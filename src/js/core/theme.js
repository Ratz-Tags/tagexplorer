export function applyTheme(preferences) {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const humiliationEnabled = Boolean(preferences?.humiliation?.enabled ?? true);
  const humiliationLevel = preferences?.humiliation?.intensity ?? 2;
  const ttsIntensity = preferences?.tts?.intensity ?? 2;
  const ttsMuted = Boolean(preferences?.tts?.muted ?? false);

  root.dataset.humiliation = humiliationEnabled ? 'on' : 'off';
  root.style.setProperty('--humiliation-level', humiliationLevel);
  root.dataset.tts = ttsMuted ? 'muted' : 'whisper';
  root.style.setProperty('--tts-intensity', ttsMuted ? 0 : ttsIntensity);
}
