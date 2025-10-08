const STORAGE_KEY = "azureTTSConfig";
const DEFAULT_VOICE = "en-US-AvaMultilingualNeural";
const WHISPER_STYLE_CANONICAL = "whispering";
const SAMPLE_PREVIEW_LINE = "Caught you tweaking my whispers again, pet.";

const INTENSITY_PROFILES = {
  1: { rate: "-15%", volume: "-32%", pitch: "-6%" },
  2: { rate: "-10%", volume: "-24%", pitch: "-2%" },
  3: { rate: "-6%", volume: "-16%", pitch: "+1%" },
};

const FALLBACK_INTENSITY = 2;

let azureConfig = {
  voice: DEFAULT_VOICE,
  style: WHISPER_STYLE_CANONICAL,
};

let voiceListPromise = null;
let latestObjectUrl = null;
let whisperVoicePool = [];
let whisperVoiceCursor = 0;
let voiceSelectorOverlay = null;
let voiceSelectorList = null;
let styleSelectEl = null;
let previewBtn = null;
let statusEl = null;
let closeBtn = null;
let escKeyHandler = null;
let ensureDefaultVoicePromise = null;

function safeLocalStorage(action) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    action(window.localStorage);
  } catch (error) {
    // Ignore storage errors (private mode, etc.)
  }
}

function persistConfig() {
  safeLocalStorage((storage) => {
    storage.setItem(STORAGE_KEY, JSON.stringify(azureConfig));
  });
}

function loadStoredConfig() {
  safeLocalStorage((storage) => {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        azureConfig = normalizeVoiceConfig(parsed);
      }
    } catch (error) {
      // Ignore malformed JSON and reset storage
    }
  });
  applyConfigToWindow();
}

function applyConfigToWindow() {
  if (typeof window === "undefined") return;
  window._azureTTSVoice = azureConfig.voice;
  window._azureTTSStyle = azureConfig.style;
}

function clampIntensity(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return FALLBACK_INTENSITY;
  if (numeric <= 0) return 0;
  if (numeric >= 3) return 3;
  return Math.max(1, Math.floor(numeric));
}

function getIntensityProfile(intensity) {
  const lane = clampIntensity(intensity) || FALLBACK_INTENSITY;
  return INTENSITY_PROFILES[lane] || INTENSITY_PROFILES[FALLBACK_INTENSITY];
}

function normalizeVoicePoolEntry(voice) {
  if (!voice || typeof voice !== "object") return null;
  const styles = filterWhisperStyles(voice.StyleList);
  if (!styles.length) return null;
  return {
    voice: voice.ShortName || voice.VoiceId || DEFAULT_VOICE,
    styles,
  };
}

function registerWhisperVoicePool(voices = []) {
  const normalized = Array.isArray(voices)
    ? voices
        .map(normalizeVoicePoolEntry)
        .filter(Boolean)
    : [];
  if (!normalized.length) return;
  whisperVoicePool = normalized;
  whisperVoiceCursor = 0;
}

function pickStyleForIntensity(styles = [], intensity = FALLBACK_INTENSITY) {
  if (!Array.isArray(styles) || styles.length === 0) {
    return azureConfig.style || WHISPER_STYLE_CANONICAL;
  }
  const canonical = styles.find(
    (style) => canonicalizeStyle(style) === WHISPER_STYLE_CANONICAL
  );
  if (canonical) return canonical;
  const containsWhisper = styles.find((style) =>
    String(style).toLowerCase().includes("whisper")
  );
  if (containsWhisper) return containsWhisper;
  const index = clampIntensity(intensity) % styles.length;
  return styles[index];
}

function getNextWhisperConfig(intensity = FALLBACK_INTENSITY) {
  if (!whisperVoicePool.length) {
    return {
      voice: azureConfig.voice || DEFAULT_VOICE,
      style: azureConfig.style || WHISPER_STYLE_CANONICAL,
    };
  }
  const entry = whisperVoicePool[whisperVoiceCursor % whisperVoicePool.length];
  whisperVoiceCursor = (whisperVoiceCursor + 1) % whisperVoicePool.length;
  return {
    voice: entry.voice,
    style: pickStyleForIntensity(entry.styles, intensity),
  };
}

function emitConfigChange() {
  if (typeof window === "undefined") return;
  const detail = { ...azureConfig };
  document.dispatchEvent(
    new CustomEvent("azureTTS:config", { detail })
  );
}

function canonicalizeStyle(style) {
  if (!style) return undefined;
  return String(style).trim();
}

