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

// Initialize favorites on module load
loadFavorites();
