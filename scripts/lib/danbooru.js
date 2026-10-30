// Node client for the Danbooru API, shared by the data-update scripts (GitHub
// Actions or a local run). Unlike the browser client in modules/api.js it
// identifies itself with a descriptive User-Agent, supports API-key auth, and
// surfaces refusals instead of quietly falling back to stale values — that
// silent fallback hid months of HTTP 403s from the scheduled workflows.

const BASE_URL = (process.env.DANBOORU_BASE_URL || 'https://danbooru.donmai.us').replace(/\/+$/, '');

export const USER_AGENT =
  process.env.DANBOORU_USER_AGENT ||
  'TagExplorer-DataUpdater/2.0 (+https://github.com/Ratz-Tags/tagexplorer)';

const LOGIN = process.env.DANBOORU_LOGIN || '';
const API_KEY = process.env.DANBOORU_API_KEY || '';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Unread bodies keep undici connections busy; release them on error paths.
async function discard(resp) {
  try {
    await resp.body?.cancel();
  } catch {
    // already consumed or closed
  }
}

export class DanbooruBlockedError extends Error {
  constructor(details) {
    super(`Danbooru refused the request (HTTP ${details.status})`);
    this.name = 'DanbooruBlockedError';
    this.details = details;
  }
}

export class DanbooruRequestError extends Error {
  constructor(status, url) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'DanbooruRequestError';
    this.status = status;
  }
}

export function hasCredentials() {
  return Boolean(LOGIN && API_KEY);
}

function buildHeaders() {
  const headers = { Accept: 'application/json', 'User-Agent': USER_AGENT };
  if (hasCredentials()) {
    headers.Authorization = `Basic ${Buffer.from(`${LOGIN}:${API_KEY}`).toString('base64')}`;
  }
  return headers;
}

async function describeRefusal(resp, url) {
  let body = '';
  try {
    body = (await resp.text()).replace(/\s+/g, ' ').trim().slice(0, 240);
  } catch {
    // body unavailable
  }
  return {
    status: resp.status,
    url: url.replace(/api_key=[^&]+/, 'api_key=***'),
    server: resp.headers.get('server') || '',
    cfRay: resp.headers.get('cf-ray') || '',
    cfMitigated: resp.headers.get('cf-mitigated') || '',
    body,
  };
}

export function formatRefusal(details) {
  const lines = [
    `HTTP ${details.status} from ${details.url}`,
    `server: ${details.server || 'n/a'}${details.cfRay ? `, cf-ray: ${details.cfRay}` : ''}${
      details.cfMitigated ? `, cf-mitigated: ${details.cfMitigated}` : ''
    }`,
  ];
  if (details.body) lines.push(`body: ${details.body}`);
  return lines.join('\n');
}

export const REFUSAL_HELP = [
  'Danbooru is refusing requests from this machine, so no data was written.',
  hasCredentials()
    ? 'Requests were authenticated (DANBOORU_LOGIN); check that the API key is valid and has API read access.'
    : 'Add DANBOORU_LOGIN and DANBOORU_API_KEY (Danbooru: My Account → API Key) as repository secrets so requests are authenticated.',
  'If it still fails on GitHub Actions, run `npm run update:data` locally and push the result.',
].join('\n');

