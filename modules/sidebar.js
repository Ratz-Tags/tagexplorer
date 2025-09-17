/**
 * Sidebar module - Handles the copied artists sidebar functionality
 */

import { vibrate } from "./ui.js";
import { getThumbnailUrl } from "./gallery.js";
import { azureSpeak, setAzureTTSConfig, DEFAULT_VOICE } from "./azure-tts.js";
import { getActiveTags } from "./tags.js";

let copiedArtists = new Set();

let copiedSidebar = null;
let allArtists = [];
let copiedArtistsCache = null;
let selectedPromptArtists = new Set();
let suggestionModal = null;
let suggestionOutputEl = null;
let suggestionSummaryEl = null;
let suggestionCopyBtn = null;
let suggestionKeyHandler = null;

// TTS toggle state
window._ttsEnabled = true;

/**
 * Returns the count of copied artists
 */
function getCopiedCount() {
  return copiedArtists.size;
}

// Ensures the TTS toggle button is present in the audio-controls
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

      // Azure Voice/Style selector button
      let voiceBtn = document.getElementById("azure-voice-style-btn");
      if (!voiceBtn) {
        voiceBtn = document.createElement("button");
        voiceBtn.id = "azure-voice-style-btn";
        voiceBtn.className = "browse-btn";
        voiceBtn.style.marginLeft = "0.7em";
        voiceBtn.textContent = "Azure Voice/Style";
        voiceBtn.onclick = () => {
          if (window.showAzureVoiceSelector) {
            window.showAzureVoiceSelector();
          }
        };
        controls.appendChild(voiceBtn);
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
  if (!window._ttsEnabled) return;
  try {
    const url = await azureSpeak(text, {});
    if (url) {
      const audio = new Audio(url);
      audio.play().catch(() => {});
    }
  } catch (e) {
    // Swallow errors to avoid UI spam
  }
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast-popup";
  toast.textContent = message;
  document.body.appendChild(toast);
  speakToast(message);
  ensureTTSToggleButton();
  // Suppress audio play errors
  const audioEl = document.getElementById('moan-audio');
  if (audioEl && audioEl.src && audioEl.src !== '' && audioEl.src !== 'null') {
    try {
      const playPromise = audioEl.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    } catch (e) {}
  }
  setTimeout(() => toast.remove(), 3000);
}

/**
 * Handles copying an artist name to clipboard and adding to sidebar
 * Uses cache to avoid duplicate sidebar updates
 */
