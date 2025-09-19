import test from 'node:test';
import assert from 'node:assert/strict';

const storageStore = new Map();
const localStorageStub = {
  getItem(key) {
    return storageStore.has(key) ? storageStore.get(key) : null;
  },
  setItem(key, value) {
    storageStore.set(key, String(value));
  },
  removeItem(key) {
    storageStore.delete(key);
  },
  clear() {
    storageStore.clear();
  }
};

global.window = { localStorage: localStorageStub };
global.localStorage = localStorageStub;

const moduleUrl = new URL('../src/js/core/preferences.js', import.meta.url);

test('preferences persist filters and clamp intensities', async () => {
  storageStore.clear();
  const { getPreferences, updatePreferences, resetPreferences } = await import(moduleUrl);
  resetPreferences();

  updatePreferences({
    filters: ['crossdressing', 'latex', 'crossdressing'],
    humiliation: { intensity: 9 }
  });

  const prefs = getPreferences();
  assert.deepEqual(prefs.filters, ['crossdressing', 'latex']);
  assert.equal(prefs.humiliation.intensity, 3, 'intensity is clamped to the max value of 3');
  assert.ok(storageStore.has('tagexplorer.preferences.v1'), 'preferences persisted to localStorage');
});

