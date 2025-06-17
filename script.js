
document.addEventListener("DOMContentLoaded", () => {
  // Your existing logic, minus the broken top-level fallback test

  // This function is correctly scoped and only used when an image fails inside filterArtists
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

  // No unscoped usage of artist here — only used properly during render
});