// Runs fn over items with at most `limit` in flight; rejects on the first error.
export async function mapPool(items, limit, fn) {
  let index = 0;
  const worker = async () => {
    while (index < items.length) {
      const item = items[index++];
      await fn(item);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
}

export function createDanbooruClient(options = {}) {
  const concurrency = Number(options.concurrency ?? process.env.DANBOORU_CONCURRENCY ?? 3);
  // Danbooru answers bursts with HTTP 429, so request starts are spaced
  // globally (the old updater ran ~6 req/s for months without trouble).
  const ratePerSecond = Number(options.ratePerSecond ?? process.env.DANBOORU_RATE ?? 5);
  const minInterval = ratePerSecond > 0 && Number.isFinite(ratePerSecond) ? 1000 / ratePerSecond : 0;
  const maxRetries = Number(options.maxRetries ?? 3); // network errors and 5xx
  const maxRateLimitRetries = Number(options.maxRateLimitRetries ?? 8);
  const rateLimitBackoffMs = Number(options.rateLimitBackoffMs ?? 2000);
  // Consecutive 401/403 responses tolerated before the whole run is aborted.
  const blockThreshold = Number(options.blockThreshold ?? 5);

  let interval = minInterval;
  let nextStartAt = 0;
  let pausedUntil = 0;
  let rateLimitStreak = 0;
  let active = 0;
  const waiting = [];
  let consecutiveRefusals = 0;
  let blockedError = null;
  const stats = { requests: 0, ok: 0, refused: 0, rateLimited: 0, failed: 0 };

  async function withSlot(fn) {
    if (active >= concurrency) {
      await new Promise((resolve) => waiting.push(resolve));
    }
    active++;
    try {
      return await fn();
    } finally {
      active--;
      const next = waiting.shift();
      if (next) next();
    }
  }

  // Waits for this request's start slot; a 429 pauses every request.
  async function waitTurn() {
    for (;;) {
      const wait = Math.max(pausedUntil, nextStartAt) - Date.now();
      if (wait <= 0) break;
      await sleep(wait);
    }
    nextStartAt = Math.max(Date.now(), nextStartAt) + interval;
  }

  async function request(path, params = {}) {
    if (blockedError) throw blockedError;
    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
    const href = url.toString();

    return withSlot(async () => {
      let attempt = 0;
      let rateLimitedAttempts = 0;
      for (;;) {
        if (blockedError) throw blockedError;
        await waitTurn();
        stats.requests++;

        let resp;
        try {
          resp = await fetch(href, { headers: buildHeaders() });
        } catch (err) {
          if (attempt++ >= maxRetries) {
            stats.failed++;
            throw err;
          }
          await sleep(Math.min(500 * 2 ** attempt, 8000));
          continue;
        }

        if (resp.status === 401 || resp.status === 403) {
          stats.refused++;
          consecutiveRefusals++;
          const details = await describeRefusal(resp, href);
          if (consecutiveRefusals >= blockThreshold) {
            blockedError = new DanbooruBlockedError(details);
            throw blockedError;
          }
          throw new DanbooruRequestError(resp.status, details.url);
        }

        if (resp.status === 429) {
          await discard(resp);
          stats.rateLimited++;
          if (rateLimitedAttempts++ >= maxRateLimitRetries) {
            stats.failed++;
            throw new DanbooruRequestError(resp.status, href);
          }
          rateLimitStreak++;
          const retryAfter = resp.headers.get('retry-after');
          const retryAfterMs = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : 0;
          const backoff = Math.min(rateLimitBackoffMs * 2 ** Math.min(rateLimitStreak - 1, 5), 60000);
          pausedUntil = Math.max(pausedUntil, Date.now() + Math.max(backoff, retryAfterMs));
          // Run slower for a while; successes ease it back to the base rate.
          interval = Math.min(Math.max(interval, 50) * 1.5, 2000);
          continue;
        }

        if (resp.status >= 500) {
          await discard(resp);
          if (attempt++ >= maxRetries) {
            stats.failed++;
            throw new DanbooruRequestError(resp.status, href);
          }
          await sleep(Math.min(500 * 2 ** attempt, 8000));
          continue;
        }

        consecutiveRefusals = 0;
        rateLimitStreak = 0;
        if (!resp.ok) {
          await discard(resp);
          stats.failed++;
          throw new DanbooruRequestError(resp.status, href);
        }
        stats.ok++;
        interval = Math.max(minInterval, interval * 0.97);
        return resp.json();
      }
    });
  }

  async function countPosts(tags) {
    const data = await request('/counts/posts.json', { tags });
    const count = data?.counts?.posts;
    if (typeof count !== 'number') throw new Error(`Unexpected counts response for "${tags}"`);
    return count;
  }

  async function tagExists(name) {
    const data = await request('/tags.json', { 'search[name]': name, limit: 1, only: 'name' });
    return Array.isArray(data) && data.some((tag) => String(tag?.name).toLowerCase() === name);
  }

  function posts(tags, { page = 1, limit = 200, only } = {}) {
    return request('/posts.json', { tags, page, limit, only });
  }

  // One request per endpoint the updaters use. Throws DanbooruBlockedError
  // (with the response details) if any of them is refused.
  async function preflight() {
    const probe = createDanbooruClient({ concurrency: 1, ratePerSecond: Infinity, maxRetries: 2, blockThreshold: 1 });
    await probe.countPosts('femdom');
    await probe.posts('femdom', { limit: 1, only: 'id' });
    await probe.tagExists('femdom');
  }

  return {
    concurrency,
    stats,
    request,
    countPosts,
    tagExists,
    posts,
    preflight,
    isBlocked: () => Boolean(blockedError),
  };
}
