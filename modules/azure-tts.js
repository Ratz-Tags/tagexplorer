try {
  await import("../azure-tts.local.js");
} catch (e) {}

// Set Ava Dragon HD as the default if available
const DEFAULT_VOICE = "en-US-AvaMultilingualNeural"; // Ava Dragon HD (latest)
const WHISPER_STYLE_CANONICAL = "Whispering";
const WHISPER_STYLE_ATTR = WHISPER_STYLE_CANONICAL.toLowerCase();
const azureState = typeof window !== "undefined" ? window : globalThis;

import { isTTSEnabled } from "./tts-toggle.js";

function sanitizeForSSML(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function resolveWhisperStyle(style) {
  if (typeof style === "string" && style.trim()) {
    const normalized = style.trim().toLowerCase();
    if (normalized === WHISPER_STYLE_ATTR) {
      return WHISPER_STYLE_CANONICAL;
    }
  }
  return WHISPER_STYLE_CANONICAL;
}

function ensureVoiceState() {
  if (!azureState._azureVoiceStyles || !(azureState._azureVoiceStyles instanceof Map)) {
    azureState._azureVoiceStyles = new Map();
  }
  if (!azureState._azureWhisperVoices || !(azureState._azureWhisperVoices instanceof Set)) {
    azureState._azureWhisperVoices = new Set();
  }
  if (!azureState._azureVoiceStyles.has(DEFAULT_VOICE)) {
    azureState._azureVoiceStyles.set(
      DEFAULT_VOICE,
      new Set([WHISPER_STYLE_ATTR])
    );
  } else {
    const styles = azureState._azureVoiceStyles.get(DEFAULT_VOICE);
    if (styles instanceof Set) {
      styles.add(WHISPER_STYLE_ATTR);
    } else {
      azureState._azureVoiceStyles.set(
        DEFAULT_VOICE,
        new Set([WHISPER_STYLE_ATTR])
      );
    }
  }
  azureState._azureWhisperVoices.add(DEFAULT_VOICE);
  azureState._azureTTSStyle = resolveWhisperStyle(azureState._azureTTSStyle);
}

function registerVoiceStyles(voices) {
  if (!Array.isArray(voices)) return;
  ensureVoiceState();
  const styleMap = azureState._azureVoiceStyles;
  const whisperSet = azureState._azureWhisperVoices;
  voices.forEach((voice) => {
    const shortName = voice?.ShortName;
    if (!shortName) return;
    const styles = Array.isArray(voice.StyleList)
      ? voice.StyleList.map((style) => String(style).toLowerCase())
      : [];
    styleMap.set(shortName, new Set(styles));
    if (styles.includes(WHISPER_STYLE_ATTR)) {
      whisperSet.add(shortName);
    } else {
      whisperSet.delete(shortName);
    }
  });
  whisperSet.add(DEFAULT_VOICE);
  if (!styleMap.has(DEFAULT_VOICE)) {
    styleMap.set(DEFAULT_VOICE, new Set([WHISPER_STYLE_ATTR]));
  }
}

function voiceSupportsWhisper(voiceName) {
  ensureVoiceState();
  const styles = azureState._azureVoiceStyles.get(voiceName);
  return styles instanceof Set ? styles.has(WHISPER_STYLE_ATTR) : false;
}

function chooseWhisperVoice(preferredVoice) {
  ensureVoiceState();
  const candidate = preferredVoice || azureState._azureTTSVoice || DEFAULT_VOICE;
  if (candidate && voiceSupportsWhisper(candidate)) {
    return candidate;
  }
  const whisperSet = azureState._azureWhisperVoices;
  if (whisperSet && whisperSet.size) {
    if (whisperSet.has(DEFAULT_VOICE)) {
      return DEFAULT_VOICE;
    }
    for (const voiceName of whisperSet.values()) {
      if (voiceSupportsWhisper(voiceName)) {
        return voiceName;
      }
    }
  }
  return DEFAULT_VOICE;
}

function buildWhisperSSML(text, voice, style = WHISPER_STYLE_CANONICAL) {
  const resolvedVoice = voice || DEFAULT_VOICE;
  const resolvedStyle = resolveWhisperStyle(style);
  const styleAttr = resolvedStyle.toLowerCase();
  const payload = sanitizeForSSML(text);
  return `<?xml version='1.0'?>\n` +
    `<speak version='1.0' xml:lang='en-US' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='https://www.w3.org/2001/mstts'>\n` +
    `  <voice name='${resolvedVoice}'>\n` +
    `    <mstts:express-as style='${styleAttr}'>\n` +
    `      <prosody rate='-10%' volume='-25%'>${payload}</prosody>\n` +
    `    </mstts:express-as>\n` +
    `  </voice>\n` +
    `</speak>`;
}

ensureVoiceState();

async function azureSpeak(text, opts = {}) {
  if (!isTTSEnabled()) return null;
  ensureVoiceState();
  const key = opts.key || azureState._azureTTSKey;
  const region = opts.region || azureState._azureTTSRegion;
  if (!key || !region) throw new Error("Azure TTS key/region not set");
  const voice = chooseWhisperVoice(opts.voice);
  const style = resolveWhisperStyle(opts.style || azureState._azureTTSStyle);
  azureState._azureTTSVoice = voice;
  azureState._azureTTSStyle = style;
  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const ssml = buildWhisperSSML(text, voice, style);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "kexplorer-tts-client",
    },
    body: ssml,
  });
  if (!res.ok) throw new Error("Azure TTS failed: " + res.status);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

