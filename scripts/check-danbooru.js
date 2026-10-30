// Verifies this machine can reach the Danbooru API the way the updaters do.
// Runs before every scheduled update (and on PRs touching the updaters) so a
// refusal fails the job loudly, with the response details, instead of letting
// the updaters produce stale or degraded data.
import fs from 'fs/promises';
import {
  createDanbooruClient,
  DanbooruBlockedError,
  formatRefusal,
  hasCredentials,
  REFUSAL_HELP,
  USER_AGENT,
} from './lib/danbooru.js';

async function writeStepSummary(markdown) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  try {
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  } catch {
    // summary is best-effort
  }
}

const auth = hasCredentials() ? 'API key (DANBOORU_LOGIN)' : 'anonymous';
console.log(`User-Agent: ${USER_AGENT}`);
console.log(`Auth: ${auth}`);

try {
  await createDanbooruClient().preflight();
  console.log('✅ Danbooru API reachable (counts, posts, tags)');
  await writeStepSummary(`✅ Danbooru API reachable — ${auth}`);
} catch (err) {
  const details = err instanceof DanbooruBlockedError ? formatRefusal(err.details) : String(err?.message || err);
  console.error(`❌ Danbooru API check failed\n${details}\n\n${REFUSAL_HELP}`);
  if (process.env.GITHUB_ACTIONS) {
    console.log(`::error title=Danbooru API unreachable::${details.split('\n')[0]}`);
  }
  await writeStepSummary(
    ['### ❌ Danbooru API check failed', '', '```', details, '```', '', REFUSAL_HELP].join('\n'),
  );
  process.exit(1);
}
