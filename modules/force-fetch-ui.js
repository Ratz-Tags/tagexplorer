/**
 * Force Fetch UI Module - Handles forced style tag fetching with humiliating progress display
 */

// Humiliating messages for force fetch loading
const FETCH_TAUNTS = [
  "Impatient, are we? Typical.",
  "Can't wait for the background fetch? Needy.",
  "Forcing me to hurry... how demanding.",
  "You know this won't make you find them faster.",
  "Desperate to see who draws what you crave.",
  "All this effort just to feed your obsession.",
  "Watch the bar fill. That's all you're good for.",
  "You really can't wait, can you? Pathetic.",
  "Every second you wait is delicious.",
  "Imagine explaining THIS to someone.",
  "Staring at a loading bar for your fetishes. Peak behavior.",
  "You'd wait all day if I told you to.",
  "This is taking too long? Good.",
  "Count the seconds. Feel the need.",
  "You're not going anywhere until I'm done.",
  "So eager. So transparent.",
  "Your patience is wearing thin, isn't it?",
  "Don't worry, I'll take my time.",
  "You clicked this button. You did this.",
  "Feel free to close this. Oh wait, you won't.",
  "Stare at the progress. It owns you right now.",
  "You could be doing anything else. But here you are.",
  "Every artist loaded is another confession.",
  "This is what desperation looks like.",
  "Still waiting? Of course you are.",
  "The bar moves slower when you watch.",
  "You'd refresh the page if you weren't afraid.",
  "Savor the anticipation. It's all you deserve right now.",
  "Your need is showing.",
  "This wouldn't be necessary if you had any self-control."
];

let currentOverlay = null;
let messageInterval = null;
let currentMessageIndex = 0;

/**
 * Show the force fetch overlay with progress bar and taunts
 */
export function showForceFetchOverlay(totalArtists) {
  // Remove any existing overlay
  hideForceFetchOverlay();
  
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal';
  overlay.style.zIndex = '20000';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';
  modalContent.style.maxWidth = '600px';
  modalContent.style.textAlign = 'center';
  
  modalContent.innerHTML = `
    <div style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.5rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3em; color: white; margin-bottom: 1rem;">
        FETCHING STYLE TAGS
      </h2>
      <p id="fetch-taunt" style="font-size: 0.9rem; color: rgba(226, 232, 240, 0.8); min-height: 3rem; line-height: 1.6; font-style: italic; margin-bottom: 2rem;">
        ${FETCH_TAUNTS[0]}
      </p>
    </div>
    
    <div style="margin-bottom: 1.5rem;">
      <div style="background: rgba(255, 255, 255, 0.1); border-radius: 0.5rem; height: 2rem; overflow: hidden; position: relative;">
        <div id="fetch-progress-bar" style="background: linear-gradient(90deg, rgba(102, 243, 255, 0.8), rgba(255, 102, 196, 0.8)); height: 100%; width: 0%; transition: width 0.3s ease; box-shadow: 0 0 20px rgba(102, 243, 255, 0.6);"></div>
      </div>
      <div style="display: flex; justify-content: space-between; margin-top: 0.5rem; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.2em; color: rgba(226, 232, 240, 0.6);">
        <span id="fetch-current">0</span>
        <span id="fetch-total">${totalArtists}</span>
      </div>
    </div>
    
    <div style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.25em; color: rgba(226, 232, 240, 0.5);">
      <p style="margin-bottom: 0.5rem;">Analyzing artist styles from Danbooru...</p>
      <p style="opacity: 0.7;">Rate limited to respect API constraints</p>
    </div>
    
    <div style="margin-top: 2rem;">
      <button id="fetch-cancel-btn" class="browse-btn" style="padding: 0.5rem 1.5rem; opacity: 0.5; cursor: not-allowed;" disabled>
        Cancel (Coward)
      </button>
    </div>
  `;
  
  overlay.appendChild(modalContent);
  document.body.appendChild(overlay);
  currentOverlay = overlay;
  
  // Rotate taunts every 4 seconds
  currentMessageIndex = 0;
  messageInterval = setInterval(() => {
    currentMessageIndex = (currentMessageIndex + 1) % FETCH_TAUNTS.length;
    const tauntEl = document.getElementById('fetch-taunt');
    if (tauntEl) {
      // Fade out
      tauntEl.style.opacity = '0';
      tauntEl.style.transition = 'opacity 0.3s ease';
      
      setTimeout(() => {
        tauntEl.textContent = FETCH_TAUNTS[currentMessageIndex];
        tauntEl.style.opacity = '1';
      }, 300);
    }
  }, 4000);
  
  return overlay;
}

