/**
 * Simple Thumbnail Chooser
 * Purpose: given an ordered list of Danbooru post objects, return a
 * prioritized list of candidate image URLs that favor smaller, preview
 * images first to improve perceived thumbnail load speed.
 *
 * Strategy:
 *  - For the first N posts (default 8) pick the smallest available URL
 *    in this preference: preview_file_url -> large_file_url -> file_url
 *  - Deduplicate while preserving order
 *
 * This module intentionally stays tiny and dependency-free so it can be
 * swapped out later for a more advanced chooser (face-aware, tag-weighted,
 * etc.).
 */

function chooseSmallestUrlForPost(post) {
  if (!post || typeof post !== 'object') return null;
  const candidates = [post.preview_file_url, post.large_file_url, post.file_url];
  for (const c of candidates) {
    if (!c) continue;
    // quick sanity: only allow common image extensions
    if (/\.(jpe?g|png|gif)$/i.test(c)) return c;
  }
  return null;
}

export function pickThumbnailCandidateUrls(posts = [], options = {}) {
  const maxPosts = Number.isFinite(options.maxPosts) ? Math.max(1, options.maxPosts) : 8;
  if (!Array.isArray(posts) || posts.length === 0) return [];
  const out = [];
  for (let i = 0; i < Math.min(posts.length, maxPosts); i++) {
    const url = chooseSmallestUrlForPost(posts[i]);
    if (url) out.push(url);
  }
  // If nothing found in the first pass, try a fallback sweep for larger urls
  if (out.length === 0) {
    for (let i = 0; i < Math.min(posts.length, 32); i++) {
      const p = posts[i];
      if (!p) continue;
      const url = p.large_file_url || p.file_url || p.preview_file_url || null;
      if (url && /\.(jpe?g|png|gif)$/i.test(url)) out.push(url);
    }
  }
  // Deduplicate preserving order
  const seen = new Set();
  const deduped = [];
  for (const u of out) {
    if (seen.has(u)) continue;
    seen.add(u);
    deduped.push(u);
  }
  return deduped;
}

export default pickThumbnailCandidateUrls;
