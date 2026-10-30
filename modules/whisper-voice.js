// Whisper voices for the taunt lines, free to run. The expressive cloud voice
// is Puter.js calling OpenAI's gpt-4o-mini-tts with a mood prompt; each
// listener's own free Puter account pays for it, so the site ships no API key.
// Anyone who hasn't connected Puter hears the browser's built-in voice.

const PUTER_SRC = 'https://js.puter.com/v2/';
const STORAGE_KEY = 'te.voice';
const CLOUD_MODEL = 'gpt-4o-mini-tts';
const CLOUD_VOICES = ['shimmer', 'nova', 'sage', 'coral'];
const CACHE_LIMIT = 30;
const SAMPLE_LINE = 'Caught you narrowing it down again, hm?';

const DELIVERY =
  "Whisper softly and close, breathy and intimate, as if leaning in to the listener's ear. " +
  'Never raise your voice. Slow pacing with small pauses.';

const MOODS = {
  tag_add: 'Teasing and amused, like catching someone at something they should be embarrassed about.',
  stack_overflow: 'Mocking and knowing, with a quiet laugh under the words.',
  tag_clear: 'Softly accusing, as if you saw everything they tried to hide.',
  artist_open: 'Pleased and possessive, a satisfied purr.',
  idle: 'Bored and drawn out, a lazy, patient tease.',
  back: 'Smug and certain, a light taunt.',
  dossier_open: 'Cool and clinical, amused while reading their secrets back to them.',
  dossier_revisit: 'Cool and clinical, amused while reading their secrets back to them.',
  'prompter-degrading': 'Seductive and slow, a degrading tease.',
};
const MOOD_PREFIXES = [
  ['ritual_', 'Low and ceremonial, quietly approving.'],
  ['streak_', 'Proud of them in a condescending way.'],
  ['mission_', 'Approving and possessive.'],
  ['command_', 'Quietly commanding.'],
];
const DEFAULT_MOOD = 'Playful and teasing.';

const LANE_TONES = {
  1: 'Keep it gentle and hushed, more amused than cruel.',
  2: 'Confident and teasing.',
  3: 'Colder and sharper, openly contemptuous, every word deliberate.',
};

// Device voices can't whisper; quieter and slower is the closest they get.
const DEVICE_PROSODY = {
  1: { rate: 0.86, pitch: 1.05, volume: 0.55 },
  2: { rate: 0.9, pitch: 1, volume: 0.7 },
  3: { rate: 0.94, pitch: 0.92, volume: 0.85 },
};
const PREFERRED_DEVICE_VOICES = [/aria/i, /jenny/i, /samantha/i, /ava/i, /allison/i, /zira/i, /female/i, /google us english/i];

let settings = loadSettings();
let puterPromise = null;
// Set after a cloud failure (usage limit, network) so the session stops
// retrying it; reconnecting in Settings clears it.
let cloudPaused = false;
let lastCloudVoice = null;
let audioEl = null;
let stopCurrent = null;
let currentUtterance = null;
let warnedSignedOut = false;
let playToken = 0;
const cloudCache = new Map();
let controls = null;

function loadSettings() {
  const defaults = { engine: 'device', cloudVoice: 'rotate', deviceVoice: '' };
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return stored && typeof stored === 'object' ? { ...defaults, ...stored } : defaults;
  } catch {
    return defaults;
  }
}

function saveSettings(patch) {
  settings = { ...settings, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // private mode: settings last for this page only
  }
}

function loadPuter() {
  if (window.puter?.ai) return Promise.resolve(window.puter);
  if (!puterPromise) {
    puterPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = PUTER_SRC;
      script.async = true;
      script.onload = () => (window.puter?.ai ? resolve(window.puter) : reject(new Error('Puter.js loaded without puter.ai')));
      script.onerror = () => reject(new Error('Could not load Puter.js'));
      document.head.appendChild(script);
    }).catch((error) => {
      puterPromise = null;
      throw error;
    });
  }
  return puterPromise;
}

function isCloudConnected() {
  return Boolean(window.puter?.auth?.isSignedIn?.());
}

