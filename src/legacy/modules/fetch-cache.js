export async function fetchWithCache(url, options = {}) {
  const {
    cacheKey = url,
    useCache = true,
    type = 'json',
    placeholder = 'fallback.jpg'
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
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`status ${resp.status}`);
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
        storage.setItem(cacheKey, JSON.stringify(data));
      } else {
        memoryCache[cacheKey] = data;
      }
    }
    return data;
  } catch (err) {
    console.warn(`fetchWithCache failed for ${url}:`, err);
    if (type === 'image') {
      return placeholder;
    }
    if (isBrowser) {
      alert(`Failed to fetch ${url}`);
    }
    return null;
  }
}
