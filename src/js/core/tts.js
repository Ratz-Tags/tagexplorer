import { createEmitter } from './utils.js';

const EVENT_PRIORITY = {
  artist_open: 3,
  too_many_tags: 2,
  clear: 2,
  back: 2,
  tag_add: 1,
  idle: 0
};

const MINIMAL_EVENTS = new Set(['artist_open', 'too_many_tags', 'clear']);
const COOLDOWN_MS = {
  0: Infinity,
  1: 24000,
  2: 12000,
  3: 5000
};

const CAPTION_TIMEOUT = 5500;

let singleton = null;

function escapeSsml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function pickRandom(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return '';
  }
  const index = Math.floor(Math.random() * list.length);
  return list[index];
}

class WhisperController {
  constructor(dataset, preferences) {
    this.dataset = dataset ?? {};
    this.preferences = preferences ?? {};
    this.voices = [];
    this.voiceIndex = 0;
    this.token = null;
    this.tokenExpiry = 0;
    this.status = 'idle';
    this.ready = false;
    this.disabled = false;
    this.disabledReason = '';
    this.emitter = createEmitter();
    this.audio = null;
    this.captionEl = null;
    this.captionTimer = null;
    this.nextAllowedTime = 0;
    this.lastLine = '';
    this.lastEvent = null;
    this.initializing = false;
    this.region = typeof window !== 'undefined' ? window._azureTTSRegion : undefined;
    this.key = typeof window !== 'undefined' ? window._azureTTSKey : undefined;
    this.userAgent = 'TagExplorer/Stage3 (+https://github.com/)';
    this.cadenceMultiplier = 1;
    this.cadenceTimer = null;
    this.updateStatus();
  }

  updateStatus() {
    const payload = {
      status: this.disabled ? 'disabled' : this.ready ? 'ready' : this.status,
      reason: this.disabledReason
    };
    this.emitter.emit(payload);
  }

  setDataset(dataset) {
    this.dataset = dataset ?? {};
  }

  updatePreferences(preferences) {
    this.preferences = preferences ?? {};
  }

  async init() {
    if (this.disabled || this.ready || this.initializing) {
      return this.ready;
    }

    if (typeof window === 'undefined' || typeof fetch === 'undefined') {
      this.disable('no-window');
      return false;
    }

    if (!this.key || !this.region) {
      this.disable('missing-credentials');
      return false;
    }

    this.initializing = true;
    this.status = 'initializing';
    this.updateStatus();

    try {
      await this.refreshToken();
      await this.loadVoices();
      if (this.voices.length === 0) {
        this.disable('no-whisper-voices');
        return false;
      }
      this.ready = true;
      this.status = 'ready';
      this.updateStatus();
      return true;
    } catch (error) {
      console.warn('azure init failed', error);
      this.disable('network-error');
      return false;
    } finally {
      this.initializing = false;
    }
  }

  disable(reason) {
    this.disabled = true;
    this.disabledReason = reason;
    this.status = 'disabled';
    this.updateStatus();
  }

  async refreshToken(force = false) {
    const now = Date.now();
    if (!force && this.token && now < this.tokenExpiry - 60000) {
      return this.token;
    }

    const response = await fetch(`https://${this.region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.key,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': this.userAgent
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh Azure token: ${response.status}`);
    }

