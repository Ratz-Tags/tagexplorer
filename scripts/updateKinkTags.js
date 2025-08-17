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

// Adaptive rate limiting and concurrency
const MAX_CONCURRENCY = Number(process.env.DANBOORU_CONCURRENCY || 8);
const BASE_DELAY_MS = Number(process.env.DANBOORU_BASE_DELAY_MS || 150);
let dynamicDelay = BASE_DELAY_MS;
let _active = 0;
const _queue = [];
async function withConcurrency(fn) {
  if (_active >= MAX_CONCURRENCY) {
    await new Promise((resolve) => _queue.push(resolve));
  }
  _active++;
  try {
    return await fn();
  } finally {
    _active--;
    const next = _queue.shift();
    if (next) next();
  }
}

async function rateLimitedFetch(url, opts = {}, retries = 3) {
  // Initial delay before acquiring a slot
  if (dynamicDelay > 0) await sleep(dynamicDelay);
  return withConcurrency(async () => {
    let attempt = 0;
    while (true) {
      let resp;
      try {
        resp = await fetch(url, opts);
      } catch (err) {
        if (attempt >= retries) throw err;
        attempt++;
        dynamicDelay = Math.min(dynamicDelay * 1.5 + 50, 8000);
        await sleep(dynamicDelay);
        continue;
      }

      if (resp.status === 429 || resp.status === 503) {
        // Backoff using Retry-After if provided
        let wait = Math.max(dynamicDelay * 1.5 + 100, BASE_DELAY_MS);
        const ra = resp.headers.get('retry-after');
        if (ra) {
          if (/^\d+$/.test(ra)) {
            wait = Math.max(wait, parseInt(ra, 10) * 1000);
          } else {
            const ts = Date.parse(ra);
            if (!Number.isNaN(ts)) wait = Math.max(wait, ts - Date.now());
          }
        }
        dynamicDelay = Math.min(Math.max(dynamicDelay, Math.floor(wait / Math.max(1, MAX_CONCURRENCY))), 12000);
        if (attempt >= retries) throw new Error(`HTTP ${resp.status} after retries`);
        attempt++;
        await sleep(wait);
        continue;
      }

      if (!resp.ok && resp.status >= 500 && attempt < retries) {
        attempt++;
        dynamicDelay = Math.min(dynamicDelay * 1.5 + 100, 8000);
        await sleep(dynamicDelay);
        continue;
      }

      // Success: gently reduce delay toward base
      if (resp.ok) {
        dynamicDelay = Math.max(BASE_DELAY_MS, Math.floor(dynamicDelay * 0.9));
      }
      return resp;
    }
  });
}

function normalizeTag(tag) {
  return String(tag).trim().toLowerCase().replace(/\s+/g, '_');
}

async function tagExistsOnDanbooru(tag) {
  try {
    const norm = normalizeTag(tag);
    const resp = await rateLimitedFetch(`https://danbooru.donmai.us/tags.json?search[name]=${encodeURIComponent(norm)}&limit=1`);
    if (!resp.ok) return false;
    const data = await resp.json();
    return data.length > 0 && (data[0].name?.toLowerCase?.() === norm);
  } catch (err) {
    console.warn(`⚠️ could not verify ${tag} on Danbooru: ${err.message}`);
    return true;
  }
}

async function getPostCountForQuery(query) {
  const url = `https://danbooru.donmai.us/counts/posts.json?tags=${encodeURIComponent(query)}`;
  const resp = await rateLimitedFetch(url);
  if (!resp.ok) throw new Error(`counts failed ${resp.status}`);
  const data = await resp.json();
  return data?.counts?.posts ?? 0;
}

async function getArtistTotalCount(artistName, cache) {
  if (cache.has(artistName)) return cache.get(artistName);
  const count = await getArtistImageCount(artistName);
  cache.set(artistName, count);
  return count;
}

async function buildTagArtistCounts(tags, artists) {
  const totalCache = new Map();
  const result = {};
  for (const tag of tags) {
    const withTag = artists.filter(a => Array.isArray(a.kinkTags) && a.kinkTags.includes(tag));
    const rows = [];
    // Concurrency for per-artist tag counts
    const limit = Number(process.env.PER_TAG_CONCURRENCY || 6);
    let idx = 0;
    async function next() {
      if (idx >= withTag.length) return;
      const current = withTag[idx++];
      try {
        const tagCount = await getPostCountForQuery(`${current.artistName} ${tag}`);
        if (tagCount) {
          const totalPosts = await getArtistTotalCount(current.artistName, totalCache);
          rows.push({ artistName: current.artistName, tagCount, totalPosts });
        }
      } catch (e) {
        console.warn(`⚠️ count failed for ${current.artistName} ${tag}: ${e.message}`);
      }
      return next();
    }
    await Promise.all(Array.from({ length: limit }, next));
    rows.sort((a, b) => b.tagCount - a.tagCount);
    result[tag] = rows;
  }
  return result;
}

