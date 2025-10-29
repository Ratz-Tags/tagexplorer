#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getArtistImageCount } from '../../modules/api.js';
async function updateCounts() {
    const filePath = fileURLToPath(new URL('../../artists.json', import.meta.url));
    const json = await readFile(filePath, 'utf8');
    const data = JSON.parse(json);
    for (const artist of data) {
        try {
            const count = await getArtistImageCount(artist.artistName);
            artist.postCount = count;
            console.log(`${artist.artistName}: ${count}`);
        }
        catch (err) {
            console.error(`Failed to get count for ${artist.artistName}:`, err);
        }
    }
    await writeFile(filePath, JSON.stringify(data, null, 2) + '\n');
}
updateCounts().catch(error => {
    console.error('Failed to update counts:', error);
    process.exit(1);
});
//# sourceMappingURL=updateCounts.js.map