    const token = await response.text();
    this.token = token;
    this.tokenExpiry = now + 9 * 60 * 1000;
    return token;
  }

  async loadVoices() {
    const response = await fetch(`https://${this.region}.tts.speech.microsoft.com/cognitiveservices/voices/list`, {
      headers: {
        'Ocp-Apim-Subscription-Key': this.key,
        'User-Agent': this.userAgent
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to list voices: ${response.status}`);
    }

    const voices = await response.json();
    this.voices = (voices || []).filter((voice) => {
      if (!voice) return false;
      const styles = voice.StyleList ?? voice.styleList ?? [];
      return Array.isArray(styles) && styles.map((value) => value.toLowerCase()).includes('whispering');
    });
  }

  async speak(event, options = {}) {
    if (this.disabled) {
      return;
    }

    if (!(await this.init())) {
      return;
    }

    if (!this.shouldSpeak(event)) {
      return;
    }

    const line = options.line ?? this.pickLine(event);
    if (!line) {
      return;
    }

    this.lastLine = line;
    this.lastEvent = event;

    try {
      await this.play(line);
      this.showCaption(line);
    } catch (error) {
      console.warn('failed to play whisper', error);
      this.disable('playback-error');
    }
  }

  shouldSpeak(event) {
    const prefs = this.preferences ?? {};
    const ttsPrefs = prefs.tts ?? {};
    const flags = prefs.featureFlags ?? {};
    if (ttsPrefs.muted || ttsPrefs.intensity === 0 || flags.whisper === false) {
      return false;
    }

    const intensity = Number(ttsPrefs.intensity ?? 2);
    const priority = EVENT_PRIORITY[event] ?? 1;

    if (intensity === 1 && !MINIMAL_EVENTS.has(event)) {
      return false;
    }

    const now = Date.now();
    const baseCooldown = COOLDOWN_MS[intensity] ?? 12000;
    const cooldown = Math.max(1500, baseCooldown * this.cadenceMultiplier);

    if (now < this.nextAllowedTime && priority < 2) {
      return false;
    }

    this.nextAllowedTime = now + cooldown;
    return true;
  }

  pickLine(event) {
    const catalogue = this.dataset?.tts ?? {};
    const lines = catalogue[event];
    if (Array.isArray(lines) && lines.length) {
      const pool = lines.filter((line) => line !== this.lastLine);
      return (pool.length ? pickRandom(pool) : pickRandom(lines)) ?? '';
    }

    const fallback = catalogue.idle ?? [];
    return pickRandom(fallback);
  }

  async play(text) {
    const voice = this.rotateVoice();
    const intensity = Number(this.preferences?.tts?.intensity ?? 2);
    const rate = intensity >= 3 ? '-15%' : intensity <= 1 ? '-5%' : '-10%';
    const volume = intensity >= 3 ? '-15%' : '-25%';
    const token = await this.refreshToken();

    const ssml = `<?xml version="1.0" encoding="utf-8"?>\n<speak version="1.0" xml:lang="en-US">\n  <voice name="${voice.ShortName}">\n    <mstts:express-as style="whispering" xmlns:mstts="http://www.w3.org/2001/mstts">\n      <prosody rate="${rate}" volume="${volume}">${escapeSsml(text)}</prosody>\n    </mstts:express-as>\n  </voice>\n</speak>`;

    const response = await fetch(`https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': this.userAgent
      },
      body: ssml
    });

    if (!response.ok) {
      throw new Error(`Synthesis failed: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const blob = new Blob([buffer], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);

    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = 'auto';
    }

    try {
      this.audio.pause();
    } catch (error) {
      // ignore
    }

    this.audio.src = url;
    this.audio.volume = 0.85;
    await this.audio.play();
  }

  rotateVoice() {
    if (!this.voices.length) {
      throw new Error('No voices available');
    }
    const voice = this.voices[this.voiceIndex % this.voices.length];
    this.voiceIndex = (this.voiceIndex + 1) % this.voices.length;
    return voice;
  }

  ensureCaption() {
    if (this.captionEl || typeof document === 'undefined') {
      return;
    }

    const caption = document.createElement('div');
    caption.className = 'whisper-caption';
    caption.setAttribute('role', 'status');
    caption.setAttribute('aria-live', 'polite');
    document.body.appendChild(caption);
    this.captionEl = caption;
  }

  showCaption(text) {
    if (typeof document === 'undefined') {
      return;
    }

    this.ensureCaption();
    if (!this.captionEl) {
      return;
    }

    this.captionEl.textContent = text;
    this.captionEl.dataset.visible = 'true';

    if (this.captionTimer) {
      window.clearTimeout(this.captionTimer);
    }

    this.captionTimer = window.setTimeout(() => {
      if (this.captionEl) {
        delete this.captionEl.dataset.visible;
      }
    }, CAPTION_TIMEOUT);
  }

  subscribe(listener) {
    return this.emitter.subscribe(listener);
  }

  accelerateCadence(factor = 0.65, duration = 9000) {
    if (this.disabled) {
      return;
    }

    const boundedFactor = Math.min(Math.max(factor, 0.3), 1);
    this.cadenceMultiplier = Math.min(this.cadenceMultiplier, boundedFactor);

    if (typeof window !== 'undefined') {
      if (this.cadenceTimer) {
        window.clearTimeout(this.cadenceTimer);
      }
      this.cadenceTimer = window.setTimeout(() => {
        this.cadenceMultiplier = 1;
        this.cadenceTimer = null;
      }, duration);
    }

    const intensity = Number(this.preferences?.tts?.intensity ?? 0);
    const baseCooldown = COOLDOWN_MS[intensity] ?? 12000;
    const cooldown = Math.max(1500, baseCooldown * this.cadenceMultiplier);
    const candidate = Date.now() + cooldown;
    if (!this.nextAllowedTime) {
      this.nextAllowedTime = candidate;
      return;
    }
    this.nextAllowedTime = Math.min(this.nextAllowedTime, candidate);
  }
}

export function createWhisperController({ dataset, preferences } = {}) {
  if (singleton) {
    singleton.setDataset(dataset);
    singleton.updatePreferences(preferences);
    return singleton;
  }

  singleton = new WhisperController(dataset, preferences);
  return singleton;
}

export function getWhisperController() {
  return singleton;
}
