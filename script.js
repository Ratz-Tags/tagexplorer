document.addEventListener("DOMContentLoaded", () => {
  const kinkTags = [
    "bimbofication", "chastity_cage", "dominatrix", "feminization", "flat_chastity_cage",
    "futanari", "gagged", "milking_machine", "mind_break", "netorare", "netorase",
    "orgasm_denial", "pegging", "prostate_milking", "sex_machine", "femdom", "foot_worship",
    "forced_feminization", "hand_milking", "hogtie", "knotting", "penis_milking",
    "pouring_from_condom", "restraints", "shibari", "small_penis_humiliation", "sockjob",
    "spreader_bar", "toe_sucking", "used_condom"
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
  let debounceTimeout;

  function debounce(func, delay = 150) {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(func, delay);
  }

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

  window.addEventListener("scroll", () => {
    if (window.scrollY > 100) {
      sidebarToggle.classList.add("pinned-visible");
    } else {
      sidebarToggle.classList.remove("pinned-visible");
    }
  });

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
    const query = "chastity_cage";
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
        backgroundBlur.style.backgroundColor = "#111";
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
        debounce(filterArtists);
        setRandomBackground();
      };
      tagButtonsContainer.appendChild(btn);
    });
  }

  function filterArtists() {
    artistGallery.innerHTML = "";
    const selected = Array.from(activeTags);
    const seen = new Set();

    allArtists.forEach(artist => {
      const tags = artist.kinkTags || [];
      if (selected.every(tag => tags.includes(tag)) && !seen.has(artist.artistName)) {
        seen.add(artist.artistName);

        const card = document.createElement("div");
        card.className = "artist-card";

        const img = document.createElement("img");
        img.className = "artist-image";
        img.loading = "lazy";
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

        const nameRow = document.createElement("div");
        nameRow.className = "name-row";

        const name = document.createElement("div");
        name.className = "artist-name";
        name.textContent = `${artist.artistName} (${artist.nsfwLevel}${artist.artStyle ? `, ${artist.artStyle}` : ""})`;

        const copyBtn = document.createElement("button");
        copyBtn.className = "copy-button";
        copyBtn.textContent = "📋";
        copyBtn.title = "Copy name";
        copyBtn.onclick = () => handleArtistCopy(artist, img.src);

        nameRow.append(name, copyBtn);

        const taglist = document.createElement("div");
        taglist.className = "artist-tags";
        taglist.textContent = artist.kinkTags.join(", ");

        card.append(img, nameRow, taglist);
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
    setInterval(setRandomBackground, 15000);
  });
});