/**
 * Update the progress bar
 */
export function updateForceFetchProgress(current, total) {
  const progressBar = document.getElementById('fetch-progress-bar');
  const currentEl = document.getElementById('fetch-current');
  const totalEl = document.getElementById('fetch-total');
  
  if (progressBar) {
    const percentage = total > 0 ? (current / total) * 100 : 0;
    progressBar.style.width = `${percentage}%`;
  }
  
  if (currentEl) {
    currentEl.textContent = current;
  }
  
  if (totalEl) {
    totalEl.textContent = total;
  }
}

/**
 * Hide the force fetch overlay
 */
export function hideForceFetchOverlay() {
  if (messageInterval) {
    clearInterval(messageInterval);
    messageInterval = null;
  }
  
  if (currentOverlay) {
    // Fade out effect
    currentOverlay.style.transition = 'opacity 0.3s ease';
    currentOverlay.style.opacity = '0';
    
    setTimeout(() => {
      if (currentOverlay && currentOverlay.parentNode) {
        currentOverlay.remove();
      }
      currentOverlay = null;
    }, 300);
  }
}

/**
 * Show completion message with final taunt
 */
export function showFetchComplete(totalFetched) {
  if (!currentOverlay) return;
  
  const modalContent = currentOverlay.querySelector('.modal-content');
  if (!modalContent) return;
  
  // Clear message rotation
  if (messageInterval) {
    clearInterval(messageInterval);
    messageInterval = null;
  }
  
  const finalTaunts = [
    "Done. Feel better now?",
    "There. Happy now? Doubt it.",
    "All that waiting for this. Worth it?",
    "Your artists are ready. Like you care about art.",
    "Enjoy your results. We both know what you're really looking for.",
    "Fetched. Now you have no excuse.",
    "Complete. The shame continues.",
    "Got what you needed. Feel proud?"
  ];
  
  const finalTaunt = finalTaunts[Math.floor(Math.random() * finalTaunts.length)];
  
  modalContent.innerHTML = `
    <div style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.5rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3em; color: rgb(102, 243, 255); margin-bottom: 1rem;">
        FETCH COMPLETE
      </h2>
      <p style="font-size: 0.9rem; color: rgba(226, 232, 240, 0.8); min-height: 3rem; line-height: 1.6; font-style: italic; margin-bottom: 2rem;">
        ${finalTaunt}
      </p>
    </div>
    
    <div style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.2em; color: rgba(226, 232, 240, 0.7); margin-bottom: 2rem;">
      <p>${totalFetched} artists analyzed</p>
      <p style="font-size: 0.7rem; opacity: 0.7; margin-top: 0.5rem;">Style tags cached for 24 hours</p>
    </div>
    
    <div style="margin-top: 2rem;">
      <button id="fetch-close-btn" class="browse-btn" style="padding: 0.5rem 1.5rem;">
        Close
      </button>
    </div>
  `;
  
  // Close button handler
  const closeBtn = modalContent.querySelector('#fetch-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      hideForceFetchOverlay();
    });
  }
  
  // Auto-close after 3 seconds
  setTimeout(() => {
    hideForceFetchOverlay();
  }, 3000);
}
