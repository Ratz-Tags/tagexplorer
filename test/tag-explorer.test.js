import test from 'node:test';
import assert from 'node:assert/strict';

// Stub browser APIs used during module initialization
global.window = {
  addEventListener: () => {},
  speechSynthesis: { getVoices: () => [], onvoiceschanged: null },
};

const store = {};
// simple localStorage mock
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => {
    store[k] = String(v);
  },
  removeItem: (k) => {
    delete store[k];
  },
};

// navigator stub for vibrate in toggleTag
Object.defineProperty(globalThis, 'navigator', {
  value: { vibrate: () => {} },
  writable: true,
});

test('tag counts and visibility respond to tag toggling', async () => {
  const { setAllArtists, getFilteredCounts } = await import('../modules/tag-explorer.js');
  const { toggleTag, getActiveTags } = await import('../modules/tags.js');

  const mockArtists = [
    { artistName: 'Alice', kinkTags: ['tag1', 'tag2'] },
    { artistName: 'Bob', kinkTags: ['tag2'] },
  ];

  setAllArtists(mockArtists);
  const allTags = ['tag1', 'tag2', 'tag3'];

  // Initial counts
  let counts = getFilteredCounts(getActiveTags());
  assert.deepEqual(counts, { tag1: 1, tag2: 2 });
  let visible = allTags.filter((t) => counts[t] || getActiveTags().has(t));
  assert.deepEqual(visible, ['tag1', 'tag2']);

  // Activate tag1
  toggleTag('tag1');
  counts = getFilteredCounts(getActiveTags());
  assert.deepEqual(counts, { tag1: 1, tag2: 1 });

  // Deactivate tag1
  toggleTag('tag1');
  counts = getFilteredCounts(getActiveTags());
  assert.deepEqual(counts, { tag1: 1, tag2: 2 });

  // Activate tag3 (no artists)
  toggleTag('tag3');
  counts = getFilteredCounts(getActiveTags());
  assert.deepEqual(counts, {});
  visible = allTags.filter((t) => counts[t] || getActiveTags().has(t));
  assert.deepEqual(visible, ['tag3']);

  // Deactivate tag3
  toggleTag('tag3');
  counts = getFilteredCounts(getActiveTags());
  visible = allTags.filter((t) => counts[t] || getActiveTags().has(t));
  assert.deepEqual(visible, ['tag1', 'tag2']);
});
