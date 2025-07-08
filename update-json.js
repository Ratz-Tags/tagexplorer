import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { getArtistImageCount } from "./modules/api.js";

// Get absolute path to the current script file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Since artists.json is in the same folder as update-json.js
const filePath = path.resolve(__dirname, "artists.json");

async function updateCounts() {
  let data;
  try {
    const fileContent = await fs.readFile(filePath, "utf8");
    data = JSON.parse(fileContent);
    if (!Array.isArray(data)) {
      throw new Error("artists.json does not contain a valid array");
    }
  } catch (err) {
    console.error("Failed to read or parse artists.json:", err);
    return;
  }

  for (const artist of data) {
    try {
      const count = await getArtistImageCount(artist.artistName);
      artist.postCount = count;
      console.log(`${artist.artistName}: ${count}`);
    } catch (err) {
      console.error(`Failed to get count for ${artist.artistName}:`, err);
    }
  }

  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n");
  } catch (err) {
    console.error("Failed to write artists.json:", err);
  }
}

updateCounts();
