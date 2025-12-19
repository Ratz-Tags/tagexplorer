/**
 * NovelAI Prompt Generator
 * Generates optimized prompts for NovelAI v4.5 Full using valid Danbooru tags
 * Suggests artists based on kink matching
 */

// Configuration
const PROMPTER_CONFIG = {
  storageKey: 'tagexplorer:novelai-prompter',
  openRouterEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
  novelaiEndpoint: 'https://api.novelai.net/ai/generate-image',
  freeNSFWModels: [
    'tngtech/deepseek-r1t2-chimera:free',
    'cognitivecomputations/dolphin-mixtral-8x7b:free',
    'mistralai/mistral-7b-instruct:free',
  ],
  defaultModel: 'tngtech/deepseek-r1t2-chimera:free',
  // NovelAI v4.5 Full model (free tier compatible)
  novelaiModel: 'nai-diffusion-4-5-full',
};

// State
let prompterElement = null;
let isMinimized = false;
let allArtists = [];
let allKinkTags = [];
let kinkTagsByCategory = [];
let currentModel = PROMPTER_CONFIG.defaultModel;
let apiKey = null;
let novelaiApiKey = null;
let getActiveTagsCallback = null; // Callback to get active tags from gallery
let imageGenSettings = {
  width: 832,
  height: 1216,
  steps: 28,
  scale: 7,
  sampler: 'k_euler_ancestral',
  samples: 1, // Number of images to generate
  negativePrompt: '',
};

// Load API key from window or localStorage
function loadAPIKey() {
  if (typeof window !== 'undefined' && window._openRouterApiKey) {
    apiKey = window._openRouterApiKey;
    return true;
  }
  
  try {
    const stored = localStorage.getItem('tagexplorer:openrouter-key');
    if (stored) {
      apiKey = stored;
      return true;
    }
  } catch (e) {
    console.warn('[NovelAI Prompter] Failed to load API key from storage:', e);
  }
  
  return false;
}

// Load NovelAI API key from window (injected via GitHub Actions)
function loadNovelAIKey() {
  if (typeof window !== 'undefined' && window._novelaiApiKey) {
    novelaiApiKey = window._novelaiApiKey;
    console.log('[NovelAI Prompter] NovelAI API key loaded from window');
    return true;
  }
  
  console.warn('[NovelAI Prompter] NovelAI API key not found');
  return false;
}

// Load config from storage
function loadConfig() {
  try {
    const stored = localStorage.getItem(PROMPTER_CONFIG.storageKey);
    if (stored) {
      const config = JSON.parse(stored);
      if (config.model) currentModel = config.model;
      if (config.apiKey) apiKey = config.apiKey;
    }
  } catch (e) {
    console.warn('[NovelAI Prompter] Failed to load config:', e);
  }
}

// Save config to storage
function saveConfig() {
  try {
    localStorage.setItem(PROMPTER_CONFIG.storageKey, JSON.stringify({
      model: currentModel,
      apiKey: apiKey ? '***' : null, // Don't store actual key
    }));
  } catch (e) {
    console.warn('[NovelAI Prompter] Failed to save config:', e);
  }
}

// Validate Danbooru tag format
function isValidDanbooruTag(tag) {
  if (!tag || typeof tag !== 'string') return false;
  // Danbooru tags: lowercase, underscores, numbers, some special chars
  return /^[a-z0-9_()]+$/.test(tag.toLowerCase());
}

// Normalize tag to Danbooru format
function normalizeTag(tag) {
  if (!tag || typeof tag !== 'string') return '';
  return tag
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_()]/g, '');
}

// Extract potential tags from user description
function extractPotentialTags(description) {
  const words = description.toLowerCase().split(/\s+/);
  const potentialTags = new Set();
  
  // Check against known kink tags
  for (const word of words) {
    const normalized = normalizeTag(word);
    if (normalized && allKinkTags.includes(normalized)) {
      potentialTags.add(normalized);
    }
  }
  
  // Also check multi-word phrases
  for (let i = 0; i < words.length - 1; i++) {
    const phrase = `${words[i]}_${words[i + 1]}`;
    const normalized = normalizeTag(phrase);
    if (normalized && allKinkTags.includes(normalized)) {
      potentialTags.add(normalized);
    }
  }
  
  return Array.from(potentialTags);
}