function normalizeVoiceConfig(partial = {}) {
  const merged = {
    voice: DEFAULT_VOICE,
    style: WHISPER_STYLE_CANONICAL,
    ...azureConfig,
    ...partial,
  };
  const rawStyle = canonicalizeStyle(merged.style);
  const normalizedStyle = rawStyle
    ? rawStyle.toLowerCase() === WHISPER_STYLE_CANONICAL
      ? WHISPER_STYLE_CANONICAL
      : rawStyle
    : WHISPER_STYLE_CANONICAL;
  return {
    voice: merged.voice || DEFAULT_VOICE,
    style: normalizedStyle,
  };
}

function setAzureTTSConfig(partial = {}) {
  azureConfig = normalizeVoiceConfig(partial);
  persistConfig();
  applyConfigToWindow();
  emitConfigChange();
}

function getAzureTTSConfig() {
  return { ...azureConfig };
}

async function ensureCredentials() {
  if (typeof window === "undefined") {
    throw new Error("Azure TTS requires browser environment");
  }
  
  // Try to get credentials from window first (if already loaded)
  let key = window._azureTTSKey;
  let region = window._azureTTSRegion;
  
  // If not available, try to load from azure-tts.local.js
  if (!key || !region) {
    try {
      const module = await import('../azure-tts.local.js');
      key = key || window._azureTTSKey;
      region = region || window._azureTTSRegion;
    } catch (error) {
      console.warn("Could not load azure-tts.local.js:", error);
    }
  }
  
  if (!key || !region) {
    throw new Error("Azure TTS credentials are missing. Ensure azure-tts.local.js sets window._azureTTSKey and window._azureTTSRegion.");
  }
  return { key, region };
}

function voiceEndpoint(region) {
  return `https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`;
}

function synthesisEndpoint(region) {
  return `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
}

async function fetchAzureVoices(key, region, { forceRefresh = false } = {}) {
  if (!key || !region) {
    throw new Error("Azure TTS credentials are required to fetch voices");
  }
  if (!forceRefresh && voiceListPromise) return voiceListPromise;

  voiceListPromise = fetch(voiceEndpoint(region), {
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "User-Agent": "TagExplorer-TTS/1.0",
      Accept: "application/json",
    },
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch Azure voices: ${response.status}`);
    }
    return response.json();
  });

  const voices = await voiceListPromise;
  return Array.isArray(voices) ? voices : [];
}

function buildSSML(text, config, { intensity, event } = {}) {
  const { voice, style } = normalizeVoiceConfig(config);
  const profile = getIntensityProfile(intensity ?? FALLBACK_INTENSITY);
  const safeText = text.replace(/[<>]/g, "");
  const prosodyOpen = `<prosody rate="${profile.rate}" volume="${profile.volume}" pitch="${profile.pitch}">`;
  const prosodyClose = `</prosody>`;
  const eventAttr = event ? ` mstts:styledegree="1.0"` : "";
  const inner = `${prosodyOpen}${safeText}${prosodyClose}`;
  const content = style
    ? `<mstts:express-as style="${style}"${eventAttr}>${inner}</mstts:express-as>`
    : inner;
  return `<?xml version="1.0" encoding="utf-8"?>
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US" xmlns:mstts="https://www.w3.org/2001/mstts">
  <voice name="${voice}">
    ${content}
  </voice>
</speak>`;
}

async function azureSpeak(text, overrides = {}, meta = {}) {
  if (!text) return null;
  const { key, region } = await ensureCredentials();
  const {
    ssml: ssmlOverride,
    intensity: overrideIntensity,
    ...voiceOverrides
  } = overrides || {};
  const hasOverrides = Object.keys(voiceOverrides).length > 0;
  const config = hasOverrides
    ? normalizeVoiceConfig(voiceOverrides)
    : { ...azureConfig };
  const resolvedIntensity =
    clampIntensity(
      overrideIntensity ?? meta.intensity ?? FALLBACK_INTENSITY
    ) || FALLBACK_INTENSITY;
  const ssml = ssmlOverride || buildSSML(text, config, {
    intensity: resolvedIntensity,
    event: meta.event,
  });

  const response = await fetch(synthesisEndpoint(region), {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3",
      "User-Agent": "TagExplorer-TTS/1.0",
      Accept: "audio/mpeg, audio/wav, audio/*;q=0.8",
    },
    body: ssml,
  });

  if (!response.ok) {
    throw new Error(`Azure TTS request failed: ${response.status}`);
  }

  const blob = await response.blob();
  if (latestObjectUrl) {
    URL.revokeObjectURL(latestObjectUrl);
  }
  latestObjectUrl = URL.createObjectURL(blob);
  return latestObjectUrl;
}