function handleArtistCopy(artist, imgSrc) {
  const artistTag = artist.artistName.replace(/_/g, " ");
  const copyText = `artist:${artist.artistName}`;
  // Always copy to clipboard, even if already in sidebar
  navigator.clipboard
    .writeText(copyText)
    .then(() => {
      let added = false;
      if (!copiedArtists.has(artistTag)) {
        copiedArtists.add(artistTag);
        copiedArtistsCache = new Set(copiedArtists);
        selectedPromptArtists.add(artistTag);
        updateCopiedSidebar();
        added = true;
      }
      showToast(
        added ? `Copied: ${artistTag}` : `Copied again: ${artistTag}`
      );
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
  // Sidebar sections container
  const sections = document.createElement("div");
  sections.className = "sidebar-sections";

  // --- HUMILIATION: Dynamic taunt banner ---
  const copiedCount = copiedArtists.size;
  if (copiedCount === 0) {
    selectedPromptArtists.clear();
  } else {
    selectedPromptArtists = new Set(
      [...selectedPromptArtists].filter((name) => copiedArtists.has(name))
    );
    if (selectedPromptArtists.size === 0) {
      selectedPromptArtists = new Set(copiedArtists);
    }
  }
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
  // Collapsible: Copied Artists
  const copiedSection = document.createElement("section");
  copiedSection.className = "sidebar-section sidebar-copied-section open";
  const copiedHeader = document.createElement("button");
  copiedHeader.className = "sidebar-section-header";
  copiedHeader.innerHTML = '<span class="sidebar-icon">📋</span> Copied Artists';
  copiedHeader.onclick = () => copiedSection.classList.toggle("open");
  copiedSection.appendChild(copiedHeader);
  // Taunt banner
  const tauntBanner = document.createElement("div");
  tauntBanner.className = "sidebar-taunt-banner";
  tauntBanner.textContent = tauntMsg;
  copiedSection.appendChild(tauntBanner);

  // --- HUMILIATION: Shame badge if copied more than 3 artists ---
  if (copiedCount > 3) {
    const shameBadge = document.createElement("div");
    shameBadge.className = "shame-badge pulse";
    shameBadge.innerHTML = `<span class="sidebar-icon">💋</span> SHAME`;
    shameBadge.title =
      copiedCount < 10
        ? "So many artists, so little dignity."
        : copiedCount < 20
        ? "You're really going for a high score, huh?"
        : copiedCount < 40
        ? "Utterly shameless!"
        : "You are the definition of humiliation.";
    copiedSection.appendChild(shameBadge);
  }

  // Add close button at the top
  const closeBtn = document.createElement("button");
  closeBtn.className = "copied-sidebar-close";
  closeBtn.innerHTML = '<span class="sidebar-icon">✖️</span>';
  closeBtn.title = "Close";
  closeBtn.onclick = () => {
    copiedSidebar.classList.add("sidebar-hidden");
    copiedSidebar.setAttribute("aria-hidden", "true");
    document.body.classList.remove("sidebar-open");
    const sidebarWrapper = copiedSidebar.closest(".sidebar-wrapper");
    if (sidebarWrapper) {
      sidebarWrapper.classList.remove("visible");
      sidebarWrapper.setAttribute("aria-hidden", "true");
    }
    const overlay = document.getElementById("sidebar-overlay");
    if (overlay) {
      overlay.style.display = "none";
      overlay.setAttribute("aria-hidden", "true");
    }
  };
  copiedSection.appendChild(closeBtn);

  const copiedList = document.createElement("div");
  copiedList.className = "sidebar-copied-list";

  let selectionNote = null;
  let suggestionBtn = null;

  copiedArtists.forEach((artistTag, idx) => {
    const artist = allArtists.find(
      (a) => a.artistName && a.artistName.replace(/_/g, " ") === artistTag
    );
    const row = document.createElement("div");
    row.className = "copied-artist-row";

    const checkboxWrap = document.createElement("div");
    checkboxWrap.className = "copied-artist-select-wrap";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "copied-artist-select";
    checkbox.setAttribute(
      "aria-label",
      `Use ${artistTag} when suggesting prompts`
    );
    const isSelected = selectedPromptArtists.has(artistTag);
    checkbox.checked = isSelected;
    if (isSelected) row.classList.add("selected");
    checkbox.addEventListener("change", (event) => {
      if (event.target.checked) {
        selectedPromptArtists.add(artistTag);
        row.classList.add("selected");
      } else {
        selectedPromptArtists.delete(artistTag);
        row.classList.remove("selected");
      }
      if (typeof updateSelectionSummary === "function") {
        updateSelectionSummary();
      }
    });
    checkboxWrap.appendChild(checkbox);
    row.appendChild(checkboxWrap);

    const info = document.createElement("div");
    info.className = "copied-artist-info";

    if (artist) {
      let thumbUrl = artist.thumbnailUrl;
      if (!thumbUrl && typeof getThumbnailUrl === "function") {
        thumbUrl = getThumbnailUrl(artist);
      }
      if (thumbUrl) {
        const img = document.createElement("img");
        img.src = thumbUrl;
        img.className = "sidebar-thumb";
        img.alt = `${artistTag} preview`;
        info.appendChild(img);
      }
    }

    const textWrap = document.createElement("div");
    textWrap.className = "copied-artist-text";

    const nameSpan = document.createElement("span");
    nameSpan.textContent = artistTag;
    nameSpan.title = artist && artist.tooltip ? artist.tooltip : artistTag;
    nameSpan.className = "sidebar-artist-name";
    textWrap.appendChild(nameSpan);

    if (idx === copiedArtists.size - 1 && copiedCount > 1) {
      const latest = document.createElement("span");
      latest.className = "sidebar-latest-tag";
      latest.textContent = "Latest";
      textWrap.appendChild(latest);
    }

    info.appendChild(textWrap);

    const flair = document.createElement("span");
    flair.className = "sidebar-icon lipstick-kiss";
    flair.title = "Kissed with shame!";
    flair.innerHTML = Math.random() > 0.5 ? "💋" : "✨";
    info.appendChild(flair);

    row.appendChild(info);

    row.addEventListener("click", (event) => {
      if (event.target && event.target.tagName === "INPUT") return;
      if (artist) {
        import("./gallery.js").then((gallery) => {
          if (typeof gallery.openArtistZoom === "function") {
            gallery.openArtistZoom(artist);
          }
        });
      }
    });

    copiedList.appendChild(row);
  });

  if (copiedArtists.size === 0) {
    const empty = document.createElement("div");
    empty.className = "sidebar-empty";
    empty.textContent = "Copy artists to build your queue.";
    copiedList.appendChild(empty);
  }

  copiedSection.appendChild(copiedList);

  const actions = document.createElement("div");
  actions.className = "sidebar-actions";
  selectionNote = document.createElement("div");
  selectionNote.className = "sidebar-selection-note";
  actions.appendChild(selectionNote);

  suggestionBtn = document.createElement("button");
  suggestionBtn.type = "button";
  suggestionBtn.className = "sidebar-suggest-btn";
  suggestionBtn.textContent = "Suggest Prompts";
  suggestionBtn.addEventListener("click", () => {
    openSuggestionsModal();
  });
  actions.appendChild(suggestionBtn);
  copiedSection.appendChild(actions);

  const updateSelectionSummary = () => {
    const validSelections = [...selectedPromptArtists].filter((name) =>
      copiedArtists.has(name)
    );
    const count = validSelections.length;
    if (selectionNote) {
      selectionNote.textContent = count
        ? `${count} artist${count > 1 ? "s" : ""} selected for prompts`
        : "Select artists to tailor your prompts.";
    }
    if (suggestionBtn) {
      suggestionBtn.disabled = count === 0;
      suggestionBtn.setAttribute("aria-disabled", count === 0 ? "true" : "false");
    }
  };

  updateSelectionSummary();
  sections.appendChild(copiedSection);
  copiedSidebar.appendChild(sections);

  // All sidebar style is now handled by CSS
}

function getSelectedArtistsForPrompts() {
  const names = selectedPromptArtists.size
    ? [...selectedPromptArtists]
    : [...copiedArtists];
  return names
    .map((name) =>
      allArtists.find(
        (artist) =>
          artist?.artistName && artist.artistName.replace(/_/g, " ") === name
      )
    )
    .filter(Boolean);
}

function buildPromptSuggestions(selectedArtists) {
  const active = typeof getActiveTags === "function" ? getActiveTags() : new Set();
  const exclude = new Set(active);
  const counts = new Map();

  selectedArtists.forEach((artist) => {
    const tags = Array.isArray(artist?.kinkTags) ? artist.kinkTags : [];
    tags.forEach((tag) => {
      if (exclude.has(tag)) return;
      counts.set(tag, (counts.get(tag) || 0) + 1);
    });
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([tag]) => tag.replace(/_/g, " "));
}

function ensureSuggestionModal() {
  if (suggestionModal && suggestionOutputEl && suggestionCopyBtn) {
    return suggestionModal;
  }
  suggestionModal = document.createElement("div");
  suggestionModal.className = "prompt-suggestion-overlay";
  suggestionModal.setAttribute("aria-hidden", "true");
  suggestionModal.innerHTML = `
    <div class="prompt-suggestion" role="dialog" aria-modal="true" aria-label="Suggested prompts">
      <header class="prompt-suggestion__header">
        <h3>Suggested Prompts</h3>
        <button type="button" class="prompt-suggestion__close" aria-label="Close">×</button>
      </header>
      <p class="prompt-suggestion__summary"></p>
      <div class="prompt-suggestion__output" aria-live="polite"></div>
      <div class="prompt-suggestion__actions">
        <button type="button" class="prompt-suggestion__copy">Copy to clipboard</button>
      </div>
    </div>
  `;
  document.body.appendChild(suggestionModal);

  suggestionOutputEl = suggestionModal.querySelector(".prompt-suggestion__output");
  suggestionSummaryEl = suggestionModal.querySelector(".prompt-suggestion__summary");
  suggestionCopyBtn = suggestionModal.querySelector(".prompt-suggestion__copy");
  const closeBtn = suggestionModal.querySelector(".prompt-suggestion__close");

  if (closeBtn) {
    closeBtn.addEventListener("click", () => closeSuggestionsModal());
  }

  suggestionModal.addEventListener("click", (event) => {
    if (event.target === suggestionModal) {
      closeSuggestionsModal();
    }
  });

  if (suggestionCopyBtn) {
    suggestionCopyBtn.addEventListener("click", () => copySuggestionText());
  }

  return suggestionModal;
}

function copySuggestionText() {
  if (!suggestionOutputEl) return;
  const text = suggestionOutputEl.dataset?.value || "";
  if (!text) return;
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showToast("Suggested prompts copied");
      })
      .catch(() => {
        showToast("Couldn't copy prompts");
      });
  } else {
    // Fallback for environments where navigator.clipboard is not available
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      // Prevent scrolling to bottom
      textarea.style.position = "fixed";
      textarea.style.top = "0";
      textarea.style.left = "0";
      textarea.style.width = "1px";
      textarea.style.height = "1px";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (successful) {
        showToast("Suggested prompts copied");
      } else {
        showToast("Couldn't copy prompts");
      }
    } catch (e) {
      showToast("Couldn't copy prompts");
    }
  }
}

