import json
import aiohttp
import asyncio
from tqdm import tqdm

# Configuration
DANBOORU_POSTS_URL = "https://danbooru.donmai.us/posts.json"
HEADERS = {"User-Agent": "kink-artist-explorer/3.5"}
ARTISTS_JSON_URL = "https://raw.githubusercontent.com/NotRatz/kexplorer/main/artists.json"
TARGET_TAGS = [
    "public_humiliation", "humiliation", "foot_domination", "gokkun", "cum_in_mouth",
    "extreme_insertion", "large_insertion", "huge_dildo", "dildo_riding",
    "object_insertion", "object_insertion_from_behind", "anal_object_insertion", "tentacle_pit",
    "trap", "otoko_no_ko", "chastity_cage",
    "orgasm_denial", "urethral_insertion", "sounding", "dominatrix", "strap-on",
    "holding_key", "nipple_piercing", "small_penis", "cum", "bondage"
]
CORE_TAGS = {"femdom", "pegging", "trap", "chastity_cage"}

# Normalization function
def normalize(name):
    return name.replace('_', ' ').strip().lower()

def fetch_artists_json_local():
    with open("artists.json", "r", encoding="utf-8") as f:
        return json.load(f)

async def fetch_all_posts_for_tag(session, tag, max_pages=20):
    posts = []
    page = 1
    while page <= max_pages:
        params = {
            "tags": tag,
            "limit": 100,
            "page": page
        }
        async with session.get(DANBOORU_POSTS_URL, params=params, headers=HEADERS) as resp:
            if resp.status != 200:
                print(f"[ERROR] Failed to fetch page {page} for tag: {tag} (status {resp.status})")
                break
            batch = await resp.json()
            if not batch:
                break
            posts.extend(batch)
            page += 1
    return posts

async def fetch_artists_from_posts(session):
    seen_artists = {}
    for tag in TARGET_TAGS:
        all_posts = await fetch_all_posts_for_tag(session, tag)
        for post in all_posts:
            post_tags = set(post.get("tag_string", "").split())
            artist_tags = post.get("tag_string_artist", "").split()
            if not CORE_TAGS.intersection(post_tags):
                continue
            for artist in artist_tags:
                if artist not in seen_artists:
                    seen_artists[artist] = set()
                for t in TARGET_TAGS + list(CORE_TAGS):
                    if t in post_tags:
                        seen_artists[artist].add(t)
    return seen_artists

async def main():
    base_artists = fetch_artists_json_local()
    normalized_updated_artists = {normalize(a["artistName"]): a for a in base_artists}
    new_artists = {}

    async with aiohttp.ClientSession() as session:
        artist_tag_map = await fetch_artists_from_posts(session)

        matched_existing = 0
        for artist_name, tags in artist_tag_map.items():
            key = normalize(artist_name)
            if key in normalized_updated_artists:
                artist = normalized_updated_artists[key]
                kink_tags = set(artist.get("kinkTags", []))
                kink_tags.update(tags)
                artist["kinkTags"] = sorted(kink_tags)
                matched_existing += 1

                # Fill NSFW level based on kinkTags
                if artist.get("nsfwLevel", "").lower() in {"", "unknown"}:
                    level = "Suggestive"
                    if any(tag in artist["kinkTags"] for tag in ["extreme_insertion", "large_insertion", "huge_dildo", "anal_object_insertion"]):
                        level = "Extreme"
                    elif any(tag in artist["kinkTags"] for tag in ["cum_in_mouth", "gokkun", "dildo_riding", "object_insertion", "public_humiliation", "tentacle_pit"]):
                        level = "Hentai"
                    elif any(tag in artist["kinkTags"] for tag in ["femdom", "pegging", "trap", "chastity_cage", "humiliation", "foot_domination"]):
                        level = "Ecchi"
                    artist["nsfwLevel"] = level
            else:
                if key not in new_artists:
                    new_artists[key] = {
                        "artistName": artist_name,
                        "nsfwLevel": "Hentai",  # inferred default due to explicit kink tag presence
                        "artStyle": "Unknown",
                        "kinkTags": sorted(tags)
                    }
                else:
                    existing_tags = set(new_artists[key]["kinkTags"])
                    existing_tags.update(tags)
                    new_artists[key]["kinkTags"] = sorted(existing_tags)

        print(f"[✓] Artists processed: {len(artist_tag_map)}, matched existing: {matched_existing}")

        # Merge and save
        final = list(normalized_updated_artists.values()) + list(new_artists.values())
        with open("updated_artists.json", "w", encoding="utf-8") as f:
            json.dump(final, f, indent=2, ensure_ascii=False)

        print(f"\n✅ Done. Updated {len(normalized_updated_artists)} existing artists, added {len(new_artists)} new ones. Total: {len(final)}")

if __name__ == "__main__":
    asyncio.run(main())
