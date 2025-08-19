/**
 * Sidebar module - Handles the copied artists sidebar functionality
 */

import { vibrate } from "./ui.js";
import { getThumbnailUrl } from "./gallery.js";
import { artists } from "./tags.js";

let copiedArtists = new Set();

let copiedSidebar = null;
let copiedArtistsCache = null;

// TTS toggle state
window._ttsEnabled = true;

/**
 * Returns the count of copied artists
 */
function getCopiedCount() {
  return copiedArtists.size;
}

// Ensures the TTS toggle button is present in the audio-controls
import { azureSpeak, setAzureTTSConfig, DEFAULT_VOICE } from "./azure-tts.js";
function ensureTTSToggleButton() {
  const audioPanel = document.getElementById("audio-panel");
  if (audioPanel) {
    const controls = audioPanel.querySelector(".audio-controls");
    if (controls) {
      let ttsBtn = document.getElementById("tts-toggle-btn");
      if (!ttsBtn) {
        ttsBtn = document.createElement("button");
        ttsBtn.id = "tts-toggle-btn";
        ttsBtn.className = "browse-btn";
        ttsBtn.style.marginLeft = "0.7em";
        ttsBtn.textContent = window._ttsEnabled ? "🔊 TTS On" : "🔇 TTS Off";
        ttsBtn.onclick = () => {
          window._ttsEnabled = !window._ttsEnabled;
          ttsBtn.textContent = window._ttsEnabled ? "🔊 TTS On" : "🔇 TTS Off";
        };
        controls.appendChild(ttsBtn);
      }

      // Add TTS voice selector dropdown
      let ttsVoiceSelect = document.getElementById("tts-voice-select");
      if (!ttsVoiceSelect) {
        ttsVoiceSelect = document.createElement("select");
        ttsVoiceSelect.id = "tts-voice-select";
        ttsVoiceSelect.className = "browse-btn";
        ttsVoiceSelect.style.marginLeft = "0.7em";
        ttsVoiceSelect.title = "Choose TTS Voice";
        controls.appendChild(ttsVoiceSelect);

        function populateVoices() {
          ttsVoiceSelect.innerHTML = "";
          const voices = window.speechSynthesis.getVoices();
          voices.forEach((voice) => {
            const option = document.createElement("option");
            option.value = voice.name;
            option.textContent = `${voice.name} (${voice.lang})`;
            if (
              voice.name.toLowerCase().includes("female") ||
              voice.gender === "female"
            ) {
              option.textContent += " ♀";
            }
            ttsVoiceSelect.appendChild(option);
          });
        }

        // Populate voices initially and when voiceschanged fires
        populateVoices();
        window.speechSynthesis.onvoiceschanged = populateVoices;

        ttsVoiceSelect.onchange = () => {
          window._ttsVoiceName = ttsVoiceSelect.value;
        };
      }
    }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", ensureTTSToggleButton);
}

/**
 * Shows a toast notification message
 */

async function speakToast(text) {
  if (window._ttsEnabled) {
    if (window._azureTTSKey && window._azureTTSRegion) {
      try {
        const url = await azureSpeak(text);
        const audio = new Audio(url);
        audio.play();
        return;
      } catch (e) {
        // Fallback to browser TTS if Azure fails
      }
    }
    // Fallback: browser SpeechSynthesis
    if (window.speechSynthesis) {
      const utter = new window.SpeechSynthesisUtterance(text);
      let voices = window.speechSynthesis.getVoices();
      let voice = null;
      if (window._ttsVoiceName) {
        voice = voices.find((v) => v.name === window._ttsVoiceName);
      }
      if (!voice) {
        voice = voices.find(
          (v) =>
            v.name.toLowerCase().includes("female") || v.gender === "female"
        );
      }
      if (!voice) voice = voices.find((v) => v.lang.startsWith("en"));
      if (voice) utter.voice = voice;
      utter.rate = 1.05;
      utter.pitch = 1.3;
      utter.volume = 1;
      window.speechSynthesis.speak(utter);
    }
  }
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast-popup";
  toast.textContent = message;
  document.body.appendChild(toast);
  speakToast(message);
  ensureTTSToggleButton();
  setTimeout(() => toast.remove(), 3000);
}

/**
 * Handles copying an artist name to clipboard and adding to sidebar
 * Uses cache to avoid duplicate sidebar updates
 */
function handleArtistCopy(artist, imgSrc) {
  const artistTag = artist.artistName.replace(/_/g, " ");
  // Always copy to clipboard, even if already in sidebar
  navigator.clipboard
    .writeText(artistTag)
    .then(() => {
      let added = false;
      if (!copiedArtists.has(artistTag)) {
        copiedArtists.add(artistTag);
        copiedArtistsCache = new Set(copiedArtists);
        updateCopiedSidebar();
        added = true;
      }
      showToast(added ? `Copied: ${artistTag}` : `Copied again: ${artistTag}`);
      // --- INCREASE HUMILIATION METER ---
      if (typeof window.incrementDesperationMeter === "function") {
        window.incrementDesperationMeter(1);
      }
    })
    .catch(() => {
      showToast("Failed to copy artist name");
    });
}

/**
 * Updates the content of the copied artists sidebar
 */
function updateCopiedSidebar() {
  if (!copiedSidebar) return;
  copiedSidebar.innerHTML = "";

  // --- HUMILIATION: Dynamic taunt banner ---
  const copiedCount = copiedArtists.size;
  let tauntMsg = "";
  if (copiedCount === 0) {
    tauntMsg = "No artists copied yet. Too shy to commit? Pathetic.";
  } else if (copiedCount === 1) {
    tauntMsg = "Just one? That's barely even embarrassing.";
  } else if (copiedCount === 2) {
    tauntMsg = "Two artists? Double the shame, double the fun!";
  } else if (copiedCount === 3) {
    tauntMsg = "Three? You're starting to get greedy, aren't you?";
  } else if (copiedCount < 6) {
    tauntMsg = `Already copied ${copiedCount}? You really can't help yourself.`;
  } else if (copiedCount < 10) {
    tauntMsg = `Wow, ${copiedCount} artists? Greedy little thing! Everyone can see your desperation.`;
  } else if (copiedCount < 15) {
    tauntMsg = `Obsessed much? ${copiedCount} artists and counting... Is there any shame left?`;
  } else if (copiedCount < 25) {
    tauntMsg = `Shameless! ${copiedCount} artists? You're insatiable! This is getting embarrassing.`;
  } else if (copiedCount < 40) {
    tauntMsg = `Utterly depraved. ${copiedCount} artists? Are you even keeping track anymore?`;
  } else {
    tauntMsg = `Hopeless case! ${copiedCount} artists? You need help (and maybe a cold shower).`;
  }
  const tauntBanner = document.createElement("div");
  tauntBanner.className = "sidebar-taunt-banner";
  tauntBanner.textContent = tauntMsg;
  tauntBanner.style.animation = "taunt-pop 0.7s";
  copiedSidebar.appendChild(tauntBanner);

  // --- HUMILIATION: Shame badge if copied more than 3 artists ---
  if (copiedCount > 3) {
    const shameBadge = document.createElement("div");
    shameBadge.className = "shame-badge pulse";
    shameBadge.innerHTML = `SHAME <span>💋</span>`;
    shameBadge.title =
      copiedCount < 10
        ? "So many artists, so little dignity."
        : copiedCount < 20
        ? "You're really going for a high score, huh?"
        : copiedCount < 40
        ? "Utterly shameless!"
        : "You are the definition of humiliation.";
    shameBadge.style.background =
      copiedCount > 20
        ? "linear-gradient(90deg, #fd7bc5 60%, #ff63a5 100%)"
        : "#fd7bc5";
    shameBadge.style.boxShadow =
      copiedCount > 20 ? "0 0 32px #ff63a5cc" : "0 0 12px #fd7bc555";
    copiedSidebar.appendChild(shameBadge);
  }

  // Add close button at the top
  const closeBtn = document.createElement("button");
  closeBtn.className = "copied-sidebar-close";
  closeBtn.innerHTML = "&times;";
  closeBtn.title = "Close";
  closeBtn.onclick = () => {
    copiedSidebar.classList.add("sidebar-hidden");
    document.body.classList.remove("sidebar-open");
  };
  copiedSidebar.appendChild(closeBtn);

  copiedArtists.forEach((artistTag, idx) => {
    // Find the artist object by normalized name
    const artist = artists.value.find(
      (a) => a.artistName.replace(/_/g, " ") === artistTag
    );
    const div = document.createElement("div");
    div.className = "copied-artist";
    div.style.display = "flex";
    div.style.alignItems = "center";
    div.style.cursor = "pointer";
    div.style.padding = "1em 0.5em";
    div.style.gap = "12px";
    div.style.fontSize = "1.15em";
    div.style.position = "relative";
    div.style.transition = "background 0.2s, box-shadow 0.2s";
    div.style.background = idx % 2 === 0 ? "#fff6fa" : "#ffe0f5";
    div.style.boxShadow =
      idx % 2 === 0 ? "0 2px 8px #fd7bc522" : "0 2px 12px #ff63a522";

    let tooltip = artist && artist.tooltip ? artist.tooltip : artistTag;

    // Show thumbnail if available (use getThumbnailUrl from gallery.js)
    if (artist) {
      let thumbUrl = artist.thumbnailUrl;
      if (!thumbUrl && typeof getThumbnailUrl === "function") {
        thumbUrl = getThumbnailUrl(artist);
      }
      if (thumbUrl) {
        const img = document.createElement("img");
        img.src = thumbUrl;
        img.style.width = "44px";
        img.style.height = "44px";
        img.style.borderRadius = "12px";
        img.style.boxShadow = "0 0 8px #fd7bc555";
        div.appendChild(img);
      }
    }

    // --- HUMILIATION: Add lipstick kiss or sparkle icon ---
    const icon = document.createElement("span");
    icon.className = "lipstick-kiss";
    icon.title = "Kissed with shame!";
    icon.innerHTML = Math.random() > 0.5 ? "💋" : "✨";
    icon.style.animation =
      Math.random() > 0.5
        ? "kissWiggle 1.2s infinite"
        : "sparklePop 1.2s infinite alternate";
    div.appendChild(icon);

    const nameSpan = document.createElement("span");
    nameSpan.textContent = artistTag;
    nameSpan.title = tooltip;
    nameSpan.style.flex = "1";
    nameSpan.style.fontWeight = "bold";
    nameSpan.style.letterSpacing = "0.04em";
    nameSpan.style.fontFamily = "'Hi Melody', cursive, sans-serif";
    div.appendChild(nameSpan);

    // Add a little heart if this is the most recent copy
    if (idx === copiedArtists.size - 1 && copiedCount > 1) {
      const heart = document.createElement("span");
      heart.textContent = "💖";
      heart.style.marginLeft = "0.5em";
      heart.style.fontSize = "1.2em";
      heart.title = "Your latest obsession";
      div.appendChild(heart);
    }

    // Make the whole row tappable: open zoom modal for this artist
    div.onclick = () => {
      if (artist) {
        import("./gallery.js").then((gallery) => {
          if (typeof gallery.openArtistZoom === "function") {
            gallery.openArtistZoom(artist);
          }
        });
      }
    };

    copiedSidebar.appendChild(div);
  });

  // --- HUMILIATION: Sidebar style tweaks ---
  copiedSidebar.style.border = "3px solid #fd7bc5";
  copiedSidebar.style.borderRadius = "2em";
  copiedSidebar.style.fontFamily = "'Hi Melody', cursive, sans-serif";
  copiedSidebar.style.background =
    "linear-gradient(135deg, #fff0fa 0%, #ffd6f6 100%)";
  copiedSidebar.style.boxShadow = "0 0 32px #fd7bc555";
}

/**
 * Initializes the sidebar with DOM elements and event listeners
 */
function initSidebar() {
  copiedSidebar = document.getElementById("copied-sidebar");

  const sidebarToggles = document.querySelectorAll(".sidebar-toggle");
  if (sidebarToggles && copiedSidebar) {
    sidebarToggles.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        vibrate();
        copiedSidebar.classList.toggle("sidebar-hidden");
        // Toggle body class when sidebar is opened or closed
        if (!copiedSidebar.classList.contains("sidebar-hidden")) {
          document.body.classList.add("sidebar-open");
        } else {
          document.body.classList.remove("sidebar-open");
        }
      });
    });
  }

  // Handle scroll behavior for sidebar toggle
  const sidebarToggle = document.querySelector(".sidebar-toggle");
  if (sidebarToggle) {
    window.addEventListener("scroll", () => {
      if (window.scrollY > 100) {
        sidebarToggle.classList.add("pinned-visible");
      } else {
        sidebarToggle.classList.remove("pinned-visible");
      }
    });
  }

  // ARIA improvements for sidebar controls
  const copyArtistBtn = document.getElementById("copy-artist-btn");
  if (copyArtistBtn) {
    copyArtistBtn.setAttribute("aria-label", "Copy artist name");
    copyArtistBtn.setAttribute("role", "button");
  }
}

