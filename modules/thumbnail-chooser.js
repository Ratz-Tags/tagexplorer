/**
 * Enhanced Thumbnail Chooser
 * Purpose: given an ordered list of Danbooru post objects, return a
 * prioritized list of candidate image URLs that balance quality and load speed.
 *
 * Strategy:
 *  - For the first N posts (default 8), select URLs based on quality preference
 *    that balances file size and resolution to prevent pixelation.
 *  - For artist cards, prefer large_file_url when available to avoid pixelation
 *  - Default preference order: large_file_url -> preview_file_url -> file_url
 *  - Deduplicate while preserving order
 *
 * This module intentionally stays tiny and dependency-free so it can be
 * swapped out later for a more advanced chooser (face-aware, tag-weighted,
 * etc.).
 */

function chooseBestUrlForPost(post, preferHighQuality = true) {
  if (!post || typeof post !== 'object') return null;
  
  // If a post has image dimensions and the width/height are small,
  // we should prefer larger versions to avoid pixelation
  const needsHigherQuality = preferHighQuality || 
    (post.image_width && post.image_width < 300) || 
    (post.image_height && post.image_height < 400);
  
  // Default order for artist cards (avoids pixelation)
  const candidates = needsHigherQuality 
    ? [post.large_file_url, post.preview_file_url, post.file_url]
    : [post.preview_file_url, post.large_file_url, post.file_url];
    
  for (const c of candidates) {
    if (!c) continue;
    // quick sanity: only allow common image extensions
    if (/\.(jpe?g|png|gif|webp)$/i.test(c)) return c;
  }
  return null;
}

export function pickThumbnailCandidateUrls(posts = [], options = {}) {
  const maxPosts = Number.isFinite(options.maxPosts) ? Math.max(1, options.maxPosts) : 8;
  const preferHighQuality = options.preferHighQuality !== false; // Default to true
  
  if (!Array.isArray(posts) || posts.length === 0) return [];
  const out = [];
  
  for (let i = 0; i < Math.min(posts.length, maxPosts); i++) {
    const url = chooseBestUrlForPost(posts[i], preferHighQuality);
    if (url) out.push(url);
  }
  
  // If nothing found in the first pass, try a fallback sweep for any available urls
  if (out.length === 0) {
    for (let i = 0; i < Math.min(posts.length, 32); i++) {
      const p = posts[i];
      if (!p) continue;
      // Fallback preference order, trying all available options
      const url = p.large_file_url || p.file_url || p.preview_file_url || null;
      if (url && /\.(jpe?g|png|gif|webp)$/i.test(url)) out.push(url);
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
