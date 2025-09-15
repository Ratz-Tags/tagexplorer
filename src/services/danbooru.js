export async function fetchArtistPage(artistName, selectedTags = [], page = 1, limit = 200) {
  const effectiveTags = [artistName, ...selectedTags].slice(0, 2).join(' ');
  const url = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(effectiveTags)}+order:approvals&limit=${limit}&page=${page}`;
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    if (!Array.isArray(data)) {
      return { posts: [], total: 0 };
    }
    const posts = data.filter(
      (p) => (p.large_file_url || p.file_url) && !p.is_banned
    );
    return { posts, total: data.length };
  } catch (e) {
    console.warn('Danbooru fetch failed', e);
    return { posts: [], total: 0 };
  }
}

export async function fetchAllArtistImages(artistName, selectedTags = [], options = {}) {
  const limit = options.limit || 200;
  let page = 1;
  let all = [];
  while (true) {
    const { posts, total } = await fetchArtistPage(artistName, selectedTags, page, limit);
    if (posts.length) all = all.concat(posts);
    if (total < limit) break;
    page++;
  }
  return all;
}
