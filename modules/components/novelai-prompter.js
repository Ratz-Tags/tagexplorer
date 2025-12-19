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
  const systemPrompt = `You are an expert prompt engineer for NovelAI v4.5 Full. Your task is to create optimized prompts using ONLY valid Danbooru tags.

Rules:
1. Use ONLY valid Danbooru tags (lowercase, underscores, no spaces)
2. Format: comma-separated tags, no special characters except underscores
3. Order: character tags first, then scene/action tags, then quality/style tags
4. Include relevant kink tags if mentioned in the description
5. Keep prompts concise but descriptive (50-150 tags max)
6. Use proper tag hierarchy (e.g., "1girl" before specific character details)

Valid tag examples: "1girl", "solo", "breasts", "nude", "standing", "smile", "long_hair"

Invalid: "long hair" (use "long_hair"), "1 girl" (use "1girl"), "smiling!" (use "smile")

Generate a prompt that accurately represents the scene and characters described.`;

  const userPrompt = `Scene Description:
${fullDescription}

${extractedTags.length > 0 ? `\nDetected relevant tags: ${extractedTags.slice(0, 20).join(', ')}` : ''}

Generate a NovelAI v4.5 Full prompt using ONLY valid Danbooru tags.`;

  try {
    const response = await callOpenRouter([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
    
    // Extract just the tag list (remove any explanatory text)
    const tagMatch = response.match(/(?:^|\n)([a-z0-9_(),\s]+)(?:\n|$)/i);
    const promptTags = tagMatch 
      ? tagMatch[1].split(',').map(t => normalizeTag(t.trim())).filter(Boolean)
      : response.split(',').map(t => normalizeTag(t.trim())).filter(Boolean);
    
    return {
      prompt: promptTags.join(', '),
      tags: promptTags,
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
async function generateNovelAIImage(prompt, options = {}) {
  if (!novelaiApiKey) {
    throw new Error('NovelAI API key not configured');
  }
  
  // Free tier settings - no anlas usage
  const payload = {
    input: prompt,
    model: PROMPTER_CONFIG.novelaiModel,
    action: 'generate',
    parameters: {
      width: options.width || 512,
      height: options.height || 768,
      scale: options.scale || 7,
      sampler: options.sampler || 'k_euler_ancestral',
      steps: options.steps || 28,
      seed: options.seed || Math.floor(Math.random() * 4294967295),
      n_samples: 1,
      sm: false, // No smearing
      sm_dyn: false,
      decrisper: false,
      controlnet_strength: 1.0,
      legacy: false,
      add_original_image: false,
      // Free tier: no anlas usage
      payment: null, // Explicitly set to null to avoid anlas usage
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
            placeholder="Describe the character(s)..."
          ></textarea>
        </div>
        
        <div class="novelai-prompter-section">
          <label class="novelai-prompter-label">Scene Description</label>
          <textarea 
            class="novelai-prompter-textarea" 
            id="prompter-scene"
            placeholder="Describe the scene you want to generate..."
            required
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
  
  // Create element
  const html = createPrompterElement();
  const temp = document.createElement('div');
  temp.innerHTML = html;
  prompterElement = temp.firstElementChild;
  document.body.appendChild(prompterElement);
  
  // Setup event listeners
  const minimizeBtn = prompterElement.querySelector('#prompter-minimize');
  const generateBtn = prompterElement.querySelector('#prompter-generate');
  const characterInput = prompterElement.querySelector('#prompter-character');
  const sceneInput = prompterElement.querySelector('#prompter-scene');
  const resultDiv = prompterElement.querySelector('#prompter-result');
  const imageResultDiv = prompterElement.querySelector('#prompter-image-result');
  
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
            <label class="novelai-prompter-label">Generated Prompt</label>
            <div class="novelai-prompter-prompt">${result.prompt}</div>
            <button class="novelai-prompter-copy-btn" onclick="navigator.clipboard.writeText('${result.prompt.replace(/'/g, "\\'")}')">
              Copy Prompt
            </button>
            ${novelaiApiKey ? `
              <button class="novelai-prompter-generate-image-btn" id="prompter-generate-image" style="margin-top: 8px;">
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
              const imageData = await generateNovelAIImage(result.prompt);
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

