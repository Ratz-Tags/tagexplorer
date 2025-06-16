
const coreTags = ["femdom", "pegging", "chastity_cage", "tentacle_sex", "cyber_femdom"];
const tagContainer = document.getElementById("tag-buttons");
const bubbleContainer = document.getElementById("jrpg-bubbles");
const artistGallery = document.getElementById("artist-gallery");
const scIframe = document.getElementById("sc-player");
const scContainer = document.getElementById("soundcloud-container");

const soundcloudTracks = [
  "https://on.soundcloud.com/HADalMkX8rPG2ISu0Z",
  "https://on.soundcloud.com/vOQ4cOkO5vjnkZoqPu",
  "https://soundcloud.com/sissypositive/happy-chastity-audio-hypnosis-18",
  "https://soundcloud.com/sissy-needs/nipples-sissy-hypno",
  "https://soundcloud.com/user-682994637/after-dark-2-gloryhole-instructions",
  "https://soundcloud.com/user-526345318/affirmations-for-cuckolds-1",
  "https://soundcloud.com/user-526345318/sph-hypno-repetitions-4",
  "https://soundcloud.com/dogelol-523627490/maria-dont-beg-me-soft",
  "https://soundcloud.com/babewithaboner/bethanys-cum-rag",
  "https://soundcloud.com/re-elle/urethral-ft-lamb-kebab-version-2"
];

let currentTrackIndex = Math.floor(Math.random() * soundcloudTracks.length);
function updateTrack() {
  const url = encodeURIComponent(soundcloudTracks[currentTrackIndex]);
  scIframe.src = `https://w.soundcloud.com/player/?url=${url}&auto_play=true&hide_related=true&show_comments=false&show_user=false&show_reposts=false&visual=false`;
}

document.getElementById("toggle-audio").addEventListener("click", () => {
  if (scContainer.style.display === "none") {
    scContainer.style.display = "block";
    updateTrack();
    document.getElementById("toggle-audio").textContent = "🔊 Femdom Hypno";
  } else {
    scContainer.style.display = "none";
    scIframe.src = "";
    document.getElementById("toggle-audio").textContent = "🔇 Femdom Hypno";
  }
});
document.getElementById("prev-audio").addEventListener("click", () => {
  currentTrackIndex = (currentTrackIndex - 1 + soundcloudTracks.length) % soundcloudTracks.length;
  updateTrack();
});
document.getElementById("next-audio").addEventListener("click", () => {
  currentTrackIndex = (currentTrackIndex + 1) % soundcloudTracks.length;
  updateTrack();
});

let taunts = {};
let tagTaunts = {};
let tagTooltips = {};

fetch("taunts.json").then(res => res.json()).then(d => taunts.general = d);
fetch("tag-taunts.json").then(res => res.json()).then(d => tagTaunts = d);
fetch("tag-tooltips.json").then(res => res.json()).then(data => {
  tagTooltips = data;
  renderTags(); // render tags with tooltips once loaded
});

function showTaunt(tag = null) {
  const msg = document.createElement("div");
  msg.className = "jrpg-bubble";
  if (tag && tagTaunts[tag]) {
    const pool = tagTaunts[tag];
    msg.textContent = pool[Math.floor(Math.random() * pool.length)];
  } else {
    const pool = taunts.general || [];
    msg.textContent = pool[Math.floor(Math.random() * pool.length)];
  }
  bubbleContainer.appendChild(msg);
  setTimeout(() => bubbleContainer.removeChild(msg), 3000);
}

function renderTags() {
  const kinkTags = Object.keys(tagTooltips);
  tagContainer.innerHTML = "";
  kinkTags.forEach(tag => {
    const btn = document.createElement("button");
    btn.textContent = tag.replace(/_/g, " ");
    btn.className = "tag-button";
    btn.title = tagTooltips[tag] || "Click to reveal your shame";
    btn.addEventListener("click", () => {
      btn.classList.toggle("active");
      showTaunt(tag);
      fetchArtists();
    });
    tagContainer.appendChild(btn);
  });
}

function getZeleImg(name) {
  const encoded = encodeURIComponent(name).replace(/%20/g, '%2520');
  return `https://cdn.zele.st/data/NAX/Images/danbooru-artist-tags-v4.5/${encoded}.jpg`;
}

function saveFavorite(artist) {
  const favorites = JSON.parse(localStorage.getItem("favorites") || "{}");
  favorites[artist.name] = artist;
  localStorage.setItem("favorites", JSON.stringify(favorites));
}

function removeFavorite(name) {
  const favorites = JSON.parse(localStorage.getItem("favorites") || "{}");
  delete favorites[name];
  localStorage.setItem("favorites", JSON.stringify(favorites));
}

function loadFavorites() {
  const favorites = JSON.parse(localStorage.getItem("favorites") || "{}");
  displayArtists(Object.values(favorites));
}