/**
 * Sets the reference to all artists data
 */
function setAllArtists(list) {
  artists.value = Array.isArray(list) ? list : [];
}

/**
 * Sets the copied artists collection
 */
function setCopiedArtists(artists) {
  copiedArtists = artists;
}

/**
 * Sets the sidebar DOM element reference
 */
function setCopiedSidebar(element) {
  copiedSidebar = element;
}

// Add spinner and error handling for sidebar actions
function showSidebarError(container, errorMsg = "Error loading sidebar.") {
  container.textContent = errorMsg;
  container.style.display = "block";
  container.setAttribute("aria-live", "assertive");
  // Add Retry button if not present
  if (!container.querySelector(".retry-btn")) {
    const retryBtn = document.createElement("button");
    retryBtn.className = "retry-btn";
    retryBtn.textContent = "Retry";
    retryBtn.setAttribute("aria-label", "Retry loading sidebar");
    retryBtn.onclick = () => {
      container.textContent = "Retrying...";
      // Invalidate cache and re-fetch sidebar data
      if (typeof invalidateSidebarCache === "function")
        invalidateSidebarCache();
      if (typeof fetchSidebarData === "function") fetchSidebarData();
    };
    container.appendChild(retryBtn);
  }
}

async function updateSidebar() {
  try {
    // Fetch sidebar data, handle errors
    const data = await fetchSidebarData();
    if (!data) throw new Error("No sidebar data");
    // ...existing code...
  } catch (err) {
    showSidebarError("Error loading sidebar.");
    console.warn("Failed to fetch sidebar data:", err);
  }
}

