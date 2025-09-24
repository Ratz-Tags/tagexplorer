const STORAGE_KEY = "azureTTSConfig";
const DEFAULT_VOICE = "en-US-AvaMultilingualNeural";
const WHISPER_STYLE_CANONICAL = "whispering";
const SAMPLE_PREVIEW_LINE = "Caught you tweaking my whispers again, pet.";

let azureConfig = {
  voice: DEFAULT_VOICE,
  style: WHISPER_STYLE_CANONICAL,
};

let voiceListPromise = null;
let latestObjectUrl = null;
let voiceSelectorOverlay = null;
let voiceSelectorList = null;
let styleSelectEl = null;
let previewBtn = null;
let statusEl = null;
let closeBtn = null;
let escKeyHandler = null;

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

function ensureCredentials() {
  if (typeof window === "undefined") {
    throw new Error("Azure TTS requires browser environment");
  }
  const key = window._azureTTSKey;
  const region = window._azureTTSRegion;
  if (!key || !region) {
    throw new Error("Azure TTS credentials are missing. Set window._azureTTSKey and window._azureTTSRegion.");
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

function buildSSML(text, config) {
  const { voice, style } = normalizeVoiceConfig(config);
  const safeText = text.replace(/[<>]/g, "");
  const content = style
    ? `<mstts:express-as style="${style}">${safeText}</mstts:express-as>`
    : safeText;
  return `<?xml version="1.0" encoding="utf-8"?>
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US" xmlns:mstts="https://www.w3.org/2001/mstts">
  <voice name="${voice}">
    ${content}
  </voice>
</speak>`;
}

async function azureSpeak(text, overrides = {}) {
  if (!text) return null;
  const { key, region } = ensureCredentials();
  const config = normalizeVoiceConfig(overrides);
  const ssml = buildSSML(text, config);

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

function updateStatusLine() {
  if (!statusEl) return;
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

async function showAzureVoiceSelector() {
  if (typeof document === "undefined") return;
  ensureVoiceSelectorElements();
  const { key, region } = ensureCredentials();
  const voices = await fetchAzureVoices(key, region);
  const whisperVoices = voices.filter((voice) =>
    Array.isArray(voice?.StyleList) && filterWhisperStyles(voice.StyleList).length > 0
  );

  renderVoiceOptions(whisperVoices);

  const activeVoice = whisperVoices.find((voice) => voice.ShortName === azureConfig.voice);
  updateStyleOptions(activeVoice || whisperVoices[0]);
  updateStatusLine();

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
};
