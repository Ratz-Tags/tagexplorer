import { deepClone } from './utils.js';

const DATA_FILES = {
  artists: '../../../data/artists.json',
  tags: '../../../data/tags.json',
  tts: '../../../data/tts_lines.json'
};

const cache = {
  artists: null,
  tags: null,
  tts: null
};

let preloadPromise = null;

function resolveDataUrl(relativePath) {
  return new URL(relativePath, import.meta.url).href;
}

async function fetchJson(relativePath) {
  const url = resolveDataUrl(relativePath);
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${relativePath}: ${response.status}`);
  }
  return response.json();
}

async function loadAll() {
  const [artists, tags, tts] = await Promise.all([
    fetchJson(DATA_FILES.artists),
    fetchJson(DATA_FILES.tags),
    fetchJson(DATA_FILES.tts)
  ]);

  cache.artists = artists;
  cache.tags = tags;
  cache.tts = tts;

  return {
    artists,
    tags,
    tts
  };
}

export async function preloadDataset() {
  if (!preloadPromise) {
    preloadPromise = loadAll().catch((error) => {
      preloadPromise = null;
      throw error;
    });
  }

  const dataset = await preloadPromise;
  return deepClone(dataset);
}

export function getDatasetSync() {
  if (!cache.artists || !cache.tags || !cache.tts) {
    return null;
  }
  return deepClone(cache);
}

export function getArtistById(id) {
  const dataset = cache.artists || [];
  return dataset.find((artist) => artist.artist_id === id) ?? null;
}