function composeWhisperSSML(text, { intensity, event, voice, style, rotate = false } = {}) {
  const lane = clampIntensity(intensity ?? FALLBACK_INTENSITY) || FALLBACK_INTENSITY;
  let config;
  if (rotate) {
    config = getNextWhisperConfig(lane);
  } else if (voice || style) {
    config = normalizeVoiceConfig({ voice, style });
  } else {
    config = { ...azureConfig };
  }
  const ssml = buildSSML(text, config, { intensity: lane, event });
  return { ssml, voice: config.voice, style: config.style, intensity: lane };
}

function highlightSelectedVoice(shortName) {
  if (!voiceSelectorList) return;
  const buttons = voiceSelectorList.querySelectorAll("[data-voice]");
  buttons.forEach((btn) => {
    if (btn.dataset.voice === shortName) {
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
    } else {
      btn.classList.remove("active");
      btn.setAttribute("aria-pressed", "false");
    }
  });
}

function formatVoiceLabel(voice) {
  const friendly = voice.FriendlyName || voice.DisplayName || voice.LocalName;
  const gender = voice.Gender ? voice.Gender.toLowerCase() : "";
  const locale = voice.LocaleName || voice.Locale;
  const parts = [friendly || voice.ShortName];
  if (locale) parts.push(locale);
  if (gender) parts.push(gender);
  return parts.join(" · ");
}

