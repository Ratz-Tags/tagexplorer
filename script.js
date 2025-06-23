document.addEventListener("DOMContentLoaded", () => {
  const kinkTags = [
  "femdom", "chastity_cage", "trap", "pegging", "futanari", "netorare", "netorase", "tentacle_sex", 
  "anal_object_insertion", "prostate_milking", "gagged", "dominatrix", "humiliation", "lactation",
  "flat_chastity_cage", "used_condom", "orgasm_denial", "mind_break", "shibari", "object_insertion", 
  "penis_milking", "small_penis_humiliation", "sex_machine", "foot_worship", "dildo_riding",
  "milking_machine", "huge_dildo", "spreader_bar", "large_insertion", "hand_milking", "cum_in_mouth",
  "gokkun", "knotting", "toe_sucking", "feminization", "hogtie", "bimbofication", "restraints",
  "sockjob", "tentacle_pit", "object_insertion_from_behind", "pouring_from_condom", "forced_feminization"
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
  const tagSearchInput = document.getElementById("tag-search");
  const artistNameFilterInput = document.getElementById("artist-name-filter");
  let artistNameFilter = "";
  const clearTagsBtn = document.getElementById("clear-tags");
  let copiedArtists = new Set();
  let searchFilter = "";

  const audioFiles = [
    "Yes.mp3",
    "Blank.mp3",
    "Filthy Habits.mp3",
    "Nipples.mp3",
    "Layer Zero.mp3",
    "Girl Factory.mp3"
  ];

  function getAudioSrc(index) {
    return `audio/${audioFiles[index]}`;
  }
  if (artistNameFilterInput) {
  artistNameFilterInput.addEventListener("input", (e) => {
    artistNameFilter = e.target.value.toLowerCase();
    filterArtists();
  });
  }
  let currentAudioIndex = 0;
  let audio = new Audio();
  audio.src = getAudioSrc(currentAudioIndex);
  audio.autoplay = false;
  audio.loop = false;
  const toggleAudioBtn = document.getElementById("toggle-audio");

toggleAudioBtn.onclick = () => {
  if (audio.paused) {
    audio.play();
    toggleAudioBtn.textContent = "🔇"; // Change icon to pause
  } else {
    audio.pause();
    toggleAudioBtn.textContent = "🔊"; // Change icon to play
  }
};

audio.onplay = () => {
  toggleAudioBtn.textContent = "🔇";
};

audio.onpause = () => {
  toggleAudioBtn.textContent = "🔊";
};
  audio.addEventListener("ended", () => {
  currentAudioIndex = (currentAudioIndex + 1) % audioFiles.length;
  audio.src = getAudioSrc(currentAudioIndex);
  audio.play();
  showToast("Now playing: " + (currentAudioIndex + 1));
});

document.getElementById("prev-audio").onclick = () => {
  currentAudioIndex = (currentAudioIndex - 1 + audioFiles.length) % audioFiles.length;
  audio.src = getAudioSrc(currentAudioIndex);
  audio.play();
  showToast("Rewound to: " + (currentAudioIndex + 1));
};

document.getElementById("next-audio").onclick = () => {
  currentAudioIndex = (currentAudioIndex + 1) % audioFiles.length;
  audio.src = getAudioSrc(currentAudioIndex);
  audio.play();
  showToast("Next up: " + (currentAudioIndex + 1));
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
          const validPosts = data.filter(post => post?.large_file_url || post?.file_url);
          const raw = validPosts[0];
          if (raw) {
            const url = raw.large_file_url || raw.file_url;
            const full = url?.startsWith("http") ? url : `https://danbooru.donmai.us${url}`;
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

  function setBestImage(artist, img) {
  const cacheKey = `danbooru-image-${artist.artistName}`;
  const cachedUrl = localStorage.getItem(cacheKey);
  const tryLoad = (url, retries = 2) => {
    const testImg = new Image();
    testImg.onload = () => {
      img.src = url;
      img.style.display = '';
      if (img.nextSibling && img.nextSibling.classList?.contains('no-entries-msg')) {
        img.nextSibling.remove();
      }
      localStorage.setItem(cacheKey, url);
    };
    testImg.onerror = () => {
      if (retries > 0) setTimeout(() => tryLoad(url, retries - 1), 500);
      else {
        img.style.display = 'none';
        let msg = img.nextSibling;
        if (!msg || !msg.classList.contains('no-entries-msg')) {
          msg = document.createElement("span");
          msg.className = "no-entries-msg";
          msg.style.color = "red";
          msg.style.fontWeight = "bold";
          msg.textContent = "No valid entries";
          img.parentNode.insertBefore(msg, img.nextSibling);
        }
      }
    };
    testImg.src = url;
  };

  if (cachedUrl) return tryLoad(cachedUrl);

  fetch(`https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(artist.artistName)}+order:approval&limit=40`)
    .then(r => r.json())
    .then(data => {
      const validPosts = data.filter(post => post?.large_file_url || post?.file_url);
      const raw = validPosts[0];
      if (raw) {
        const url = raw.large_file_url || raw.file_url;
        const full = url?.startsWith("http") ? url : `https://danbooru.donmai.us${url}`;
        tryLoad(full);
      } else {
        img.style.display = 'none';
        let msg = img.nextSibling;
        if (!msg || !msg.classList.contains('no-entries-msg')) {
          msg = document.createElement("span");
          msg.className = "no-entries-msg";
          msg.style.color = "red";
          msg.style.fontWeight = "bold";
          msg.textContent = "No valid entries";
          img.parentNode.insertBefore(msg, img.nextSibling);
        }
      }
    })
    .catch(() => {
      img.style.display = 'none';
      let msg = img.nextSibling;
      if (!msg || !msg.classList.contains('no-entries-msg')) {
        msg = document.createElement("span");
        msg.className = "no-entries-msg";
        msg.style.color = "red";
        msg.style.fontWeight = "bold";
        msg.textContent = "No valid entries";
        img.parentNode.insertBefore(msg, img.nextSibling);
      }
    });
}
  function lazyLoadBestImage(artist, img) {
  if (img.dataset.loaded) return;

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        setBestImage(artist, img);
        img.dataset.loaded = "true";
        observer.unobserve(entry.target);
      }
    });
  }, { rootMargin: "100px" }); // Adjust as needed for preloading

  observer.observe(img);
}
  
