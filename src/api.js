export async function fetchArtistPage(artist, page = 1, limit = 200) {
  const url = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(
    artist
  )}+order:approvals&limit=${limit}&page=${page}`;
  const res = await fetch(url);
  const data = await res.json();
  return (Array.isArray(data) ? data : []).filter(
    (p) => p.large_file_url || p.file_url
  );
}
