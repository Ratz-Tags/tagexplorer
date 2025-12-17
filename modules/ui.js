/**
 * UI module - General UI utilities and helper functions
 */

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
function setupInfiniteScroll(options, legacyInfoProvider) {
  const gallery = document.getElementById("artist-gallery");
  if (!gallery) return;

  let config = options;
  if (typeof options === "function") {
    config = {
      onForward: options,
      infoProvider: legacyInfoProvider,
    };
  }

  if (!config || typeof config !== "object") return;

  const {
    onForward,
    onBackward,
    infoProvider,
    rootMargin = "30% 0px",
  } = config;

  if (typeof onForward !== "function") return;

  let forwardLoading = false;
  let backwardLoading = false;
  const activeSentinels = new Set();
  let lastProgressSignature = null;

  const emitProgress = (direction) => {
    if (typeof document === "undefined") return;
    if (typeof infoProvider !== "function") return;
    const info = infoProvider();
    if (!info) return;
    const signature = `${info.lastRenderedPage}:${info.shown}:${direction}`;
    if (signature && signature === lastProgressSignature) {
      return;
    }
    lastProgressSignature = signature;
    const detail = {
      shown: info.shown,
      total: info.total,
      direction,
      page: info.lastRenderedPage,
      signature,
    };
    try {
      document.dispatchEvent(new CustomEvent("goal:progress", { detail }));
    } catch (error) {
      try {
        const evt = document.createEvent("CustomEvent");
        evt.initCustomEvent("goal:progress", false, false, detail);
        document.dispatchEvent(evt);
      } catch (fallbackError) {
        console.warn("[ui] Failed to dispatch goal progress", fallbackError || error);
      }
    }
  };

  const requestStep = (direction) => {
    const info = typeof infoProvider === "function" ? infoProvider() : null;
    if (direction === "backward") {
      if (
        typeof onBackward !== "function" ||
        backwardLoading ||
        !(info?.hasMoreBackward)
      ) {
        return;
      }
      backwardLoading = true;
      Promise.resolve(onBackward())
        .catch((error) => {
          console.warn("Infinite scroll backward callback failed", error);
        })
        .then(() => emitProgress("backward"))
        .finally(() => {
          backwardLoading = false;
        });
    } else {
      if (forwardLoading || !(info?.hasMoreForward ?? info?.hasMore)) {
        return;
      }
      forwardLoading = true;
      Promise.resolve(onForward())
        .catch((error) => {
          console.warn("Infinite scroll forward callback failed", error);
        })
        .then(() => emitProgress("forward"))
        .finally(() => {
          forwardLoading = false;
        });
    }
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const direction = entry.target?.dataset?.direction || "forward";
        requestStep(direction === "backward" ? "backward" : "forward");
      });
    },
    {
      root: null,
      rootMargin,
      threshold: 0.01,
    }
  );

  const connectSentinels = () => {
    const bottom = document.getElementById("gallery-end-sentinel");
    const top = document.getElementById("gallery-start-sentinel");
    const targets = [bottom, top].filter((el) => el instanceof Element);

    // Disconnect any removed sentinels
    activeSentinels.forEach((node) => {
      if (!node || !node.isConnected || !targets.includes(node)) {
        observer.unobserve(node);
        activeSentinels.delete(node);
      }
    });

    targets.forEach((node) => {
      if (!activeSentinels.has(node)) {
        observer.observe(node);
        activeSentinels.add(node);
      }
    });
  };

  connectSentinels();
  requestAnimationFrame(() => emitProgress("init"));

  const mutationObserver = new MutationObserver(() => {
    connectSentinels();
  });

  mutationObserver.observe(gallery, { childList: true });

  window.addEventListener("beforeunload", () => {
    observer.disconnect();
    mutationObserver.disconnect();
    activeSentinels.clear();
  });
}

/**
 * Sets up back-to-top button functionality
 */
function setupBackToTop() {
  const backToTopBtn = document.getElementById("back-to-top");
  if (!backToTopBtn) return;

  const show = () => {
    backToTopBtn.classList.add("is-visible");
    backToTopBtn.setAttribute("aria-hidden", "false");
  };

  const hide = () => {
    backToTopBtn.classList.remove("is-visible");
    backToTopBtn.setAttribute("aria-hidden", "true");
  };

  const onScroll = () => {
    if (window.scrollY > 200) {
      show();
    } else {
      hide();
    }
  };

  hide();
  onScroll();

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("beforeunload", () => {
    window.removeEventListener("scroll", onScroll);
  });

  backToTopBtn.addEventListener("click", (event) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function setupStickyTopBar() {
  // Header is no longer sticky - this function is disabled
  // The header will scroll naturally with the page content
  return;
}

/**
 * Sets up random background changes at intervals
 */
async function setupBackgroundRotation(setBackgroundCallback, options = {}) {
  if (typeof setBackgroundCallback !== 'function') return null;

  let config = options;
  if (typeof options === 'number') {
    config = { interval: options };
  }
  const controllerOptions = {
    setBackground: setBackgroundCallback,
    getActiveTags: config?.getActiveTags,
    getFilteredArtists: config?.getFilteredArtists,
    getPaginationInfo: config?.getPaginationInfo,
    interval: typeof config?.interval === 'number' ? config.interval : 15000,
  };

  try {
    const module = await import('./ambience-controller.js');
    if (module?.initAmbienceController) {
      return module.initAmbienceController(controllerOptions);
    }
  } catch (error) {
    console.warn('Failed to initialize ambience controller, falling back to timer', error);
  }

  setBackgroundCallback();
  const interval = controllerOptions.interval;
  const timer = setInterval(() => {
    try {
      setBackgroundCallback();
    } catch (err) {
      console.warn('Background rotation fallback failed', err);
    }
  }, interval);

  return {
    dispose() {
      clearInterval(timer);
    },
  };
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
    `<img src="/spinner.gif" alt="Loading..." />` +
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
function createFullscreenViewer(options = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = "fullscreen-wrapper";

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
    wrapper.remove();
  };
  content.appendChild(closeBtn);

  wrapper.appendChild(content);

  // Tap/click behavior for image
  if (typeof options.onImageClick === "function") {
    img.addEventListener("click", (e) => {
      e.preventDefault();
      options.onImageClick(e);
    });
  } else {
    img.addEventListener("click", () => {
      tagList.style.display =
        tagList.style.display === "none" ? "block" : "none";
      topTags.style.display =
        topTags.style.display === "none" ? "block" : "none";
    });
  }

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
  };
}

/**
 * Sets up keyboard shortcuts for the application
 */
function setupKeyboardShortcuts(shortcuts = {}) {
  document.addEventListener("keydown", (e) => {
    // Skip if typing in an input
    const target = e.target;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
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
  // Ensure background layer exists
  let bg = document.getElementById("background-blur");
  if (!bg) {
    bg = document.createElement("div");
    bg.id = "background-blur";
    document.body.prepend(bg);
  }
  addLipstickKiss();
  setupBackToTop();
  setupStickyTopBar();
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

function vibratePattern(pattern = [20, 35, 20]) {
  if (window.navigator && typeof window.navigator.vibrate === "function") {
    const sequence = Array.isArray(pattern) ? pattern : [pattern];
    window.navigator.vibrate(sequence);
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
  vibratePattern,
  pulseScreen,
};