async function fetchAzureVoices(key, region) {
  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`;
  const res = await fetch(endpoint, {
    method: "GET",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
    },
  });
  if (!res.ok) throw new Error("Failed to fetch voices: " + res.status);
  const voices = await res.json();
  registerVoiceStyles(voices);
  return voices;
}

// Optionally: expose a UI to set key/region and voice globally
function setAzureTTSConfig({ key, region, voice, style }) {
  ensureVoiceState();
  if (key) azureState._azureTTSKey = key;
  if (region) azureState._azureTTSRegion = region;
  if (voice) {
    azureState._azureTTSVoice = chooseWhisperVoice(voice);
  }
  if (style !== undefined) {
    azureState._azureTTSStyle = resolveWhisperStyle(style);
  } else if (voice) {
    azureState._azureTTSStyle = resolveWhisperStyle(azureState._azureTTSStyle);
  }
}

// UI: Show Azure voice selector (fetches voices from Azure)
async function showAzureVoiceSelector() {
  if (!azureState._azureTTSKey || !azureState._azureTTSRegion) {
    alert("Set your Azure TTS key and region first!");
    return;
  }
  if (typeof document === "undefined") return;
  let container = document.getElementById("azure-voice-selector");
  if (!container) {
    container = document.createElement("div");
    container.id = "azure-voice-selector";
    container.style = [
      "position:fixed",
      "left:50%",
      "transform:translateX(-50%)",
      "bottom:3em",
      "z-index:3000",
      "background:#fff0fa",
      "border:2px solid #fd7bc5",
      "border-radius:1.2em",
      "padding:1em",
      "box-shadow:0 2px 16px #fd7bc540",
      "max-width:90vw",
      "width:360px",
    ].join(";");
    document.body.appendChild(container);
  }
  container.innerHTML = `<b>Azure Whisper Voices</b><br>
    <label style='font-size:0.98em;'><input type='checkbox' id='azure-voice-female' checked> Show only feminine voices</label><br>
    <label style='font-size:0.98em;'><input type='checkbox' id='azure-voice-english' checked> Show only English voices</label>
    <div id='azure-voices-loading' style='color:#a0005a;margin-top:0.5em;'>Loading whisper voices...</div>`;
  let saveBtn;
  try {
    const voices = await fetchAzureVoices(
      azureState._azureTTSKey,
      azureState._azureTTSRegion
    );
    const whisperVoices = Array.isArray(voices)
      ? voices.filter((voice) => voiceSupportsWhisper(voice.ShortName))
      : [];
    if (!whisperVoices.length) {
      container.innerHTML = `<b>Azure Whisper Voices</b><br><span style='color:#a0005a;'>No whisper-capable voices returned.</span>`;
      return;
    }

    const renderVoiceSelect = () => {
      const onlyFemaleEl = document.getElementById("azure-voice-female");
      const onlyEnglishEl = document.getElementById("azure-voice-english");
      let filtered = whisperVoices;
      if (onlyFemaleEl && onlyFemaleEl.checked) {
        filtered = filtered.filter((voice) => voice.Gender === "Female");
      }
      if (onlyEnglishEl && onlyEnglishEl.checked) {
        filtered = filtered.filter((voice) =>
          (voice.Locale || "").toLowerCase().startsWith("en")
        );
      }

      let select = document.getElementById("azure-voice-select");
      if (select) select.remove();
      select = document.createElement("select");
      select.id = "azure-voice-select";
      select.style = "width:100%;margin-top:0.7em;margin-bottom:0.4em;";

      if (!filtered.length) {
        select.disabled = true;
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "No voices match the current filters";
        select.appendChild(opt);
      } else {
        const preferred = chooseWhisperVoice(azureState._azureTTSVoice);
        const usableVoice = filtered.some(
          (voice) => voice.ShortName === preferred
        )
          ? preferred
          : filtered[0].ShortName;
        azureState._azureTTSVoice = usableVoice;
        filtered.forEach((voice) => {
          const opt = document.createElement("option");
          opt.value = voice.ShortName;
          opt.textContent = `${voice.ShortName} — ${voice.FriendlyName} (${voice.Locale}, ${voice.Gender})`;
          if (voice.ShortName === azureState._azureTTSVoice) {
            opt.selected = true;
          }
          select.appendChild(opt);
        });
        select.disabled = false;
      }

      select.onchange = () => {
        azureState._azureTTSVoice = chooseWhisperVoice(select.value);
      };

      const anchor = document.getElementById("azure-voices-loading");
      if (anchor) {
        container.insertBefore(select, anchor);
        anchor.textContent = select.disabled
          ? "No whisper voices match the current filters."
          : "Style locked to Whispering (-10% rate, -25% volume).";
      } else {
        container.appendChild(select);
      }

      if (saveBtn) {
        saveBtn.disabled = select.disabled;
      }

      return select.disabled;
    };

    const initialDisabled = renderVoiceSelect();
    const femaleToggle = document.getElementById("azure-voice-female");
    const englishToggle = document.getElementById("azure-voice-english");
    const handleFilterChange = () => {
      renderVoiceSelect();
    };
    if (femaleToggle) femaleToggle.onchange = handleFilterChange;
    if (englishToggle) englishToggle.onchange = handleFilterChange;

    saveBtn = document.createElement("button");
    saveBtn.textContent = "Set Whisper Voice";
    saveBtn.className = "browse-btn";
    saveBtn.style = "margin-left:0.7em;";
    saveBtn.disabled = initialDisabled;
    saveBtn.onclick = () => {
      const select = document.getElementById("azure-voice-select");
      const voiceValue = select && !select.disabled ? select.value : undefined;
      const chosen = chooseWhisperVoice(voiceValue);
      setAzureTTSConfig({ voice: chosen, style: WHISPER_STYLE_CANONICAL });
      alert(`Azure TTS set to: ${chosen} (Whispering)`);
    };
    container.appendChild(saveBtn);

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.className = "zoom-close";
    closeBtn.onclick = () => container.remove();
    container.appendChild(closeBtn);
  } catch (e) {
    container.innerHTML = `<b>Azure Whisper Voices</b><br><span style='color:#a0005a;'>Failed to load voices: ${e.message}</span>`;
  }
}

export {
  azureSpeak,
  setAzureTTSConfig,
  DEFAULT_VOICE,
  WHISPER_STYLE_CANONICAL,
  fetchAzureVoices,
  showAzureVoiceSelector,
};

// Expose for debugging/UI
if (typeof window !== "undefined") {
  window.azureSpeak = azureSpeak;
  window.fetchAzureVoices = fetchAzureVoices;
  window.showAzureVoiceSelector = showAzureVoiceSelector;
}
