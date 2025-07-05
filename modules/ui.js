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
function setupInfiniteScroll(callback) {
  let scrollTimeout = null;
  window.addEventListener("scroll", () => {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const isNearBottom = 
        window.innerHeight + window.scrollY >= 
        document.body.offsetHeight - 300;
      
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
  spinner.innerHTML = `<img src="spinner.gif" alt="Loading..." />`;
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
      setTimeout(() => inThrottle = false, wait);
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
  
  const img = document.createElement("img");
  img.className = "fullscreen-img";
  wrapper.appendChild(img);

  const noEntriesMsg = document.createElement("span");
  noEntriesMsg.style.display = "none";
  noEntriesMsg.className = "no-entries-msg";
  noEntriesMsg.textContent = "No valid entries";
  wrapper.appendChild(noEntriesMsg);

  const closeBtn = document.createElement("button");
  closeBtn.className = "zoom-close";
  closeBtn.textContent = "×";
  closeBtn.onclick = () => wrapper.remove();

  const prevBtn = document.createElement("button");
  prevBtn.className = "zoom-prev";
  prevBtn.textContent = "←";

  const nextBtn = document.createElement("button");
  nextBtn.className = "zoom-next";
  nextBtn.textContent = "→";

  wrapper.append(closeBtn, prevBtn, nextBtn);

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

  return {
    wrapper,
    img,
    noEntriesMsg,
    closeBtn,
    prevBtn,
    nextBtn
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
      key
    ].filter(Boolean).join("+");
    
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
  initUI
};