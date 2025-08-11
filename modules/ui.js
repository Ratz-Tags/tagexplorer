/**
 * UI module - General UI utilities and helper functions
 */
import { hideZoomTauntOverlay } from "./gallery.js";
/**
 * Shows a "no entries" message next to an element
 */
function showNoEntriesMsg(element, msg = "No valid entries") {
  element.style.display = "none";
  let span = element.nextSibling;
  if (!span || !span.classList || !span.classList.contains("no-entries-msg")) {
    span = document.createElement("span");
    span.className = "no-entries-msg";
    span.style.color = "red";
    span.style.fontWeight = "bold";
    element.parentNode.insertBefore(span, element.nextSibling);
  }
  span.textContent = window._danbooruUnavailable ? "Danbooru unavailable" : msg;
  span.style.display = "block";
}

/**
 * Sets up infinite scroll functionality
 */
function setupInfiniteScroll(callback) {
  let scrollTimeout = null;
  window.addEventListener("scroll", () => {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const isNearBottom =
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 300;

      if (isNearBottom && callback) {
        callback();
      }
    }, 100);
  });
}

/**
 * Sets up back-to-top button functionality
 */
function setupBackToTop() {
  const backToTopBtn = document.getElementById("back-to-top");
  if (!backToTopBtn) return;

  window.addEventListener("scroll", () => {
    if (window.scrollY > 200) {
      backToTopBtn.style.display = "block";
    } else {
      backToTopBtn.style.display = "none";
    }
  });

  backToTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/**
 * Sets up random background changes at intervals
 */
function setupBackgroundRotation(setBackgroundCallback, intervalMs = 15000) {
  if (setBackgroundCallback) {
    setBackgroundCallback(); // Set initial background
    setInterval(setBackgroundCallback, intervalMs);
  }
}

/**
 * Adds the lipstick kiss watermark if not present
 */
function addLipstickKiss() {
  if (!document.querySelector(".lipstick-kiss")) {
    const kiss = document.createElement("div");
    kiss.className = "lipstick-kiss";
    document.body.appendChild(kiss);
  }
}

/**
 * Creates a loading spinner element
 */
function createSpinner(className = "gallery-spinner") {
  const spinner = document.createElement("div");
  spinner.className = className;
  spinner.innerHTML =
    `<img src="spinner.gif" alt="Loading..." />` +
    `<progress class="loading-bar" value="0" max="1"></progress>`;

  spinner.setTotal = (total) => {
    const bar = spinner.querySelector(".loading-bar");
    if (bar) bar.max = total;
  };
  spinner.updateProgress = (val) => {
    const bar = spinner.querySelector(".loading-bar");
    if (bar) bar.value = val;
  };

  return spinner;
}

/**
 * Debounce utility function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle utility function
 */
function throttle(func, wait) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), wait);
    }
  };
}

/**
 * Creates a modal/popup element
 */
function createModal(content, className = "modal") {
  const modal = document.createElement("div");
  modal.className = className;

  const modalContent = document.createElement("div");
  modalContent.className = `${className}-content`;

  if (typeof content === "string") {
    modalContent.innerHTML = content;
  } else {
    modalContent.appendChild(content);
  }

  modal.appendChild(modalContent);

  // Close on click outside
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === "Escape") {
      modal.remove();
      document.removeEventListener("keydown", handleEscape);
    }
  };
  document.addEventListener("keydown", handleEscape);

  return modal;
}

/**
 * Creates a fullscreen image viewer
 */
function createFullscreenViewer() {
  const wrapper = document.createElement("div");
  wrapper.className = "fullscreen-wrapper";

  // Taunt header above zoom content
  const tauntHeader = document.createElement("div");
  tauntHeader.className = "taunt-header";
  tauntHeader.textContent = ""; // Fill as needed
  wrapper.appendChild(tauntHeader);

  // Zoom content container (strict 3-column flex)
  const content = document.createElement("div");
  content.className = "zoom-content";

  // Prev arrow column
  const prevBtn = document.createElement("button");
  prevBtn.className = "zoom-prev";
  prevBtn.textContent = "←";
  content.appendChild(prevBtn);

  // Main column: image and tags stacked vertically
  const main = document.createElement("div");
  main.className = "zoom-main";

  const img = document.createElement("img");
  img.className = "fullscreen-img";
  main.appendChild(img);

  // No entries message (below image)
  const noEntriesMsg = document.createElement("div");
  noEntriesMsg.className = "no-entries-msg";
  noEntriesMsg.textContent = "No images found for this artist.";
  noEntriesMsg.style.display = "none";
  main.appendChild(noEntriesMsg);

  // Tag list (below image)
  const tagList = document.createElement("div");
  tagList.className = "zoom-tags";
  tagList.style.display = "none";
  main.appendChild(tagList);

  // Top tags (below tag list)
  const topTags = document.createElement("div");
  topTags.className = "zoom-top-tags";
  topTags.style.display = "none";
  main.appendChild(topTags);

  content.appendChild(main);

  // Next arrow column
  const nextBtn = document.createElement("button");
  nextBtn.className = "zoom-next";
  nextBtn.textContent = "→";
  content.appendChild(nextBtn);

  // Close button (top right, absolutely/flex positioned by CSS)
  const closeBtn = document.createElement("button");
  closeBtn.className = "zoom-close";
  closeBtn.textContent = "×";
  closeBtn.onclick = () => {
    hideZoomTauntOverlay();
    wrapper.remove();
  };
  content.appendChild(closeBtn);

  wrapper.appendChild(content);

  // Tap/click image to show tags
  img.addEventListener("click", () => {
    tagList.style.display = tagList.style.display === "none" ? "block" : "none";
    topTags.style.display = topTags.style.display === "none" ? "block" : "none";
  });

  // Keyboard navigation
  wrapper.tabIndex = 0;
  wrapper.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      prevBtn.click();
      e.preventDefault();
    }
    if (e.key === "ArrowRight") {
      nextBtn.click();
      e.preventDefault();
    }
    if (e.key === "Escape") {
      closeBtn.click();
      e.preventDefault();
    }
  });

  wrapper.addEventListener("click", (e) => {
    if (e.target === wrapper) wrapper.remove();
  });

  return {
    wrapper,
    img,
    tagList,
    topTags,
    noEntriesMsg,
    closeBtn,
    prevBtn,
    nextBtn,
    tauntHeader,
  };
}