// Find artists matching kinks
function findMatchingArtists(kinkTags) {
  if (!Array.isArray(kinkTags) || kinkTags.length === 0) return [];
  if (!Array.isArray(allArtists) || allArtists.length === 0) return [];
  
  const tagSet = new Set(kinkTags.map(t => normalizeTag(t)));
  const matches = [];
  
  for (const artist of allArtists) {
    if (!artist.kinkTags || !Array.isArray(artist.kinkTags)) continue;
    
    const artistTags = new Set(artist.kinkTags.map(t => normalizeTag(t)));
    const intersection = Array.from(tagSet).filter(t => artistTags.has(t));
    
    if (intersection.length > 0) {
      matches.push({
        artist,
        matchCount: intersection.length,
        matchedTags: intersection,
        matchRatio: intersection.length / tagSet.size,
      });
    }
  }
  
  // Sort by match count and ratio
  matches.sort((a, b) => {
    if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
    return b.matchRatio - a.matchRatio;
  });
  
  return matches.slice(0, 10); // Top 10 matches
}

// Call OpenRouter API
async function callOpenRouter(messages, model = currentModel) {
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured');
  }
  
  const response = await fetch(PROMPTER_CONFIG.openRouterEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'TagExplorer NovelAI Prompter',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(error.error?.message || `HTTP ${response.status}`);
  }
  
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Generate NovelAI prompt
async function generatePrompt(sceneDescription, characterDescription = '') {
  const fullDescription = characterDescription 
    ? `${characterDescription}\n\nScene: ${sceneDescription}`
    : sceneDescription;
  
  // Extract potential tags
  const extractedTags = extractPotentialTags(fullDescription);
  
  // Find matching artists
  const artistMatches = findMatchingArtists(extractedTags);
  
  // Build system prompt
  const systemPrompt = `You are an expert prompt engineer for NovelAI v4.5 Full. Your task is to create optimized prompts using ONLY valid Danbooru tags, structured for NovelAI's prompt system.

NovelAI Prompt Structure:
1. POSITIVE PROMPT: Main scene description with Danbooru tags
   - Character tags: "1girl", "2girls", "solo", character details
   - Position/pose: "standing", "sitting", "lying", "kneeling", etc.
   - Scene/action: "outdoors", "indoors", "bedroom", action tags
   - Quality/style: "high quality", "detailed", "masterpiece"
   - Kink tags: Include relevant tags from description

2. NEGATIVE PROMPT: Undesired content (if not provided, suggest common ones)
   - Quality issues: "lowres", "bad anatomy", "blurry", "worst quality"
   - Common problems: "deformed", "disfigured", "bad proportions"
   - Unwanted elements: "text", "watermark", "signature"

3. CHARACTER PROMPTS: For multi-character scenes
   - Format: Character descriptions with position parameters
   - Position: "left", "right", "center", "foreground", "background"
   - Or let NovelAI decide by omitting position

Rules:
- Use ONLY valid Danbooru tags (lowercase, underscores, no spaces)
- Format: comma-separated tags
- Order: character count → character details → pose → scene → quality → kink tags
- Keep prompts descriptive but concise (50-200 tags max)
- Separate positive and negative prompts clearly
- For character prompts, include position if specified, otherwise omit

Valid tag examples: "1girl", "solo", "breasts", "nude", "standing", "smile", "long_hair", "2girls", "left", "right"

Invalid: "long hair" (use "long_hair"), "1 girl" (use "1girl"), "smiling!" (use "smile")

Generate structured prompts that accurately represent the scene, characters, and any position requirements.`;

  const userPrompt = `Scene Description:
${fullDescription}

${extractedTags.length > 0 ? `\nDetected relevant tags: ${extractedTags.slice(0, 20).join(', ')}` : ''}

Generate a structured NovelAI v4.5 Full prompt with:
1. POSITIVE PROMPT: Main scene with Danbooru tags (character, pose, scene, quality, kink tags)
2. NEGATIVE PROMPT: Suggested undesired content tags (if not provided in description)
3. CHARACTER PROMPTS: If multiple characters mentioned, include position parameters (left/right/center) or note to let NovelAI decide

Format your response as:
POSITIVE: [comma-separated Danbooru tags]
NEGATIVE: [comma-separated undesired tags]
CHARACTERS: [if applicable, character descriptions with positions or "let NovelAI decide"]

Use ONLY valid Danbooru tags.`;

  try {
    const response = await callOpenRouter([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
    
    // Parse structured response
    const positiveMatch = response.match(/POSITIVE:\s*([^\n]+)/i) || response.match(/positive[:\s]+([^\n]+)/i);
    const negativeMatch = response.match(/NEGATIVE:\s*([^\n]+)/i) || response.match(/negative[:\s]+([^\n]+)/i);
    const characterMatch = response.match(/CHARACTERS?:\s*([^\n]+)/i) || response.match(/character[:\s]+([^\n]+)/i);
    
    let positiveTags = [];
    let negativeTags = [];
    let characterPrompt = '';
    
    if (positiveMatch) {
      positiveTags = positiveMatch[1].split(',').map(t => normalizeTag(t.trim())).filter(Boolean);
    } else {
      // Fallback: try to extract tags from response
      const tagMatch = response.match(/(?:^|\n)([a-z0-9_(),\s]+)(?:\n|$)/i);
      positiveTags = tagMatch 
        ? tagMatch[1].split(',').map(t => normalizeTag(t.trim())).filter(Boolean)
        : response.split(',').map(t => normalizeTag(t.trim())).filter(Boolean);
    }
    
    if (negativeMatch) {
      negativeTags = negativeMatch[1].split(',').map(t => normalizeTag(t.trim())).filter(Boolean);
    }
    
    if (characterMatch) {
      characterPrompt = characterMatch[1].trim();
    }
    
    return {
      prompt: positiveTags.join(', '),
      tags: positiveTags,
      negativePrompt: negativeTags.join(', '),
      characterPrompt: characterPrompt,
      extractedTags,
      artistMatches: artistMatches.slice(0, 5),
      rawResponse: response,
    };
  } catch (error) {
    console.error('[NovelAI Prompter] Generation failed:', error);
    throw error;
  }
}

// Generate image using NovelAI API (free tier only - no anlas)
async function generateNovelAIImage(prompt, negativePrompt = '', options = {}) {
  if (!novelaiApiKey) {
    throw new Error('NovelAI API key not configured');
  }
  
  // Merge user options with saved settings
  const settings = { ...imageGenSettings, ...options };
  
  // Free tier settings - no anlas usage
  const payload = {
    input: prompt,
    model: PROMPTER_CONFIG.novelaiModel,
    action: 'generate',
    parameters: {
      width: settings.width,
      height: settings.height,
      scale: settings.scale,
      sampler: settings.sampler,
      steps: settings.steps,
      seed: options.seed || Math.floor(Math.random() * 4294967295),
      n_samples: settings.samples || 1,
      sm: false, // No smearing
      sm_dyn: false,
      decrisper: false,
      controlnet_strength: 1.0,
      legacy: false,
      add_original_image: false,
      // Free tier: no anlas usage
      payment: null, // Explicitly set to null to avoid anlas usage
      // Negative prompt (undesired content)
      ...(negativePrompt ? { uc: negativePrompt } : {}),
    },
  };
  
  try {
    const response = await fetch(PROMPTER_CONFIG.novelaiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${novelaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }
    
    // NovelAI returns image as base64 string
    const data = await response.json();
    if (data && typeof data === 'string') {
      // If response is base64 string directly
      return `data:image/png;base64,${data}`;
    } else if (data && data.data) {
      // If response has data field
      return `data:image/png;base64,${data.data}`;
    } else {
      throw new Error('Invalid response format from NovelAI API');
    }
  } catch (error) {
    console.error('[NovelAI Prompter] Image generation failed:', error);
    throw error;
  }
}

// Create UI element
function createPrompterElement() {
  return `
    <div id="novelai-prompter" class="novelai-prompter">
      <style>
        .novelai-prompter {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 420px;
          max-width: calc(100vw - 40px);
          max-height: calc(100vh - 40px);
          background: oklch(19% 0.02 260);
          border: 1px solid oklch(30% 0.05 260);
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          z-index: 10000;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          backdrop-filter: blur(10px);
        }
        
        .novelai-prompter.minimized {
          height: 50px;
        }
        
        .novelai-prompter-header {
          padding: 12px 16px;
          background: oklch(15% 0.02 260);
          border-bottom: 1px solid oklch(30% 0.05 260);
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: move;
        }
        
        .novelai-prompter-title {
          font-weight: 600;
          color: oklch(80% 0.14 205);
          font-size: 14px;
        }
        
        .novelai-prompter-controls {
          display: flex;
          gap: 8px;
        }
        
        .novelai-prompter-btn {
          background: transparent;
          border: none;
          color: oklch(70% 0.05 260);
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 18px;
          transition: all 0.2s;
        }
        
        .novelai-prompter-btn:hover {
          background: oklch(25% 0.02 260);
          color: oklch(80% 0.14 205);
        }
        
        .novelai-prompter-content {
          padding: 16px;
          overflow-y: auto;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        .novelai-prompter-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .novelai-prompter-label {
          font-size: 12px;
          color: oklch(60% 0.05 260);
          font-weight: 500;
        }
        
        .novelai-prompter-input,
        .novelai-prompter-textarea {
          background: oklch(15% 0.02 260);
          border: 1px solid oklch(30% 0.05 260);
          border-radius: 6px;
          padding: 10px;
          color: oklch(80% 0.05 260);
          font-size: 14px;
          font-family: inherit;
          resize: vertical;
        }
        
        .novelai-prompter-textarea {
          min-height: 80px;
        }
        
        .novelai-prompter-input:focus,
        .novelai-prompter-textarea:focus {
          outline: none;
          border-color: oklch(80% 0.14 205);
          box-shadow: 0 0 0 2px oklch(80% 0.14 205 / 0.2);
        }
        
        .novelai-prompter-generate-btn {
          background: oklch(66% 0.25 25);
          border: none;
          color: white;
          padding: 12px 24px;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .novelai-prompter-generate-btn:hover:not(:disabled) {
          background: oklch(70% 0.25 25);
          transform: translateY(-1px);
        }
        
        .novelai-prompter-generate-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .novelai-prompter-result {
          background: oklch(15% 0.02 260);
          border: 1px solid oklch(30% 0.05 260);
          border-radius: 6px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .novelai-prompter-prompt {
          background: oklch(10% 0.02 260);
          border: 1px solid oklch(30% 0.05 260);
          border-radius: 4px;
          padding: 10px;
          font-family: 'Courier New', monospace;
          font-size: 13px;
          color: oklch(75% 0.05 260);
          word-break: break-all;
          max-height: 200px;
          overflow-y: auto;
        }
        
        .novelai-prompter-artists {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        
        .novelai-prompter-artist {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 8px;
          background: oklch(12% 0.02 260);
          border-radius: 4px;
          font-size: 12px;
        }
        
        .novelai-prompter-artist-name {
          color: oklch(70% 0.14 205);
          font-weight: 500;
        }
        
        .novelai-prompter-artist-match {
          color: oklch(60% 0.05 260);
          font-size: 11px;
        }
        
        .novelai-prompter-copy-btn {
          background: oklch(25% 0.02 260);
          border: 1px solid oklch(30% 0.05 260);
          color: oklch(70% 0.05 260);
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .novelai-prompter-copy-btn:hover {
          background: oklch(30% 0.02 260);
          color: oklch(80% 0.14 205);
        }
        
        .novelai-prompter-loading {
          text-align: center;
          padding: 20px;
          color: oklch(60% 0.05 260);
        }
        
        .novelai-prompter-error {
          background: oklch(50% 0.25 25);
          border: 1px solid oklch(60% 0.25 25);
          color: white;
          padding: 12px;
          border-radius: 6px;
          font-size: 13px;
        }
        
        .novelai-prompter-image {
          width: 100%;
          max-width: 512px;
          height: auto;
          border-radius: 6px;
          border: 1px solid oklch(30% 0.05 260);
          margin-top: 8px;
        }
        
        .novelai-prompter-image-container {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .novelai-prompter-generate-image-btn {
          background: oklch(70% 0.18 350);
          border: none;
          color: white;
          padding: 10px 20px;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 13px;
        }
        
        .novelai-prompter-generate-image-btn:hover:not(:disabled) {
          background: oklch(75% 0.18 350);
          transform: translateY(-1px);
        }
        
        .novelai-prompter-generate-image-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .novelai-prompter-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 20000;
          backdrop-filter: blur(4px);
        }
        
        .novelai-prompter-modal-content {
          background: oklch(19% 0.02 260);
          border: 1px solid oklch(30% 0.05 260);
          border-radius: 12px;
          padding: 24px;
          max-width: 500px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        }
        
        .novelai-prompter-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        
        .novelai-prompter-modal-title {
          font-size: 18px;
          font-weight: 600;
          color: oklch(80% 0.14 205);
        }
        
        .novelai-prompter-use-tags-btn {
          background: oklch(25% 0.02 260);
          border: 1px solid oklch(30% 0.05 260);
          color: oklch(70% 0.14 205);
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 8px;
        }
        
        .novelai-prompter-use-tags-btn:hover {
          background: oklch(30% 0.02 260);
          color: oklch(80% 0.14 205);
        }
        
        .novelai-prompter-settings-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 12px;
        }
        
        .novelai-prompter-settings-row.full {
          grid-template-columns: 1fr;
        }
      </style>
      
      <div class="novelai-prompter-header">
        <div class="novelai-prompter-title">NovelAI Prompt Generator</div>
        <div class="novelai-prompter-controls">
          <button class="novelai-prompter-btn" id="prompter-settings" title="Settings">⚙️</button>
          <button class="novelai-prompter-btn" id="prompter-minimize" title="Minimize">−</button>
        </div>
      </div>
      
      <div class="novelai-prompter-content">
        <div class="novelai-prompter-section">
          <label class="novelai-prompter-label">Character Description (optional)</label>
          <textarea 
            class="novelai-prompter-textarea" 
            id="prompter-character"
            placeholder="Describe the character(s) and positions (e.g., 'girl on left, boy on right' or 'let NovelAI decide positions')..."
          ></textarea>
          <small style="color: oklch(60% 0.05 260); font-size: 11px; display: block; margin-top: 4px;">
            For multiple characters, specify positions (left/right/center) or let NovelAI decide
          </small>
        </div>
        
        <div class="novelai-prompter-section">
          <label class="novelai-prompter-label">Scene Description</label>
          <textarea 
            class="novelai-prompter-textarea" 
            id="prompter-scene"
            placeholder="Describe the scene you want to generate..."
            required
          ></textarea>
          <button class="novelai-prompter-use-tags-btn" id="prompter-use-active-tags" style="display: none;">
            📌 Use Active Tags from Gallery
          </button>
        </div>
        
        <div class="novelai-prompter-section">
          <label class="novelai-prompter-label">Negative Prompt (optional)</label>
          <textarea 
            class="novelai-prompter-textarea" 
            id="prompter-negative"
            placeholder="Tags to avoid (e.g., lowres, bad anatomy, blurry)..."
            style="min-height: 60px;"
          ></textarea>
        </div>
        
        <button class="novelai-prompter-generate-btn" id="prompter-generate">
          Generate Prompt
        </button>
        
        <div id="prompter-result" style="display: none;"></div>
        
        <div id="prompter-image-result" style="display: none;"></div>
      </div>
    </div>
  `;
}

// Initialize prompter
export async function initNovelAIPrompter(artists = [], kinkTags = [], kinkTagsByCategory = []) {
  if (prompterElement) return;
  
  console.log('[NovelAI Prompter] Initializing...');
  
  // Store references
  allArtists = Array.isArray(artists) ? artists : [];
  allKinkTags = Array.isArray(kinkTags) ? kinkTags : [];
  kinkTagsByCategory = Array.isArray(kinkTagsByCategory) ? kinkTagsByCategory : [];
  
  // Load config
  loadConfig();
  loadAPIKey();
  loadNovelAIKey();
  loadImageGenSettings();
  
  // Create element
  const html = createPrompterElement();
  const temp = document.createElement('div');
  temp.innerHTML = html;
  prompterElement = temp.firstElementChild;
  document.body.appendChild(prompterElement);
  
  // Setup event listeners
  const minimizeBtn = prompterElement.querySelector('#prompter-minimize');
  const settingsBtn = prompterElement.querySelector('#prompter-settings');
  const generateBtn = prompterElement.querySelector('#prompter-generate');
  const characterInput = prompterElement.querySelector('#prompter-character');
  const sceneInput = prompterElement.querySelector('#prompter-scene');
  const negativeInput = prompterElement.querySelector('#prompter-negative');
  const useActiveTagsBtn = prompterElement.querySelector('#prompter-use-active-tags');
  const resultDiv = prompterElement.querySelector('#prompter-result');
  const imageResultDiv = prompterElement.querySelector('#prompter-image-result');
  
  // Show "Use Active Tags" button if callback is available
  if (getActiveTagsCallback) {
    useActiveTagsBtn.style.display = 'block';
    useActiveTagsBtn.addEventListener('click', () => {
      const activeTags = Array.from(getActiveTagsCallback());
      if (activeTags.length > 0) {
        const tagsText = activeTags.join(', ');
        sceneInput.value = sceneInput.value 
          ? `${sceneInput.value}, ${tagsText}`
          : tagsText;
      }
    });
  }
  
  // Settings modal
  settingsBtn.addEventListener('click', () => {
    showSettingsModal();
  });
  
  minimizeBtn.addEventListener('click', () => {
    isMinimized = !isMinimized;
    prompterElement.classList.toggle('minimized', isMinimized);
    minimizeBtn.textContent = isMinimized ? '+' : '−';
  });
  
  generateBtn.addEventListener('click', async () => {
    const character = characterInput.value.trim();
    const scene = sceneInput.value.trim();
    
    if (!scene) {
      alert('Please enter a scene description');
      return;
    }
    
    if (!apiKey) {
      alert('OpenRouter API key not configured. Please set it in settings.');
      return;
    }
    
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
    resultDiv.style.display = 'none';
    
    try {
      const result = await generatePrompt(scene, character);
      
      // Display result
      resultDiv.innerHTML = `
        <div class="novelai-prompter-result">
          <div class="novelai-prompter-section">
            <label class="novelai-prompter-label">Generated Positive Prompt</label>
            <div class="novelai-prompter-prompt">${result.prompt}</div>
            <button class="novelai-prompter-copy-btn" onclick="navigator.clipboard.writeText('${result.prompt.replace(/'/g, "\\'")}')">
              Copy Positive Prompt
            </button>
          </div>
          
          ${result.negativePrompt ? `
            <div class="novelai-prompter-section">
              <label class="novelai-prompter-label">Suggested Negative Prompt</label>
              <div class="novelai-prompter-prompt" style="background: oklch(15% 0.02 260); color: oklch(70% 0.25 25);">
                ${result.negativePrompt}
              </div>
              <button class="novelai-prompter-copy-btn" onclick="
                const negativeInput = document.getElementById('prompter-negative');
                negativeInput.value = '${result.negativePrompt.replace(/'/g, "\\'")}';
                navigator.clipboard.writeText('${result.negativePrompt.replace(/'/g, "\\'")}');
              ">
                Use as Negative Prompt
              </button>
            </div>
          ` : ''}
          
          ${result.characterPrompt ? `
            <div class="novelai-prompter-section">
              <label class="novelai-prompter-label">Character Prompt</label>
              <div class="novelai-prompter-prompt" style="background: oklch(15% 0.02 260); color: oklch(70% 0.14 205);">
                ${result.characterPrompt}
              </div>
              <small style="color: oklch(60% 0.05 260); font-size: 11px; display: block; margin-top: 4px;">
                ${result.characterPrompt.toLowerCase().includes('novelai decide') 
                  ? 'NovelAI will automatically position characters' 
                  : 'Character positions specified'}
              </small>
            </div>
          ` : ''}
          
          <div class="novelai-prompter-section">
            ${novelaiApiKey ? `
              <button class="novelai-prompter-generate-image-btn" id="prompter-generate-image" style="width: 100%;">
                🎨 Generate Image (Free)
              </button>
            ` : ''}
          </div>
          
          ${result.artistMatches.length > 0 ? `
            <div class="novelai-prompter-section">
              <label class="novelai-prompter-label">Suggested Artists</label>
              <div class="novelai-prompter-artists">
                ${result.artistMatches.map(match => `
                  <div class="novelai-prompter-artist">
                    <span class="novelai-prompter-artist-name">${match.artist.artistName.replace(/_/g, ' ')}</span>
                    <span class="novelai-prompter-artist-match">${match.matchCount} tags match</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;
      
      resultDiv.style.display = 'block';
      
      // Setup image generation button if NovelAI key is available
      if (novelaiApiKey) {
        const generateImageBtn = resultDiv.querySelector('#prompter-generate-image');
        if (generateImageBtn) {
          generateImageBtn.addEventListener('click', async () => {
            generateImageBtn.disabled = true;
            generateImageBtn.textContent = 'Generating Image...';
            imageResultDiv.style.display = 'none';
            imageResultDiv.innerHTML = '<div class="novelai-prompter-loading">Generating image (this may take 30-60 seconds)...</div>';
            imageResultDiv.style.display = 'block';
            
            try {
              // Use AI-suggested negative prompt if available, otherwise use input or default
              const negativePrompt = negativeInput.value.trim() || result.negativePrompt || imageGenSettings.negativePrompt;
              const numSamples = imageGenSettings.samples || 1;
              
              // Generate multiple images if samples > 1
              if (numSamples > 1) {
                imageResultDiv.innerHTML = '<div class="novelai-prompter-loading">Generating ' + numSamples + ' images...</div>';
                const images = [];
                for (let i = 0; i < numSamples; i++) {
                  const imageData = await generateNovelAIImage(result.prompt, negativePrompt, { seed: Math.floor(Math.random() * 4294967295) });
                  images.push(imageData);
                }
                
                imageResultDiv.innerHTML = `
                  <div class="novelai-prompter-section">
                    <label class="novelai-prompter-label">Generated Images (${numSamples})</label>
                    ${images.map((imgData, idx) => `
                      <div class="novelai-prompter-image-container" style="margin-bottom: 12px;">
                        <img src="${imgData}" alt="Generated image ${idx + 1}" class="novelai-prompter-image" />
                        <button class="novelai-prompter-copy-btn" onclick="
                          const img = this.previousElementSibling;
                          const canvas = document.createElement('canvas');
                          const ctx = canvas.getContext('2d');
                          canvas.width = img.naturalWidth;
                          canvas.height = img.naturalHeight;
                          ctx.drawImage(img, 0, 0);
                          canvas.toBlob(blob => {
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'novelai-generated-${idx + 1}.png';
                            a.click();
                            URL.revokeObjectURL(url);
                          });
                        ">
                          Download Image ${idx + 1}
                        </button>
                      </div>
                    `).join('')}
                  </div>
                `;
              } else {
                const imageData = await generateNovelAIImage(result.prompt, negativePrompt);
                imageResultDiv.innerHTML = `
                  <div class="novelai-prompter-section">
                    <label class="novelai-prompter-label">Generated Image</label>
                    <div class="novelai-prompter-image-container">
                      <img src="${imageData}" alt="Generated image" class="novelai-prompter-image" />
                      <button class="novelai-prompter-copy-btn" onclick="
                        const img = this.previousElementSibling;
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                        ctx.drawImage(img, 0, 0);
                        canvas.toBlob(blob => {
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = 'novelai-generated.png';
                          a.click();
                          URL.revokeObjectURL(url);
                        });
                      ">
                        Download Image
                      </button>
                    </div>
                  </div>
                `;
              }
            } catch (error) {
              imageResultDiv.innerHTML = `
                <div class="novelai-prompter-error">
                  Image Generation Error: ${error.message}
                </div>
              `;
            } finally {
              generateImageBtn.disabled = false;
              generateImageBtn.textContent = '🎨 Generate Image (Free)';
            }
          });
        }
      }
    } catch (error) {
      resultDiv.innerHTML = `
        <div class="novelai-prompter-error">
          Error: ${error.message}
        </div>
      `;
      resultDiv.style.display = 'block';
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate Prompt';
    }
  });
  
  console.log('[NovelAI Prompter] Initialized');
}

// Set artists (called from gallery)
export function setPrompterArtists(artists) {
  allArtists = Array.isArray(artists) ? artists : [];
}

// Set kink tags (called from tags module)
export function setPrompterKinkTags(tags, byCategory = []) {
  allKinkTags = Array.isArray(tags) ? tags : [];
  kinkTagsByCategory = Array.isArray(byCategory) ? byCategory : [];
}

// Set callback to get active tags from gallery
export function setGetActiveTagsCallback(callback) {
  getActiveTagsCallback = callback;
}

// Show settings modal
function showSettingsModal() {
  const modal = document.createElement('div');
  modal.className = 'novelai-prompter-modal';
  modal.innerHTML = `
      <div class="novelai-prompter-modal-content">
        <div class="novelai-prompter-modal-header">
          <div class="novelai-prompter-modal-title">Image Generation Settings</div>
          <button class="novelai-prompter-btn" onclick="this.closest('.novelai-prompter-modal').remove()">×</button>
        </div>
        
        <div class="novelai-prompter-section">
          <div class="novelai-prompter-settings-row full">
            <div>
              <label class="novelai-prompter-label">Resolution Preset</label>
              <select class="novelai-prompter-input" id="setting-preset" onchange="
                const preset = this.value;
                const presets = {
                  'portrait': {width: 832, height: 1216},
                  'landscape': {width: 1216, height: 832},
                  'square': {width: 1024, height: 1024},
                  'wide': {width: 1344, height: 832},
                  'tall': {width: 832, height: 1344},
                  'hd-portrait': {width: 1024, height: 1536},
                  'hd-landscape': {width: 1536, height: 1024},
                  'ultra-wide': {width: 1920, height: 1088},
                  'custom': null
                };
                if (presets[preset]) {
                  document.getElementById('setting-width').value = presets[preset].width;
                  document.getElementById('setting-height').value = presets[preset].height;
                }
              ">
                <option value="custom">Custom</option>
                <option value="portrait" ${imageGenSettings.width === 832 && imageGenSettings.height === 1216 ? 'selected' : ''}>Portrait (832×1216)</option>
                <option value="landscape" ${imageGenSettings.width === 1216 && imageGenSettings.height === 832 ? 'selected' : ''}>Landscape (1216×832)</option>
                <option value="square" ${imageGenSettings.width === 1024 && imageGenSettings.height === 1024 ? 'selected' : ''}>Square (1024×1024)</option>
                <option value="wide" ${imageGenSettings.width === 1344 && imageGenSettings.height === 832 ? 'selected' : ''}>Wide (1344×832)</option>
                <option value="tall" ${imageGenSettings.width === 832 && imageGenSettings.height === 1344 ? 'selected' : ''}>Tall (832×1344)</option>
                <option value="hd-portrait" ${imageGenSettings.width === 1024 && imageGenSettings.height === 1536 ? 'selected' : ''}>HD Portrait (1024×1536)</option>
                <option value="hd-landscape" ${imageGenSettings.width === 1536 && imageGenSettings.height === 1024 ? 'selected' : ''}>HD Landscape (1536×1024)</option>
                <option value="ultra-wide" ${imageGenSettings.width === 1920 && imageGenSettings.height === 1088 ? 'selected' : ''}>Ultra Wide (1920×1088)</option>
              </select>
            </div>
          </div>
          
          <div class="novelai-prompter-settings-row">
            <div>
              <label class="novelai-prompter-label">Width</label>
              <input type="number" class="novelai-prompter-input" id="setting-width" 
                     value="${imageGenSettings.width}" min="256" max="2048" step="64">
            </div>
            <div>
              <label class="novelai-prompter-label">Height</label>
              <input type="number" class="novelai-prompter-input" id="setting-height" 
                     value="${imageGenSettings.height}" min="256" max="2048" step="64">
            </div>
          </div>
          
          <div class="novelai-prompter-settings-row">
            <div>
              <label class="novelai-prompter-label">Steps (1-50)</label>
              <input type="number" class="novelai-prompter-input" id="setting-steps" 
                     value="${imageGenSettings.steps}" min="1" max="50" step="1">
              <small style="color: oklch(60% 0.05 260); font-size: 11px;">More steps = better quality, slower</small>
            </div>
            <div>
              <label class="novelai-prompter-label">Guidance Scale (1-20)</label>
              <input type="number" class="novelai-prompter-input" id="setting-scale" 
                     value="${imageGenSettings.scale}" min="1" max="20" step="0.5">
              <small style="color: oklch(60% 0.05 260); font-size: 11px;">Higher = follows prompt more closely</small>
            </div>
          </div>
          
          <div class="novelai-prompter-settings-row">
            <div>
              <label class="novelai-prompter-label">Sampler</label>
              <select class="novelai-prompter-input" id="setting-sampler">
                <option value="k_euler_ancestral" ${imageGenSettings.sampler === 'k_euler_ancestral' ? 'selected' : ''}>k_euler_ancestral (Recommended)</option>
                <option value="k_euler" ${imageGenSettings.sampler === 'k_euler' ? 'selected' : ''}>k_euler</option>
                <option value="k_lms" ${imageGenSettings.sampler === 'k_lms' ? 'selected' : ''}>k_lms</option>
                <option value="plms" ${imageGenSettings.sampler === 'plms' ? 'selected' : ''}>plms</option>
                <option value="ddim" ${imageGenSettings.sampler === 'ddim' ? 'selected' : ''}>ddim</option>
              </select>
            </div>
            <div>
              <label class="novelai-prompter-label">Samples (1-4)</label>
              <input type="number" class="novelai-prompter-input" id="setting-samples" 
                     value="${imageGenSettings.samples || 1}" min="1" max="4" step="1">
              <small style="color: oklch(60% 0.05 260); font-size: 11px;">Number of images to generate</small>
            </div>
          </div>
          
          <div class="novelai-prompter-settings-row full">
            <div>
              <label class="novelai-prompter-label">Default Negative Prompt</label>
              <textarea class="novelai-prompter-textarea" id="setting-negative" 
                        style="min-height: 60px;" placeholder="lowres, bad anatomy, blurry, worst quality">${imageGenSettings.negativePrompt}</textarea>
            </div>
          </div>
          
          <button class="novelai-prompter-generate-btn" style="margin-top: 16px;" onclick="
            const width = parseInt(document.getElementById('setting-width').value);
            const height = parseInt(document.getElementById('setting-height').value);
            const steps = parseInt(document.getElementById('setting-steps').value);
            const scale = parseFloat(document.getElementById('setting-scale').value);
            const sampler = document.getElementById('setting-sampler').value;
            const samples = parseInt(document.getElementById('setting-samples').value) || 1;
            const negative = document.getElementById('setting-negative').value;
            
            if (width && height && steps && scale && samples) {
              window._prompterSaveSettings({
                width, height, steps, scale, sampler, samples, negativePrompt: negative
              });
              this.closest('.novelai-prompter-modal').remove();
            } else {
              alert('Please fill in all required fields');
            }
          ">
            Save Settings
          </button>
        </div>
      </div>
  `;
  
  // Save settings function
  window._prompterSaveSettings = (settings) => {
    imageGenSettings = { ...imageGenSettings, ...settings };
    try {
      localStorage.setItem('tagexplorer:novelai-image-settings', JSON.stringify(imageGenSettings));
    } catch (e) {
      console.warn('[NovelAI Prompter] Failed to save settings:', e);
    }
    // Update negative prompt input if empty
    if (!negativeInput.value.trim() && imageGenSettings.negativePrompt) {
      negativeInput.value = imageGenSettings.negativePrompt;
    }
  };
  
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

// Load image generation settings
function loadImageGenSettings() {
  try {
    const stored = localStorage.getItem('tagexplorer:novelai-image-settings');
    if (stored) {
      const parsed = JSON.parse(stored);
      imageGenSettings = { ...imageGenSettings, ...parsed };
    }
  } catch (e) {
    console.warn('[NovelAI Prompter] Failed to load image settings:', e);
  }
}