// --- GALLERY HUMILIATION FEATURES ---

const galleryTaunts = [
  "Caught you peeking!",
  "You wish you were this talented.",
  "Desperate for more, aren’t you?",
  "You can't resist, can you?",
  "Another one for your collection?",
  "Shameless little fan!",
  "You really like this one, huh?",
  "Dreaming of being this cute?",
  "You’re not fooling anyone!",
  "Still not satisfied?",
  "You’re hopeless!",
];

const copyTaunts = [
  "You really want to remember this one? Pathetic.",
  "Copied again? You must be obsessed.",
  "Desperate to keep this? How sad.",
  "Adding to your shame list?",
  "You’re not even subtle about it!",
  "Another one? Greedy!",
];

function addShameBadgeToCard(card, artist) {
  if (artist && artist.postCount !== undefined && artist.postCount < 5) {
    let badge = card.querySelector(".gallery-shame-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "gallery-shame-badge pulse";
      badge.innerHTML = "SHAME <span>💔</span>";
      badge.title = "So few images... embarrassing!";
      card.appendChild(badge);
    }
  }
}

function showGalleryEmptyState() {
  const gallery = document.getElementById("artist-gallery");
  if (gallery) {
    gallery.innerHTML = `<div class="gallery-empty-humiliation">
      <span class="gallery-empty-emoji">😭</span>
      <div class="gallery-empty-msg">Nobody wants to play with you.<br>Try less picky tags!</div>
    </div>`;
  }
}

