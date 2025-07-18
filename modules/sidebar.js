/**
 * Sidebar module - Handles the copied artists sidebar functionality
 */

let copiedArtists = new Set();
let copiedSidebar = null;
let allArtists = [];
let copiedArtistsCache = null;

/**
 * Returns the count of copied artists
 */
function getCopiedCount() {
  return copiedArtists.size;
}

/**
 * Shows a toast notification message
 */
function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast-popup";
  toast.textContent = message;
  document.body.appendChild(toast);

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
    tauntMsg = "No artists copied yet. Too shy?";
  } else if (copiedCount === 1) {
    tauntMsg = "Just one? Surely you can do better.";
  } else if (copiedCount < 4) {
    tauntMsg = `Already copied ${copiedCount}? Getting needy!`;
  } else if (copiedCount < 8) {
    tauntMsg = `Wow, ${copiedCount} artists? Greedy little thing!`;
  } else if (copiedCount < 15) {
    tauntMsg = `Obsessed much? ${copiedCount} artists and counting...`;
  } else {
    tauntMsg = `Shameless! ${copiedCount} artists? You're insatiable!`;
  }
  const tauntBanner = document.createElement("div");
  tauntBanner.className = "sidebar-taunt-banner";
  tauntBanner.textContent = tauntMsg;
  copiedSidebar.appendChild(tauntBanner);

  // --- HUMILIATION: Shame badge if copied more than 3 artists ---
  if (copiedCount > 3) {
    const shameBadge = document.createElement("div");
    shameBadge.className = "shame-badge pulse";
    shameBadge.innerHTML = `SHAME <span>💋</span>`;
    shameBadge.title =
      copiedCount < 8
        ? "So many artists, so little dignity."
        : copiedCount < 15
        ? "You're really going for a high score, huh?"
        : "Utterly shameless!";
    copiedSidebar.appendChild(shameBadge);
  }

  // Add close button at the top
  const closeBtn = document.createElement("button");
  closeBtn.className = "copied-sidebar-close";
  closeBtn.innerHTML = "&times;";
  closeBtn.title = "Close";
  closeBtn.onclick = () => copiedSidebar.classList.remove("visible");
  copiedSidebar.appendChild(closeBtn);

  copiedArtists.forEach((artistTag) => {
    // Find the artist object by normalized name
    const artist = allArtists.find(
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

    let tooltip = artist && artist.tooltip ? artist.tooltip : artistTag;

    // Show thumbnail if available
    if (artist && artist.thumbnailUrl) {
      const img = document.createElement("img");
      img.src = artist.thumbnailUrl;
      img.style.width = "44px";
      img.style.height = "44px";
      img.style.borderRadius = "12px";
      div.appendChild(img);
    }

    // --- HUMILIATION: Add lipstick kiss or sparkle icon ---
    const icon = document.createElement("span");
    icon.className = "lipstick-kiss";
    icon.title = "Kissed with shame!";
    icon.innerHTML = Math.random() > 0.5 ? "💋" : "✨";
    div.appendChild(icon);

    const nameSpan = document.createElement("span");
    nameSpan.textContent = artistTag;
    nameSpan.title = tooltip;
    nameSpan.style.flex = "1";
    nameSpan.style.fontWeight = "bold";
    div.appendChild(nameSpan);

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
}

/**
 * Initializes the sidebar with DOM elements and event listeners
 */
function initSidebar() {
  copiedSidebar = document.getElementById("copied-sidebar");

  const sidebarToggles = document.querySelectorAll(".sidebar-toggle");
  if (sidebarToggles && copiedSidebar) {
    sidebarToggles.forEach((btn) => {
      btn.addEventListener("click", () => {
        copiedSidebar.classList.toggle("visible");
        // Toggle body class when sidebar is opened or closed
        if (copiedSidebar.classList.contains("visible")) {
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
function setAllArtists(artists) {
  allArtists = artists;
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
