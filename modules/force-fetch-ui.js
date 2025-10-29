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

const TAUNT_DEFAULT_COLOR = 'rgba(226, 232, 240, 0.8)';
const TAUNT_INFO_COLOR = 'rgba(148, 233, 255, 0.85)';
const TAUNT_WARNING_COLOR = 'rgba(255, 160, 160, 0.9)';
const TAUNT_SUCCESS_COLOR = 'rgba(255, 118, 214, 0.85)';

let currentOverlay = null;
let messageInterval = null;
let currentMessageIndex = 0;
let cancelRequested = false;
let onCancelCallback = null;
let pinnedMessageUntil = 0;

function applyTauntToneColor(element, tone = 'default') {
  if (!element) return;
  switch (tone) {
    case 'warning':
      element.style.color = TAUNT_WARNING_COLOR;
      break;
    case 'success':
      element.style.color = TAUNT_SUCCESS_COLOR;
      break;
    case 'info':
      element.style.color = TAUNT_INFO_COLOR;
      break;
    default:
      element.style.color = TAUNT_DEFAULT_COLOR;
  }
}

function scheduleMessageHold(durationMs = 2400) {
  pinnedMessageUntil = Date.now() + Math.max(0, durationMs);
}

/**
 * Show the force fetch overlay with progress bar and taunts
 */
export function showForceFetchOverlay(totalArtists, onCancel = null) {
  // Reset cancellation state
  cancelRequested = false;
  onCancelCallback = onCancel;
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
      <button id="fetch-cancel-btn" class="browse-btn" style="padding: 0.5rem 1.5rem;">
        Cancel (Coward)
      </button>
    </div>
  `;
  
  overlay.appendChild(modalContent);
  document.body.appendChild(overlay);
  currentOverlay = overlay;

  const initialTaunt = document.getElementById('fetch-taunt');
  if (initialTaunt) {
    applyTauntToneColor(initialTaunt, 'default');
    scheduleMessageHold(2800);
  }
  
  // Add cancel button handler
  const cancelBtn = modalContent.querySelector('#fetch-cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      cancelRequested = true;
      if (onCancelCallback) {
        onCancelCallback();
      }
      
      // Update button to show cancellation
      cancelBtn.textContent = 'Cancelling...';
      cancelBtn.disabled = true;
      cancelBtn.style.opacity = '0.5';
      cancelBtn.style.cursor = 'not-allowed';
      
      // Update taunt
      const tauntEl = document.getElementById('fetch-taunt');
      if (tauntEl) {
        tauntEl.textContent = 'Giving up already? Pathetic.';
        applyTauntToneColor(tauntEl, 'warning');
        scheduleMessageHold(3600);
      }
    });
  }

  // Rotate taunts every 4 seconds
  currentMessageIndex = 0;
  messageInterval = setInterval(() => {
    if (Date.now() < pinnedMessageUntil) {
      return;
    }
    currentMessageIndex = (currentMessageIndex + 1) % FETCH_TAUNTS.length;
    const tauntEl = document.getElementById('fetch-taunt');
    if (tauntEl) {
      // Fade out
      tauntEl.style.opacity = '0';
      tauntEl.style.transition = 'opacity 0.3s ease';

      setTimeout(() => {
        tauntEl.textContent = FETCH_TAUNTS[currentMessageIndex];
        applyTauntToneColor(tauntEl, 'default');
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

export function setForceFetchTaunt(message, options = {}) {
  const { tone = 'default', holdMs = 2400 } = options ?? {};
  const tauntEl = document.getElementById('fetch-taunt');
  if (!tauntEl) return;

  tauntEl.style.transition = 'opacity 0.25s ease';
  tauntEl.style.opacity = '0';

  const applyUpdate = () => {
    tauntEl.textContent = message ?? FETCH_TAUNTS[currentMessageIndex] ?? '';
    applyTauntToneColor(tauntEl, tone);
    tauntEl.style.opacity = '1';
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(applyUpdate);
  });

  scheduleMessageHold(typeof holdMs === 'number' ? holdMs : 2400);
}

/**
 * Check if cancellation has been requested
 */
export function isCancelRequested() {
  return cancelRequested;
}

/**
 * Reset cancellation state
 */
export function resetCancellation() {
  cancelRequested = false;
  onCancelCallback = null;
  pinnedMessageUntil = 0;
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
      resetCancellation();
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
