export async function initLandingPage({ shell }) {
  const audioButton = document.querySelector('[data-landing-audio]');
  let setupPromise = null;

  function revealAudioPanel() {
    if (!shell?.audioPanel) return;
    shell.audioPanel.removeAttribute('hidden');
    const panel = shell.audioPanel.querySelector('#audio-panel');
    if (panel) {
      panel.classList.remove('hidden');
      panel.setAttribute('aria-hidden', 'false');
    }
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
