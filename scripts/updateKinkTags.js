// Re-checks the kink tag list against Danbooru, discovers artists for each
// core+kink tag combo, and fills in post counts for newly found artists.
// Nothing is written unless the run completes and the result passes sanity
// checks; a refused or degraded run exits non-zero and leaves the data as is.
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
import { categorizeTags, flattenCategorizedTags, KINK_CATEGORY_RULES } from '../modules/tag-categories.js';

const DATA_DIR = process.env.DATA_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARTISTS_PATH = path.join(DATA_DIR, 'artists.json');
const KINK_TAGS_PATH = path.join(DATA_DIR, 'kink-tags.json');

// List of core tags used to limit collected tags
const coreTags = [
  'chastity_cage',
  'femdom',
  'futanari',
  'trap'
];

// Additional Danbooru kink tags to include (VALID DANBOORU TAGS ONLY)
// These tags are verified to exist on Danbooru and will be checked before adding
const extraTags = [
  // BDSM & Power Dynamics
  'bdsm',
  'bondage',
  'bound',
  'restrained',
  'immobilization',
  'leash',
  'collar',
  'chains',
  'rope',
  'cuffs',
  'gag',
  'gagged',
  'blindfold',
  'spanking',
  'sadism',
  'dominatrix',
  'femdom',
  'mistress',
  'forced',
  'assertive_female',
  'submissive',
  'submissive_male',
  'dominant',
  
  // Hypnosis & Mind Control
  'hypnosis',
  'mind_control',
  
  // Pet Play
  'pet_play',
  'viewer_on_leash',
  
  // Oral & Cum
  'oral',
  'fellatio',
  'irrumatio',
  'cum_in_mouth',
  'cum_in_ass',
  'swallowing',
  'pussy_juice',
  'precum',
  'covered_in_cum',
  'cumdump',
  
  // Condom Related
  'condom',
  'used_condom',
  'drinking_from_condom',
  'pouring_from_condom',
  
  // Cuckoldry & Relationship Betrayal (valid tags only)
  'netorare',
  'netorase',
  'felching',
  'forced_to_watch',
  'watching',
  'cuckold',
  'cuckoldry',
  'hotwife',
  'size_comparison',
  'cheating_(relationship)',
  
  // Chastity & Orgasm Control (valid tags only)
  'chastity_belt',
  'chastity_cage',
  'chastity_cage_emission',
  'orgasm_denial',
  'ruined_orgasm',
  'premature_ejaculation',
  'handsfree_ejaculation',
  'ejaculating_while_penetrated',
  'caged',
  'locked',
  'edging',
  'tease_and_denial',
  'denial',
  'orgasm_control',
  'holding_key',
  
  // Femdom Activities (valid tags only)
  'facesitting',
  'sitting_on_face',
  'cock_and_ball_torture',
  'cbt',
  'forced_submission',
  'on_all_fours',
  'kneeling',
  'worship',
  'foot_worship',
  'pegging',
  'male_penetrated',
  
  // Feminization & Crossdressing (valid tags only)
  'crossdressing',
  'crossdressing_(mtf)',
  'sissy',
  'sissification',
  'forced_feminization',
  'otoko_no_ko',
  'trap',
  'femboy',
  'genderswap',
  'genderswap_(mtf)',
  'before_and_after',
  
  // Clothing & Appearance (valid tags only)
  'panties',
  'lingerie',
  'dress',
  'high_heels',
  'makeup',
  'shaved_body',
  'pubic_hair',
  
  // Humiliation & Degradation
  'small_penis_humiliation',
  'clothed_female_nude_male',
  'assisted_exposure',
  'public_nudity',
  'public_sex',
  'exhibitionism',
  'voyeurism',
  'body_writing',
  'bullying',
  'annoyed',
  'crying',
  'begging',
  'drooling',
  'ahegao',
  'messy',
  'shamed',
  
  // Other
  'stomach_bulge',
  'sex_toy',
  'anal_fingering',
  'anal_fisting',
  'rape',
  'reverse_rape',
  'dark_skin',
  'maid',
  'nurse',
  'latex',
  'leather',
];

