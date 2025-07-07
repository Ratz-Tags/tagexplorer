import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, 'artists.json');


async function updateCounts() {
  const filePath = new URL('../artists.json', import.meta.url);
  const data = JSON.parse(await fs.readFile(filePath, 'utf8'));

  for (const artist of data) {
    try {
      const count = await getArtistImageCount(artist.artistName);
      artist.postCount = count;
      console.log(`${artist.artistName}: ${count}`);
    } catch (err) {
      console.error(`Failed to get count for ${artist.artistName}:`, err);
    }
  }

  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n');
}

updateCounts();
