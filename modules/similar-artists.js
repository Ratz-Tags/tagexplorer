/**
 * Similar Artists Module - Finds and displays artists with similar tags
 */

let allArtists = [];

/**
 * Sets the reference to all artists data
 */
export function setAllArtists(artists) {
  allArtists = Array.isArray(artists) ? [...artists] : [];
}

/**
 * Calculate similarity score between two artists based on shared tags
 */
function calculateSimilarity(artist1, artist2) {
  if (!artist1 || !artist2) return 0;
  
  const tags1 = new Set(artist1.tags || []);
  const tags2 = new Set(artist2.tags || []);
  
  if (tags1.size === 0 || tags2.size === 0) return 0;
  
  // Count shared tags
  let sharedCount = 0;
  for (const tag of tags1) {
    if (tags2.has(tag)) {
      sharedCount++;
    }
  }
  
  // Jaccard similarity coefficient: intersection / union
  const union = tags1.size + tags2.size - sharedCount;
  return union > 0 ? sharedCount / union : 0;
}

/**
 * Find similar artists to the given artist
 */
export function findSimilarArtists(artist, options = {}) {
  const { limit = 10, minSimilarity = 0.1 } = options;
  
  if (!artist || !allArtists.length) return [];
  
  const similarities = allArtists
    .filter(a => a.artistName !== artist.artistName) // Exclude the artist itself
    .map(a => ({
      artist: a,
      score: calculateSimilarity(artist, a),
      sharedTags: getSharedTags(artist, a)
    }))
    .filter(item => item.score >= minSimilarity)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  
  return similarities;
}

/**
 * Get shared tags between two artists
 */
function getSharedTags(artist1, artist2) {
  const tags1 = new Set(artist1.tags || []);
  const tags2 = new Set(artist2.tags || []);
  
  const shared = [];
  for (const tag of tags1) {
    if (tags2.has(tag)) {
      shared.push(tag);
    }
  }
  
  return shared;
}

/**
 * Show similar artists modal
 */
export function showSimilarArtistsModal(artist, options = {}) {
  if (!artist) return;
  
  const similar = findSimilarArtists(artist, options);
  
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal';
  overlay.style.zIndex = '15000';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';
  modalContent.style.maxWidth = '900px';
  modalContent.style.maxHeight = '80vh';
  modalContent.style.overflowY = 'auto';
  
  modalContent.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <h2 style="font-size: 1.2rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3em; color: white; margin-bottom: 0.5rem;">
        Similar to ${artist.artistName}
      </h2>
      <p style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.25em; color: rgba(226, 232, 240, 0.7);">
        ${similar.length} artists found with matching tags
      </p>
    </div>
    <div id="similar-artists-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem;">
    </div>
    <div style="margin-top: 1.5rem; display: flex; justify-content: flex-end;">
      <button class="browse-btn" id="close-similar-modal" style="padding: 0.5rem 1.5rem;">
        Close
      </button>
    </div>
  `;
  
  overlay.appendChild(modalContent);
  document.body.appendChild(overlay);
  
  // Render similar artists
  const listContainer = modalContent.querySelector('#similar-artists-list');
  
  if (similar.length === 0) {
    listContainer.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: rgba(226, 232, 240, 0.6);">
        <p style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.25em;">
          No similar artists found
        </p>
      </div>
    `;
  } else {
    similar.forEach(({ artist: similarArtist, score, sharedTags }) => {
      const card = document.createElement('div');
      card.className = 'similar-artist-card';
      card.style.cssText = `
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 1rem;
        padding: 1rem;
        background: rgba(255, 255, 255, 0.05);
        transition: all 0.2s;
        cursor: pointer;
      `;
      
      card.innerHTML = `
        <div style="font-size: 0.85rem; font-weight: 600; color: white; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.2em;">
          ${similarArtist.artistName}
        </div>
        <div style="font-size: 0.65rem; color: rgba(102, 243, 255, 0.8); margin-bottom: 0.75rem;">
          ${Math.round(score * 100)}% match
        </div>
        <div style="font-size: 0.6rem; color: rgba(226, 232, 240, 0.6); text-transform: uppercase; letter-spacing: 0.15em;">
          ${sharedTags.slice(0, 3).join(', ')}${sharedTags.length > 3 ? '...' : ''}
        </div>
      `;
      
      // Hover effect
      card.addEventListener('mouseenter', () => {
        card.style.borderColor = 'rgba(102, 243, 255, 0.5)';
        card.style.background = 'rgba(102, 243, 255, 0.1)';
        card.style.transform = 'translateY(-2px)';
      });
      
      card.addEventListener('mouseleave', () => {
        card.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        card.style.background = 'rgba(255, 255, 255, 0.05)';
        card.style.transform = 'translateY(0)';
      });
      
      // Click to view artist (scroll to them in gallery if possible)
      card.addEventListener('click', () => {
        overlay.remove();
        // Try to scroll to the artist card
        const artistCard = document.querySelector(`[data-artist-name="${similarArtist.artistName}"]`);
        if (artistCard) {
          artistCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Highlight briefly
          artistCard.style.boxShadow = '0 0 30px rgba(102, 243, 255, 0.8)';
          setTimeout(() => {
            artistCard.style.boxShadow = '';
          }, 2000);
        }
      });
      
      listContainer.appendChild(card);
    });
  }
  
  // Close modal handlers
  const closeBtn = modalContent.querySelector('#close-similar-modal');
  closeBtn.addEventListener('click', () => overlay.remove());
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
  
  // ESC key to close
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}