const MIN_ARTIST_POSTS = Number(process.env.MIN_ARTIST_POSTS || 40);
const DISCOVER_MAX_PAGES = Number(process.env.DISCOVER_MAX_PAGES || 100);
// Guards against committing a degraded result (e.g. a partially refused run).
const MAX_TAG_DROP_RATIO = Number(process.env.MAX_TAG_DROP_RATIO ?? 0.1);
const MAX_ARTIST_DROP_RATIO = Number(process.env.MAX_ARTIST_DROP_RATIO ?? 0.05);
const MAX_DISCOVER_FAILURE_RATIO = Number(process.env.MAX_DISCOVER_FAILURE_RATIO ?? 0.05);

const client = createDanbooruClient();

function normalizeTag(tag) {
  return String(tag).trim().toLowerCase().replace(/\s+/g, '_');
}

// Only drops a tag when Danbooru answers that it doesn't exist; a failed
// lookup keeps it (these lists are curated), refusals abort the run.
async function tagExistsOnDanbooru(tag) {
  try {
    return await client.tagExists(tag);
  } catch (err) {
    if (err instanceof DanbooruBlockedError) throw err;
    console.warn(`⚠️ could not verify ${tag} on Danbooru (${err.message}); keeping it`);
    return true;
  }
}

async function discoverArtistsByCoreAndKink(cores, kinkTags) {
  const combos = cores.flatMap((core) => kinkTags.map((tag) => [normalizeTag(core), normalizeTag(tag)]));
  const found = new Map();
  let failedCombos = 0;
  let done = 0;

  await mapPool(combos, client.concurrency, async ([core, tag]) => {
    const query = `${core} ${tag}`;
    for (let page = 1; page <= DISCOVER_MAX_PAGES; page++) {
      let posts;
      try {
        posts = await client.posts(query, { page, limit: 200, only: 'tag_string_artist' });
      } catch (err) {
        if (err instanceof DanbooruBlockedError) throw err;
        console.warn(`⚠️ discover failed for ${query} p${page}: ${err.message}`);
        failedCombos++;
        break;
      }
      if (!Array.isArray(posts) || posts.length === 0) break;
      for (const post of posts) {
        for (const name of String(post.tag_string_artist || '').split(' ').filter(Boolean)) {
          if (!found.has(name)) found.set(name, new Set());
          found.get(name).add(core).add(tag);
        }
      }
      if (posts.length < 200) break;
    }
    done++;
    if (done % 100 === 0 || done === combos.length) {
      console.log(`[discover ${done}/${combos.length}] ${found.size} artists found`);
    }
  });

  const failureRatio = failedCombos / Math.max(1, combos.length);
  if (failureRatio > MAX_DISCOVER_FAILURE_RATIO) {
    throw new Error(`discovery failed for ${failedCombos}/${combos.length} tag combos`);
  }
  return found;
}

function mergeDiscoveredIntoArtists(existing, discoveredMap) {
  const byName = new Map(existing.map((a) => [a.artistName, { ...a }]));
  const added = [];
  for (const [artistName, tagSet] of discoveredMap.entries()) {
    const normName = String(artistName).trim();
    const entry = byName.get(normName);
    if (entry) {
      const merged = new Set(entry.kinkTags || []);
      tagSet.forEach((t) => merged.add(t));
      entry.kinkTags = Array.from(merged).sort();
    } else {
      const newArtist = { artistName: normName, kinkTags: Array.from(tagSet).sort() };
      byName.set(normName, newArtist);
      added.push(newArtist);
    }
  }
  const updated = Array.from(byName.values()).sort((a, b) => a.artistName.localeCompare(b.artistName));
  return { updated, added };
}