function displayArtists(list) {
  artistGallery.innerHTML = "";
  const saved = JSON.parse(localStorage.getItem("favorites") || "{}");

  list.forEach(artist => {
    const img = document.createElement("img");
    img.src = getZeleImg(artist.name);
    img.onerror = () => { if (artist.preview) img.src = `https://danbooru.donmai.us${artist.preview}`; };

    const div = document.createElement("div");
    div.className = "artist-card";
    div.innerHTML = `
      <h3>${artist.name}</h3>
      <p>${[...artist.tags].map(t => t.replace(/_/g, " ")).join(", ")}</p>
      <button class="save-btn">${saved[artist.name] ? "❤️ Saved" : "💾 Save"}</button>
    `;
    div.querySelector("button").addEventListener("click", (e) => {
      if (saved[artist.name]) {
        removeFavorite(artist.name);
        e.target.textContent = "💾 Save";
      } else {
        saveFavorite(artist);
        e.target.textContent = "❤️ Saved";
      }
    });
    div.prepend(img);
    artistGallery.appendChild(div);
  });
}

async function fetchArtists() {
  const selectedTags = [...document.querySelectorAll(".tag-button.active")].map(btn => btn.textContent.replace(/ /g, "_"));
  if (selectedTags.length === 0) return;

  const query = encodeURIComponent([...selectedTags, "order:rank"].join(" "));
  try {
    const res = await fetch(`https://danbooru.donmai.us/posts.json?tags=${query}&limit=100`);
    const posts = await res.json();

    if (!Array.isArray(posts)) {
      console.error("Invalid Danbooru response:", posts);
      artistGallery.innerHTML = "<p class='error-msg'>No artists found. Tag combo may be invalid.</p>";
      return;
    }

    const artists = {};
    posts.forEach(post => {
      if (!post.tag_string_artist) return;
      const matchesCore = coreTags.some(tag => post.tag_string.includes(tag));
      if (!matchesCore) return;
      const matchedTags = selectedTags.filter(tag => post.tag_string.includes(tag));
      if (matchedTags.length === 0) return;

      const artist = post.tag_string_artist;
      if (!artists[artist]) {
        artists[artist] = {
          name: artist,
          tags: new Set(),
          preview: post.preview_file_url
        };
      }
      matchedTags.forEach(tag => artists[artist].tags.add(tag));
    });

    updateBackground(selectedTags);
    displayArtists(Object.values(artists));
  } catch (err) {
    console.error("Error fetching artists:", err);
    artistGallery.innerHTML = "<p class='error-msg'>Something went wrong while fetching data.</p>";
  }
}

async function updateBackground(tags) {
  if (tags.length === 0) return;
  const tag = tags[0];
  const res = await fetch(`https://danbooru.donmai.us/posts.json?tags=${tag}+rating:explicit+order:rank&limit=1`);
  const [post] = await res.json();
  if (post && post.large_file_url) {
    document.body.style.backgroundImage = `url(https://danbooru.donmai.us${post.large_file_url})`;
  }
}

// Add favorites toggle in header
const favBtn = document.createElement("button");
favBtn.textContent = "🌟 Show Favorites";
favBtn.onclick = loadFavorites;
document.querySelector(".audio-controls").appendChild(favBtn);

// Patch for v7.1 — ensure .tag-button click binds even after tooltip load
function refreshTagListeners() {
  document.querySelectorAll(".tag-button").forEach(button => {
    button.addEventListener("click", () => {
      const tagName = button.textContent.replace(/ /g, "_");
      button.classList.toggle("active");
      showTaunt(tagName);
      fetchArtists();
    });
  });
}

// After rendering all tag buttons
setTimeout(refreshTagListeners, 1000);

// Add fallback debug log if fetch returns 0 artists
function displayArtists(list) {
  artistGallery.innerHTML = "";
  if (list.length === 0) {
    artistGallery.innerHTML = "<p class='error-msg'>No artists found. Try another kink or combo.</p>";
    console.warn("Artist list empty. Tags selected may not match core rules.");
    return;
  }

  const saved = JSON.parse(localStorage.getItem("favorites") || "{}");
  list.forEach(artist => {
    const img = document.createElement("img");
    img.src = getZeleImg(artist.name);
    img.onerror = () => { if (artist.preview) img.src = `https://danbooru.donmai.us${artist.preview}`; };

    const div = document.createElement("div");
    div.className = "artist-card";
    div.innerHTML = `
      <h3>${artist.name}</h3>
      <p>${[...artist.tags].map(t => t.replace(/_/g, " ")).join(", ")}</p>
      <button class="save-btn">${saved[artist.name] ? "❤️ Saved" : "💾 Save"}</button>
    `;
    div.querySelector("button").addEventListener("click", (e) => {
      if (saved[artist.name]) {
        removeFavorite(artist.name);
        e.target.textContent = "💾 Save";
      } else {
        saveFavorite(artist);
        e.target.textContent = "❤️ Saved";
      }
    });
    div.prepend(img);
    artistGallery.appendChild(div);
  });
}
