const FALLBACK_IMAGE_PLACEHOLDER = new URL('../fallback.jpg', import.meta.url).href;

export async function fetchWithCache(url, options = {}) {
  const {
    cacheKey = url,
    useCache = true,
    type = 'json',
    placeholder = FALLBACK_IMAGE_PLACEHOLDER
  } = options;

  const isBrowser = typeof window !== 'undefined';
  const storage = isBrowser ? window.localStorage : null;
  const memoryCache = fetchWithCache._cache || (fetchWithCache._cache = {});

  if (useCache) {
    if (isBrowser && storage) {
      const cached = storage.getItem(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          storage.removeItem(cacheKey);
        }
      }
    } else if (memoryCache[cacheKey]) {
      return memoryCache[cacheKey];
    }
  }

  try {
    let data;
    if (isBrowser || url.startsWith('http')) {
      const resp = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'default',
        credentials: 'omit',
        headers: {
          'Accept': type === 'json' ? 'application/json' : '*/*',
        },
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText || 'Request failed'}`);
      }
      data = type === 'json' ? await resp.json() : await resp.blob();
    } else {
      const fs = await import('fs/promises');
      const { fileURLToPath } = await import('url');
      const { dirname, resolve } = await import('path');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const filePath = resolve(__dirname, '..', url);
      const fileData = await fs.readFile(filePath, 'utf8');
      data = JSON.parse(fileData);
    }

    if (useCache) {
      if (isBrowser && storage && type === 'json') {
        try {
          storage.setItem(cacheKey, JSON.stringify(data));
        } catch (err) {
          // Ignore quota errors and fall back to in-memory caching so the
          // fetched payload is still returned to the caller.
          if (err?.name === 'QuotaExceededError') {
            try {
              storage.removeItem(cacheKey);
            } catch (_) {
              // ignore secondary errors from cleanup
            }
          }
          memoryCache[cacheKey] = data;
          console.warn(`Unable to persist ${cacheKey} in localStorage:`, err);
        }
      } else {
        memoryCache[cacheKey] = data;
      }
    }

    return data;
  } catch (err) {
    // More detailed error logging
    if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
      console.warn(`fetchWithCache network error for ${url}: CORS or connectivity issue`);
    } else if (err.message && err.message.includes('HTTP')) {
      console.warn(`fetchWithCache HTTP error for ${url}:`, err.message);
    } else {
      console.warn(`fetchWithCache failed for ${url}:`, err.message || err);
    }
    
    if (type === 'image') {
      return placeholder;
    }
    return null;
  }
}
