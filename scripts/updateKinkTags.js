import fs from 'fs/promises';
import { getArtistImageCount } from '../modules/api.js';

// List of core tags used to limit collected tags
const coreTags = [
  'chastity_cage',
  'femdom',
  'futanari',
  'trap'
];

// Additional Danbooru kink tags to include
const extraTags = [
  'bdsm',
  'hypnosis',
  'leash',
  'pet_play',
  'spanking',
  'dark_skin',
  'mind_control',
  'oral',
  'cum_in_mouth',
  'cum_in_ass',
  'swallowing',
  'cheating_(relationship)',
  'pubic_hair',
  'fellatio',
  'irrumatio',
  'rape',
  'condom',
  'drinking_from_condom',
  'forced',
  'crossdressing_(mtf)',
  'stomach_bulge',
  'before_and_after',
  'chastity_cage_emission',
  'crossdressing',
  'male_penetrated',
  'precum',
  'bdsm',
  'bound',
  'immobilization',
  'restrained',
  'bondage',
  'sex_toy',
  'clothed_female_nude_male',
  'leash',
  'gag',
  'pussy_juice',
  'assertive_female',
  'anal_fingering',
  'anal_fisting',
  'handsfree_ejaculation',
  'ejaculating_while_penetrated',
  'small_penis_humiliation',
  'premature_ejaculation',
  'viewer_on_leash',
  'annoyed',
  'sadism',
  'public_nudity',
  'bullying',
  'body_writing',
  'cumdump',
  'assisted_exposure'
];

// Basic throttle to avoid hammering Danbooru
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const RATE_DELAY_MS = 300;

function normalizeTag(tag) {
  return String(tag).trim().toLowerCase().replace(/\s+/g, '_');
}

async function tagExistsOnDanbooru(tag) {
  try {
    const norm = normalizeTag(tag);
    const resp = await fetch(`https://danbooru.donmai.us/tags.json?search[name]=${encodeURIComponent(norm)}&limit=1`);
    if (!resp.ok) return false;
    const data = await resp.json();
    return data.length > 0 && (data[0].name?.toLowerCase?.() === norm);
  } catch (err) {
    console.warn(`⚠️ could not verify ${tag} on Danbooru: ${err.message}`);
    // Assume valid if verification fails so tags can still be added
    return true;
  }
}

async function getPostCountForQuery(query) {
  // Danbooru counts API
  const url = `https://danbooru.donmai.us/counts/posts.json?tags=${encodeURIComponent(query)}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`counts failed ${resp.status}`);
  const data = await resp.json();
  return data?.counts?.posts ?? 0;
}

async function getArtistTotalCount(artistName, cache) {
  if (cache.has(artistName)) return cache.get(artistName);
  const count = await getArtistImageCount(artistName);
  cache.set(artistName, count);
  await sleep(RATE_DELAY_MS);
  return count;
}

async function buildTagArtistCounts(tags, artists) {
  const totalCache = new Map();
  const result = {};
  for (const tag of tags) {
    // Only consider artists we already mark with this tag
    const withTag = artists.filter(a => Array.isArray(a.kinkTags) && a.kinkTags.includes(tag));
    const rows = [];
    for (const artist of withTag) {
      const artistName = artist.artistName;
      // Count posts that match artist + tag
      let tagCount = 0;
      try {
        tagCount = await getPostCountForQuery(`${artistName} ${tag}`);
      } catch (e) {
        console.warn(`⚠️ count failed for ${artistName} ${tag}: ${e.message}`);
      }
      await sleep(RATE_DELAY_MS);

      // Skip artists with zero posts for this tag
      if (!tagCount) continue;

      // Get total posts for artist (cached)
      let totalPosts = 0;
      try {
        totalPosts = await getArtistTotalCount(artistName, totalCache);
      } catch (e) {
        console.warn(`⚠️ total count failed for ${artistName}: ${e.message}`);
      }

      rows.push({ artistName, tagCount, totalPosts });
    }
    // Sort by tagCount desc
    rows.sort((a, b) => b.tagCount - a.tagCount);
    result[tag] = rows;
  }
  return result;
}

async function updateKinkTags() {
  let artists;
  try {
    artists = JSON.parse(await fs.readFile('artists.json', 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error("Error: 'artists.json' file not found. Please ensure the file exists in the current directory.");
      process.exit(1);
    } else {
      throw err;
    }
  }
  const tagSet = new Set();

  for (const artist of artists) {
    const tags = artist.kinkTags || [];
    if (!tags.some(tag => coreTags.includes(tag))) continue;
    tags.forEach(tag => tagSet.add(tag));
  }

  for (const tag of extraTags) {
    const norm = normalizeTag(tag);
    if (await tagExistsOnDanbooru(norm)) {
      tagSet.add(norm);
    } else {
      console.warn(`⚠️ skipped invalid Danbooru tag: ${tag} -> ${norm}`);
    }
  }

  const tags = Array.from(new Set(tagSet)).sort();
  await fs.writeFile('kink-tags.json', JSON.stringify(tags, null, 2) + '\n');
  console.log(`✅ kink-tags.json updated with ${tags.length} tags`);

  // NEW: Build per-tag artist counts (for artists in artists.json)
  console.log('⏳ fetching per-tag artist counts from Danbooru...');
  const tagArtistCounts = await buildTagArtistCounts(tags, artists);
  await fs.writeFile('kink-tag-artists.json', JSON.stringify(tagArtistCounts, null, 2) + '\n');
  console.log('✅ wrote kink-tag-artists.json');
}

updateKinkTags().catch(err => {
  console.error('Failed to update kink tags:', err);
  process.exit(1);
});