/**
 * Sets up keyboard shortcuts for the application
 */
function setupKeyboardShortcuts(shortcuts = {}) {
  document.addEventListener("keydown", (e) => {
    // Skip if typing in an input
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
      return;
    }

    const key = e.key.toLowerCase();
    const combo = [
      e.ctrlKey && "ctrl",
      e.altKey && "alt",
      e.shiftKey && "shift",
      key,
    ]
      .filter(Boolean)
      .join("+");

    if (shortcuts[combo]) {
      e.preventDefault();
      shortcuts[combo]();
    }
  });
}

/**
 * Initializes general UI components
 */
function initUI() {
  setupBackToTop();
  addLipstickKiss();
}

/**
 * Shows a toast notification (global, re-usable)
 */
function showToast(message, duration = 3000) {
  const toast = document.createElement("div");
  toast.className = "toast-popup";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

/**
 * Scrolls smoothly to the top of the page.
 */
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Creates a confirmation modal with OK/Cancel.
 * Returns a Promise that resolves to true/false.
 */
function createConfirmationModal(message) {
  return new Promise((resolve) => {
    const modal = createModal("", "confirmation-modal");
    const content = modal.querySelector(".confirmation-modal-content");
    content.innerHTML = `<div style="margin-bottom:1em;">${message}</div>`;
    const okBtn = document.createElement("button");
    okBtn.textContent = "OK";
    okBtn.className = "browse-btn";
    okBtn.onclick = () => {
      modal.remove();
      resolve(true);
    };
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.className = "browse-btn";
    cancelBtn.onclick = () => {
      modal.remove();
      resolve(false);
    };
    content.append(okBtn, cancelBtn);
    document.body.appendChild(modal);
    okBtn.focus();
  });
}

/**
 * Triggers a short vibration for haptic feedback (if supported)
 */
function vibrate(ms = 30) {
  if (window.navigator && typeof window.navigator.vibrate === "function") {
    window.navigator.vibrate(ms);
  }
}

/**
 * Triggers a screen pulse effect (CSS + accessibility)
 */
function pulseScreen() {
  if (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  document.body.classList.add("screen-pulse");
  setTimeout(() => document.body.classList.remove("screen-pulse"), 500);
}

// All functions in this file are defined and used as follows:

// showNoEntriesMsg: exported, used by other modules
// setupInfiniteScroll: exported, used by main.js
// setupBackToTop: used by initUI
// setupBackgroundRotation: exported, used by main.js
// addLipstickKiss: used by initUI
// createSpinner: exported, used by gallery.js
// debounce: exported, used by tags.js
// throttle: exported, not used internally (for external use)
// createModal: exported, used by createConfirmationModal
// createFullscreenViewer: exported, used by gallery.js
// setupKeyboardShortcuts: exported, not used internally (for external use)
// initUI: exported, used by main.js
// showToast: exported, used by sidebar.js, humiliation.js, audio.js
// scrollToTop: exported, not used internally (for external use)
// createConfirmationModal: exported, not used internally (for external use)
// vibrate: exported, not used internally (for external use)
// pulseScreen: exported, not used internally (for external use)

// No unused or undefined functions in this file.

// Export functions for ES modules
export {
  showNoEntriesMsg,
  setupInfiniteScroll,
  setupBackToTop,
  setupBackgroundRotation,
  addLipstickKiss,
  createSpinner,
  debounce,
  throttle,
  createModal,
  createFullscreenViewer,
  setupKeyboardShortcuts,
  initUI,
  showToast,
  scrollToTop,
  createConfirmationModal,
  vibrate,
  pulseScreen,
};
