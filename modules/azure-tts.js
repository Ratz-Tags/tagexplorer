try {
  await import("../azure-tts.local.js");
} catch (e) {}

// Set Ava Dragon HD as the default if available
const DEFAULT_VOICE = "en-US-AvaMultilingualNeural"; // Ava Dragon HD (latest)

async function azureSpeak(text, opts = {}) {
  const key = opts.key || window._azureTTSKey;
  const region = opts.region || window._azureTTSRegion;
  const voice = opts.voice || DEFAULT_VOICE;
  if (!key || !region) throw new Error("Azure TTS key/region not set");
  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const ssml = `<?xml version='1.0'?><speak version='1.0' xml:lang='en-US'><voice name='${voice}'>${text}</voice></speak>`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-16khz-32kbitrate-mono-mp3",
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
  return await res.json();
}

// Optionally: expose a UI to set key/region and voice globally
function setAzureTTSConfig({ key, region, voice }) {
  if (key) window._azureTTSKey = key;
  if (region) window._azureTTSRegion = region;
  if (voice) window._azureTTSVoice = voice;
}

// UI: Show Azure voice selector (fetches voices from Azure)
async function showAzureVoiceSelector() {
  if (!window._azureTTSKey || !window._azureTTSRegion) {
    alert("Set your Azure TTS key and region first!");
    return;
  }
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
      "width:340px",
    ].join(";");
    document.body.appendChild(container);
  }
  // Add filter controls
  container.innerHTML = `<b>Azure TTS Voices</b><br>
    <label style='font-size:0.98em;'><input type='checkbox' id='azure-voice-female' checked> Show only feminine voices</label><br>
    <label style='font-size:0.98em;'><input type='checkbox' id='azure-voice-english' checked> Show only English voices</label>
    <div id='azure-voices-loading' style='color:#a0005a;margin-top:0.5em;'>Loading voices...</div>`;
  try {
    const voices = await fetchAzureVoices(
      window._azureTTSKey,
      window._azureTTSRegion
    );
    if (!Array.isArray(voices)) throw new Error("No voices returned");

    // If no voice is set, default to Ava if available
    if (!window._azureTTSVoice) {
      const ava = voices.find(
        (v) => v.ShortName === "en-US-AvaMultilingualNeural"
      );
      window._azureTTSVoice = ava ? ava.ShortName : DEFAULT_VOICE;
    }

    // Filtering logic
    function renderVoiceSelect() {
      const onlyFemale = document.getElementById("azure-voice-female").checked;
      const onlyEnglish = document.getElementById(
        "azure-voice-english"
      ).checked;
      let filtered = voices;
      if (onlyFemale) filtered = filtered.filter((v) => v.Gender === "Female");
      if (onlyEnglish)
        filtered = filtered.filter(
          (v) => v.Locale && v.Locale.toLowerCase().startsWith("en")
        );
      const select = document.createElement("select");
      select.style = "width:100%;margin-top:0.7em;margin-bottom:0.7em;";
      filtered.forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v.ShortName;
        opt.textContent = `${v.ShortName} — ${v.FriendlyName} (${v.Locale}, ${v.Gender})`;
        if (window._azureTTSVoice === v.ShortName) opt.selected = true;
        select.appendChild(opt);
      });
      // Replace or add select
      let prev = document.getElementById("azure-voice-select");
      if (prev) prev.remove();
      select.id = "azure-voice-select";
      container.insertBefore(
        select,
        document.getElementById("azure-voices-loading")
      );
    }

    // Initial render
    renderVoiceSelect();
    document.getElementById("azure-voices-loading").style.display = "none";

    // Add event listeners for checkboxes
    document.getElementById("azure-voice-female").onchange = renderVoiceSelect;
    document.getElementById("azure-voice-english").onchange = renderVoiceSelect;

    // Save and close buttons
    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Set Voice";
    saveBtn.className = "browse-btn";
    saveBtn.style = "margin-left:0.7em;";
    saveBtn.onclick = () => {
      const select = document.getElementById("azure-voice-select");
      if (select && select.value) {
        window._azureTTSVoice = select.value;
        setAzureTTSConfig({ voice: select.value });
        alert("Azure TTS voice set to: " + select.value);
      }
    };
    container.appendChild(saveBtn);
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.className = "zoom-close";
    closeBtn.style = "float:right;";
    closeBtn.onclick = () => container.remove();
    container.appendChild(closeBtn);
  } catch (e) {
    container.innerHTML = `<b>Azure TTS Voices</b><br><span style='color:#a0005a;'>Failed to load voices: ${e.message}</span>`;
  }
}

export {
  azureSpeak,
  setAzureTTSConfig,
  DEFAULT_VOICE,
  fetchAzureVoices,
  showAzureVoiceSelector,
};

// Expose fetchAzureVoices and showAzureVoiceSelector globally for debugging/UI
window.fetchAzureVoices = fetchAzureVoices;
window.showAzureVoiceSelector = showAzureVoiceSelector;
