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
  const concurrency = Number(options.concurrency ?? process.env.DANBOORU_CONCURRENCY ?? 6);
  const baseDelay = Number(options.baseDelayMs ?? process.env.DANBOORU_BASE_DELAY_MS ?? 150);
  const maxRetries = Number(options.maxRetries ?? 3);
  // Consecutive 401/403 responses tolerated before the whole run is aborted.
  const blockThreshold = Number(options.blockThreshold ?? 5);

  let delay = baseDelay;
  let active = 0;
  const waiting = [];
  let consecutiveRefusals = 0;
  let blockedError = null;
  const stats = { requests: 0, ok: 0, refused: 0, failed: 0 };

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

  async function request(path, params = {}) {
    if (blockedError) throw blockedError;
    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
    const href = url.toString();

    return withSlot(async () => {
      for (let attempt = 0; ; attempt++) {
        if (blockedError) throw blockedError;
        if (delay > 0) await sleep(delay);
        stats.requests++;

        let resp;
        try {
          resp = await fetch(href, { headers: buildHeaders() });
        } catch (err) {
          if (attempt >= maxRetries) {
            stats.failed++;
            throw err;
          }
          delay = Math.min(delay * 1.5 + 100, 8000);
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

        if (resp.status === 429 || resp.status >= 500) {
          await discard(resp);
          if (attempt >= maxRetries) {
            stats.failed++;
            throw new DanbooruRequestError(resp.status, href);
          }
          let wait = Math.max(delay * 1.5 + 100, 500);
          const retryAfter = resp.headers.get('retry-after');
          if (retryAfter && /^\d+$/.test(retryAfter)) wait = Math.max(wait, Number(retryAfter) * 1000);
          delay = Math.min(Math.max(delay, Math.floor(wait / Math.max(1, concurrency))), 12000);
          await sleep(wait);
          continue;
        }

        consecutiveRefusals = 0;
        if (!resp.ok) {
          await discard(resp);
          stats.failed++;
          throw new DanbooruRequestError(resp.status, href);
        }
        stats.ok++;
        delay = Math.max(baseDelay, Math.floor(delay * 0.9));
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
    const probe = createDanbooruClient({ concurrency: 1, baseDelayMs: 0, maxRetries: 2, blockThreshold: 1 });
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