async function fetchPostsForQuery(query, page = 1, limit = 100) {
  const url = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(query)}&limit=${limit}&page=${page}`;
  const resp = await rateLimitedFetch(url);
  if (!resp.ok) throw new Error(`posts failed ${resp.status}`);
  return await resp.json();
}

async function discoverArtistsByCoreAndKink(coreTags, kinkTags, options = {}) {
  const { maxPages = 100, perPage = 200, maxArtistsPerCombo = 0 } = options;
  const found = new Map();
  for (const core of coreTags) {
    for (const tag of kinkTags) {
      const q = `${normalizeTag(core)} ${normalizeTag(tag)}`;
      const collectedForCombo = new Set();
      for (let p = 1; p <= maxPages; p++) {
        let posts = [];
        try {
          posts = await fetchPostsForQuery(q, p, perPage);
        } catch (e) {
          console.warn(`⚠️ discover failed for ${q} p${p}: ${e.message}`);
          break;
        }
        if (!Array.isArray(posts) || posts.length === 0) break;
        for (const post of posts) {
          const artistsStr = post.tag_string_artist || "";
          if (!artistsStr) continue;
          const names = artistsStr.split(" ").filter(Boolean);
          for (const name of names) {
            collectedForCombo.add(name);
            if (!found.has(name)) found.set(name, new Set());
            const set = found.get(name);
            set.add(normalizeTag(core));
            set.add(normalizeTag(tag));
          }
          if (maxArtistsPerCombo && collectedForCombo.size >= maxArtistsPerCombo) break;
        }
        if (maxArtistsPerCombo && collectedForCombo.size >= maxArtistsPerCombo) break;
        if (posts.length < perPage) break; // last page
      }
    }
  }
  return found;
}

function mergeDiscoveredIntoArtists(existing, discoveredMap) {
  const byName = new Map(existing.map((a) => [a.artistName, a]));
  const added = [];
  for (const [artistName, tagSet] of discoveredMap.entries()) {
    const normName = String(artistName).trim();
    const addTags = Array.from(tagSet);
    const entry = byName.get(normName);
    if (entry) {
      const s = new Set(entry.kinkTags || []);
      addTags.forEach((t) => s.add(t));
      entry.kinkTags = Array.from(s).sort();
    } else {
      const newArtist = { artistName: normName, kinkTags: addTags.sort() };
      byName.set(normName, newArtist);
      added.push(newArtist);
    }
  }
  const updated = Array.from(byName.values()).sort((a, b) => a.artistName.localeCompare(b.artistName));
  return { updated, added };
}

async function consolidateCountsFromKinkTagArtists(artists) {
  let data;
  try {
    const raw = await fs.readFile('kink-tag-artists.json', 'utf8');
    data = JSON.parse(raw);
  } catch {
    return { artists, changed: false }; // File not present; nothing to consolidate
  }
  const byNameMax = new Map();
  for (const tag of Object.keys(data || {})) {
    const rows = Array.isArray(data[tag]) ? data[tag] : [];
    for (const row of rows) {
      const name = row?.artistName;
      const total = Number(row?.totalPosts || 0);
      if (!name) continue;
      const prev = byNameMax.get(name) || 0;
      if (total > prev) byNameMax.set(name, total);
    }
  }
  if (byNameMax.size === 0) return { artists, changed: false };
  let changed = false;
  const updated = artists.map((a) => {
    const max = byNameMax.get(a.artistName);
    if (typeof max === 'number' && max >= 0 && a.postCount !== max) {
      changed = true;
      return { ...a, postCount: max };
    }
    return a;
  });
  return { artists: updated, changed };
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

  // Discover artists by (coreTag + kinkTag) and augment artists.json
  console.log('⏳ discovering artists by core+kink tags...');
  const discovered = await discoverArtistsByCoreAndKink(coreTags, tags, { maxPages: 100, perPage: 200, maxArtistsPerCombo: 0 });
  const { updated: updatedArtists, added } = mergeDiscoveredIntoArtists(artists, discovered);

  // Set postCount for newly added artists with limited concurrency
  if (added.length) {
    const limit = Number(process.env.NEW_ARTIST_COUNT_CONCURRENCY || 6);
    let i = 0;
    async function next() {
      if (i >= added.length) return;
      const a = added[i++];
      try {
        const c = await getArtistImageCount(a.artistName, { force: true });
        if (Number.isInteger(c) && c > 0) a.postCount = c;
      } catch (e) {
        console.warn(`⚠️ postCount failed for ${a.artistName}: ${e.message}`);
      }
      return next();
    }
    await Promise.all(Array.from({ length: limit }, next));
  }

  // Consolidate counts from existing kink-tag-artists.json (if present)
  const consolidated = await consolidateCountsFromKinkTagArtists(updatedArtists);
  let finalArtists = consolidated.artists;

  // Remove artists below minimum post count threshold (configurable)
  const MIN_ARTIST_POSTS = Number(process.env.MIN_ARTIST_POSTS || 40);
  const beforeCount = finalArtists.length;
  const removedArtists = finalArtists.filter(a => !(Number.isInteger(a.postCount) && a.postCount >= MIN_ARTIST_POSTS));
  finalArtists = finalArtists.filter(a => Number.isInteger(a.postCount) && a.postCount >= MIN_ARTIST_POSTS);
  const removedCount = beforeCount - finalArtists.length;
  if (removedCount > 0) {
    console.log(`ℹ️ removed ${removedCount} artists with postCount < ${MIN_ARTIST_POSTS}`);
    if (removedArtists.length <= 50) console.log('Removed artists:', removedArtists.map(a => a.artistName).join(', '));
    else console.log('Removed sample:', removedArtists.slice(0,50).map(a => a.artistName).join(', ') + ' …');
  }

  let changed = JSON.stringify(artists) !== JSON.stringify(finalArtists);
  if (changed) {
    await fs.writeFile('artists.json', JSON.stringify(finalArtists, null, 2) + '\n');
    console.log(`✅ artists.json updated (consolidated counts${added.length ? `, ${added.length} new` : ''})`);
  } else {
    console.log('ℹ️ no changes to artists.json');
  }

  // Always refresh zero/missing counts (fast pass) unless explicitly disabled
  const REFRESH_ZERO_COUNTS = process.env.REFRESH_ZERO_COUNTS !== '0';
  if (REFRESH_ZERO_COUNTS) {
    const zeroList = finalArtists.filter(a => !Number.isInteger(a.postCount) || a.postCount <= 0);
    if (zeroList.length) {
      console.log(`⏳ refreshing ${zeroList.length} zero/missing artist post counts...`);
      const limit = Number(process.env.ZERO_COUNT_CONCURRENCY || process.env.REFRESH_COUNTS_CONCURRENCY || 8);
      let i = 0;
      let anyChanged = false;
      async function next() {
        if (i >= zeroList.length) return;
        const a = zeroList[i++];
        try {
          const c = await getArtistImageCount(a.artistName, { force: true });
          if (Number.isInteger(c) && c > 0) {
            a.postCount = c;
            anyChanged = true;
          }
        } catch (e) {
          console.warn(`⚠️ zero-count refresh failed for ${a.artistName}: ${e.message}`);
        }
        return next();
      }
      await Promise.all(Array.from({ length: limit }, next));
      if (anyChanged) {
        await fs.writeFile('artists.json', JSON.stringify(finalArtists, null, 2) + '\n');
        console.log('✅ artists.json zero/missing counts refreshed');
      } else {
        console.log('ℹ️ no zero/missing counts could be refreshed');
      }
    }
  }

  // Optional: refresh all counts from API if requested
  if (process.env.REFRESH_ALL_COUNTS === '1') {
    console.log('⏳ refreshing all artist post counts from API...');
    const limit = Number(process.env.REFRESH_COUNTS_CONCURRENCY || 8);
    let i = 0;
    async function next() {
      if (i >= finalArtists.length) return;
      const a = finalArtists[i++];
      try {
        const c = await getArtistImageCount(a.artistName, { force: true });
        if (Number.isInteger(c) && c >= 0) a.postCount = c;
      } catch (e) {
        console.warn(`⚠️ refresh count failed for ${a.artistName}: ${e.message}`);
      }
      return next();
    }
    await Promise.all(Array.from({ length: limit }, next));
    await fs.writeFile('artists.json', JSON.stringify(finalArtists, null, 2) + '\n');
    console.log('✅ artists.json counts refreshed');
  }

  // Skip generating kink-tag-artists.json to save time
  console.log('ℹ️ skipping kink-tag-artists.json generation.');
}

updateKinkTags().catch(err => {
  console.error('Failed to update kink tags:', err);
  process.exit(1);
});
