import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { getArtistImageCount } from "./modules/api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.join(__dirname, "artists.json");

async function updateCounts() {
  const data = JSON.parse(await fs.readFile(filePath, "utf8"));

  for (const artist of data) {
    const count = await getArtistImageCount(artist.artistName);
    artist.postCount = count;
    console.log(`${artist.artistName}: ${count}`);
  }

  console.log("✅ Updating file:", filePath);
  console.log("Sample output:", JSON.stringify(data.slice(0, 1), null, 2));

  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n");
  console.log("✅ artists.json written successfully");
}

updateCounts();
