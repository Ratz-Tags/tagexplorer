
const kinkTags = [
  "chastity_cage", "flat_chastity_cage", "pegging", "dominatrix", "femdom", "orgasm_denial", "small_penis_humiliation", "public_humiliation", "tease_and_deny", "cock_cage_visible_through_clothes", "mind_break", "crying_while_cumming",
  "used_condom", "cum_feeding", "cum_tube_feeding", "drinking_cum", "pouring_from_condom", "cum_in_food", "creampie_in_chastity_cage", "cum_urination_overlap",
  "prostate_milking", "penis_milking", "hand_milking", "milking_machine", "lactation",
  "machine_penetration", "automatic_dildo", "bondage_device", "cyber_femdom", "sex_machine",
  "foot_domination", "foot_worship", "toe_sucking", "sockjob", "shoebill_domination",
  "hogtie", "spreader_bar", "shibari", "restraints", "arm_binder", "gagged",
  "sissy_training", "feminization", "forced_feminization", "bimbofication", "crossdressing_male", "trap_in_chastity",
  "collar_with_leash", "pet_bowl_drinking", "girl_walking_boy_on_leash", "barking_like_a_dog",
  "futanari", "tentacle_sex", "extreme_penetration", "large_penetration", "knotting",
  "netorare", "netorase"
];

const coreTags = ["femdom", "pegging", "chastity_cage", "tentacle_sex", "cyber_femdom"];
let taunts = [];

fetch('taunts.json')
  .then(res => res.json())
  .then(data => taunts = data);

const artistGallery = document.getElementById("artist-gallery");
const tagContainer = document.getElementById("tag-buttons");
const bubbleContainer = document.getElementById("jrpg-bubbles");

kinkTags.forEach(tag => {
  const btn = document.createElement("button");
  btn.textContent = tag.replace(/_/g, " ");
  btn.className = "tag-button";
  btn.addEventListener("click", () => {
    btn.classList.toggle("active");
    showTaunt();
    fetchArtists();
  });
  tagContainer.appendChild(btn);
});

function showTaunt() {
  if (!taunts.length) return;
  const msg = document.createElement("div");
  msg.className = "jrpg-bubble";
  msg.textContent = taunts[Math.floor(Math.random() * taunts.length)];
  bubbleContainer.appendChild(msg);
  setTimeout(() => bubbleContainer.removeChild(msg), 3000);
}

async function fetchArtists() {
  const selectedTags = [...document.querySelectorAll(".tag-button.active")].map(btn => btn.textContent.replace(/ /g, "_"));
  if (selectedTags.length === 0) return;

  const query = encodeURIComponent([...selectedTags, "order:rank"].join(" "));
  const res = await fetch(`https://danbooru.donmai.us/posts.json?tags=${query}&limit=100`);
  const posts = await res.json();

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
}

function displayArtists(list) {
  artistGallery.innerHTML = "";
  list.forEach(artist => {
    const div = document.createElement("div");
    div.className = "artist-card";
    div.innerHTML = `
      <img src="https://danbooru.donmai.us${artist.preview}" alt="preview">
      <h3>${artist.name}</h3>
      <p>${[...artist.tags].map(t => t.replace(/_/g, " ")).join(", ")}</p>
    `;
    artistGallery.appendChild(div);
  });
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

const audio = document.getElementById("hypno-audio");
const toggleBtn = document.getElementById("toggle-audio");
toggleBtn.addEventListener("click", () => {
  if (audio.paused) {
    audio.play();
    toggleBtn.textContent = "🔊 Femdom Hypno";
  } else {
    audio.pause();
    toggleBtn.textContent = "🔇 Femdom Hypno";
  }
});
