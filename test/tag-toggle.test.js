import test from 'node:test';
import assert from 'node:assert/strict';

const allTags = ['t1', 't2', 't3'];

const artists = [
  { artistName: 'A1', kinkTags: ['t1', 't2'] },
  { artistName: 'A2', kinkTags: ['t1'] },
  { artistName: 'A3', kinkTags: ['t2'] },
  { artistName: 'A4', kinkTags: ['t3'] },
];

test('tag toggling updates counts and visibility', async () => {
  global.navigator = { vibrate: () => {} };
  global.localStorage = { getItem: () => null, setItem: () => {} };
  const dummyEl = { style: {}, appendChild: () => {}, setAttribute: () => {}, addEventListener: () => {}, querySelector: () => null };
  global.document = {
    getElementById: () => ({ ...dummyEl }),
    createElement: () => ({ ...dummyEl }),
    querySelector: () => ({ ...dummyEl }),
    body: { appendChild: () => {} },
  };
  global.window = { addEventListener: () => {}, removeEventListener: () => {} };

  const { setAllArtists, getFilteredCounts } = await import('../modules/tag-explorer.js');
  const { toggleTag, getActiveTags } = await import('../modules/tags.js');

  setAllArtists(artists);

  let counts = getFilteredCounts(getActiveTags());
  assert.equal(counts.t2, 2);
  assert.equal(counts.t3, 1);

  toggleTag('t1');
  counts = getFilteredCounts(getActiveTags());
  assert.equal(counts.t2, 1);
  assert.ok(!('t3' in counts));

  toggleTag('t1');
  counts = getFilteredCounts(getActiveTags());
  assert.equal(counts.t2, 2);
  assert.equal(counts.t3, 1);

  toggleTag('t1');
  toggleTag('t3');
  counts = getFilteredCounts(getActiveTags());
  const active = getActiveTags();
  const visibleTags = allTags.filter(t => counts[t] || active.has(t));
  assert.ok(visibleTags.includes('t3'));
  assert.ok(!visibleTags.includes('t2'));
});