function toReadableStyle(style) {
  if (!style) return "";
  const cleaned = style
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  return cleaned
    .split(" ")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function filterWhisperStyles(styleList = []) {
  return styleList.filter((style) =>
    typeof style === "string" && style.toLowerCase().includes("whisper")
  );
}

function updateStatusLine(message) {
  if (!statusEl) return;
  if (message) {
    statusEl.textContent = message;
    return;
  }
  const { voice, style } = azureConfig;
  const fallbackLabel = toReadableStyle(WHISPER_STYLE_CANONICAL) || "Whispering";
  const readableStyle = toReadableStyle(style) || fallbackLabel;
  statusEl.textContent = `Voice: ${voice} · Style: ${readableStyle}`;
}

function updateStyleOptions(forVoice) {
  if (!styleSelectEl) return;
  const styles = filterWhisperStyles(forVoice?.StyleList);
  styleSelectEl.innerHTML = "";

  if (styles.length === 0) {
    const option = document.createElement("option");
    option.value = WHISPER_STYLE_CANONICAL;
    option.textContent = toReadableStyle(WHISPER_STYLE_CANONICAL);
    styleSelectEl.appendChild(option);
    styleSelectEl.disabled = true;
    setAzureTTSConfig({ style: WHISPER_STYLE_CANONICAL });
    return;
  }

  styles.forEach((style) => {
    const option = document.createElement("option");
    option.value = style;
    option.textContent = toReadableStyle(style);
    styleSelectEl.appendChild(option);
  });

  const currentStyle = canonicalizeStyle(azureConfig.style);
  const matchingStyle = styles.find(
    (style) =>
      canonicalizeStyle(style).toLowerCase() === currentStyle?.toLowerCase()
  );
  const effectiveStyle = matchingStyle || styles[0];
  if (effectiveStyle) {
    styleSelectEl.value = effectiveStyle;
    setAzureTTSConfig({ style: effectiveStyle });
  } else {
    styleSelectEl.value = WHISPER_STYLE_CANONICAL;
    setAzureTTSConfig({ style: WHISPER_STYLE_CANONICAL });
  }
  styleSelectEl.disabled = styles.length === 1;
  updateStatusLine();
}

function attachStyleListener() {
  if (!styleSelectEl) return;
  styleSelectEl.addEventListener("change", (event) => {
    const value = canonicalizeStyle(event.target.value);
    if (!value) return;
    setAzureTTSConfig({ style: value });
    updateStatusLine();
  });
}

async function handlePreviewClick() {
  if (!previewBtn) return;
  previewBtn.disabled = true;
  const original = previewBtn.textContent;
  previewBtn.textContent = "Previewing…";
  try {
    const url = await azureSpeak(SAMPLE_PREVIEW_LINE);
    if (url) {
      const audio = new Audio(url);
      audio.play().catch(() => {});
    }
  } catch (error) {
    console.error("Azure TTS preview failed", error);
  } finally {
    previewBtn.disabled = false;
    previewBtn.textContent = original;
  }
}

function closeVoiceSelector() {
  if (!voiceSelectorOverlay) return;
  voiceSelectorOverlay.classList.add("hidden");
  voiceSelectorOverlay.setAttribute("aria-hidden", "true");
  if (typeof window !== "undefined") {
    document.body.classList.remove("voice-selector-open");
  }
  if (typeof document !== "undefined") {
    document.dispatchEvent(
      new CustomEvent("azureTTS:selector", { detail: { open: false } })
    );
  }
  if (escKeyHandler) {
    document.removeEventListener("keydown", escKeyHandler);
    escKeyHandler = null;
  }
}

function ensureVoiceSelectorElements() {
  if (voiceSelectorOverlay) return;
  if (typeof document === "undefined") return;

  voiceSelectorOverlay = document.createElement("div");
  voiceSelectorOverlay.id = "azure-voice-selector";
  voiceSelectorOverlay.className = "voice-selector-overlay hidden";
  voiceSelectorOverlay.setAttribute("role", "dialog");
  voiceSelectorOverlay.setAttribute("aria-modal", "true");
  voiceSelectorOverlay.setAttribute("aria-hidden", "true");
  voiceSelectorOverlay.tabIndex = -1;

  voiceSelectorOverlay.innerHTML = `
    <div class="voice-selector-card" role="document">
      <header class="voice-selector-header">
        <h2 id="azure-voice-selector-title">Azure Whisper Voices</h2>
        <p>Choose which humiliating whisper follows you around the gallery.</p>
      </header>
      <div class="voice-selector-grid" data-role="voice-list" role="list"></div>
      <div class="voice-selector-actions">
        <div class="voice-style-field">
          <label class="field-label" for="azure-voice-style-select">Voice style</label>
          <select id="azure-voice-style-select" data-role="style-select" class="voice-style-select"></select>
        </div>
        <div class="voice-selector-buttons">
          <button type="button" class="audio-pill" data-role="preview">Preview whisper</button>
          <button type="button" class="audio-pill" data-role="close">Done</button>
        </div>
      </div>
      <p class="voice-selector-footnote" data-role="status"></p>
    </div>
  `;

  voiceSelectorList = voiceSelectorOverlay.querySelector("[data-role='voice-list']");
  styleSelectEl = voiceSelectorOverlay.querySelector("[data-role='style-select']");
  previewBtn = voiceSelectorOverlay.querySelector("[data-role='preview']");
  closeBtn = voiceSelectorOverlay.querySelector("[data-role='close']");
  statusEl = voiceSelectorOverlay.querySelector("[data-role='status']");

  if (previewBtn) {
    previewBtn.addEventListener("click", handlePreviewClick);
  }
  if (closeBtn) {
    closeBtn.addEventListener("click", () => closeVoiceSelector());
  }

  attachStyleListener();

  voiceSelectorOverlay.addEventListener("click", (event) => {
    if (event.target === voiceSelectorOverlay) {
      closeVoiceSelector();
    }
  });

  document.body.appendChild(voiceSelectorOverlay);
}

function renderVoiceOptions(voices) {
  if (!voiceSelectorList) return;
  voiceSelectorList.innerHTML = "";
  const sorted = voices
    .slice()
    .sort((a, b) => (a.LocalName || a.ShortName).localeCompare(b.LocalName || b.ShortName));

  sorted.forEach((voice) => {
    const whisperStyles = filterWhisperStyles(voice.StyleList);
    if (!whisperStyles.length) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "voice-option";
    button.dataset.voice = voice.ShortName;
    button.setAttribute("role", "listitem");
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = `
      <span class="voice-option-title">${formatVoiceLabel(voice)}</span>
      <span class="voice-option-meta">${whisperStyles.length} whisper style${whisperStyles.length === 1 ? "" : "s"}</span>
    `;
    button.addEventListener("click", () => {
      setAzureTTSConfig({ voice: voice.ShortName, style: whisperStyles[0] || WHISPER_STYLE_CANONICAL });
      highlightSelectedVoice(voice.ShortName);
      updateStyleOptions(voice);
    });
    voiceSelectorList.appendChild(button);
  });
  highlightSelectedVoice(azureConfig.voice);
}

function renderVoiceSelectorMessage(message) {
  if (!voiceSelectorList) return;
  voiceSelectorList.innerHTML = "";
  const notice = document.createElement("div");
  notice.className = "voice-selector-empty";
  notice.setAttribute("role", "status");
  notice.textContent = message;
  voiceSelectorList.appendChild(notice);
}

async function showAzureVoiceSelector() {
  if (typeof document === "undefined") return;
  ensureVoiceSelectorElements();

  let whisperVoices = [];
  let statusMessage = "";
  let credentials = null;

  try {
    credentials = await ensureCredentials();
  } catch (error) {
    console.warn("Azure TTS credentials missing", error);
    statusMessage = "Add your Azure Speech key and region to choose a whisper voice.";
  }

  if (credentials) {
    try {
      const voices = await fetchAzureVoices(credentials.key, credentials.region);
      whisperVoices = voices.filter(
        (voice) =>
          Array.isArray(voice?.StyleList) &&
          filterWhisperStyles(voice.StyleList).length > 0
      );
      if (!whisperVoices.length) {
        statusMessage = "No whisper-capable voices were returned for this Azure resource.";
      }
    } catch (error) {
      console.error("Failed to fetch Azure voices", error);
      statusMessage = "Azure voice list unavailable. Try again in a moment.";
    }
  }

  if (whisperVoices.length > 0) {
    registerWhisperVoicePool(whisperVoices);
    renderVoiceOptions(whisperVoices);
    const activeVoice = whisperVoices.find(
      (voice) => voice.ShortName === azureConfig.voice
    );
    updateStyleOptions(activeVoice || whisperVoices[0]);
    updateStatusLine();
    if (previewBtn) {
      previewBtn.disabled = false;
      previewBtn.removeAttribute("aria-disabled");
      previewBtn.title = "";
    }
  } else {
    const message =
      statusMessage ||
      "No whisper styles are available. Keep the default whisper until Azure voices load.";
    renderVoiceSelectorMessage(message);
    updateStyleOptions();
    const readableStyle =
      toReadableStyle(azureConfig.style) || toReadableStyle(WHISPER_STYLE_CANONICAL);
    updateStatusLine(`${message} Current voice: ${azureConfig.voice} · Style: ${readableStyle}`);
    if (previewBtn) {
      previewBtn.disabled = true;
      previewBtn.setAttribute("aria-disabled", "true");
      previewBtn.title = message;
    }
  }

  voiceSelectorOverlay.classList.remove("hidden");
  voiceSelectorOverlay.setAttribute("aria-hidden", "false");
  voiceSelectorOverlay.focus({ preventScroll: true });
  document.body.classList.add("voice-selector-open");
  document.dispatchEvent(
    new CustomEvent("azureTTS:selector", { detail: { open: true } })
  );

  escKeyHandler = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeVoiceSelector();
    }
  };
  document.addEventListener("keydown", escKeyHandler);
}

