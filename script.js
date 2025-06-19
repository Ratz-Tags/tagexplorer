// (Script.js) – full script with audio control + localStorage fallback caching

// Global constants
const kinkTags = [
  "chastity_cage", "futanari", "pegging", "bimbofication", "orgasm_denial",
  "netorare", "feminization", "public_humiliation", "humiliation", "dominatrix",
  "tentacle_sex", "foot_domination", "gokkun", "milking_machine", "mind_break",
  "cum_feeding", "prostate_milking", "lactation", "sex_machine", "cyber_femdom",
  "gagged", "sissy_training", "extreme_penetration", "large_penetration", "netorase"
];

const soundcloudLinks = [
  "https://soundcloud.com/sissy-needs/girl-factory-sissy-hypno",
  "https://soundcloud.com/sissy-needs/layer-zero",
  "https://soundcloud.com/user-526345318/sissy-hypnosis-bimbo-affirmations-deep-repetition",
  "https://soundcloud.com/sissy-needs/nipples-sissy-hypno",
  "https://soundcloud.com/user-526345318/hypno-affirmations-3",
  "https://soundcloud.com/user-526345318/affirmations-for-cuckolds-1",
  "https://soundcloud.com/user-526345318/sph-hypno-repetitions-4",
  "https://soundcloud.com/babewithaboner/bethanys-cum-rag",
  "https://soundcloud.com/babewithaboner/sissy-cuckold-throws-a-fit",
  "https://soundcloud.com/babewithaboner/ruinedorgasm-lifes-not-fair"
];

// DOM references
const tagButtonsContainer = document.getElementById("tag-buttons");
const artistGallery = document.getElementById("artist-gallery");
const jrpgBubbles = document.getElementById("jrpg-bubbles");
const backgroundBlur = document.getElementById("background-blur");
const scPlayer = document.getElementById("sc-player");
const toggleAudioBtn = document.getElementById("toggle-audio");
const prevAudioBtn = document.getElementById("prev-audio");
const nextAudioBtn = document.getElementById("next-audio");
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxCaption = document.getElementById("lightbox-caption");
const closeBtn = document.querySelector(".close");
const prevBtn = document.getElementById("prev-img");
const nextBtn = document.getElementById("next-img");

// Runtime state
let currentAudioIndex = 0;
let activeTags = [];
let cachedArtists = [];
let tagTooltips = {};
let tagTaunts = {};
let currentIndex = 0;

lightbox.style.display = "none";

Promise.all([
  fetch("tag-tooltips.json").then(r => r.json()).catch(() => ({})),
  fetch("tag-taunts.json").then(r => r.json()).catch(() => ({})),
  fetch("artists.json").then(r => r.json()).catch(() => [])
]).then(([tooltips, taunts, artists]) => {
  tagTooltips = tooltips;
  tagTaunts = taunts;
  cachedArtists = artists;
  renderTagButtons();
  fetchAndRenderArtists();
  updateBackground("femdom");
  setSoundcloudTrack(currentAudioIndex);
});

function renderTagButtons() {
  tagButtonsContainer.innerHTML = "";
  kinkTags.forEach(tag => {
    const btn = document.createElement("button");
    btn.classList.add("tag-button");
    btn.textContent = tag.replaceAll("_", " ");
    btn.title = tagTooltips[tag] || `You really tapped '${tag}'? Pathetic.`;
    if (activeTags.includes(tag)) btn.classList.add("active");
    btn.onclick = () => toggleTag(tag);
    tagButtonsContainer.appendChild(btn);
  });
}

function toggleTag(tag) {
  activeTags = activeTags.includes(tag)
    ? activeTags.filter(t => t !== tag)
    : [...activeTags, tag];
  renderTagButtons();
  fetchAndRenderArtists();
  showTaunt(tag);
  updateBackground(activeTags.length > 0 ? activeTags.at(-1) : "femdom");
}

