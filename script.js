const kinkTags = [
  "chastity_cage", "futanari", "pegging", "bimbofication", "orgasm_denial",
  "netorare", "feminization", "public_humiliation", "humiliation", "dominatrix",
  "tentacle_sex", "foot_domination", "gokkun", "milking_machine", "mind_break",
  "cum_feeding", "prostate_milking", "lactation", "sex_machine", "cyber_femdom",
  "gagged", "sissy_training", "extreme_penetration", "large_penetration", "netorase"
];

const audioLinks = [
  'https://on.soundcloud.com/HADalMkX8rPG2ISu0Z',
  'https://on.soundcloud.com/vOQ4cOkO5vjnkZoqPu',
  'https://soundcloud.com/sissypositive/happy-chastity-audio-hypnosis-18',
  'https://soundcloud.com/sissy-needs/nipples-sissy-hypno',
  'https://soundcloud.com/user-682994637/after-dark-2-gloryhole-instructions',
  'https://soundcloud.com/user-526345318/affirmations-for-cuckolds-1',
  'https://soundcloud.com/user-526345318/sph-hypno-repetitions-4',
  'https://soundcloud.com/dogelol-523627490/maria-dont-beg-me-soft',
  'https://soundcloud.com/babewithaboner/bethanys-cum-rag',
  'https://soundcloud.com/re-elle/urethral-ft-lamb-kebab-version-2'
];

const tagButtonsContainer = document.getElementById("tag-buttons");
const artistGallery = document.getElementById("artist-gallery");
const jrpgBubbles = document.getElementById("jrpg-bubbles");
const backgroundBlur = document.getElementById("background-blur");
const scPlayer = document.getElementById("sc-player");
const soundcloudContainer = document.getElementById("soundcloud-container");
const toggleAudioBtn = document.getElementById("toggle-audio");
const prevAudioBtn = document.getElementById("prev-audio");
const nextAudioBtn = document.getElementById("next-audio");

let currentAudioIndex = 0;
let activeTags = [];
let cachedArtists = [];
let tagTooltips = {};
let tagTaunts = {};

Promise.all([
  fetch("tag-tooltips.json").then(r => r.json()).catch(() => ({})),
  fetch("tag-taunts.json").then(r => r.json()).catch(() => ({}))
])
.then(([tooltips, taunts]) => {
  tagTooltips = tooltips;
  tagTaunts = taunts;
  renderTagButtons();
  fetchAndRenderArtists();
})
.catch(console.error);

function renderTagButtons() {
  kinkTags.forEach((tag) => {
    const btn = document.createElement("button");
    btn.classList.add("tag-button");
    btn.innerText = tag.replaceAll("_", " ");
    btn.title = tagTooltips[tag] || `You really tapped '${tag}'? Pathetic.`;
    btn.addEventListener("click", () => toggleTag(tag, btn));
    tagButtonsContainer.appendChild(btn);
  });
}

function toggleTag(tag, btn) {
  if (activeTags.includes(tag)) {
    activeTags = activeTags.filter((t) => t !== tag);
    btn.classList.remove("active");
  } else {
    activeTags.push(tag);
    btn.classList.add("active");
  }
  fetchAndRenderArtists();
  showTaunt(tag);
  updateBackground(tag);
}

function showTaunt(tag) {
  const taunt = tagTaunts[tag] || `Still chasing '${tag}' huh? You're beyond help.`;
  const bubble = document.createElement("div");
  bubble.className = "jrpg-bubble";
  bubble.textContent = taunt;
  jrpgBubbles.appendChild(bubble);
  setTimeout(() => bubble.remove(), 5000);
}

function updateBackground(tag) {
  const url = `https://danbooru.donmai.us/posts.json?limit=1&random=true&tags=${encodeURIComponent(tag)}+rating:explicit+-loli+-shota+-young`;
  fetch(url)
    .then((res) => res.json())
    .then((posts) => {
      if (posts[0]?.large_file_url) {
        backgroundBlur.style.backgroundImage = `url(https://danbooru.donmai.us${posts[0].large_file_url})`;
      }
    })
    .catch(console.error);
}

function fetchAndRenderArtists() {
  artistGallery.innerHTML = "";
  fetch("artists.json")
    .then((res) => res.json())
    .then((artists) => {
      cachedArtists = artists.filter((a) =>
        activeTags.length === 0 || activeTags.every((tag) => a.tags.includes(tag))
      );
      cachedArtists.forEach((artist, index) => createArtistCard(artist, index));
    })
    .catch((err) => {
      console.error("Failed to load artists.json", err);
    });
}

function createArtistCard(artist, index) {
  const card = document.createElement("div");
  card.className = "artist-card";

  const img = document.createElement("img");
  const encoded = encodeURIComponent(artist.name).replace(/%20/g, "%2520");
  const cacheKey = `artist-img-${encoded}`;
  const cached = localStorage.getItem(cacheKey);

  if (cached) {
    img.src = cached;
  } else {
    img.src = `https://cdn.zele.st/data/NAX/Images/danbooru-artist-tags-v4.5/${encoded}.jpg`;
    img.onload = () => localStorage.setItem(cacheKey, img.src);
    img.onerror = () => {
      if (!img.src.includes("danbooru")) {
        img.src = `https://danbooru.donmai.us${artist.fallback}`;
        localStorage.setItem(cacheKey, img.src);
      }
    };
  }

  img.addEventListener("click", () => openLightbox(index));

  const name = document.createElement("div");
  name.className = "artist-name";
  name.textContent = artist.name;
  name.addEventListener("dblclick", () => {
    navigator.clipboard.writeText(artist.name);
    name.textContent = "Copied!";
    setTimeout(() => (name.textContent = artist.name), 1000);
  });

  card.appendChild(img);
  card.appendChild(name);
  artistGallery.appendChild(card);
}

// Lightbox viewer
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxCaption = document.getElementById("lightbox-caption");
const closeBtn = document.querySelector(".close");
const prevBtn = document.getElementById("prev-img");
const nextBtn = document.getElementById("next-img");

let currentIndex = 0;

function openLightbox(index) {
  currentIndex = index;
  const artist = cachedArtists[index];
  lightbox.style.display = "flex";
  lightboxImg.src = `https://danbooru.donmai.us${artist.fallback}`;
  lightboxCaption.textContent = artist.name;
}

function changeLightbox(dir) {
  currentIndex = (currentIndex + dir + cachedArtists.length) % cachedArtists.length;
  openLightbox(currentIndex);
}

closeBtn.onclick = () => (lightbox.style.display = "none");
prevBtn.onclick = () => changeLightbox(-1);
nextBtn.onclick = () => changeLightbox(1);

// Audio control logic
function loadAudio(index) {
  scPlayer.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(audioLinks[index])}&auto_play=true`;
}

toggleAudioBtn.addEventListener("click", () => {
  if (soundcloudContainer.style.display === "none") {
    soundcloudContainer.style.display = "block";
    loadAudio(currentAudioIndex);
    toggleAudioBtn.textContent = "🔊 Femdom Hypno";
  } else {
    soundcloudContainer.style.display = "none";
    scPlayer.src = "";
    toggleAudioBtn.textContent = "🔇 Femdom Hypno";
  }
});

prevAudioBtn.addEventListener("click", () => {
  currentAudioIndex = (currentAudioIndex - 1 + audioLinks.length) % audioLinks.length;
  loadAudio(currentAudioIndex);
});

nextAudioBtn.addEventListener("click", () => {
  currentAudioIndex = (currentAudioIndex + 1) % audioLinks.length;
  loadAudio(currentAudioIndex);
});