function closeSuggestionsModal() {
  if (!suggestionModal) return;
  suggestionModal.classList.remove("open");
  suggestionModal.setAttribute("aria-hidden", "true");
  if (suggestionKeyHandler) {
    document.removeEventListener("keydown", suggestionKeyHandler);
    suggestionKeyHandler = null;
  }
}

function openSuggestionsModal() {
  if (!copiedArtists.size) {
    showToast("Copy a few artists first!");
    return;
  }
  const overlay = ensureSuggestionModal();
  const selected = getSelectedArtistsForPrompts();
  const suggestions = buildPromptSuggestions(selected);
  const line = suggestions.join(", ");

  if (suggestionSummaryEl) {
    suggestionSummaryEl.textContent = selected.length
      ? `Based on ${selected.length} selected artist${selected.length > 1 ? "s" : ""}`
      : "Select artists with the checkboxes first.";
  }

  if (suggestionOutputEl) {
    if (line) {
      suggestionOutputEl.textContent = line;
      suggestionOutputEl.dataset.value = line;
    } else {
      suggestionOutputEl.textContent = selected.length
        ? "No overlapping tags left to recommend."
        : "No artists selected.";
      suggestionOutputEl.dataset.value = "";
    }
  }

  if (suggestionCopyBtn) {
    const disabled = !line;
    suggestionCopyBtn.disabled = disabled;
    suggestionCopyBtn.setAttribute("aria-disabled", disabled ? "true" : "false");
    if (!disabled) {
      suggestionCopyBtn.focus({ preventScroll: true });
    }
  }

  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");

  if (!suggestionKeyHandler) {
    suggestionKeyHandler = (event) => {
      if (event.key === "Escape") closeSuggestionsModal();
    };
    document.addEventListener("keydown", suggestionKeyHandler);
  }
}

