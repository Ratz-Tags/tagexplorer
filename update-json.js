import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getArtistImageCount } from './modules/api.js';

// Get absolute path to the current script file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Since artists.json is in the same folder as update-json.js
const filePath = path.resolve(__dirname, 'artists.json');

async function updateCounts() {
  const data = JSON.parse(await fs.readFile(filePath, 'utf8'));

  for (const artist of data) {
    try {
      const count = await getArtistImageCount(artist.artistName, { forceFetch: true });
      artist.postCount = count;
      console.log(`${artist.artistName}: ${count}`);
    } catch (err) {
      console.error(`Failed to get count for ${artist.artistName}:`, err);
    }
  }

  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n');
}

updateCounts();
