document.addEventListener("DOMContentLoaded", () => {
  setRandomBackground();
  const tagIcons = {
    "pegging": "icons/pegging.svg",
    "chastity_cage": "icons/chastity_cage.svg",
    "feminization": "icons/feminization.svg",
    "bimbofication": "icons/bimbofication.svg",
    "gagged": "icons/gagged.png",
    "tentacle_sex": "icons/tentacle_sex.png",
    "futanari": "icons/futanari.png",
    "mind_break": "icons/mind_break.png",
    "netorare": "icons/netorare.png"
  };

  const activeTags = new Set();
  const filterTags = [
    "chastity_cage", "futanari", "pegging", "bimbofication", "orgasm_denial", "netorare",
    "feminization", "public_humiliation", "humiliation", "dominatrix", "tentacle_sex",
    "foot_domination", "gokkun", "milking_machine", "mind_break", "cum_feeding",
    "prostate_milking", "lactation", "sex_machine", "cyber_femdom", "gagged",
    "sissy_training", "extreme_penetration", "large_penetration", "netorase"
  ];

  let allArtists = [];
  let tooltips = {};
  let taunts = [];
  let tagTaunts = {};

  function setRandomBackground() {
    const query = `chastity_cage`;
    fetch(`https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(query)}+order:rank&limit=200`)
      .then(res => res.json())
      .then(data => {
        if (data.length) {
          const post = data[Math.floor(Math.random() * data.length)];
          const imgUrl = post.large_file_url;
          document.body.style.backgroundImage = `url(${imgUrl})`;
          document.body.style.backgroundSize = 'auto auto';
          document.body.style.backgroundRepeat = 'no-repeat';
          document.body.style.backgroundAttachment = 'fixed';
          document.body.style.backgroundPosition = 'center';
        }
      })
      .catch(err => console.error("Background image fetch failed:", err));
  }

  function fetchDanbooruImage(artistName, img) {
    fetch(`https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(artistName)}+order:rank&limit=1`)
      .then(res => res.json())
      .then(data => {
        if (data.length && data[0].preview_file_url) {
          const url = data[0].preview_file_url;
          img.src = url.startsWith("http") ? url : `https://danbooru.donmai.us${url}`;
        } else img.src = "fallback.png";
      })
      .catch(() => img.src = "fallback.png");
  }

  function checkImageExists(url, callback, fallback) {
    const tester = new Image();
    tester.onload = () => callback(url);
    tester.onerror = fallback;
    tester.src = url;
  }

  function setBestImage(artist, img) {
    const localURL = `images/${encodeURIComponent(artist.artistName)}.jpg`;
    checkImageExists(localURL,
      url => img.src = url,
      () => fetchDanbooruImage(artist.artistName, img));
  }

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast-popup";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }

  function renderTagButtons(tags) {
    const container = document.getElementById("tag-buttons");
    container.innerHTML = '';
    tags.forEach(tag => {
      const btn = document.createElement("button");
      btn.className = "tag-button";

      if (tagIcons[tag]) {
        const img = document.createElement("img");
        img.src = tagIcons[tag];
        img.alt = tag;
        img.style.height = "16px";
        img.style.marginRight = "4px";
        btn.appendChild(img);
      }

      btn.appendChild(document.createTextNode(tag.replaceAll('_', ' ')));
      btn.dataset.tag = tag;
      if (tooltips[tag]) btn.title = tooltips[tag];

      btn.addEventListener("click", () => {
        if (activeTags.has(tag)) {
          activeTags.delete(tag);
          btn.classList.remove("active");
        } else {
          activeTags.add(tag);
          btn.classList.add("active");
          spawnBubble(tag);
        }
        filterArtists();
      });
      container.appendChild(btn);
    });
  }

  function filterArtists() {
    const gallery = document.getElementById("artist-gallery");
    gallery.innerHTML = "";
    const selected = Array.from(activeTags);
    allArtists.forEach(artist => {
      const artistTags = artist.kinkTags;
      if (selected.every(t => artistTags.includes(t))) {
        const card = document.createElement("div");
        card.className = "artist-card";

        const img = document.createElement("img");
        img.className = "artist-image";
        img.loading = "lazy";
        setBestImage(artist, img);
        img.addEventListener("click", () => {
          const zoomed = img.cloneNode();
          zoomed.classList.add("fullscreen-img");
          document.body.appendChild(zoomed);
          zoomed.addEventListener("click", () => zoomed.remove());
        });
        card.appendChild(img);

        const name = document.createElement("div");
        name.className = "artist-name";
        name.textContent = `${artist.artistName} (${artist.nsfwLevel}${artist.artStyle ? `, ${artist.artStyle}` : ''})`;
        card.appendChild(name);

        name.addEventListener("touchstart", e => {
          name.dataset.touchStart = Date.now();
        });

        name.addEventListener("touchend", e => {
          if (Date.now() - name.dataset.touchStart < 1000) return;
          navigator.clipboard.writeText(artist.artistName.replaceAll('_', ' '));
          showToast("Copied: " + artist.artistName.replaceAll('_', ' '));
        });

        const taglist = document.createElement("div");
        taglist.className = "artist-tags";
        taglist.textContent = artist.kinkTags.join(", ");
        card.appendChild(taglist);

        gallery.appendChild(card);
      }
    });
  }

  function spawnBubble(tag) {
    const container = document.getElementById("jrpg-bubbles");
    const bubble = document.createElement("div");
    bubble.className = "jrpg-bubble";

    const chibi = document.createElement("img");
    chibi.src = "icons/chibi.png";
    chibi.alt = "chibi";
    chibi.className = "chibi";
    bubble.appendChild(chibi);

    const pool = tagTaunts[tag] || taunts;
    const tauntText = document.createElement("span");
    tauntText.textContent = pool[Math.floor(Math.random() * pool.length)];
    bubble.appendChild(tauntText);

    container.appendChild(bubble);
    setTimeout(() => bubble.remove(), 5000);
  }

  const hypnoTracks = [...]; // Leave as-is

  Promise.all([
    fetch("artists.json").then(r => r.json()),
    fetch("artists-local.json").then(r => r.json()),
    fetch("tag-tooltips.json").then(r => r.json()),
    fetch("taunts.json").then(r => r.json()),
    fetch("tag-taunts.json").then(r => r.json())
  ]).then(([artists, locals, tool, baseTaunts, specificTaunts]) => {
    allArtists = artists;
    tooltips = tool;
    taunts = baseTaunts;
    tagTaunts = specificTaunts;
    renderTagButtons(filterTags);
    filterArtists();
  });

  document.body.style.display = "none";
  setTimeout(() => document.body.style.display = "", 0);
});
