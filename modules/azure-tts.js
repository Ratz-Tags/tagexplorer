try {
  await import("../azure-tts.local.js");
} catch (e) {}

const DEFAULT_VOICE = "en-US-MichelleNeural";

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

// Optionally: expose a UI to set key/region globally
function setAzureTTSConfig({ key, region }) {
  window._azureTTSKey = key;
  window._azureTTSRegion = region;
}

export { azureSpeak, setAzureTTSConfig, DEFAULT_VOICE };
