/**
 * Sidebar module - Handles the copied artists sidebar functionality
 */

let copiedArtists = new Set();
let copiedSidebar = null;
let allArtists = [];

/**
 * Shows a toast notification message
 */
function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast-popup";
  toast.textContent = message;
  document.body.appendChild(toast);

  if (Math.random() < 0.4) {
    const moanAudio = document.getElementById("moan-audio");
    if (moanAudio) {
      moanAudio.currentTime = 0;
      moanAudio.play().catch(() => {});
    }
  }

  setTimeout(() => toast.remove(), 3000);
}

/**
 * Handles copying an artist name to clipboard and adding to sidebar
 */
function handleArtistCopy(artist, imgSrc) {
  // Remove underscores and copy as artist:artistTag
  const artistTag = artist.artistName.replace(/_/g, " ");
  const copyText = `artist:${artistTag}`;
  navigator.clipboard
    .writeText(copyText)
    .then(() => {
      showToast(`Copied: ${copyText}`);
      // Add to copied sidebar
      if (!copiedArtists.has(artist.artistName)) {
        copiedArtists.add(artist.artistName);
        updateCopiedSidebar();
      }
    })
    .catch(() => {
      showToast("Failed to copy!");
    });
}

/**
 * Updates the content of the copied artists sidebar
 */
function updateCopiedSidebar() {
  if (!copiedSidebar) return;
  copiedSidebar.innerHTML = "";

  // Add close button at the top
  const closeBtn = document.createElement("button");
  closeBtn.className = "copied-sidebar-close";
  closeBtn.innerHTML = "&times;";
  closeBtn.title = "Close";
  closeBtn.onclick = () => copiedSidebar.classList.remove("visible");
  copiedSidebar.appendChild(closeBtn);

  copiedArtists.forEach((name) => {
    const artist = allArtists.find((a) => a.artistName === name);
    const div = document.createElement("div");
    div.className = "copied-artist";
    div.style.display = "flex";
    div.style.alignItems = "center";
    div.style.cursor = "pointer";
    div.style.padding = "1em 0.5em"; // More tap area
    div.style.gap = "12px"; // More space between image and text
    div.style.fontSize = "1.15em"; // Larger text

    let tooltip =
      artist && artist.tooltip
        ? artist.tooltip
        : artist?.artistName.replace(/_/g, " ");

    if (artist && artist.thumbnailUrl) {
      const img = document.createElement("img");
      img.src = artist.thumbnailUrl;
      img.style.width = "44px";
      img.style.height = "44px";
      img.style.borderRadius = "12px";
      img.style.marginRight = "10px";
      img.title = tooltip;
      div.appendChild(img);
    }

    const nameSpan = document.createElement("span");
    nameSpan.textContent = name.replace(/_/g, " ");
    nameSpan.title = tooltip;
    nameSpan.style.flex = "1";
    nameSpan.style.fontWeight = "bold";
    div.appendChild(nameSpan);

    // Make the whole row tappable
    div.onclick = () => {
      import("./gallery.js")
        .then((gallery) => {
          gallery.openArtistZoom(artist);
        })
        .catch(console.warn);
    };

    copiedSidebar.appendChild(div);
  });
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

// Export functions for ES modules
export {
  handleArtistCopy,
  updateCopiedSidebar,
  initSidebar,
  setAllArtists,
  setCopiedArtists,
  setCopiedSidebar,
  showToast,
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