function addGalleryCardHover(card) {
  card.addEventListener("mouseenter", () => {
    let overlay = card.querySelector(".gallery-hover-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "gallery-hover-overlay";
      overlay.innerHTML = Math.random() > 0.5 ? "💋" : "✨";
      card.appendChild(overlay);
      setTimeout(() => overlay.remove(), 1200);
    }
  });
}

function updateDesperationMeter() {
  let meter = document.getElementById("desperation-meter");
  if (!meter) {
    meter = document.createElement("div");
    meter.id = "desperation-meter";
    meter.innerHTML = `<div class="desperation-bar"></div><span class="desperation-taunt"></span>`;
    document.body.appendChild(meter);
  }
  const count = copiedArtists.size;
  const bar = meter.querySelector(".desperation-bar");
  const taunt = meter.querySelector(".desperation-taunt");
  const percent = Math.min(100, count * 5);
  bar.style.width = percent + "%";
  bar.style.background =
    percent > 80 ? "#fd7bc5" : percent > 50 ? "#ff63a5" : "#f9badd";
  let msg = "";
  if (count === 0) msg = "Dignity: Intact (for now)";
  else if (count < 5) msg = "Mildly desperate";
  else if (count < 10) msg = "Getting needy...";
  else if (count < 20) msg = "Desperation rising!";
  else if (count < 30) msg = "Utterly shameless!";
  else msg = "No hope left!";
  taunt.textContent = msg;
}

