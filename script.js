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
  const copiedSidebar = document.getElementById("copied-sidebar");
  const sidebarToggle = document.querySelector(".sidebar-toggle");
  const moanAudio = document.getElementById("moan-audio");
  let copiedArtists = new Set();

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
  let audio = new Audio();
  audio.src = soundcloudLinks[currentAudioIndex];
  audio.autoplay = false;
  audio.loop = false;

  audio.addEventListener("ended", () => {
    currentAudioIndex = (currentAudioIndex + 1) % soundcloudLinks.length;
    audio.src = soundcloudLinks[currentAudioIndex];
    audio.play();
    showToast("Now playing: Femdom Track #" + (currentAudioIndex + 1));
  });

  document.getElementById("toggle-audio").onclick = () => {
    if (audio.paused) {
      audio.play();
      document.getElementById("toggle-audio").textContent = "🔊 Femdom Hypno";
    } else {
      audio.pause();
      document.getElementById("toggle-audio").textContent = "🔇 Femdom Hypno";
    }
  };

  document.getElementById("prev-audio").onclick = () => {
    currentAudioIndex = (currentAudioIndex - 1 + soundcloudLinks.length) % soundcloudLinks.length;
    audio.src = soundcloudLinks[currentAudioIndex];
    audio.play();
    showToast("Rewound to: Femdom Track #" + (currentAudioIndex + 1));
  };

  document.getElementById("next-audio").onclick = () => {
    currentAudioIndex = (currentAudioIndex + 1) % soundcloudLinks.length;
    audio.src = soundcloudLinks[currentAudioIndex];
    audio.play();
    showToast("Next up: Femdom Track #" + (currentAudioIndex + 1));
  };

  if (sidebarToggle && copiedSidebar) {
    sidebarToggle.addEventListener("click", () => {
      copiedSidebar.classList.toggle("visible");
    });
  }

  let activeTags = new Set();
  let allArtists = [];
  let tagTooltips = {};
  let tagTaunts = {};
  let taunts = [];

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast-popup";
    toast.textContent = message;
    document.body.appendChild(toast);

    if (Math.random() < 0.4) {
      moanAudio.currentTime = 0;
      moanAudio.play().catch(() => {});
    }

    setTimeout(() => toast.remove(), 3000);
  }

  function setRandomBackground() {
    const query = "chastity_cage"; // You can rotate this later
    const page = Math.floor(Math.random() * 5) + 1;

    fetch(`https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(query)}+order:approval&limit=40&page=${page}`)
      .then(res => res.json())
      .then(data => {
        if (data.length) {
          const post = data[Math.floor(Math.random() * data.length)];
          const raw = post?.large_file_url || post?.file_url;
          const full = raw?.startsWith("http") ? raw : `https://danbooru.donmai.us${raw}`;
          if (full) {
            backgroundBlur.style.backgroundImage = `url(${full})`;
          }
        }
      })
      .catch(() => {
        backgroundBlur.style.backgroundColor = "#111"; // fallback
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
  let currentIndex = 0;
  let posts = [];
  const zoomWrapper = document.createElement("div");
  zoomWrapper.className = "fullscreen-wrapper";

  const zoomed = document.createElement("img");
  zoomed.className = "fullscreen-img";
  zoomWrapper.appendChild(zoomed);

  const closeBtn = document.createElement("button");
  closeBtn.className = "zoom-close";
  closeBtn.textContent = "×";
  closeBtn.onclick = () => zoomWrapper.remove();

  const prevBtn = document.createElement("button");
  prevBtn.className = "zoom-prev";
  prevBtn.textContent = "←";

  const nextBtn = document.createElement("button");
  nextBtn.className = "zoom-next";
  nextBtn.textContent = "→";

  zoomWrapper.append(closeBtn, prevBtn, nextBtn);
  document.body.appendChild(zoomWrapper);

  function showPost(i) {
    const post = posts[i];
    const raw = post?.large_file_url || post?.file_url;
    const full = raw?.startsWith("http") ? raw : `https://danbooru.donmai.us${raw}`;
    zoomed.src = full;
  }

  prevBtn.onclick = () => {
    currentIndex = (currentIndex - 1 + posts.length) % posts.length;
    showPost(currentIndex);
  };

  nextBtn.onclick = () => {
    currentIndex = (currentIndex + 1) % posts.length;
    showPost(currentIndex);
  };

  fetch(`https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(artist.artistName)}+order:approval&limit=20`)
    .then(res => res.json())
    .then(data => {
      posts = data;
      if (posts.length) showPost(currentIndex);
    });
});

        const name = document.createElement("div");
        name.className = "artist-name";
        name.textContent = `${artist.artistName} (${artist.nsfwLevel}${artist.artStyle ? `, ${artist.artStyle}` : ""})`;

        // Touch (mobile) long press
        name.addEventListener("touchstart", e => {
          name.dataset.touchStart = Date.now();
        });
        name.addEventListener("touchend", e => {
          if (Date.now() - name.dataset.touchStart < 800) return;
          handleArtistCopy(artist, img.src);
        });

        // Mouse (desktop) long press
        name.addEventListener("mousedown", e => {
          name.dataset.mouseDown = Date.now();
        });
        name.addEventListener("mouseup", e => {
          if (Date.now() - name.dataset.mouseDown < 800) return;
          handleArtistCopy(artist, img.src);
        });

        const taglist = document.createElement("div");
        taglist.className = "artist-tags";
        taglist.textContent = artist.kinkTags.join(", ");

        card.append(img, name, taglist);
        artistGallery.appendChild(card);
      }
    });
  }

  function handleArtistCopy(artist, previewUrl) {
    const cleanName = artist.artistName.replaceAll("_", " ");
    navigator.clipboard.writeText(cleanName);
    showToast("Copied: " + cleanName);

    if (!copiedArtists.has(artist.artistName)) {
      copiedArtists.add(artist.artistName);

      const container = document.createElement("div");
      container.className = "sidebar-artist";
      container.id = `copy-${artist.artistName}`;

      const previewImg = document.createElement("img");
      previewImg.src = previewUrl || "fallback.jpg";
      container.appendChild(previewImg);

      const span = document.createElement("span");
      span.textContent = cleanName;
      container.appendChild(span);

      container.onclick = () => {
        const zoomed = previewImg.cloneNode();
        zoomed.className = "fullscreen-img";
        document.body.appendChild(zoomed);
        zoomed.onclick = () => zoomed.remove();
      };

      copiedSidebar.appendChild(container);
    }
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
    setInterval(setRandomBackground, 15000); // every 15 seconds
  });

});
