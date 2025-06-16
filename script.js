
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

function renderTagButtons(tags) {
  const container = document.getElementById("filter-buttons");
  container.innerHTML = '';
  tags.forEach(tag => {
    const btn = document.createElement("button");
    btn.className = "tag-button";
    const img = document.createElement("img");
    if (tagIcons[tag]) {
      img.src = tagIcons[tag];
      img.alt = tag;
      img.style.height = "16px";
      img.style.marginRight = "4px";
    }
    btn.appendChild(img);
    btn.appendChild(document.createTextNode(tag.replaceAll('_', ' ')));
    btn.dataset.tag = tag;
    btn.addEventListener("click", () => {
      if (activeTags.has(tag)) {
        activeTags.delete(tag);
        btn.classList.remove("active");
      } else {
        activeTags.add(tag);
        btn.classList.add("active");
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
      img.src = artist.previewImage;
      card.appendChild(img);

      const name = document.createElement("div");
      name.className = "artist-name";
      name.textContent = artist.artistName;
      card.appendChild(name);

      const taglist = document.createElement("div");
      taglist.className = "artist-tags";
      taglist.textContent = artist.kinkTags.join(", ");
      card.appendChild(taglist);

      gallery.appendChild(card);
    }
  });
}

// Fetch artist data and init
fetch("artists.json")
  .then(res => res.json())
  .then(data => {
    allArtists = data;
    renderTagButtons(filterTags);
    filterArtists();
  });