function moodFor(event) {
  const key = String(event || '').toLowerCase();
  if (MOODS[key]) return MOODS[key];
  const prefixed = MOOD_PREFIXES.find(([prefix]) => key.startsWith(prefix));
  return prefixed ? prefixed[1] : DEFAULT_MOOD;
}

function clampLane(lane) {
  const value = Math.round(Number(lane));
  return Number.isFinite(value) ? Math.min(3, Math.max(1, value)) : 2;
}

function pickCloudVoice() {
  if (CLOUD_VOICES.includes(settings.cloudVoice)) return settings.cloudVoice;
  const choices = CLOUD_VOICES.filter((voice) => voice !== lastCloudVoice);
  lastCloudVoice = choices[Math.floor(Math.random() * choices.length)];
  return lastCloudVoice;
}

class SignedOutError extends Error {
  constructor() {
    super('Puter is not connected');
  }
}

async function synthesizeCloud(text, event, lane) {
  const mood = moodFor(event);
  const cacheKey = `${lane}|${mood}|${text}`;
  const hit = cloudCache.get(cacheKey);
  // Repeated lines replay from memory so they don't spend the listener's credits.
  if (hit && (settings.cloudVoice === 'rotate' || hit.voice === settings.cloudVoice)) {
    cloudCache.delete(cacheKey);
    cloudCache.set(cacheKey, hit);
    return hit.src;
  }
  const puter = await loadPuter();
  // Never let a taunt open Puter's sign-in popup; that only happens from Settings.
  if (!puter.auth.isSignedIn()) throw new SignedOutError();
  const voice = pickCloudVoice();
  const audio = await puter.ai.txt2speech(text, {
    provider: 'openai',
    model: CLOUD_MODEL,
    voice,
    instructions: `${DELIVERY} Mood: ${mood} ${LANE_TONES[lane]}`,
  });
  const src = audio?.src;
  if (!src) throw new Error('Puter returned no audio');
  cloudCache.set(cacheKey, { voice, src });
  if (cloudCache.size > CACHE_LIMIT) cloudCache.delete(cloudCache.keys().next().value);
  return src;
}

function ensureAudioElement() {
  if (audioEl && document.body.contains(audioEl)) return audioEl;
  audioEl = document.getElementById('whisper-audio-element');
  if (!audioEl) {
    audioEl = document.createElement('audio');
    audioEl.id = 'whisper-audio-element';
    audioEl.className = 'whisper-audio-element hidden';
    audioEl.setAttribute('aria-hidden', 'true');
    audioEl.preload = 'auto';
    document.body.appendChild(audioEl);
  }
  return audioEl;
}

function playCloudAudio(src, onStart) {
  const audio = ensureAudioElement();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (reason) => {
      if (settled) return;
      settled = true;
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('pause', onPause);
      if (stopCurrent === stop) stopCurrent = null;
      resolve(reason);
    };
    const onEnded = () => finish('ended');
    const onError = () => finish('error');
    const onPause = () => {
      if (!audio.ended) finish('interrupted');
    };
    const stop = () => {
      audio.pause();
      finish('interrupted');
    };
    stopCurrent = stop;
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.src = src;
    audio.currentTime = 0;
    audio.play().then(
      () => {
        if (settled) return;
        audio.addEventListener('pause', onPause);
        onStart?.('cloud');
      },
      // Autoplay blocked: nothing has been clicked on this page yet.
      () => finish('blocked'),
    );
  });
}

function getDeviceVoices() {
  const synth = window.speechSynthesis;
  return synth ? synth.getVoices() : [];
}

function pickDeviceVoice() {
  const voices = getDeviceVoices();
  if (settings.deviceVoice) {
    const chosen = voices.find((voice) => voice.voiceURI === settings.deviceVoice);
    if (chosen) return chosen;
  }
  const english = voices.filter((voice) => /^en([-_]|$)/i.test(voice.lang));
  for (const pattern of PREFERRED_DEVICE_VOICES) {
    const match = english.find((voice) => pattern.test(voice.name));
    if (match) return match;
  }
  return english[0] || null;
}

