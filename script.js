// (Script.js) – merged from working + current version with full artist logic, localStorage fallback, audio, and background

document.addEventListener("DOMContentLoaded", () => {
  const kinkTags = [
    "chastity_cage", "futanari", "pegging", "bimbofication", "orgasm_denial",
    "netorare", "feminization", "public_humiliation", "humiliation", "dominatrix",
    "tentacle_sex", "foot_domination", "gokkun", "milking_machine", "mind_break",
    "cum_feeding", "prostate_milking", "lactation", "sex_machine", "cyber_femdom",
    "gagged", "sissy_training", "extreme_penetration", "large_penetration", "netorase"
  ];

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

  const tagButtonsContainer = document.getElementById("tag-buttons");
  const artistGallery = document.getElementById("artist-gallery");
  const jrpgBubbles = document.getElementById("jrpg-bubbles");
  const backgroundBlur = document.getElementById("background-blur");

  const scPlayer = document.getElementById("sc-player");
  const toggleAudioBtn = document.getElementById("toggle-audio");
  const prevAudioBtn = document.getElementById("prev-audio");
  const nextAudioBtn = document.getElementById("next-audio");

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

  let currentAudioIndex = 0;
  let activeTags = new Set();
  let allArtists = [];
  let tagTooltips = {};
  let tagTaunts = {};
  let taunts = [];

  function setSoundcloudTrack(index) {
    scPlayer.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(soundcloudLinks[index])}&auto_play=true`;
  }

  toggleAudioBtn.onclick = () => {
    const showing = scPlayer.style.display !== "none";
    scPlayer.style.display = showing ? "none" : "block";
    toggleAudioBtn.textContent = showing ? "🔇 Femdom Hypno" : "🔊 Femdom Hypno";
    if (!showing) setSoundcloudTrack(currentAudioIndex);
  };

  prevAudioBtn.onclick = () => {
    currentAudioIndex = (currentAudioIndex - 1 + soundcloudLinks.length) % soundcloudLinks.length;
    setSoundcloudTrack(currentAudioIndex);
  };

  nextAudioBtn.onclick = () => {
    currentAudioIndex = (currentAudioIndex + 1) % soundcloudLinks.length;
    setSoundcloudTrack(currentAudioIndex);
  };

  function setRandomBackground() {
    const tag = [...activeTags].at(-1) || "femdom";
    const page = Math.floor(Math.random() * 5) + 1;
    const url = `https://danbooru.donmai.us/posts.json?limit=100&page=${page}&tags=${encodeURIComponent(`order:approval rating:explicit ${tag}`)}`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        const post = data[Math.floor(Math.random() * data.length)];
        if (post?.large_file_url) {
          localStorage.setItem("backgroundImage", `https://danbooru.donmai.us${post.large_file_url}`);
          backgroundBlur.style.backgroundImage = `url(https://danbooru.donmai.us${post.large_file_url})`;
        } else {
          const cached = localStorage.getItem("backgroundImage");
          if (cached) backgroundBlur.style.backgroundImage = `url(${cached})`;
        }
      });
  }

  function spawnBubble(tag) {
    const div = document.createElement("div");
    div.className = "jrpg-bubble";
    const chibi = document.createElement("img");
    chibi.src = "icons/chibi.png";
    chibi.className = "chibi";
    const line = document.createElement("span");
    const pool = tagTaunts[tag] || taunts;
    line.textContent = pool[Math.floor(Math.random() * pool.length)] || `Still chasing '${tag}' huh? You're beyond help.`;
    div.append(chibi, line);
    jrpgBubbles.appendChild(div);
    setTimeout(() => div.remove(), 5000);
  }

  function setBestImage(artist, img) {
    const cacheKey = `danbooru-image-${artist.artistName}`;
    const cachedUrl = localStorage.getItem(cacheKey);
    const tryLoad = (url, retries = 2) => {
      const testImg = new Image();
      testImg.onload = () => {
        img.src = url;
        localStorage.setItem(cacheKey, url);
      };
      testImg.onerror = () => {
        if (retries > 0) setTimeout(() => tryLoad(url, retries - 1), 500);
        else img.src = "fallback.jpg";
      };
      testImg.src = url;
    };

    if (cachedUrl) return tryLoad(cachedUrl);

    fetch(`https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(artist.artistName)}+order:approval&limit=1`)
      .then(r => r.json())
      .then(data => {
        const post = data[0];
        const raw = post?.large_file_url || post?.file_url;
        if (raw) {
          const full = raw.startsWith("http") ? raw : `https://danbooru.donmai.us${raw}`;
          tryLoad(full);
        } else img.src = "fallback.jpg";
      })
      .catch(() => img.src = "fallback.jpg");
  }

  function renderTagButtons() {
    tagButtonsContainer.innerHTML = "";
    kinkTags.forEach(tag => {
      const btn = document.createElement("button");
      btn.className = "tag-button";
      if (tagIcons[tag]) {
        const icon = document.createElement("img");
        icon.src = tagIcons[tag];
        icon.style.height = "16px";
        icon.style.marginRight = "4px";
        btn.appendChild(icon);
      }
      btn.appendChild(document.createTextNode(tag.replaceAll("_", " ")));
      btn.dataset.tag = tag;
      if (tagTooltips[tag]) btn.title = tagTooltips[tag];
      if (activeTags.has(tag)) btn.classList.add("active");
      btn.onclick = () => {
        if (activeTags.has(tag)) activeTags.delete(tag);
        else {
          activeTags.add(tag);
          spawnBubble(tag);
        }
        renderTagButtons();
        filterArtists();
        setRandomBackground();
      };
      tagButtonsContainer.appendChild(btn);
    });
  }

  function filterArtists() {
    artistGallery.innerHTML = "";
    const selected = Array.from(activeTags);
    allArtists.forEach(artist => {
      const tags = artist.kinkTags || [];
      if (selected.every(tag => tags.includes(tag))) {
        const card = document.createElement("div");
        card.className = "artist-card";

        const img = document.createElement("img");
        img.className = "artist-image";
        setBestImage(artist, img);
        img.addEventListener("click", () => {
          const zoomed = img.cloneNode();
          zoomed.classList.add("fullscreen-img");
          document.body.appendChild(zoomed);
          zoomed.onclick = () => zoomed.remove();
        });

        const name = document.createElement("div");
        name.className = "artist-name";
        name.textContent = `${artist.artistName} (${artist.nsfwLevel}${artist.artStyle ? `, ${artist.artStyle}` : ""})`;
        name.addEventListener("touchstart", e => {
          name.dataset.touchStart = Date.now();
        });
        name.addEventListener("touchend", e => {
          if (Date.now() - name.dataset.touchStart < 1000) return;
          navigator.clipboard.writeText(artist.artistName.replaceAll("_", " "));
          name.textContent = "Copied!";
          setTimeout(() => {
            name.textContent = `${artist.artistName} (${artist.nsfwLevel}${artist.artStyle ? `, ${artist.artStyle}` : ""})`;
          }, 800);
        });

        const taglist = document.createElement("div");
        taglist.className = "artist-tags";
        taglist.textContent = artist.kinkTags.join(", ");

        card.append(img, name, taglist);
        artistGallery.appendChild(card);
      }
    });
  }

  Promise.all([
    fetch("artists.json").then(r => r.json()),
    fetch("artists-local.json").then(r => r.json()),
    fetch("tag-tooltips.json").then(r => r.json()),
    fetch("taunts.json").then(r => r.json()),
    fetch("tag-taunts.json").then(r => r.json())
  ]).then(([remote, local, tips, general, specific]) => {
    allArtists = [...remote, ...local];
    tagTooltips = tips;
    taunts = general;
    tagTaunts = specific;
    renderTagButtons();
    filterArtists();
    setRandomBackground();
    setSoundcloudTrack(currentAudioIndex);
  });
});
