import { describe, it, expect } from 'vitest';
import { setAllArtists, getFilteredCounts } from '../modules/tag-explorer.js';
import { toggleTag, getActiveTags } from '../modules/tags.js';
import tags from '../kink-tags.json' assert { type: 'json' };

describe('tag filter toggling', () => {
  it('updates counts based on active tags', async () => {
    // minimal stubs
    global.navigator = { vibrate: () => {} };
    const store = {};
    global.localStorage = {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); }
    };
    const dummyEl = { style: {}, appendChild: () => {}, setAttribute: () => {}, addEventListener: () => {}, querySelector: () => null };
    global.document = {
      getElementById: () => ({ ...dummyEl }),
      createElement: () => ({ ...dummyEl }),
      querySelector: () => ({ ...dummyEl }),
      body: { appendChild: () => {} }
    };
    global.window = { addEventListener: () => {}, removeEventListener: () => {} };

    const mockArtists = [
      { artistName: 'A1', kinkTags: [tags[0], tags[1]] },
      { artistName: 'A2', kinkTags: [tags[1]] }
    ];
    setAllArtists(mockArtists);

    let counts = getFilteredCounts(getActiveTags());
    expect(counts[tags[0]]).toBe(1);
    expect(counts[tags[1]]).toBe(2);

    toggleTag(tags[0]);
    counts = getFilteredCounts(getActiveTags());
    expect(counts[tags[1]]).toBe(1);

    toggleTag(tags[0]);
    counts = getFilteredCounts(getActiveTags());
    expect(counts[tags[1]]).toBe(2);
  });
});