function renderTagButtons() {
  // Clear current tag buttons
  tagButtonsContainer.innerHTML = "";

  // Filter and sort tags
  let tagsToShow = kinkTags
    .filter(tag =>
      tag.toLowerCase().includes(searchFilter.trim().toLowerCase())
    )
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  // Show a message if nothing matches
  if (tagsToShow.length === 0) {
    const emptyMsg = document.createElement("span");
    emptyMsg.style.fontStyle = "italic";
    emptyMsg.style.opacity = "0.7";
    emptyMsg.textContent = "No tags found.";
    tagButtonsContainer.appendChild(emptyMsg);
    if (clearTagsBtn) clearTagsBtn.style.display = activeTags.size ? "" : "none";
    return;
  }

  // Create a button for each tag
  tagsToShow.forEach(tag => {
    const btn = document.createElement("button");
    btn.className = "tag-button";
    btn.type = "button";
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
      if (activeTags.has(tag)) {
        activeTags.delete(tag);
      } else {
        activeTags.add(tag);
        spawnBubble(tag);
      }
      renderTagButtons();
      filterArtists();
      setRandomBackground();
    };
    tagButtonsContainer.appendChild(btn);
  });

  // Show or hide the clear-all button if present
  if (clearTagsBtn) clearTagsBtn.style.display = activeTags.size ? "" : "none";
}
// Add event for live search
if (tagSearchInput) {
  tagSearchInput.addEventListener("input", (e) => {
    searchFilter = e.target.value;
    renderTagButtons();
  });
}

// Add event for "Clear All" button
if (clearTagsBtn) {
  clearTagsBtn.addEventListener("click", () => {
    activeTags.clear();
    renderTagButtons();
    filterArtists();
    setRandomBackground();
  });
}

  function filterArtists() {
    artistGallery.innerHTML = "";
    const selected = Array.from(activeTags);
    const seen = new Set();

    allArtists.forEach(artist => {
  const tags = artist.kinkTags || [];
  if (
    selected.every(tag => tags.includes(tag)) &&
    !seen.has(artist.artistName) &&
    (
      artist.artistName.toLowerCase().includes(artistNameFilter) ||
      artistNameFilter === ""
    )
  ) {
    seen.add(artist.artistName);
  

        const card = document.createElement("div");
        card.className = "artist-card";

        const img = document.createElement("img");
        img.className = "artist-image";
        lazyLoadBestImage(artist, img);
        img.addEventListener("click", () => {
          let currentIndex = 0;
          let posts = [];
          const zoomWrapper = document.createElement("div");
          zoomWrapper.className = "fullscreen-wrapper";

          const zoomed = document.createElement("img");
          zoomed.className = "fullscreen-img";
          zoomWrapper.appendChild(zoomed);

          const noEntriesMsg = document.createElement("span");
          noEntriesMsg.style.display = "none";
          noEntriesMsg.className = "no-entries-msg";
          noEntriesMsg.textContent = "No valid entries";
          zoomWrapper.appendChild(noEntriesMsg);

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
           if (posts.length === 0) {
              zoomed.style.display = "none";
              noEntriesMsg.style.display = "block";
              noEntriesMsg.style.color = "red";
              noEntriesMsg.style.fontWeight = "bold";
              noEntriesMsg.textContent = "No valid entries";
          } else {
              zoomed.style.display = "block";
              noEntriesMsg.style.display = "none";
              const raw = posts[i];
             if (raw) {
              const url = raw?.large_file_url || raw?.file_url;
              const full = url?.startsWith("http") ? url : `https://danbooru.donmai.us${url}`;
              zoomed.src = full;
              }
           }
          }

          prevBtn.onclick = () => {
            currentIndex = (currentIndex - 1 + posts.length) % posts.length;
            showPost(currentIndex);
          };

          nextBtn.onclick = () => {
            currentIndex = (currentIndex + 1) % posts.length;
            showPost(currentIndex);
          };

          fetch(`https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(artist.artistName)}+order:approval&limit=40`)
            .then(res => res.json())
            .then(data => {
              posts = data.filter(post => post?.large_file_url || post?.file_url);
              showPost(currentIndex);
              }
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
  // Modal wrapper
  const zoomWrapper = document.createElement("div");
  zoomWrapper.className = "fullscreen-wrapper";

  // Cloned image
  const zoomed = previewImg.cloneNode();
  zoomed.className = "fullscreen-img";
  zoomWrapper.appendChild(zoomed);

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.className = "zoom-close";
  closeBtn.textContent = "×";
  closeBtn.onclick = () => zoomWrapper.remove();
  zoomWrapper.appendChild(closeBtn);

  document.body.appendChild(zoomWrapper);
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
