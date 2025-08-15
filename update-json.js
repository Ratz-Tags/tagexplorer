import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { getArtistImageCount } from "./modules/api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.join(__dirname, "artists.json");

async function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function fetchCountWithRetry(name, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const count = await getArtistImageCount(name, { force: true });
      if (typeof count === "number") return count;
    } catch (e) {
      // ignore, will retry
    }
    await sleep(500 * (attempt + 1));
  }
  return 0;
}

async function updateCounts() {
  const data = JSON.parse(await fs.readFile(filePath, "utf8"));
  const zeroAfter = [];

  for (const artist of data) {
    const prev = Number.isInteger(artist.postCount) ? artist.postCount : 0;
    let count = await fetchCountWithRetry(artist.artistName, 2);
    // If we failed to get a positive count, keep previous positive value
    if (!Number.isInteger(count) || count < 0) count = prev;
    if (count === 0 && prev > 0) count = prev;
    artist.postCount = count;
    console.log(`${artist.artistName}: ${count}`);
    if (count === 0) zeroAfter.push(artist.artistName);
    // Be a little nice to the API
    await sleep(120);
  }

  console.log("✅ Updating file:", filePath);
  console.log("Sample output:", JSON.stringify(data.slice(0, 1), null, 2));

  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n");
  console.log("✅ artists.json written successfully");

  if (zeroAfter.length) {
    console.warn(`Artists still at 0 (check tag validity): ${zeroAfter.length}`);
    console.warn(zeroAfter.slice(0, 50).join(", ") + (zeroAfter.length > 50 ? " …" : ""));
  }
}

updateCounts();
