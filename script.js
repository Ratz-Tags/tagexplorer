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

const tagButtonsContainer = document.getElementById("tag-buttons");
const artistGallery = document.getElementById("artist-gallery");
const jrpgBubbles = document.getElementById("jrpg-bubbles");
const backgroundBlur = document.getElementById("background-blur");
const scPlayer = document.getElementById("sc-player");
const soundcloudContainer = document.getElementById("soundcloud-container");
const toggleAudioBtn = document.getElementById("toggle-audio");
const prevAudioBtn = document.getElementById("prev-audio");
const nextAudioBtn = document.getElementById("next-audio");
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxCaption = document.getElementById("lightbox-caption");
const closeBtn = document.querySelector(".close");
const prevBtn = document.getElementById("prev-img");
const nextBtn = document.getElementById("next-img");

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
])
.then(([tooltips, taunts, artists]) => {
  tagTooltips = tooltips;
  tagTaunts = taunts;
  cachedArtists = artists;
  renderTagButtons();
  fetchAndRenderArtists();
  updateBackground("femdom");
});

function renderTagButtons() {
  tagButtonsContainer.innerHTML = "";
  kinkTags.forEach((tag) => {
    const btn = document.createElement("button");
    btn.classList.add("tag-button");
    btn.innerText = tag.replaceAll("_", " ");
    btn.title = tagTooltips[tag] || `You really tapped '${tag}'? Pathetic.`;
    if (activeTags.includes(tag)) btn.classList.add("active");
    btn.addEventListener("click", () => toggleTag(tag));
    tagButtonsContainer.appendChild(btn);
  });
}

function toggleTag(tag) {
  const isActive = activeTags.includes(tag);
  activeTags = isActive ? activeTags.filter(t => t !== tag) : [...activeTags, tag];
  renderTagButtons();
  fetchAndRenderArtists();
  showTaunt(tag);
  updateBackground(activeTags.length > 0 ? activeTags.at(-1) : "femdom");
}

function showTaunt(tag) {
  const taunt = tagTaunts[tag] || `Still chasing '${tag}' huh? You're beyond help.`;
  const bubble = document.createElement("div");
  bubble.className = "jrpg-bubble";
  bubble.innerHTML = `<img src='./icons/chibi.png' class='chibi' /><span>${taunt}</span>`;
  jrpgBubbles.appendChild(bubble);
  setTimeout(() => bubble.remove(), 5000);
}

function updateBackground(tag) {
  const page = Math.floor(Math.random() * 5) + 1;
  const fullQuery = `order:approval rating:explicit ${tag}`;
  const url = `https://danbooru.donmai.us/posts.json?limit=100&page=${page}&tags=${encodeURIComponent(fullQuery)}`;
  fetch(url)
    .then(res => res.json())
    .then(posts => {
      if (posts && posts.length > 0) {
        const randomPost = posts[Math.floor(Math.random() * posts.length)];
        if (randomPost?.large_file_url) {
          backgroundBlur.style.backgroundImage = `url(https://danbooru.donmai.us${randomPost.large_file_url})`;
        }
      }
    })
    .catch(console.error);
}

function fetchAndRenderArtists() {
  artistGallery.innerHTML = "";
  const filtered = cachedArtists.filter(artist =>
    activeTags.every(tag => artist.tags.includes(tag))
  );

  filtered.forEach((artist, index) => {
    const card = document.createElement("div");
    card.classList.add("artist-card");

    const name = document.createElement("div");
    name.classList.add("artist-name");
    name.innerText = artist.name;

    let tapTimeout = null;
    name.addEventListener("click", () => {
      if (tapTimeout !== null) {
        navigator.clipboard.writeText(artist.name);
        name.innerText = "Copied!";
        setTimeout(() => (name.innerText = artist.name), 800);
        clearTimeout(tapTimeout);
        tapTimeout = null;
      } else {
        tapTimeout = setTimeout(() => {
          tapTimeout = null;
        }, 300);
      }
    });

    const img = document.createElement("img");
    img.src = `https://cdn.zele.st/data/NAX/Images/danbooru-artist-tags-v4.5/${encodeURIComponent(artist.name)}.jpg`;
    img.onerror = () => {
      img.src = artist.image || "fallback.jpg";
    };
    img.addEventListener("click", () => openLightbox(artist));

    card.appendChild(img);
    card.appendChild(name);
    artistGallery.appendChild(card);
  });
}

function openLightbox(artist) {
  if (!artist.images || artist.images.length === 0) return;
  currentIndex = 0;
  lightbox.style.display = "flex";
  updateLightbox(artist);

  prevBtn.onclick = () => {
    if (currentIndex > 0) currentIndex--;
    updateLightbox(artist);
  };

  nextBtn.onclick = () => {
    if (currentIndex < artist.images.length - 1) currentIndex++;
    updateLightbox(artist);
  };

  closeBtn.onclick = () => {
    lightbox.style.display = "none";
  };
}

function updateLightbox(artist) {
  lightboxImg.src = artist.images[currentIndex];
  lightboxCaption.innerText = `${artist.name} — Image ${currentIndex + 1} of ${artist.images.length}`;
}