function speakOnDevice(text, lane, onStart) {
  const synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance !== 'function') return Promise.resolve('unsupported');
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    Object.assign(utterance, DEVICE_PROSODY[lane]);
    const voice = pickDeviceVoice();
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || 'en-US';
    let settled = false;
    let watchdog = null;
    const stop = () => {
      synth.cancel();
      finish('interrupted');
    };
    const finish = (reason) => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      if (stopCurrent === stop) stopCurrent = null;
      if (currentUtterance === utterance) currentUtterance = null;
      resolve(reason);
    };
    utterance.onstart = () => onStart?.('device');
    utterance.onend = () => finish('ended');
    utterance.onerror = (event) =>
      finish(event.error === 'interrupted' || event.error === 'canceled' ? 'interrupted' : 'error');
    stopCurrent = stop;
    // Chrome drops utterances it garbage-collects mid-sentence; keep a reference.
    currentUtterance = utterance;
    if (synth.speaking || synth.pending) synth.cancel();
    synth.speak(utterance);
    // Some engines never fire onend; don't leave the caller waiting forever.
    watchdog = setTimeout(() => finish('ended'), 4000 + text.length * 150);
  });
}

export function stopWhisper() {
  playToken++;
  stopCurrent?.();
}

// Speaks one line. Resolves with how playback ended: 'ended', 'interrupted',
// 'blocked' (autoplay), 'error' or 'unsupported'. onStart(engine) fires once
// sound actually starts.
export async function speakWhisper(text, { event, lane, onStart } = {}) {
  const line = String(text || '').trim();
  if (!line) return 'ended';
  stopWhisper();
  const token = playToken;
  const level = clampLane(lane);
  if (settings.engine === 'cloud' && !cloudPaused) {
    try {
      const src = await synthesizeCloud(line, event, level);
      if (token !== playToken) return 'interrupted';
      return await playCloudAudio(src, onStart);
    } catch (error) {
      if (token !== playToken) return 'interrupted';
      if (!(error instanceof SignedOutError)) {
        console.warn('[whisper-voice] Cloud voice failed, using the device voice:', error?.message || error);
        cloudPaused = true;
      } else if (!warnedSignedOut) {
        console.info('[whisper-voice] Puter is not connected; using the device voice.');
        warnedSignedOut = true;
      }
    }
  }
  return speakOnDevice(line, level, onStart);
}

// Called once per page. Warms up whichever engine the visitor picked without
// blocking the page: Puter loads in the background, device voices list lazily.
export function initWhisperVoice() {
  if (settings.engine === 'cloud') {
    loadPuter().catch((error) => console.warn('[whisper-voice]', error.message));
  }
  getDeviceVoices();
}

// --- Voice controls (rendered inside the Settings panel) --------------------

export function mountVoiceControls(container) {
  controls = container;
  container.innerHTML = `
    <fieldset class="voice-engines">
      <legend class="settings__label">Voice</legend>
      <label class="voice-option">
        <input type="radio" name="voice-engine" value="cloud">
        <span>
          <strong>Expressive cloud whisper</strong>
          <small>Free with a Puter account (sign in once). Real whispering, with the mood changing per taunt.</small>
        </span>
      </label>
      <label class="voice-option">
        <input type="radio" name="voice-engine" value="device">
        <span>
          <strong>Device voice</strong>
          <small>Your browser's built-in voice. No sign-in, but it can't whisper or emote.</small>
        </span>
      </label>
    </fieldset>
    <div class="voice-group" data-group="cloud">
      <p class="voice-status" aria-live="polite"></p>
      <div class="voice-row">
        <button type="button" class="settings-btn settings-btn--primary" data-act="connect">Connect Puter</button>
        <button type="button" class="settings-btn" data-act="disconnect">Disconnect</button>
      </div>
      <label class="settings-field">Cloud voice
        <select data-field="cloudVoice">
          <option value="rotate">Rotate voices</option>
          ${CLOUD_VOICES.map((voice) => `<option value="${voice}">${voice[0].toUpperCase()}${voice.slice(1)}</option>`).join('')}
        </select>
      </label>
    </div>
    <div class="voice-group" data-group="device">
      <label class="settings-field">Device voice
        <select data-field="deviceVoice"></select>
      </label>
    </div>
    <div class="voice-row">
      <button type="button" class="settings-btn" data-act="preview">Play a sample</button>
    </div>
  `;

  container.addEventListener('click', (event) => {
    const action = event.target.closest('[data-act]')?.dataset.act;
    if (action === 'connect') connectCloud();
    else if (action === 'disconnect') disconnectCloud();
    else if (action === 'preview') speakWhisper(SAMPLE_LINE, { event: 'tag_add', lane: 2 });
  });
  container.addEventListener('change', (event) => {
    const target = event.target;
    if (target.name === 'voice-engine') {
      saveSettings({ engine: target.value });
      if (target.value === 'cloud') {
        cloudPaused = false;
        warmPuter();
      }
      renderVoiceControls();
    } else if (target.dataset.field) {
      saveSettings({ [target.dataset.field]: target.value });
    }
  });
  window.speechSynthesis?.addEventListener?.('voiceschanged', () => renderVoiceControls());
  if (settings.engine === 'cloud') warmPuter();
  renderVoiceControls();
}

