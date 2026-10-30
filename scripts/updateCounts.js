// Refreshes postCount for every artist in artists.json from Danbooru.
// Exits non-zero without writing if Danbooru refuses the run or too many
// lookups fail, so the workflow goes red instead of committing stale counts.
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  createDanbooruClient,
  DanbooruBlockedError,
  formatRefusal,
  mapPool,
  REFUSAL_HELP,
} from './lib/danbooru.js';

const DATA_DIR = process.env.DATA_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARTISTS_PATH = path.join(DATA_DIR, 'artists.json');
// Share of artists whose lookup may fail before the run is rejected.
const MAX_FAILURE_RATIO = Number(process.env.MAX_FAILURE_RATIO ?? 0.05);

async function updateCounts() {
  const artists = JSON.parse(await fs.readFile(ARTISTS_PATH, 'utf8'));
  const client = createDanbooruClient();
  await client.preflight();

  const failed = [];
  const zeroed = [];
  let changed = 0;
  let done = 0;

  await mapPool(artists, client.concurrency, async (artist) => {
    const prev = Number.isInteger(artist.postCount) ? artist.postCount : 0;
    let count = prev;
    try {
      count = await client.countPosts(artist.artistName);
    } catch (err) {
      if (err instanceof DanbooruBlockedError) throw err;
      failed.push(artist.artistName);
    }
    // Zero usually means the artist tag was renamed or aliased; keep the last
    // known count and report it rather than wiping the artist out.
    if (count === 0 && prev > 0) {
      zeroed.push(artist.artistName);
      count = prev;
    }
    if (count !== artist.postCount) {
      artist.postCount = count;
      changed++;
    }
    done++;
    if (done % 500 === 0 || done === artists.length) {
      console.log(`[${done}/${artists.length}] ${changed} changed, ${failed.length} failed`);
    }
  });

  if (zeroed.length) {
    console.warn(`⚠️ ${zeroed.length} artists returned 0 posts (kept previous count): ${zeroed.slice(0, 30).join(', ')}${zeroed.length > 30 ? ' …' : ''}`);
  }
  const failureRatio = failed.length / Math.max(1, artists.length);
  if (failureRatio > MAX_FAILURE_RATIO) {
    console.error(
      `❌ ${failed.length}/${artists.length} count lookups failed (> ${(MAX_FAILURE_RATIO * 100).toFixed(0)}%); artists.json left unchanged.`,
    );
    process.exitCode = 1;
    return;
  }
  if (failed.length) {
    console.warn(`⚠️ ${failed.length} lookups failed (kept previous count): ${failed.slice(0, 30).join(', ')}${failed.length > 30 ? ' …' : ''}`);
  }

  await fs.writeFile(ARTISTS_PATH, JSON.stringify(artists, null, 2) + '\n');
  console.log(
    `✅ artists.json written: ${changed} counts changed (${client.stats.requests} requests, ${client.stats.rateLimited} rate-limited retries)`,
  );
}

updateCounts().catch((err) => {
  if (err instanceof DanbooruBlockedError) {
    console.error(`❌ ${formatRefusal(err.details)}\n\n${REFUSAL_HELP}`);
  } else {
    console.error('❌ Count update failed:', err);
  }
  process.exit(1);
});
