export async function initLandingPage({ shell }) {
  const audioButton = document.querySelector('[data-landing-audio]');
  let setupPromise = null;

  // Initialize background montage rotation
  initMontage();

  function revealAudioPanel() {
    if (!shell?.audioPanel) return;
    shell.audioPanel.removeAttribute('hidden');
    const panel = shell.audioPanel.querySelector('#audio-panel');
    if (panel) {
      panel.classList.remove('hidden');
      panel.setAttribute('aria-hidden', 'false');
    }
  }

  function initMontage() {
    const frames = document.querySelectorAll('.landing-montage__frame');
    if (frames.length === 0) return;

    let currentIndex = 0;
    
    // Show first frame immediately
    frames[0].style.opacity = '1';
    
    // Rotate frames every 4 seconds
    setInterval(() => {
      // Fade out current frame
      frames[currentIndex].style.opacity = '0';
      
      // Move to next frame
      currentIndex = (currentIndex + 1) % frames.length;
      
      // Fade in next frame
      frames[currentIndex].style.opacity = '1';
    }, 4000);
  }

  if (audioButton) {
    audioButton.addEventListener('click', async () => {
      audioButton.disabled = true;
      audioButton.classList.add('is-loading');
      try {
        if (!setupPromise) {
          setupPromise = (async () => {
            const [{ initAudio, initAudioUI }] = await Promise.all([
              import('../audio.js'),
            ]);
            await initAudio();
            initAudioUI();
          })();
        }
        await setupPromise;
        revealAudioPanel();
        audioButton.textContent = 'Whispers armed';
      } catch (error) {
        console.warn('[landing] Failed to initialise audio', error);
        audioButton.textContent = 'Audio unavailable';
      } finally {
        audioButton.classList.remove('is-loading');
      }
    });
  }

  return {};
}

export const initPage = initLandingPage;
