import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { getArtistImageCount } from "./modules/api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.join(__dirname, "artists.json");

function cleanArtist(artist) {
  return {
    artistName: artist.artistName || "Unknown",
    kinkTags: Array.isArray(artist.kinkTags) ? artist.kinkTags : [],
    previewImage: artist.previewImage || "",
    postCount: typeof artist.postCount === "number" ? artist.postCount : 0,
  };
}

async function updateCounts() {
  const data = JSON.parse(await fs.readFile(filePath, "utf8"));

  for (const artist of data) {
    if (artist.artistName) {
      const count = await getArtistImageCount(artist.artistName);
      artist.postCount = count;
    }
  }

  // Clean and filter only required fields
  const cleaned = data
    .filter((a) => a.artistName && typeof a.postCount === "number")
    .map(cleanArtist);

  console.log("✅ Updating file:", filePath);
  console.log("Sample output:", JSON.stringify(cleaned.slice(0, 1), null, 2));

  await fs.writeFile(filePath, JSON.stringify(cleaned, null, 2) + "\n");
  console.log("✅ artists.json written successfully");
}

updateCounts();
