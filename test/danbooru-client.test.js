import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

// Local stand-in for Danbooru; each test sets `respond` to script its replies.
let respond = () => [200, { counts: { posts: 1 } }];
const seen = [];
const server = http.createServer((req, res) => {
  seen.push({ url: req.url, ua: req.headers['user-agent'], auth: req.headers.authorization });
  const [status, body, headers = {}] = respond(req);
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
process.env.DANBOORU_BASE_URL = `http://127.0.0.1:${server.address().port}`;
process.env.DANBOORU_LOGIN = 'tester';
process.env.DANBOORU_API_KEY = 'secret';

const { createDanbooruClient, DanbooruBlockedError, USER_AGENT } = await import('../scripts/lib/danbooru.js');
const fastClient = (opts = {}) => createDanbooruClient({ ratePerSecond: Infinity, rateLimitBackoffMs: 20, ...opts });

test.after(() => server.close());

test('sends an identifying User-Agent and basic auth', async () => {
  seen.length = 0;
  respond = () => [200, { counts: { posts: 42 } }];
  assert.equal(await fastClient().countPosts('some_artist'), 42);
  assert.equal(seen[0].ua, USER_AGENT);
  assert.notEqual(seen[0].ua, 'node');
  assert.equal(seen[0].auth, `Basic ${Buffer.from('tester:secret').toString('base64')}`);
});

test('retries server errors before succeeding', async () => {
  let calls = 0;
  respond = () => (++calls < 3 ? [502, 'bad gateway'] : [200, { counts: { posts: 7 } }]);
  assert.equal(await fastClient().countPosts('flaky'), 7);
  assert.equal(calls, 3);
});

test('rides out 429 rate limiting instead of failing', async () => {
  let calls = 0;
  respond = () => (++calls <= 3 ? [429, 'slow down', { 'retry-after': '0' }] : [200, { counts: { posts: 9 } }]);
  const client = fastClient();
  assert.equal(await client.countPosts('busy'), 9);
  assert.equal(client.stats.rateLimited, 3);
  assert.equal(client.stats.failed, 0);
});

test('spaces request starts to the configured rate', async () => {
  respond = () => [200, { counts: { posts: 1 } }];
  const client = createDanbooruClient({ ratePerSecond: 20, concurrency: 5 });
  const started = Date.now();
  await Promise.all(Array.from({ length: 5 }, (_, i) => client.countPosts(`t${i}`)));
  assert.ok(Date.now() - started >= 180, 'five requests at 20/s take at least ~200ms');
});

test('repeated 403s trip the breaker and stop all further requests', async () => {
  seen.length = 0;
  respond = () => [403, '<title>Just a moment...</title>', { server: 'cloudflare', 'cf-mitigated': 'challenge' }];
  const client = fastClient({ blockThreshold: 3 });
  for (let i = 0; i < 2; i++) {
    await assert.rejects(client.countPosts(`a${i}`), (err) => !(err instanceof DanbooruBlockedError));
  }
  await assert.rejects(client.countPosts('a2'), (err) => {
    assert.ok(err instanceof DanbooruBlockedError);
    assert.equal(err.details.status, 403);
    assert.equal(err.details.cfMitigated, 'challenge');
    return true;
  });
  const before = seen.length;
  await assert.rejects(client.countPosts('a3'), DanbooruBlockedError);
  assert.equal(seen.length, before, 'no request sent once blocked');
  assert.ok(client.isBlocked());
});

test('preflight reports a refusal immediately', async () => {
  respond = () => [403, 'denied'];
  await assert.rejects(fastClient().preflight(), DanbooruBlockedError);
});

test('tagExists distinguishes missing tags from present ones', async () => {
  respond = (req) => [200, req.url.includes('real_tag') ? [{ name: 'real_tag' }] : []];
  const client = fastClient();
  assert.equal(await client.tagExists('real_tag'), true);
  assert.equal(await client.tagExists('fake_tag'), false);
});