// Loaded ahead of the Connect click so its sign-in popup opens from that click.
function warmPuter() {
  loadPuter().then(renderVoiceControls, () => renderVoiceControls());
}

async function connectCloud() {
  const status = controls.querySelector('.voice-status');
  status.textContent = 'Opening Puter sign-in…';
  try {
    const puter = await loadPuter();
    if (!puter.auth.isSignedIn()) {
      await puter.auth.signIn({ attempt_temp_user_creation: true });
    }
    cloudPaused = false;
    saveSettings({ engine: 'cloud' });
  } catch (error) {
    status.textContent = error?.error === 'popup_blocked'
      ? 'Your browser blocked the sign-in popup. Allow popups for this site and try again.'
      : 'Sign-in didn’t finish. You can try again any time.';
    return;
  }
  await renderVoiceControls();
  controls.querySelector('[data-act="disconnect"]')?.focus();
}

async function disconnectCloud() {
  try {
    window.puter?.auth?.signOut();
  } catch {
    // already signed out
  }
  cloudCache.clear();
  saveSettings({ engine: 'device' });
  await renderVoiceControls();
  controls.querySelector('input[name="voice-engine"]:checked')?.focus();
}

export async function renderVoiceControls() {
  if (!controls || !controls.isConnected) return;
  const cloud = settings.engine === 'cloud';
  controls.querySelectorAll('input[name="voice-engine"]').forEach((input) => {
    input.checked = input.value === settings.engine;
  });
  controls.querySelector('[data-group="cloud"]').hidden = !cloud;
  controls.querySelector('[data-group="device"]').hidden = cloud;
  controls.querySelector('[data-field="cloudVoice"]').value = settings.cloudVoice;

  const deviceSelect = controls.querySelector('[data-field="deviceVoice"]');
  const voices = getDeviceVoices();
  const automatic = document.createElement('option');
  automatic.value = '';
  automatic.textContent = window.speechSynthesis ? 'Automatic' : 'Not supported in this browser';
  deviceSelect.replaceChildren(
    automatic,
    ...voices.map((voice) => {
      const option = document.createElement('option');
      option.value = voice.voiceURI;
      option.textContent = `${voice.name} (${voice.lang})`;
      return option;
    }),
  );
  deviceSelect.value = voices.some((voice) => voice.voiceURI === settings.deviceVoice) ? settings.deviceVoice : '';

  const connected = isCloudConnected();
  controls.querySelector('[data-act="connect"]').hidden = connected;
  controls.querySelector('[data-act="disconnect"]').hidden = !connected;
  const status = controls.querySelector('.voice-status');
  if (!window.puter) {
    status.textContent = puterPromise ? 'Loading Puter…' : 'Puter couldn’t load. Check your connection or ad blocker.';
  } else if (!connected) {
    status.textContent = 'Not connected yet. Taunts use the device voice until you connect.';
  } else {
    status.textContent = cloudPaused ? 'Connected, but the last request failed, so taunts use the device voice.' : 'Connected.';
    try {
      const user = await window.puter.auth.getUser();
      if (user?.username && isCloudConnected()) {
        status.textContent = cloudPaused
          ? `Connected as ${user.username}, but the last request failed, so taunts use the device voice.`
          : `Connected as ${user.username}.`;
      }
    } catch {
      // keep the generic status
    }
  }
}
