import fs from 'fs/promises';

// List of core tags used to limit collected tags
const coreTags = [
  'chastity_cage',
  'femdom',
  'futanari'
];

// Additional Danbooru kink tags to include
const extraTags = [
  'bdsm',
  'hypnosis',
  'leash',
  'pet_play',
  'spanking',
  'tickling'
];

async function tagExistsOnDanbooru(tag) {
  try {
    const resp = await fetch(`https://danbooru.donmai.us/tags.json?search[name]=${encodeURIComponent(tag)}&limit=1`);
    if (!resp.ok) return false;
    const data = await resp.json();
    return data.length > 0 && data[0].name === tag;
  } catch (err) {
    console.warn(`⚠️ could not verify ${tag} on Danbooru: ${err.message}`);
    // Assume valid if verification fails so tags can still be added
    return true;
  }
}

async function updateKinkTags() {
  let artists;
  try {
    artists = JSON.parse(await fs.readFile('artists.json', 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error("Error: 'artists.json' file not found. Please ensure the file exists in the current directory.");
      process.exit(1);
    } else {
      throw err;
    }
  }
  const tagSet = new Set();

  for (const artist of artists) {
    const tags = artist.kinkTags || [];
    if (!tags.some(tag => coreTags.includes(tag))) continue;
    tags.forEach(tag => tagSet.add(tag));
  }

  for (const tag of extraTags) {
    if (await tagExistsOnDanbooru(tag)) {
      tagSet.add(tag);
    } else {
      console.warn(`⚠️ skipped invalid Danbooru tag: ${tag}`);
    }
  }

  const tags = Array.from(tagSet).sort();
  await fs.writeFile('kink-tags.json', JSON.stringify(tags, null, 2) + '\n');
  console.log(`✅ kink-tags.json updated with ${tags.length} tags`);
}

updateKinkTags().catch(err => {
  console.error('Failed to update kink tags:', err);
  process.exit(1);
});