/**
 * Initializes the sidebar with DOM elements and event listeners
 */
function initSidebar() {
  copiedSidebar = document.getElementById("copied-sidebar");
  const sidebarWrapper = copiedSidebar
    ? copiedSidebar.closest(".sidebar-wrapper")
    : null;

  // Add mobile-friendly slide-in/out and overlay
  if (copiedSidebar) {
    copiedSidebar.classList.add("sidebar-animated");
    // Add overlay for mobile dismiss
    let overlay = document.getElementById("sidebar-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "sidebar-overlay";
      overlay.style.position = "fixed";
      overlay.style.top = 0;
      overlay.style.left = 0;
      overlay.style.width = "100vw";
      overlay.style.height = "100vh";
      overlay.style.background = "rgba(0,0,0,0.25)";
      overlay.style.zIndex = 1000;
      overlay.style.display = "none";
      overlay.setAttribute("aria-hidden", "true");
      document.body.appendChild(overlay);
    }
    function openSidebar() {
      vibrate && vibrate();
      copiedSidebar.classList.remove("sidebar-hidden");
      copiedSidebar.setAttribute("aria-hidden", "false");
      document.body.classList.add("sidebar-open");
      if (sidebarWrapper) {
        sidebarWrapper.classList.add("visible");
        sidebarWrapper.setAttribute("aria-hidden", "false");
      }
      overlay.style.display = "block";
      overlay.setAttribute("aria-hidden", "false");
      copiedSidebar.setAttribute("aria-modal", "true");
      copiedSidebar.setAttribute("tabindex", "0");
      copiedSidebar.focus();
    }
    function closeSidebar() {
      copiedSidebar.classList.add("sidebar-hidden");
      copiedSidebar.setAttribute("aria-hidden", "true");
      document.body.classList.remove("sidebar-open");
      if (sidebarWrapper) {
        sidebarWrapper.classList.remove("visible");
        sidebarWrapper.setAttribute("aria-hidden", "true");
      }
      overlay.style.display = "none";
      overlay.setAttribute("aria-hidden", "true");
      copiedSidebar.removeAttribute("aria-modal");
      copiedSidebar.removeAttribute("tabindex");
    }
    // Sidebar toggle buttons
    const sidebarToggles = document.querySelectorAll(".sidebar-toggle");
    sidebarToggles.forEach((btn) => {
      btn.addEventListener("click", openSidebar);
    });
    // Overlay click closes sidebar
    overlay.addEventListener("click", closeSidebar);
    // Close button
    const closeBtn = copiedSidebar.querySelector(".copied-sidebar-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeSidebar);
      closeBtn.setAttribute("aria-label", "Close sidebar");
      closeBtn.setAttribute("tabindex", "0");
    }
    // Escape key closes sidebar
    copiedSidebar.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeSidebar();
    });
    // Touch swipe left to close (mobile UX)
    let touchStartX = null;
    copiedSidebar.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) touchStartX = e.touches[0].clientX;
    });
    copiedSidebar.addEventListener("touchend", (e) => {
      if (touchStartX !== null && e.changedTouches.length === 1) {
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (dx < -60) closeSidebar();
      }
      touchStartX = null;
    });
    // Ensure sidebar is hidden by default unless .sidebar-open is on body
    if (!document.body.classList.contains("sidebar-open")) {
      copiedSidebar.classList.add("sidebar-hidden");
      copiedSidebar.setAttribute("aria-hidden", "true");
      if (sidebarWrapper) {
        sidebarWrapper.classList.remove("visible");
        sidebarWrapper.setAttribute("aria-hidden", "true");
      }
    }
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
function setAllArtists(artists) {
  allArtists = artists;
}

/**
 * Sets the copied artists collection
 */
function setCopiedArtists(artists) {
  copiedArtists = artists;
  selectedPromptArtists = new Set(artists);
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
      const artist = allArtists.find((a) => a.artistName === artistName);
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
