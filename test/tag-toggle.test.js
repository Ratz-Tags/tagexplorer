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

test('preference subscribers receive updates and respect rememberFilters', async () => {
  storageStore.clear();
  const { subscribeToPreferences, updatePreferences, getPreferences, resetPreferences } = await import(moduleUrl);
  resetPreferences();

  const notifications = [];
  const unsubscribe = subscribeToPreferences((prefs) => {
    notifications.push(prefs);
  });

  updatePreferences({ filters: ['femdom'] });
  updatePreferences({ rememberFilters: false });
  unsubscribe();
  updatePreferences({ filters: ['pet_play'] });

  assert.ok(notifications.length >= 3, 'subscriber received initial + update notifications');
  const latest = getPreferences();
  assert.deepEqual(latest.filters, [], 'filters cleared when rememberFilters is disabled');
  const notificationFilters = notifications.at(-2)?.filters ?? [];
  assert.deepEqual(notificationFilters, ['femdom'], 'subscriber saw intermediate filter state');
});
