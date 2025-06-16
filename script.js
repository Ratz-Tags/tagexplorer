document.addEventListener("DOMContentLoaded", () => {
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

      if (tooltips[tag]) {
        btn.title = tooltips[tag];
      }

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
        img.src = artist.previewImage;
        img.onerror = () => {
          img.src = `https://danbooru.donmai.us${artist.backupImage || '/images/placeholder.png'}`;
        };
        img.loading = "lazy";
        card.appendChild(img);

        const name = document.createElement("div");
        name.className = "artist-name";
        name.textContent = `${artist.artistName} (${artist.nsfwLevel}${artist.artStyle ? `, ${artist.artStyle}` : ''})`;
        card.appendChild(name);

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

    const pool = tagTaunts[tag] || taunts;
    bubble.textContent = pool[Math.floor(Math.random() * pool.length)];

    container.appendChild(bubble);
    setTimeout(() => bubble.remove(), 5000);
  }

  const hypnoTracks = [
    "https://soundcloud.com/sissypositive/happy-chastity-audio-hypnosis-18",
    "https://soundcloud.com/sissy-needs/nipples-sissy-hypno",
    "https://soundcloud.com/user-682994637/after-dark-2-gloryhole-instructions",
    "https://soundcloud.com/user-526345318/affirmations-for-cuckolds-1",
    "https://soundcloud.com/user-526345318/sph-hypno-repetitions-4",
    "https://soundcloud.com/dogelol-523627490/maria-dont-beg-me-soft",
    "https://soundcloud.com/babewithaboner/bethanys-cum-rag",
    "https://soundcloud.com/re-elle/urethral-ft-lamb-kebab-version-2"
  ];

  let currentAudio = 0;
  const scPlayer = document.getElementById("sc-player");
  const audioToggle = document.getElementById("toggle-audio");
  const prevAudio = document.getElementById("prev-audio");
  const nextAudio = document.getElementById("next-audio");

  function loadTrack(index) {
    const url = hypnoTracks[index];
    if (scPlayer) {
      scPlayer.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=true`;
      document.getElementById("soundcloud-container").style.display = 'block';
    }
  }

  if (audioToggle && prevAudio && nextAudio) {
    audioToggle.addEventListener("click", () => {
      const container = document.getElementById("soundcloud-container");
      const visible = container.style.display !== 'none';
      container.style.display = visible ? 'none' : 'block';
    });
    prevAudio.addEventListener("click", () => {
      currentAudio = (currentAudio - 1 + hypnoTracks.length) % hypnoTracks.length;
      loadTrack(currentAudio);
    });
    nextAudio.addEventListener("click", () => {
      currentAudio = (currentAudio + 1) % hypnoTracks.length;
      loadTrack(currentAudio);
    });
  }

  loadTrack(currentAudio);

  Promise.all([
    fetch("artists.json").then(r => r.json()),
    fetch("tag-tooltips.json").then(r => r.json()),
    fetch("taunts.json").then(r => r.json()),
    fetch("tag-taunts.json").then(r => r.json())
  ]).then(([artists, tool, baseTaunts, specificTaunts]) => {
    allArtists = artists;
    tooltips = tool;
    taunts = baseTaunts;
    tagTaunts = specificTaunts;
    renderTagButtons(filterTags);
    filterArtists();
  });
});
                                         