if (typeof window !== "undefined") {
  loadStoredConfig();
  window.showAzureVoiceSelector = showAzureVoiceSelector;
}

export {
  azureSpeak,
  setAzureTTSConfig,
  getAzureTTSConfig,
  fetchAzureVoices,
  showAzureVoiceSelector,
  DEFAULT_VOICE,
  WHISPER_STYLE_CANONICAL,
  composeWhisperSSML,
  getNextWhisperConfig,
  registerWhisperVoicePool,
};

export async function ensureDefaultWhisperVoice() {
  if (ensureDefaultVoicePromise) return ensureDefaultVoicePromise;

  ensureDefaultVoicePromise = (async () => {
    try {
      if (typeof window !== 'undefined' && window._azureTTSKey && window._azureTTSRegion) {
        const voices = await fetchAzureVoices(
          window._azureTTSKey,
          window._azureTTSRegion
        );
        const whisperVoices = Array.isArray(voices)
          ? voices.filter((voice) =>
              Array.isArray(voice?.StyleList) &&
              voice.StyleList.some((style) => String(style).toLowerCase() === 'whispering')
            )
          : [];
        if (whisperVoices.length) {
          registerWhisperVoicePool(whisperVoices);
          const currentVoice = window._azureTTSVoice;
          const preferred = whisperVoices.find((voice) => voice.ShortName === currentVoice);
          const fallback =
            whisperVoices.find((voice) => voice.ShortName === DEFAULT_VOICE) || whisperVoices[0];
          const voiceToUse = preferred || fallback;
          const whisperStyle = Array.isArray(voiceToUse?.StyleList)
            ? voiceToUse.StyleList.find(
                (style) => String(style).toLowerCase() === WHISPER_STYLE_CANONICAL
              ) ||
              voiceToUse.StyleList.find((style) =>
                String(style).toLowerCase().includes('whisper')
              )
            : null;
          setAzureTTSConfig({
            voice: voiceToUse.ShortName,
            style: whisperStyle || WHISPER_STYLE_CANONICAL,
          });
          return;
        }
      }
    } catch (error) {
      // Ignore errors and fall back to default voice
      console.warn('[azure-tts] ensureDefaultWhisperVoice fallback', error);
    }

    setAzureTTSConfig({
      voice: DEFAULT_VOICE,
      style: WHISPER_STYLE_CANONICAL,
    });
  })();

  return ensureDefaultVoicePromise;
}
