
const coreTags = ["femdom", "pegging", "chastity_cage", "tentacle_sex", "cyber_femdom"];
const tagContainer = document.getElementById("tag-buttons");
const bubbleContainer = document.getElementById("jrpg-bubbles");
const artistGallery = document.getElementById("artist-gallery");

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
const scIframe = document.getElementById("sc-player");
const scContainer = document.getElementById("soundcloud-container");

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

// The rest of the artist filtering code remains unchanged from v4


// Tag-specific taunts
let tagTaunts = {};
fetch("tag-taunts.json")
  .then(res => res.json())
  .then(data => tagTaunts = data);

function showTaunt(tag = null) {
  let msg = document.createElement("div");
  msg.className = "jrpg-bubble";

  if (tag && tagTaunts[tag]) {
    const pool = tagTaunts[tag];
    msg.textContent = pool[Math.floor(Math.random() * pool.length)];
  } else {
    const fallback = [
      "You're really into that? Pathetic.",
      "Keep clicking, you desperate freak.",
      "Tsk. This is all being recorded, you know.",
      "Your shame is showing again, slut."
    ];
    msg.textContent = fallback[Math.floor(Math.random() * fallback.length)];
  }

  bubbleContainer.appendChild(msg);
  setTimeout(() => bubbleContainer.removeChild(msg), 3000);
}

// Patch tag click to use tag-based taunt
document.querySelectorAll(".tag-button").forEach(button => {
  button.addEventListener("click", () => {
    const tagName = button.textContent.replace(/ /g, "_");
    button.classList.toggle("active");
    showTaunt(tagName);
    fetchArtists();
  });
});