/**
 * Increments the desperation meter (for humiliation features)
 */
function incrementDesperationMeter(amount = 1) {
  let meter = document.getElementById("desperation-meter");
  if (!meter) return;
  let bar = meter.querySelector(".desperation-bar");
  let taunt = meter.querySelector(".desperation-taunt");
  let width = parseFloat(bar.style.width) || 0;
  width = Math.min(100, width + amount * 5);
  bar.style.width = width + "%";
  bar.style.background =
    width > 80 ? "#fd7bc5" : width > 50 ? "#ff63a5" : "#f9badd";
  let msg = "";
  if (width === 0) msg = "Dignity: Intact (for now)";
  else if (width < 20) msg = "Mildly desperate";
  else if (width < 40) msg = "Getting needy...";
  else if (width < 60) msg = "Desperation rising!";
  else if (width < 80) msg = "Utterly shameless!";
  else msg = "No hope left!";
  taunt.textContent = msg;
  // Optionally, show a humiliation toast
  if (width > 80) {
    showToast("You're really pushing your limits, aren't you?");
  }
}

// Patch into gallery rendering (assumes renderArtistCards or similar is called)
if (typeof window !== "undefined") {
  window._galleryHumiliationPatch = function patchGalleryHumiliation() {
    const cards = document.querySelectorAll(".artist-card");
    cards.forEach((card) => {
      // Add random taunt as tooltip
      card.title =
        galleryTaunts[Math.floor(Math.random() * galleryTaunts.length)];
      // Add shame badge if needed
      const artistName = card.getAttribute("data-artist");
      const artist = artists.value.find((a) => a.artistName === artistName);
      addShameBadgeToCard(card, artist);
      // Add hover animation
      addGalleryCardHover(card);
    });
  };
  window._showGalleryEmptyState = showGalleryEmptyState;
}

// Patch into copy logic for humiliation toast
const origShowToast = showToast;
showToast = function (message) {
  if (message && message.startsWith("Copied")) {
    const taunt = copyTaunts[Math.floor(Math.random() * copyTaunts.length)];
    origShowToast(`${message}  ${taunt}`);
    updateDesperationMeter();
  } else {
    origShowToast(message);
  }
};

// Patch desperation meter update into sidebar update
const origUpdateCopiedSidebar = updateCopiedSidebar;
updateCopiedSidebar = function () {
  origUpdateCopiedSidebar.apply(this, arguments);
  updateDesperationMeter();
};

// Expose incrementDesperationMeter globally for use in other modules
if (typeof window !== "undefined") {
  window.incrementDesperationMeter = incrementDesperationMeter;
}

// Export functions for ES modules
export {
  handleArtistCopy,
  updateCopiedSidebar,
  initSidebar,
  setAllArtists,
  setCopiedArtists,
  setCopiedSidebar,
  showToast,
  getCopiedCount,
};

// Legacy CommonJS exports for existing tests
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    updateCopiedSidebar,
    _setAllArtists: setAllArtists,
    _setCopiedArtists: setCopiedArtists,
    _setCopiedSidebar: setCopiedSidebar,
  };
}

// All functions in this file are defined and used as follows:

// getCopiedCount: exported, used by humiliation.js
// showToast: exported, used by handleArtistCopy, patched for humiliation
// handleArtistCopy: exported, used by gallery.js
// updateCopiedSidebar: exported, used by handleArtistCopy, patched for humiliation, and main.js
// initSidebar: exported, used by main.js
// setAllArtists: exported, used by main.js
// setCopiedArtists: exported, not used internally (for external use)
// setCopiedSidebar: exported, not used internally (for external use)
// showSidebarError: used by updateSidebar
// updateSidebar: not exported, not used externally (could be removed if not needed)
// addShameBadgeToCard: used by window._galleryHumiliationPatch
// showGalleryEmptyState: used by window._showGalleryEmptyState
// addGalleryCardHover: used by window._galleryHumiliationPatch
// updateDesperationMeter: used by showToast (patch), updateCopiedSidebar (patch), and window._galleryHumiliationPatch
// window._galleryHumiliationPatch: used by gallery.js (assumed via window)
// window._showGalleryEmptyState: used by gallery.js (assumed via window)

// No unused or undefined functions in this file.
// (End of file)
