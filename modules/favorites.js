/**
 * Favorites Module - Manages favorited/pinned artists with persistent storage
 */

const FAVORITES_STORAGE_KEY = 'tagexplorer_favorites';

// Favorites stored as Set of artist names
let favoriteArtists = new Set();

/**
 * Load favorites from localStorage
 */
export function loadFavorites() {
  try {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      favoriteArtists = new Set(Array.isArray(parsed) ? parsed : []);
      console.log(`Loaded ${favoriteArtists.size} favorite artists`);
    }
  } catch (error) {
    console.warn('Failed to load favorites:', error);
    favoriteArtists = new Set();
  }
  return favoriteArtists;
}

/**
 * Save favorites to localStorage
 */
function saveFavorites() {
  try {
    const array = Array.from(favoriteArtists);
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(array));
    console.log(`Saved ${favoriteArtists.size} favorite artists`);
  } catch (error) {
    console.warn('Failed to save favorites:', error);
  }
}

/**
 * Add artist to favorites
 */
export function addFavorite(artistName) {
  if (!artistName) return false;
  
  const wasAdded = !favoriteArtists.has(artistName);
  favoriteArtists.add(artistName);
  
  if (wasAdded) {
    saveFavorites();
    dispatchFavoritesChanged('added', artistName);
  }
  
  return wasAdded;
}

/**
 * Remove artist from favorites
 */
export function removeFavorite(artistName) {
  if (!artistName) return false;
  
  const wasRemoved = favoriteArtists.has(artistName);
  favoriteArtists.delete(artistName);
  
  if (wasRemoved) {
    saveFavorites();
    dispatchFavoritesChanged('removed', artistName);
  }
  
  return wasRemoved;
}

/**
 * Toggle favorite status
 */
export function toggleFavorite(artistName) {
  if (!artistName) return false;
  
  const isFavorite = favoriteArtists.has(artistName);
  
  if (isFavorite) {
    removeFavorite(artistName);
    return false; // Now not favorited
  } else {
    addFavorite(artistName);
    return true; // Now favorited
  }
}

/**
 * Check if artist is favorited
 */
export function isFavorite(artistName) {
  return artistName ? favoriteArtists.has(artistName) : false;
}

/**
 * Get all favorite artist names
 */
export function getAllFavorites() {
  return Array.from(favoriteArtists);
}

/**
 * Get count of favorites
 */
export function getFavoritesCount() {
  return favoriteArtists.size;
}

/**
 * Clear all favorites
 */
export function clearAllFavorites() {
  const count = favoriteArtists.size;
  favoriteArtists.clear();
  saveFavorites();
  dispatchFavoritesChanged('cleared');
  return count;
}

/**
 * Export favorites as JSON
 */
export function exportFavorites() {
  return JSON.stringify(Array.from(favoriteArtists), null, 2);
}

/**
 * Import favorites from JSON
 */
export function importFavorites(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (Array.isArray(parsed)) {
      favoriteArtists = new Set(parsed);
      saveFavorites();
      dispatchFavoritesChanged('imported');
      return true;
    }
  } catch (error) {
    console.warn('Failed to import favorites:', error);
  }
  return false;
}

/**
 * Dispatch event when favorites change
 */
function dispatchFavoritesChanged(action = 'updated', artistName = '') {
  const detail = {
    action,
    artist: artistName || undefined,
    subject: artistName || undefined,
    count: favoriteArtists.size,
    favorites: Array.from(favoriteArtists),
    dedupeKey: `${action}:${artistName}:${favoriteArtists.size}`,
  };
  const legacyEvent = new CustomEvent('favorites:changed', {
    detail,
  });
  document.dispatchEvent(legacyEvent);
  try {
    document.dispatchEvent(new CustomEvent('favorites:change', { detail }));
  } catch (error) {
    console.warn('Failed to dispatch favorites:change dossier event', error);
  }
}

/**
 * Filter artists to only favorites
 */
export function filterToFavorites(artists) {
  if (!Array.isArray(artists)) return [];
  return artists.filter(artist => 
    artist && artist.artistName && favoriteArtists.has(artist.artistName)
  );
}

// --- Collections: named lists of artists, kept separately from favorites ---

const COLLECTIONS_STORAGE_KEY = 'tagexplorer_collections';
let collections = new Map(); // name -> Set of artist names

function loadCollections() {
  try {
    const parsed = JSON.parse(localStorage.getItem(COLLECTIONS_STORAGE_KEY) || '{}');
    collections = new Map(
      Object.entries(parsed && typeof parsed === 'object' ? parsed : {})
        .filter(([, names]) => Array.isArray(names))
        .map(([name, names]) => [name, new Set(names)]),
    );
  } catch (error) {
    console.warn('Failed to load collections:', error);
    collections = new Map();
  }
}

function saveCollections(action, name = '', artistName = '') {
  try {
    const plain = Object.fromEntries([...collections].map(([key, names]) => [key, [...names]]));
    localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(plain));
  } catch (error) {
    console.warn('Failed to save collections:', error);
  }
  document.dispatchEvent(
    new CustomEvent('collections:changed', { detail: { action, collection: name, artist: artistName } }),
  );
}

export function getCollections() {
  return [...collections]
    .map(([name, names]) => ({ name, artists: [...names] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getCollection(name) {
  return collections.has(name) ? [...collections.get(name)] : [];
}

export function createCollection(name) {
  const clean = String(name || '').trim();
  if (!clean || collections.has(clean)) return false;
  collections.set(clean, new Set());
  saveCollections('created', clean);
  return true;
}

export function renameCollection(oldName, newName) {
  const clean = String(newName || '').trim();
  if (!collections.has(oldName) || !clean || collections.has(clean)) return false;
  collections.set(clean, collections.get(oldName));
  collections.delete(oldName);
  saveCollections('renamed', clean);
  return true;
}

export function deleteCollection(name) {
  if (!collections.delete(name)) return false;
  saveCollections('deleted', name);
  return true;
}

export function isInCollection(name, artistName) {
  return Boolean(collections.get(name)?.has(artistName));
}

// Returns whether the artist is in the collection afterwards.
export function toggleInCollection(name, artistName) {
  const set = collections.get(name);
  if (!set || !artistName) return false;
  const nowIn = !set.has(artistName);
  if (nowIn) set.add(artistName);
  else set.delete(artistName);
  saveCollections(nowIn ? 'added' : 'removed', name, artistName);
  return nowIn;
}

export function getCollectionsForArtist(artistName) {
  return [...collections].filter(([, names]) => names.has(artistName)).map(([name]) => name);
}

// Initialize favorites on module load
loadFavorites();
loadCollections();