function showTaunt(tag) {
  const bubble = document.createElement("div");
  bubble.className = "jrpg-bubble";
  bubble.innerHTML = `<img src='./icons/chibi.png' class='chibi' /><span>${tagTaunts[tag] || `Still chasing '${tag}' huh? You're beyond help.`}</span>`;
  jrpgBubbles.appendChild(bubble);
  setTimeout(() => bubble.remove(), 5000);
}

function updateBackground(tag) {
  const page = Math.floor(Math.random() * 5) + 1;
  const url = `https://danbooru.donmai.us/posts.json?limit=100&page=${page}&tags=${encodeURIComponent(`order:approval rating:explicit ${tag}`)}`;
  fetch(url)
    .then(res => res.json())
    .then(posts => {
      const post = posts[Math.floor(Math.random() * posts.length)];
      if (post?.large_file_url) {
        localStorage.setItem("backgroundImage", `https://danbooru.donmai.us${post.large_file_url}`);
        backgroundBlur.style.backgroundImage = `url(https://danbooru.donmai.us${post.large_file_url})`;
      } else {
        const fallback = localStorage.getItem("backgroundImage");
        if (fallback) backgroundBlur.style.backgroundImage = `url(${fallback})`;
      }
    });
}

function fetchAndRenderArtists() {
  artistGallery.innerHTML = "";
  const filtered = cachedArtists.filter(a => activeTags.every(t => a.tags.includes(t)));

  filtered.forEach((artist, index) => {
    const card = document.createElement("div");
    card.className = "artist-card";

    const name = document.createElement("div");
    name.className = "artist-name";
    name.textContent = artist.name;

    let tapTimer = null;
    name.onclick = () => {
      if (tapTimer) {
        navigator.clipboard.writeText(artist.name);
        name.textContent = "Copied!";
        setTimeout(() => (name.textContent = artist.name), 800);
        clearTimeout(tapTimer);
        tapTimer = null;
      } else {
        tapTimer = setTimeout(() => (tapTimer = null), 300);
      }
    };

    const img = document.createElement("img");
    img.src = `https://cdn.zele.st/data/NAX/Images/danbooru-artist-tags-v4.5/${encodeURIComponent(artist.name)}.jpg`;
    img.onerror = () => (img.src = artist.image || "fallback.jpg");
    img.onclick = () => openLightbox(artist);

    card.append(img, name);
    artistGallery.appendChild(card);
  });
}

function openLightbox(artist) {
  if (!artist.images?.length) return;
  currentIndex = 0;
  lightbox.style.display = "flex";
  updateLightbox(artist);
  prevBtn.onclick = () => currentIndex > 0 && updateLightbox(artist, --currentIndex);
  nextBtn.onclick = () => currentIndex < artist.images.length - 1 && updateLightbox(artist, ++currentIndex);
  closeBtn.onclick = () => (lightbox.style.display = "none");
}

function updateLightbox(artist) {
  lightboxImg.src = artist.images[currentIndex];
  lightboxCaption.textContent = `${artist.name} — Image ${currentIndex + 1} of ${artist.images.length}`;
}

// Soundcloud logic
function setSoundcloudTrack(index) {
  scPlayer.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(soundcloudLinks[index])}&auto_play=true`;
}

toggleAudioBtn.onclick = () => {
  if (scPlayer.style.display === "none") {
    scPlayer.style.display = "block";
    toggleAudioBtn.textContent = "🔊 Femdom Hypno";
    setSoundcloudTrack(currentAudioIndex);
  } else {
    scPlayer.style.display = "none";
    toggleAudioBtn.textContent = "🔇 Femdom Hypno";
  }
};

prevAudioBtn.onclick = () => {
  currentAudioIndex = (currentAudioIndex - 1 + soundcloudLinks.length) % soundcloudLinks.length;
  setSoundcloudTrack(currentAudioIndex);
};

nextAudioBtn.onclick = () => {
  currentAudioIndex = (currentAudioIndex + 1) % soundcloudLinks.length;
  setSoundcloudTrack(currentAudioIndex);
};