async function fillCounts(list, label) {
  let filled = 0;
  await mapPool(list, client.concurrency, async (artist) => {
    try {
      const count = await client.countPosts(artist.artistName);
      if (Number.isInteger(count) && count > 0) {
        artist.postCount = count;
        filled++;
      }
    } catch (err) {
      if (err instanceof DanbooruBlockedError) throw err;
      console.warn(`⚠️ ${label} count failed for ${artist.artistName}: ${err.message}`);
    }
  });
  return filled;
}

function assertNoLargeDrop(label, before, after, maxRatio) {
  if (before > 0 && after < before * (1 - maxRatio)) {
    throw new Error(`${label} would shrink from ${before} to ${after} (> ${(maxRatio * 100).toFixed(0)}% drop); refusing to write`);
  }
}

async function updateKinkTags() {
  const artists = JSON.parse(await fs.readFile(ARTISTS_PATH, 'utf8'));
  let previousTags = [];
  try {
    previousTags = flattenCategorizedTags(JSON.parse(await fs.readFile(KINK_TAGS_PATH, 'utf8')));
  } catch {
    // first run: nothing to compare against
  }

  await client.preflight();

  const tagSet = new Set();
  for (const artist of artists) {
    const tags = artist.kinkTags || [];
    if (!tags.some((tag) => coreTags.includes(tag))) continue;
    tags.forEach((tag) => tagSet.add(tag));
  }
  for (const tag of extraTags) {
    const norm = normalizeTag(tag);
    if (await tagExistsOnDanbooru(norm)) {
      tagSet.add(norm);
    } else {
      console.warn(`⚠️ skipped tag missing on Danbooru: ${tag}`);
    }
  }
  const tags = Array.from(tagSet).sort();
  assertNoLargeDrop('kink-tags.json', previousTags.length, tags.length, MAX_TAG_DROP_RATIO);
  const categorizedTags = categorizeTags(tags, KINK_CATEGORY_RULES);

  console.log(`⏳ discovering artists across ${coreTags.length}×${tags.length} core+kink combos...`);
  const discovered = await discoverArtistsByCoreAndKink(coreTags, tags);
  const { updated, added } = mergeDiscoveredIntoArtists(artists, discovered);

  if (added.length) {
    console.log(`⏳ fetching post counts for ${added.length} new artists...`);
    await fillCounts(added, 'new-artist');
  }
  const missing = updated.filter((a) => !added.includes(a) && (!Number.isInteger(a.postCount) || a.postCount <= 0));
  if (missing.length) {
    const filled = await fillCounts(missing, 'zero-count');
    console.log(`ℹ️ refreshed ${filled}/${missing.length} zero or missing counts`);
  }

  const finalArtists = updated.filter((a) => Number.isInteger(a.postCount) && a.postCount >= MIN_ARTIST_POSTS);
  const removed = updated.length - finalArtists.length;
  if (removed > 0) console.log(`ℹ️ dropped ${removed} artists with fewer than ${MIN_ARTIST_POSTS} posts`);
  assertNoLargeDrop('artists.json', artists.length, finalArtists.length, MAX_ARTIST_DROP_RATIO);

  await fs.writeFile(KINK_TAGS_PATH, JSON.stringify(categorizedTags, null, 2) + '\n');
  console.log(`✅ kink-tags.json: ${tags.length} tags across ${categorizedTags.length} categories (was ${previousTags.length})`);
  await fs.writeFile(ARTISTS_PATH, JSON.stringify(finalArtists, null, 2) + '\n');
  console.log(
    `✅ artists.json: ${finalArtists.length} artists (${added.length} discovered, was ${artists.length}; ${client.stats.requests} requests, ${client.stats.rateLimited} rate-limited retries)`,
  );
}

updateKinkTags().catch((err) => {
  if (err instanceof DanbooruBlockedError) {
    console.error(`❌ ${formatRefusal(err.details)}\n\n${REFUSAL_HELP}`);
  } else {
    console.error('❌ Kink tag update failed; nothing was written:', err.message || err);
  }
  process.exit(1);
});
