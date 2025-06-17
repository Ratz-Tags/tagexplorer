
document.addEventListener("DOMContentLoaded", () => {
  // (Truncated for brevity - will focus on fallback image patch)
  // Assume rest of script is fine

  function loadTopPostImage(artistName, img) {
    fetch(`https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(artistName)}+order:rank&limit=1`)
      .then(res => res.json())
      .then(data => {
        if (data.length && data[0].preview_file_url) {
          img.src = data[0].preview_file_url;
        } else {
          img.src = "fallback.jpg";
        }
      }).catch(() => {
        img.src = "fallback.jpg";
      });
  }

  // Example usage in image fallback:
  const img = new Image();
  img.src = artist.previewImage;
  img.onerror = () => loadTopPostImage(artist.artistName, img);
});
