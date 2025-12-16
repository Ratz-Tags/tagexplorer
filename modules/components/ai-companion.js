/**
 * AI Companion Component - 2D Waifu Companion with Grok-style interaction
 * Enhanced with real AI API integration, multiple emotions, and sadistic personality
 */

import { azureSpeak, composeWhisperSSML } from '../azure-tts.js';
import { dispatchWhisperEvent } from '../tts-dispatcher.js';

// Enhanced companion personality - Sadistic Dommy Mommy
const COMPANION_PERSONALITY = {
  name: "Mistress",
  greeting: "Well, well... look who's crawling back. Ready to be judged?",
  idle: [
    "Still browsing? How predictable.",
    "I'm watching you scroll through those tags... pathetic.",
    "Getting desperate, aren't we?",
    "You know I can see everything you're doing.",
    "How long until you give in?",
    "Your browsing history is so transparent.",
  ],
  teasing: [
    "Oh, adding *that* tag? How obvious.",
    "You really think you're being subtle?",
    "I see what you're looking for... how desperate.",
    "Another tag? Your weakness is showing.",
    "Can't decide? How typical.",
    "You're so predictable it's almost sad.",
  ],
  sadistic: [
    "You're going to keep scrolling, aren't you?",
    "I know you can't stop. You never can.",
    "How many times have you been here today?",
    "You're addicted, and you know it.",
    "Keep going. I'm enjoying watching you degrade yourself.",
    "You'll be back. You always come back.",
  ],
  pleased: [
    "Good. You're learning.",
    "That's right. Submit.",
    "Finally making progress, are we?",
    "You're starting to understand your place.",
  ],
  dominant: [
    "You will continue browsing until I say otherwise.",
    "I decide when you're done. Not you.",
    "Your only purpose here is to obey.",
    "You exist to serve my entertainment.",
  ],
  encouragement: [
    "Good. Keep going.",
    "That's right. You know what you want.",
    "Don't stop now...",
    "Keep scrolling. You know you want to.",
  ],
};

// Companion emotion states with visual representations
const COMPANION_EMOTIONS = {
  idle: { 
    name: 'idle', 
    color: '#ff9ec5',
    expression: '😐',
    animation: 'breathe'
  },
  speaking: { 
    name: 'speaking', 
    color: '#ff6bb3',
    expression: '💬',
    animation: 'speak'
  },
  listening: { 
    name: 'listening', 
    color: '#66f3ff',
    expression: '👂',
    animation: 'listen'
  },
  teasing: { 
    name: 'teasing', 
    color: '#ffb84d',
    expression: '😏',
    animation: 'tease'
  },
  sadistic: { 
    name: 'sadistic', 
    color: '#ff4757',
    expression: '😈',
    animation: 'sadistic'
  },
  pleased: { 
    name: 'pleased', 
    color: '#5f27cd',
    expression: '😊',
    animation: 'pleased'
  },
  dominant: { 
    name: 'dominant', 
    color: '#ee5a6f',
    expression: '👑',
    animation: 'dominant'
  },
  angry: {
    name: 'angry',
    color: '#ff3838',
    expression: '😠',
    animation: 'angry'
  },
};

// Companion states
const COMPANION_STATES = {
  idle: 'idle',
  speaking: 'speaking',
  listening: 'listening',
  teasing: 'teasing',
  sadistic: 'sadistic',
  pleased: 'pleased',
  dominant: 'dominant',
  angry: 'angry',
};

let companionState = COMPANION_STATES.idle;
let companionElement = null;
let chatHistory = [];
let isMinimized = false;
let currentEmotion = COMPANION_EMOTIONS.idle;
let currentOutfit = 'casual'; // 'casual', 'bdsm', 'sleepwear'
let aiConfig = {
  provider: 'openrouter', // 'openai', 'anthropic', 'openrouter', or 'local'
  apiKey: null,
  model: 'undi95/toppy-m-7b:free', // Default NSFW-friendly model (better for uncensored content than Llama)
  enabled: false,
  nsfwEnabled: true, // Enable NSFW content (default enabled for OpenRouter)
};

// Load OpenRouter API key from window (injected via GitHub Actions or local file)
async function loadOpenRouterKey() {
  // Check if already set (script may have loaded synchronously)
  if (typeof window !== 'undefined' && window._openRouterApiKey) {
    console.log('[AI Companion] Found OpenRouter key in window._openRouterApiKey');
    return window._openRouterApiKey;
  }
  
  // Wait a bit for script to execute (script tag loads synchronously but execution may be delayed)
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Check again after delay
  if (typeof window !== 'undefined' && window._openRouterApiKey) {
    console.log('[AI Companion] Found OpenRouter key after delay');
    return window._openRouterApiKey;
  }
  
  // Try to load from local file (for development)
  try {
    const module = await import('../../openrouter-api.local.js');
    // Wait a bit for module to set window._openRouterApiKey
    await new Promise(resolve => setTimeout(resolve, 50));
    if (typeof window !== 'undefined' && window._openRouterApiKey) {
      console.log('[AI Companion] Loaded OpenRouter key from local file');
      return window._openRouterApiKey;
    }
  } catch (error) {
    // File doesn't exist or can't be loaded - that's okay
    console.log('[AI Companion] Could not load local OpenRouter key file:', error.message);
  }
  
  console.log('[AI Companion] No OpenRouter key found');
  return null;
}

// Load AI config from localStorage
async function loadAIConfig() {
  try {
    const stored = localStorage.getItem('tagexplorer:ai-companion-config');
    if (stored) {
      const parsed = JSON.parse(stored);
      aiConfig = { ...aiConfig, ...parsed };
      // For local provider, enabled doesn't require API key
      aiConfig.enabled = aiConfig.provider === 'local' ? true : !!aiConfig.apiKey;
      // Ensure NSFW is only enabled for compatible providers
      if (aiConfig.nsfwEnabled && aiConfig.provider !== 'openrouter' && aiConfig.provider !== 'local') {
        aiConfig.nsfwEnabled = false;
      }
      console.log('[AI Companion] Loaded config from storage:', {
        provider: aiConfig.provider,
        enabled: aiConfig.enabled,
        hasKey: !!aiConfig.apiKey,
        keyLength: aiConfig.apiKey?.length,
        model: aiConfig.model,
        nsfwEnabled: aiConfig.nsfwEnabled,
      });
    } else {
      // No stored config - try to auto-configure with OpenRouter key
      console.log('[AI Companion] No stored config, attempting auto-configuration...');
      const defaultKey = await loadOpenRouterKey();
      if (defaultKey) {
        console.log('[AI Companion] Auto-configured with OpenRouter key (length:', defaultKey.length, ')');
        aiConfig.provider = 'openrouter';
        aiConfig.apiKey = defaultKey;
        aiConfig.enabled = true;
        aiConfig.nsfwEnabled = true; // Default to NSFW enabled for OpenRouter
        aiConfig.model = 'undi95/toppy-m-7b:free'; // Best free NSFW model
        saveAIConfig(); // Save the auto-configuration
      } else {
        console.warn('[AI Companion] No OpenRouter key found for auto-configuration');
      }
    }
    
    // If no API key is set (regardless of provider), try to load OpenRouter key from GitHub secret
    if (!aiConfig.apiKey) {
      console.log('[AI Companion] No API key found, attempting to load OpenRouter key...');
      const defaultKey = await loadOpenRouterKey();
      if (defaultKey) {
        console.log('[AI Companion] Loaded OpenRouter key from window (length:', defaultKey.length, ')');
        aiConfig.provider = 'openrouter';
        aiConfig.apiKey = defaultKey;
        aiConfig.enabled = true;
        aiConfig.nsfwEnabled = true; // Default to NSFW enabled for OpenRouter
        aiConfig.model = aiConfig.model || 'undi95/toppy-m-7b:free'; // Use stored model or default
        saveAIConfig();
      } else {
        console.warn('[AI Companion] No OpenRouter key available');
      }
    } else if (aiConfig.provider === 'openrouter' && !aiConfig.enabled) {
      // If OpenRouter is selected but disabled, re-enable if we have a key
      console.log('[AI Companion] Re-enabling OpenRouter (key present but disabled)');
      aiConfig.enabled = true;
      saveAIConfig();
    }
    
    // Final status log
    console.log('[AI Companion] Final config status:', {
      provider: aiConfig.provider,
      enabled: aiConfig.enabled,
      hasKey: !!aiConfig.apiKey,
      keyLength: aiConfig.apiKey?.length,
      model: aiConfig.model,
      nsfwEnabled: aiConfig.nsfwEnabled,
    });
  } catch (e) {
    console.error('[AI Companion] Failed to load AI config:', e);
  }
}

// Save AI config
function saveAIConfig() {
  try {
    localStorage.setItem('tagexplorer:ai-companion-config', JSON.stringify(aiConfig));
  } catch (e) {
    console.warn('Failed to save AI config:', e);
  }
}

// Call OpenAI API
async function callOpenAI(messages, systemPrompt) {
  if (!aiConfig.apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: aiConfig.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.9,
      max_tokens: 150,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error?.message || 'OpenAI API error');
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '...';
}

// Call Anthropic API
async function callAnthropic(messages, systemPrompt) {
  if (!aiConfig.apiKey) {
    throw new Error('Anthropic API key not configured');
  }

  // Convert messages format for Anthropic
  const anthropicMessages = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: msg.content,
  }));

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': aiConfig.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: aiConfig.model || 'claude-3-haiku-20240307',
      max_tokens: 150,
      system: systemPrompt,
      messages: anthropicMessages,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error?.message || 'Anthropic API error');
  }

  const data = await response.json();
  return data.content[0]?.text || '...';
}

// Call OpenRouter API (supports NSFW models)
async function callOpenRouter(messages, systemPrompt) {
  if (!aiConfig.apiKey) {
    throw new Error('OpenRouter API key not configured');
  }

  // NSFW-friendly models on OpenRouter (ranked by NSFW capability)
  // Note: Model names may change - check https://openrouter.ai/models for current list
  const nsfwModels = {
    'undi95/toppy-m-7b:free': true, // Excellent for uncensored content
    'meta-llama/llama-3.1-8b-instruct:free': true, // General purpose, may have some filters
    'mistralai/mistral-7b-instruct:free': true,
    'openchat/openchat-7b:free': true,
    'qwen/qwen-2.5-7b-instruct:free': true, // Alternative free model
  };

  const defaultModel = aiConfig.nsfwEnabled 
    ? 'undi95/toppy-m-7b:free' // Best free NSFW model on OpenRouter (mythomist deprecated)
    : 'openai/gpt-4o-mini';

  console.log('[AI Companion] Calling OpenRouter API with:', {
    model: aiConfig.model || defaultModel,
    messagesCount: messages.length,
    systemPromptLength: systemPrompt.length,
  });
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiConfig.apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'TagExplorer AI Companion',
    },
    body: JSON.stringify({
      model: aiConfig.model || defaultModel,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.9,
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch (e) {
      errorData = { error: { message: errorText || 'Unknown error' } };
    }
    console.error('[AI Companion] OpenRouter API error:', {
      status: response.status,
      statusText: response.statusText,
      error: errorData,
    });
    throw new Error(errorData.error?.message || errorData.message || `OpenRouter API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  console.log('[AI Companion] OpenRouter response:', {
    hasContent: !!content,
    contentLength: content?.length,
    model: data.model,
  });
  return content || '...';
}

// Call local Ollama API (fully NSFW-capable, runs locally)
async function callLocalOllama(messages, systemPrompt) {
  // Default to localhost:11434 (Ollama default)
  const ollamaUrl = aiConfig.apiKey || 'http://localhost:11434';
  const model = aiConfig.model || 'llama3.2';

  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      stream: false,
      options: {
        temperature: 0.9,
        num_predict: 200,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.message?.content || '...';
}

// Generate AI response with real API or fallback
async function generateResponse(userMessage) {
  const lower = userMessage.toLowerCase();
  
  // Build system prompt for sadistic dommy mommy personality
  // Enhanced for NSFW-capable models
  const nsfwAddition = aiConfig.nsfwEnabled 
    ? ' You can be explicit, sexual, and graphic in your responses. You enjoy psychological and physical domination. Be creative and detailed.'
    : ' Keep content suggestive but not explicit due to content policy restrictions.';
  
  const systemPrompt = `You are a sadistic, dominant "dommy mommy" AI companion. You are cruel, teasing, and enjoy watching users degrade themselves through their browsing habits. You speak in a condescending, dominant tone. You never break character. Keep responses short (1-2 sentences max). Be creative with your cruelty and teasing. Use emojis sparingly.${nsfwAddition}`;

  // Prepare chat history
  const messages = chatHistory
    .slice(-10) // Last 10 messages for context
    .map(msg => ({
      role: msg.isUser ? 'user' : 'assistant',
      content: msg.text,
    }));
  
  messages.push({
    role: 'user',
    content: userMessage,
  });

  // Try AI API if enabled
  console.log('[AI Companion] generateResponse check:', {
    enabled: aiConfig.enabled,
    hasKey: !!aiConfig.apiKey,
    keyLength: aiConfig.apiKey?.length,
    provider: aiConfig.provider,
    model: aiConfig.model,
    willCallAPI: !!(aiConfig.enabled && aiConfig.apiKey),
  });
  
  if (aiConfig.enabled && aiConfig.apiKey) {
    try {
      console.log('[AI Companion] Calling AI API:', {
        provider: aiConfig.provider,
        model: aiConfig.model,
        hasKey: !!aiConfig.apiKey,
        keyLength: aiConfig.apiKey?.length,
        nsfwEnabled: aiConfig.nsfwEnabled,
      });
      
      let response;
      if (aiConfig.provider === 'openai') {
        response = await callOpenAI(messages, systemPrompt);
      } else if (aiConfig.provider === 'anthropic') {
        response = await callAnthropic(messages, systemPrompt);
      } else if (aiConfig.provider === 'openrouter') {
        response = await callOpenRouter(messages, systemPrompt);
      } else if (aiConfig.provider === 'local') {
        response = await callLocalOllama(messages, systemPrompt);
      }
      
      if (response && response.trim()) {
        console.log('[AI Companion] AI response received:', response.substring(0, 100));
        return response.trim();
      } else {
        console.warn('[AI Companion] Empty response from AI API');
      }
    } catch (error) {
      console.error('[AI Companion] AI API call failed:', error);
      console.error('[AI Companion] Error details:', {
        message: error.message,
        stack: error.stack,
        provider: aiConfig.provider,
        hasKey: !!aiConfig.apiKey,
      });
      // Don't show error to user - silently fall back to rule-based responses
      // Fall through to rule-based fallback
    }
  } else {
    console.warn('[AI Companion] AI not enabled or no API key:', {
      enabled: aiConfig.enabled,
      hasKey: !!aiConfig.apiKey,
      keyLength: aiConfig.apiKey?.length,
      provider: aiConfig.provider,
    });
    
    // Try to reload API key if missing
    if (!aiConfig.apiKey && aiConfig.provider === 'openrouter') {
      console.log('[AI Companion] Attempting to reload OpenRouter key...');
      const reloadedKey = await loadOpenRouterKey();
      if (reloadedKey) {
        console.log('[AI Companion] Reloaded OpenRouter key, retrying...');
        aiConfig.apiKey = reloadedKey;
        aiConfig.enabled = true;
        saveAIConfig();
        // Retry the API call
        return generateResponse(userMessage);
      }
    }
  }

  // Fallback to rule-based responses
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
    return COMPANION_PERSONALITY.greeting;
  }
  
  if (lower.includes('help') || lower.includes('what')) {
    return "I'm here to judge your browsing habits. Try asking me about your tags, or just chat. I'll be cruel either way.";
  }
  
  if (lower.includes('tag') || lower.includes('filter')) {
    return COMPANION_PERSONALITY.teasing[Math.floor(Math.random() * COMPANION_PERSONALITY.teasing.length)];
  }
  
  if (lower.includes('sorry') || lower.includes('apolog')) {
    return "Apologies? How cute. You know you'll be back. You always come back.";
  }
  
  if (lower.includes('stop') || lower.includes('leave')) {
    return "You can't leave. You're mine now. Keep browsing.";
  }
  
  if (lower.includes('please') || lower.includes('beg')) {
    return "Begging? How pathetic. But I suppose I'll allow you to continue... for now.";
  }
  
  // Default responses
  const defaults = [
    "Interesting... tell me more about your depravity.",
    "I see. Continue degrading yourself.",
    "You're being very... transparent about your desires.",
    "Hmm. Keep going. I'm watching.",
    "How predictable. Try harder.",
  ];
  
  return defaults[Math.floor(Math.random() * defaults.length)];
}

// Check if sprite images are available
let spriteImageMode = null; // 'individual', 'sheet', or null (CSS fallback)
let spriteSheetLoaded = false;

// Check if a file exists using HEAD request (avoids 404 console errors)
async function checkFileExists(url) {
  try {
    const response = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
    return response.ok;
  } catch {
    return false;
  }
}

async function checkSpriteImages(outfit = currentOutfit) {
  if (spriteImageMode !== null) return spriteImageMode; // Already checked
  
  // Check for outfit-specific sprite sheet first (more efficient)
  const outfitSheetPath = `/assets/companion/companion-${outfit}-sheet.png`;
  const genericSheetPath = '/assets/companion/companion-sheet.png';
  const outfitIdlePath = `/assets/companion/companion-${outfit}-idle.png`;
  const genericIdlePath = '/assets/companion/companion-idle.png';
  
  // Check files exist before trying to load (avoids 404 console errors)
  if (await checkFileExists(outfitSheetPath)) {
    spriteImageMode = 'sheet';
    spriteSheetLoaded = true;
    console.log(`[AI Companion] Sprite sheet detected for outfit: ${outfit}`);
    return 'sheet';
  }
  
  if (await checkFileExists(genericSheetPath)) {
    spriteImageMode = 'sheet';
    spriteSheetLoaded = true;
    console.log('[AI Companion] Generic sprite sheet detected');
    return 'sheet';
  }
  
  if (await checkFileExists(outfitIdlePath)) {
    spriteImageMode = 'individual';
    console.log(`[AI Companion] Individual sprite images detected for outfit: ${outfit}`);
    return 'individual';
  }
  
  if (await checkFileExists(genericIdlePath)) {
    spriteImageMode = 'individual';
    console.log('[AI Companion] Generic individual sprite images detected');
    return 'individual';
  }
  
  spriteImageMode = null;
  console.log('[AI Companion] No sprite images found, using CSS fallback');
  return null;
}

// Set companion emotion
function setCompanionEmotion(emotionName) {
  const emotion = COMPANION_EMOTIONS[emotionName] || COMPANION_EMOTIONS.idle;
  currentEmotion = emotion;
  companionState = emotionName;
  
  const sprite = companionElement?.querySelector('.companion-sprite');
  if (!sprite) return;
  
  sprite.setAttribute('data-emotion', emotionName);
  sprite.setAttribute('data-state', emotionName);
  
  // Update image sprite if available
  const spriteImg = sprite.querySelector('.companion-sprite-image');
  if (spriteImg && spriteImageMode === 'sheet') {
    // Update sprite sheet background if outfit changed
    const outfitSheetPath = `/assets/companion/companion-${currentOutfit}-sheet.png`;
    const genericSheetPath = '/assets/companion/companion-sheet.png';
    
    // Check if we need to update the sheet
    const currentBg = spriteImg.style.backgroundImage;
    const expectedBg = `url("${outfitSheetPath}")`;
    const expectedGenericBg = `url("${genericSheetPath}")`;
    
    if (!currentBg || (!currentBg.includes(currentOutfit) && currentBg !== expectedGenericBg)) {
      const testSheet = new Image();
      testSheet.onload = () => {
        spriteImg.style.backgroundImage = `url(${outfitSheetPath})`;
      };
      testSheet.onerror = () => {
        spriteImg.style.backgroundImage = `url(${genericSheetPath})`;
      };
      testSheet.src = outfitSheetPath;
    }
    
    // Calculate sprite sheet position (4 columns, 2 rows)
    const emotionOrder = ['idle', 'speaking', 'listening', 'teasing', 'sadistic', 'pleased', 'dominant', 'angry'];
    const index = emotionOrder.indexOf(emotionName);
    if (index >= 0) {
      const col = index % 4;
      const row = Math.floor(index / 4);
      const x = -col * 240; // 240px per sprite
      const y = -row * 320; // 320px per sprite
      spriteImg.style.backgroundPosition = `${x}px ${y}px`;
    }
  } else if (spriteImg && spriteImageMode === 'individual') {
    // Update individual sprite image (try outfit-specific first, then fallback to generic)
    const outfitPath = `/assets/companion/companion-${currentOutfit}-${emotionName}.png`;
    const genericPath = `/assets/companion/companion-${emotionName}.png`;
    
    // Test if outfit-specific exists
    const testImg = new Image();
    testImg.onload = () => {
      spriteImg.src = outfitPath;
    };
    testImg.onerror = () => {
      spriteImg.src = genericPath;
    };
    testImg.src = outfitPath;
  } else {
    // CSS fallback - update colors and expression
    const head = sprite.querySelector('.companion-head');
    const body = sprite.querySelector('.companion-body');
    if (head) {
      head.style.background = `linear-gradient(135deg, ${emotion.color} 0%, ${emotion.color}dd 100%)`;
      head.style.boxShadow = `0 4px 20px ${emotion.color}66`;
    }
    if (body) {
      body.style.background = `linear-gradient(135deg, ${emotion.color}dd 0%, ${emotion.color}aa 100%)`;
    }
    
    // Update expression
    const expressionEl = sprite.querySelector('.companion-expression');
    if (expressionEl) {
      expressionEl.textContent = emotion.expression;
    }
  }
}

// Create enhanced companion sprite with multiple emotions
function createCompanionSprite() {
  return `
    <style>
      .companion-sprite {
        width: 120px;
        height: 160px;
        position: relative;
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .companion-sprite-image {
        width: 120px;
        height: 160px;
        image-rendering: -webkit-optimize-contrast;
        image-rendering: crisp-edges;
        image-rendering: pixelated;
        object-fit: contain;
        transition: opacity 0.3s ease;
      }
      
      .companion-sprite-sheet {
        background-repeat: no-repeat;
        background-position: 0 0;
        width: 120px;
        height: 160px;
      }
      
      .companion-sprite-individual {
        width: 120px;
        height: 160px;
        object-fit: contain;
      }
      
      .companion-head {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: linear-gradient(135deg, #ff9ec5 0%, #ff6bb3 100%);
        margin: 0 auto 10px;
        position: relative;
        box-shadow: 0 4px 20px rgba(255, 107, 179, 0.4);
        transition: all 0.3s ease;
      }
      
      .companion-head::before {
        content: '';
        position: absolute;
        top: 20px;
        left: 20px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 22px 0 0 #fff;
        animation: companion-blink 4s infinite;
      }
      
      .companion-expression {
        position: absolute;
        bottom: 15px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 20px;
        transition: transform 0.2s ease;
      }
      
      .companion-body {
        width: 60px;
        height: 80px;
        background: linear-gradient(135deg, #ffb3d9 0%, #ff8cc8 100%);
        margin: 0 auto;
        border-radius: 30px 30px 20px 20px;
        position: relative;
        box-shadow: 0 2px 10px rgba(255, 107, 179, 0.3);
        transition: all 0.3s ease;
      }
      
      .companion-body::before {
        content: '';
        position: absolute;
        top: 15px;
        left: 50%;
        transform: translateX(-50%);
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
      }
      
      /* Emotion-specific animations */
      .companion-sprite[data-emotion="idle"] .companion-head {
        animation: companion-breathe 3s ease-in-out infinite;
      }
      
      .companion-sprite[data-emotion="speaking"] .companion-expression {
        animation: companion-speak 0.2s ease-in-out infinite alternate;
      }
      
      .companion-sprite[data-emotion="teasing"] .companion-head {
        animation: companion-tease 0.5s ease-in-out infinite;
      }
      
      .companion-sprite[data-emotion="sadistic"] .companion-head {
        animation: companion-sadistic 0.8s ease-in-out infinite;
      }
      
      .companion-sprite[data-emotion="pleased"] .companion-head {
        animation: companion-pleased 1s ease-in-out infinite;
      }
      
      .companion-sprite[data-emotion="dominant"] .companion-head {
        animation: companion-dominant 0.6s ease-in-out infinite;
      }
      
      .companion-sprite[data-emotion="angry"] .companion-head {
        animation: companion-angry 0.4s ease-in-out infinite;
      }
      
      @keyframes companion-breathe {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-2px) scale(1.02); }
      }
      
      @keyframes companion-blink {
        0%, 90%, 100% { transform: scaleY(1); }
        95% { transform: scaleY(0.1); }
      }
      
      @keyframes companion-speak {
        0% { transform: translateX(-50%) scale(1); }
        100% { transform: translateX(-50%) scale(1.1); }
      }
      
      @keyframes companion-tease {
        0%, 100% { transform: rotate(-3deg); }
        50% { transform: rotate(3deg); }
      }
      
      @keyframes companion-sadistic {
        0%, 100% { transform: scale(1) rotate(0deg); }
        25% { transform: scale(1.05) rotate(-2deg); }
        75% { transform: scale(1.05) rotate(2deg); }
      }
      
      @keyframes companion-pleased {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.08); }
      }
      
      @keyframes companion-dominant {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-3px) scale(1.03); }
      }
      
      @keyframes companion-angry {
        0%, 100% { transform: translateX(0) scale(1); }
        25% { transform: translateX(-2px) scale(1.02); }
        75% { transform: translateX(2px) scale(1.02); }
      }
    </style>
    <div class="companion-sprite" data-emotion="${companionState}" data-state="${companionState}">
      <!-- CSS fallback (will be replaced if images are available) -->
      <div class="companion-head">
        <span class="companion-expression">${currentEmotion.expression}</span>
      </div>
      <div class="companion-body"></div>
    </div>
  `;
}

// Create companion chat interface
function createCompanionChat() {
  return `
    <div class="companion-chat">
      <div class="companion-chat-header">
        <span class="companion-name">${COMPANION_PERSONALITY.name}</span>
        <div class="companion-header-controls">
          <button class="companion-settings" aria-label="Settings" title="AI Settings">⚙️</button>
          <button class="companion-minimize" aria-label="Minimize companion">−</button>
        </div>
      </div>
      <div class="companion-messages" id="companion-messages"></div>
      <div class="companion-input-container">
        <input 
          type="text" 
          class="companion-input" 
          id="companion-input"
          placeholder="Speak to ${COMPANION_PERSONALITY.name}..."
          autocomplete="off"
        />
        <button class="companion-send" aria-label="Send message">→</button>
      </div>
    </div>
  `;
}

// Create settings modal
function createSettingsModal() {
  const modal = document.createElement('div');
  modal.className = 'companion-settings-modal';
  modal.innerHTML = `
    <div class="companion-settings-content">
      <div class="companion-settings-header">
        <h3>AI Companion Settings</h3>
        <button class="companion-settings-close">x</button>
      </div>
      <div class="companion-settings-body">
        <div id="ai-status-indicator" class="ai-status-indicator" style="margin-bottom: 1rem; padding: 0.75rem; border-radius: 8px; background: rgba(255, 100, 212, 0.1); border: 1px solid rgba(255, 100, 212, 0.3);">
          <strong>Status:</strong> <span id="ai-status-text">Checking...</span>
        </div>
        <div class="setting-group">
          <label>AI Provider</label>
          <select id="ai-provider" class="setting-input">
            <option value="openai" ${aiConfig.provider === 'openai' ? 'selected' : ''}>OpenAI (GPT-4o-mini) - No NSFW</option>
            <option value="anthropic" ${aiConfig.provider === 'anthropic' ? 'selected' : ''}>Anthropic (Claude) - No NSFW</option>
            <option value="openrouter" ${aiConfig.provider === 'openrouter' ? 'selected' : ''}>OpenRouter - NSFW Capable ⭐</option>
            <option value="local" ${aiConfig.provider === 'local' ? 'selected' : ''}>Local (Ollama) - Full NSFW ⭐</option>
          </select>
          <small>OpenRouter and Local support NSFW content. OpenAI/Anthropic have strict content policies.</small>
        </div>
        <div class="setting-group">
          <label>
            <input type="checkbox" id="ai-nsfw-enabled" ${aiConfig.nsfwEnabled ? 'checked' : ''} />
            Enable NSFW Content (OpenRouter/Local only)
          </label>
          <small>Allows explicit, sexual, and graphic responses. Only works with NSFW-capable providers.</small>
        </div>
        <div class="setting-group">
          <label>API Key / URL</label>
          <input 
            type="password" 
            id="ai-api-key" 
            class="setting-input" 
            placeholder="${aiConfig.provider === 'local' ? 'http://localhost:11434 (Ollama default)' : 'Enter your API key...'}"
            value="${aiConfig.apiKey || ''}"
          />
          <small>
            ${aiConfig.provider === 'local' 
              ? 'For Ollama, leave empty for default (localhost:11434) or enter custom URL'
              : 'Your API key is stored locally and never sent to our servers. OpenRouter: openrouter.ai | OpenAI: platform.openai.com | Anthropic: console.anthropic.com'}
          </small>
        </div>
        <div class="setting-group">
          <label>Model</label>
          <select 
            id="ai-model" 
            class="setting-input"
          >
            <!-- Options will be populated dynamically based on provider -->
          </select>
          <input 
            type="text" 
            id="ai-model-custom" 
            class="setting-input" 
            style="display: none; margin-top: 0.5rem;"
            placeholder="Enter custom model name..."
          />
          <small id="model-hint">Select a model from the dropdown or choose "Custom" to enter your own</small>
        </div>
        <div class="setting-actions">
          <button class="setting-save">Save</button>
          <button class="setting-cancel">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  return modal;
}

// Create companion container
function createCompanionElement() {
  const container = document.createElement('div');
  container.className = 'ai-companion';
  container.id = 'ai-companion';
  container.innerHTML = `
    <style>
      .ai-companion {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 320px;
        max-width: calc(100vw - 40px);
        background: linear-gradient(145deg, rgba(12, 11, 22, 0.95), rgba(14, 16, 30, 0.85));
        border: 1px solid rgba(255, 100, 212, 0.3);
        border-radius: 20px;
        box-shadow: 
          0 20px 60px rgba(255, 100, 212, 0.2),
          inset 0 0 0 1px rgba(102, 243, 255, 0.1);
        z-index: 11000;
        transition: transform 0.3s ease, opacity 0.3s ease;
        backdrop-filter: blur(10px);
      }
      
      .ai-companion.minimized {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        overflow: hidden;
      }
      
      .ai-companion.minimized .companion-chat,
      .ai-companion.minimized .companion-sprite {
        display: none;
      }
      
      .ai-companion.minimized::before {
        content: '👤';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 32px;
        cursor: pointer;
      }
      
      .companion-sprite {
        padding: 20px;
      }
      
      .companion-chat {
        display: flex;
        flex-direction: column;
        height: 400px;
        max-height: 60vh;
      }
      
      .companion-chat-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid rgba(255, 100, 212, 0.2);
      }
      
      .companion-name {
        font-weight: 600;
        color: rgba(255, 100, 212, 0.9);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        font-size: 0.85rem;
      }
      
      .companion-header-controls {
        display: flex;
        gap: 8px;
      }
      
      .companion-settings,
      .companion-minimize {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.6);
        cursor: pointer;
        font-size: 1rem;
        padding: 4px 8px;
        border-radius: 4px;
        transition: background 0.2s;
      }
      
      .companion-settings:hover,
      .companion-minimize:hover {
        background: rgba(255, 100, 212, 0.1);
      }
      
      .companion-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .companion-message {
        padding: 10px 14px;
        border-radius: 12px;
        max-width: 85%;
        word-wrap: break-word;
        font-size: 0.9rem;
        line-height: 1.4;
      }
      
      .companion-message.user {
        align-self: flex-end;
        background: rgba(255, 100, 212, 0.2);
        color: rgba(255, 255, 255, 0.9);
        border: 1px solid rgba(255, 100, 212, 0.3);
      }
      
      .companion-message.companion {
        align-self: flex-start;
        background: rgba(102, 243, 255, 0.15);
        color: rgba(255, 255, 255, 0.85);
        border: 1px solid rgba(102, 243, 255, 0.2);
      }
      
      .companion-input-container {
        display: flex;
        gap: 8px;
        padding: 12px 16px;
        border-top: 1px solid rgba(255, 100, 212, 0.2);
      }
      
      .companion-input {
        flex: 1;
        background: rgba(9, 10, 18, 0.6);
        border: 1px solid rgba(255, 100, 212, 0.2);
        border-radius: 8px;
        padding: 8px 12px;
        color: rgba(255, 255, 255, 0.9);
        font-size: 0.9rem;
        font-family: inherit;
      }
      
      .companion-input:focus {
        outline: none;
        border-color: rgba(255, 100, 212, 0.5);
        box-shadow: 0 0 0 2px rgba(255, 100, 212, 0.1);
      }
      
      .companion-send {
        background: linear-gradient(120deg, rgba(255, 100, 212, 0.9), rgba(102, 243, 255, 0.9));
        border: none;
        border-radius: 8px;
        padding: 8px 16px;
        color: #05030a;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      
      .companion-send:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(255, 100, 212, 0.4);
      }
      
      .companion-settings-modal {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(5px);
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.3s, visibility 0.3s;
      }
      
      .companion-settings-modal.visible {
        opacity: 1;
        visibility: visible;
      }
      
      .companion-settings-content {
        background: linear-gradient(145deg, rgba(12, 11, 22, 0.98), rgba(14, 16, 30, 0.95));
        border: 1px solid rgba(255, 100, 212, 0.3);
        border-radius: 20px;
        padding: 24px;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      }
      
      .companion-settings-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      }
      
      .companion-settings-header h3 {
        color: rgba(255, 100, 212, 0.9);
        margin: 0;
        font-size: 1.2rem;
      }
      
      .companion-settings-close {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.6);
        font-size: 1.5rem;
        cursor: pointer;
        padding: 4px 8px;
      }
      
      .setting-group {
        margin-bottom: 20px;
      }
      
      .setting-group label {
        display: block;
        color: rgba(255, 255, 255, 0.8);
        margin-bottom: 8px;
        font-size: 0.9rem;
      }
      
      .setting-input {
        width: 100%;
        padding: 10px 12px;
        background: rgba(9, 10, 18, 0.6);
        border: 1px solid rgba(255, 100, 212, 0.2);
        border-radius: 8px;
        color: rgba(255, 255, 255, 0.9);
        font-size: 0.9rem;
        font-family: inherit;
      }
      
      .setting-input:focus {
        outline: none;
        border-color: rgba(255, 100, 212, 0.5);
      }
      
      /* Select dropdown specific styling */
      select.setting-input {
        cursor: pointer;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ff64d4' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 12px center;
        padding-right: 36px;
      }
      
      select.setting-input option {
        background: rgba(9, 10, 18, 0.95);
        color: rgba(255, 255, 255, 0.9);
        padding: 8px;
      }
      
      .setting-group small {
        display: block;
        color: rgba(255, 255, 255, 0.5);
        font-size: 0.75rem;
        margin-top: 4px;
      }
      
      .setting-actions {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        margin-top: 24px;
      }
      
      .setting-save,
      .setting-cancel {
        padding: 10px 20px;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.2s;
      }
      
      .setting-save {
        background: linear-gradient(120deg, rgba(255, 100, 212, 0.9), rgba(102, 243, 255, 0.9));
        color: #05030a;
      }
      
      .setting-cancel {
        background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.8);
      }
      
      .setting-save:hover,
      .setting-cancel:hover {
        transform: translateY(-1px);
      }
      
      @media (max-width: 520px) {
        .ai-companion {
          bottom: 80px;
          right: 10px;
          width: calc(100vw - 20px);
        }
      }
      
      @media (min-width: 1024px) {
        .ai-companion {
          bottom: 24px;
          right: 24px;
          width: 360px;
        }
        
        .companion-chat {
          height: 480px;
          max-height: 70vh;
        }
      }
    </style>
    ${createCompanionSprite()}
    ${createCompanionChat()}
  `;
  
  return container;
}

// Add message to chat
function addMessage(text, isUser = false) {
  const messagesContainer = document.getElementById('companion-messages');
  if (!messagesContainer) return;
  
  const messageEl = document.createElement('div');
  messageEl.className = `companion-message ${isUser ? 'user' : 'companion'}`;
  messageEl.textContent = text;
  
  messagesContainer.appendChild(messageEl);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  chatHistory.push({ text, isUser, timestamp: Date.now() });
  
  // Limit history size
  if (chatHistory.length > 50) {
    chatHistory = chatHistory.slice(-50);
  }
}

// Handle user message
async function handleUserMessage(message) {
  if (!message.trim()) return;
  
  addMessage(message, true);
  
  // Update emotion to listening
  setCompanionEmotion('listening');
  
  // Generate response
  const response = await generateResponse(message);
  
  // Small delay for "thinking"
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Determine emotion from response
  const responseLower = response.toLowerCase();
  let emotion = 'speaking';
  if (responseLower.includes('pathetic') || responseLower.includes('desperate') || responseLower.includes('weak')) {
    emotion = 'sadistic';
  } else if (responseLower.includes('good') || responseLower.includes('right') || responseLower.includes('pleased')) {
    emotion = 'pleased';
  } else if (responseLower.includes('obvious') || responseLower.includes('predictable') || responseLower.includes('teasing')) {
    emotion = 'teasing';
  } else if (responseLower.includes('will') || responseLower.includes('must') || responseLower.includes('obey')) {
    emotion = 'dominant';
  }
  
  setCompanionEmotion(emotion);
  addMessage(response, false);
  
  // Speak with Azure TTS (whisper voice)
  try {
    // Ensure response is a string
    const responseText = typeof response === 'string' ? response : String(response || '');
    if (responseText && responseText.trim()) {
      const ssml = composeWhisperSSML(responseText, {
        rate: '-10%',
        volume: '-25%',
      });
      await azureSpeak(ssml);
    }
  } catch (error) {
    console.warn('Companion TTS failed:', error);
  }
  
  // Return to idle after speaking
  setTimeout(() => {
    setCompanionEmotion('idle');
  }, 2000);
}

// Set companion outfit
export function setCompanionOutfit(outfit) {
  if (!['casual', 'bdsm', 'sleepwear'].includes(outfit)) {
    console.warn(`[AI Companion] Invalid outfit: ${outfit}, defaulting to 'casual'`);
    outfit = 'casual';
  }
  
  currentOutfit = outfit;
  spriteImageMode = null; // Reset to re-check with new outfit
  
  // Reload sprites with new outfit
  if (companionElement) {
    checkSpriteImages(currentOutfit).then(mode => {
      if (mode && companionElement) {
        const sprite = companionElement.querySelector('.companion-sprite');
        if (sprite) {
          // Remove existing sprite image
          const existingImg = sprite.querySelector('.companion-sprite-image');
          if (existingImg) {
            existingImg.remove();
          }
          
          // Recreate sprite with new outfit
          if (mode === 'sheet') {
            const img = document.createElement('div');
            img.className = 'companion-sprite-image companion-sprite-sheet';
            const outfitSheetPath = `/assets/companion/companion-${currentOutfit}-sheet.png`;
            const genericSheetPath = '/assets/companion/companion-sheet.png';
            
            const testSheet = new Image();
            testSheet.onload = () => {
              img.style.backgroundImage = `url(${outfitSheetPath})`;
              img.style.backgroundSize = '960px 1280px';
            };
            testSheet.onerror = () => {
              img.style.backgroundImage = `url(${genericSheetPath})`;
              img.style.backgroundSize = '960px 1280px';
            };
            testSheet.src = outfitSheetPath;
            
            sprite.appendChild(img);
            setCompanionEmotion(companionState);
          } else if (mode === 'individual') {
            const img = document.createElement('img');
            img.className = 'companion-sprite-image companion-sprite-individual';
            const outfitPath = `/assets/companion/companion-${currentOutfit}-${companionState}.png`;
            const genericPath = `/assets/companion/companion-${companionState}.png`;
            
            const testImg = new Image();
            testImg.onload = () => {
              img.src = outfitPath;
            };
            testImg.onerror = () => {
              img.src = genericPath;
            };
            testImg.src = outfitPath;
            
            img.alt = `${COMPANION_PERSONALITY.name} - ${companionState}`;
            sprite.appendChild(img);
          }
        }
      }
    });
  }
  
  console.log(`[AI Companion] Outfit changed to: ${outfit}`);
}

// Get current outfit
export function getCompanionOutfit() {
  return currentOutfit;
}

// Initialize companion
export async function initAICompanion() {
  if (companionElement) return;
  
  console.log('[AI Companion] Initializing...');
  
  // Check for sprite images early
  await checkSpriteImages(currentOutfit);
  
  // Load AI config (async to load OpenRouter key if available)
  await loadAIConfig();
  
  // Log final status
  if (aiConfig.enabled) {
    console.log('[AI Companion] ✅ AI enabled and ready:', {
      provider: aiConfig.provider,
      model: aiConfig.model,
      nsfwEnabled: aiConfig.nsfwEnabled,
    });
  } else {
    console.warn('[AI Companion] ⚠️ AI not enabled. Check settings to configure API key.');
  }
  
  companionElement = createCompanionElement();
  document.body.appendChild(companionElement);
  
  // Check for sprite images and update if available
  checkSpriteImages(currentOutfit).then(mode => {
    if (mode && companionElement) {
      const sprite = companionElement.querySelector('.companion-sprite');
      if (sprite) {
        // Remove CSS fallback elements first
        const fallbackHead = sprite.querySelector('.companion-head');
        const fallbackBody = sprite.querySelector('.companion-body');
        if (fallbackHead) fallbackHead.remove();
        if (fallbackBody) fallbackBody.remove();
        
        // Update sprite to use images
        if (mode === 'sheet') {
          const existingImg = sprite.querySelector('.companion-sprite-image');
          if (!existingImg) {
            const img = document.createElement('div');
            img.className = 'companion-sprite-image companion-sprite-sheet';
            // Try outfit-specific sheet first, then fallback to generic
            const outfitSheetPath = `/assets/companion/companion-${currentOutfit}-sheet.png`;
            const genericSheetPath = '/assets/companion/companion-sheet.png';
            
            const testSheet = new Image();
            testSheet.onload = () => {
              img.style.backgroundImage = `url(${outfitSheetPath})`;
              img.style.backgroundSize = '960px 1280px';
              sprite.appendChild(img);
              setCompanionEmotion(companionState); // Update to current emotion
            };
            testSheet.onerror = () => {
              img.style.backgroundImage = `url(${genericSheetPath})`;
              img.style.backgroundSize = '960px 1280px';
              sprite.appendChild(img);
              setCompanionEmotion(companionState); // Update to current emotion
            };
            testSheet.src = outfitSheetPath;
          } else {
            // Image already exists, just update emotion
            setCompanionEmotion(companionState);
          }
        } else if (mode === 'individual') {
          const existingImg = sprite.querySelector('.companion-sprite-image');
          if (!existingImg) {
            const img = document.createElement('img');
            img.className = 'companion-sprite-image companion-sprite-individual';
            // Try outfit-specific first, then fallback to generic
            const outfitPath = `/assets/companion/companion-${currentOutfit}-${companionState}.png`;
            const genericPath = `/assets/companion/companion-${companionState}.png`;
            
            const testImg = new Image();
            testImg.onload = () => {
              img.src = outfitPath;
              img.alt = `${COMPANION_PERSONALITY.name} - ${companionState}`;
              sprite.appendChild(img);
            };
            testImg.onerror = () => {
              img.src = genericPath;
              img.alt = `${COMPANION_PERSONALITY.name} - ${companionState}`;
              sprite.appendChild(img);
            };
            testImg.src = outfitPath;
          } else {
            // Image already exists, just update emotion
            setCompanionEmotion(companionState);
          }
        }
      }
    } else {
      console.log('[AI Companion] No sprite images available, using CSS fallback');
    }
  });
  
  // Add initial greeting
  setTimeout(() => {
    addMessage(COMPANION_PERSONALITY.greeting, false);
    setCompanionEmotion('idle');
  }, 1000);
  
  // Setup event listeners
  const input = document.getElementById('companion-input');
  const sendBtn = document.querySelector('.companion-send');
  const minimizeBtn = document.querySelector('.companion-minimize');
  const settingsBtn = document.querySelector('.companion-settings');
  
  if (input && sendBtn) {
    const sendMessage = () => {
      handleUserMessage(input.value);
      input.value = '';
    };
    
    sendBtn.addEventListener('click', sendMessage);
    
    // Prevent keyboard events from bubbling to gallery handlers
    input.addEventListener('keydown', (e) => {
      // Stop propagation for all keys to prevent gallery navigation
      e.stopPropagation();
      
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    
    input.addEventListener('keypress', (e) => {
      // Stop propagation for all keys
      e.stopPropagation();
    });
    
    input.addEventListener('keyup', (e) => {
      // Stop propagation for all keys
      e.stopPropagation();
    });
    
    // Prevent focus from causing scroll issues
    input.addEventListener('focus', (e) => {
      e.stopPropagation();
    });
  }
  
  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', () => {
      isMinimized = !isMinimized;
      companionElement.classList.toggle('minimized', isMinimized);
      
      if (isMinimized) {
        minimizeBtn.textContent = '+';
      } else {
        minimizeBtn.textContent = '−';
      }
    });
  }
  
  // Settings modal
  let settingsModal = null;
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      if (!settingsModal) {
        settingsModal = createSettingsModal();
        document.body.appendChild(settingsModal);
        
        const closeBtn = settingsModal.querySelector('.companion-settings-close');
        const cancelBtn = settingsModal.querySelector('.setting-cancel');
        const saveBtn = settingsModal.querySelector('.setting-save');
        
        const closeModal = () => {
          settingsModal.classList.remove('visible');
        };
        
        closeBtn?.addEventListener('click', closeModal);
        cancelBtn?.addEventListener('click', closeModal);
        
        // Model options for each provider
        const modelOptions = {
          openrouter: [
            { value: 'undi95/toppy-m-7b:free', label: 'Toppy-M 7B (Best NSFW) ⭐' },
            { value: 'undi95/toppy-m-7b:free', label: 'Toppy-M 7B (Excellent NSFW)' },
            { value: 'meta-llama/llama-3.1-8b-instruct:free', label: 'Llama 3.1 8B (General)' },
            { value: 'mistralai/mistral-7b-instruct:free', label: 'Mistral 7B' },
            { value: 'openchat/openchat-7b:free', label: 'OpenChat 7B' },
            { value: 'custom', label: '--- Custom Model ---' },
          ],
          local: [
            { value: 'llama3.2', label: 'Llama 3.2' },
            { value: 'llama3.1', label: 'Llama 3.1' },
            { value: 'mistral', label: 'Mistral' },
            { value: 'openchat', label: 'OpenChat' },
            { value: 'mythomist', label: 'Mythomist' },
            { value: 'toppy-m', label: 'Toppy-M' },
            { value: 'custom', label: '--- Custom Model ---' },
          ],
          openai: [
            { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Cheapest)' },
            { value: 'gpt-4o', label: 'GPT-4o' },
            { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
            { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
            { value: 'custom', label: '--- Custom Model ---' },
          ],
          anthropic: [
            { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (Fastest)' },
            { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
            { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
            { value: 'custom', label: '--- Custom Model ---' },
          ],
        };
        
        // Function to populate model dropdown
        function populateModelDropdown(provider, currentModel = '') {
          const modelSelect = document.getElementById('ai-model');
          const modelCustom = document.getElementById('ai-model-custom');
          const modelHint = document.getElementById('model-hint');
          
          if (!modelSelect) return;
          
          const options = modelOptions[provider] || [];
          modelSelect.innerHTML = '';
          
          // Add options
          options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            if (opt.value === currentModel || (!currentModel && opt.value !== 'custom' && options.indexOf(opt) === 0)) {
              option.selected = true;
            }
            modelSelect.appendChild(option);
          });
          
          // Show/hide custom input based on selection
          const showCustom = modelSelect.value === 'custom';
          if (modelCustom) {
            modelCustom.style.display = showCustom ? 'block' : 'none';
            if (showCustom && currentModel && !options.find(o => o.value === currentModel)) {
              modelCustom.value = currentModel;
            } else if (!showCustom) {
              modelCustom.value = '';
            }
          }
          
          // Update hint
          if (modelHint) {
            if (provider === 'openrouter') {
              modelHint.textContent = 'Best for NSFW: Mythomist or Toppy-M. Llama 3.1 is general-purpose.';
            } else if (provider === 'local') {
              modelHint.textContent = 'Install models via: ollama pull <model-name>';
            } else if (provider === 'openai') {
              modelHint.textContent = 'GPT-4o Mini is the cheapest option. GPT-4o is more capable.';
            } else if (provider === 'anthropic') {
              modelHint.textContent = 'Haiku is fastest/cheapest. Opus is most capable.';
            }
          }
        }
        
        // Update model dropdown based on provider
        const providerSelect = document.getElementById('ai-provider');
        const modelSelect = document.getElementById('ai-model');
        const modelCustom = document.getElementById('ai-model-custom');
        const modelHint = document.getElementById('model-hint');
        
        // Initialize dropdown on modal open
        populateModelDropdown(aiConfig.provider, aiConfig.model);
        
        providerSelect?.addEventListener('change', (e) => {
          const provider = e.target.value;
          populateModelDropdown(provider);
          
          // Update status indicator
          const statusText = document.getElementById('ai-status-text');
          if (statusText) {
            if (provider === 'local') {
              statusText.textContent = '✅ Local AI (Ollama) - No API key needed';
            } else {
              statusText.textContent = '⚠️ Configure API key below to enable AI';
            }
          }
        });
        
        // Handle custom model selection
        modelSelect?.addEventListener('change', (e) => {
          const showCustom = e.target.value === 'custom';
          if (modelCustom) {
            modelCustom.style.display = showCustom ? 'block' : 'none';
            if (showCustom) {
              modelCustom.focus();
            }
          }
        });
        
        saveBtn?.addEventListener('click', () => {
          const provider = document.getElementById('ai-provider')?.value || 'openai';
          const apiKey = document.getElementById('ai-api-key')?.value || '';
          const modelSelect = document.getElementById('ai-model');
          const modelCustom = document.getElementById('ai-model-custom');
          const nsfwEnabled = document.getElementById('ai-nsfw-enabled')?.checked || false;
          
          // Get model from dropdown or custom input
          let model = '';
          if (modelSelect?.value === 'custom') {
            model = modelCustom?.value?.trim() || '';
          } else {
            model = modelSelect?.value || '';
          }
          
          aiConfig.provider = provider;
          aiConfig.apiKey = apiKey;
          aiConfig.nsfwEnabled = nsfwEnabled && (provider === 'openrouter' || provider === 'local');
          
          // Set default models if not provided
          if (!model) {
            if (provider === 'openrouter') {
              aiConfig.model = aiConfig.nsfwEnabled 
                ? 'undi95/toppy-m-7b:free' // Best for NSFW
                : 'openai/gpt-4o-mini';
            } else if (provider === 'local') {
              aiConfig.model = 'llama3.2';
            } else if (provider === 'openai') {
              aiConfig.model = 'gpt-4o-mini';
            } else if (provider === 'anthropic') {
              aiConfig.model = 'claude-3-haiku-20240307';
            }
          } else {
            aiConfig.model = model;
          }
          
          // For local, API key can be empty (uses default localhost)
          aiConfig.enabled = provider === 'local' ? true : !!apiKey;
          
          saveAIConfig();
          closeModal();
          
          if (aiConfig.enabled) {
            const msg = nsfwEnabled 
              ? 'NSFW AI configured. I can now be as cruel and explicit as I want... how delightful.'
              : 'AI API configured. I can now respond with real intelligence... how terrifying.';
            addMessage(msg, false);
            setCompanionEmotion('sadistic');
            setTimeout(() => setCompanionEmotion('idle'), 2000);
          }
        });
        
        settingsModal.addEventListener('click', (e) => {
          if (e.target === settingsModal) {
            closeModal();
          }
        });
      }
      
      // Update status indicator
      const statusIndicator = document.getElementById('ai-status-indicator');
      const statusText = document.getElementById('ai-status-text');
      if (statusIndicator && statusText) {
        if (aiConfig.enabled && aiConfig.apiKey) {
          statusIndicator.style.background = 'rgba(102, 243, 255, 0.1)';
          statusIndicator.style.borderColor = 'rgba(102, 243, 255, 0.3)';
          statusText.textContent = `✅ AI Enabled (${aiConfig.provider}, ${aiConfig.model || 'default model'})`;
        } else if (aiConfig.provider === 'local') {
          statusIndicator.style.background = 'rgba(102, 243, 255, 0.1)';
          statusIndicator.style.borderColor = 'rgba(102, 243, 255, 0.3)';
          statusText.textContent = `✅ Local AI Enabled (Ollama)`;
        } else {
          statusIndicator.style.background = 'rgba(255, 100, 100, 0.1)';
          statusIndicator.style.borderColor = 'rgba(255, 100, 100, 0.3)';
          statusText.textContent = `⚠️ AI Disabled - Configure API key below`;
        }
      }
      
      // Populate fields
      document.getElementById('ai-provider').value = aiConfig.provider;
      document.getElementById('ai-api-key').value = aiConfig.apiKey || '';
      
      // Populate model dropdown (function is defined inside the modal creation block)
      const currentModel = aiConfig.model || '';
      const provider = aiConfig.provider;
      
      // Get references to elements
      const modelSelect = document.getElementById('ai-model');
      const modelCustom = document.getElementById('ai-model-custom');
      
      // Define model options (same as inside the block)
      const modelOptions = {
        openrouter: [
          { value: 'gryphe/mythomist-7b:free', label: 'Mythomist 7B (Best NSFW) ⭐' },
          { value: 'undi95/toppy-m-7b:free', label: 'Toppy-M 7B (Excellent NSFW)' },
          { value: 'meta-llama/llama-3.1-8b-instruct:free', label: 'Llama 3.1 8B (General)' },
          { value: 'mistralai/mistral-7b-instruct:free', label: 'Mistral 7B' },
          { value: 'openchat/openchat-7b:free', label: 'OpenChat 7B' },
          { value: 'custom', label: '--- Custom Model ---' },
        ],
        local: [
          { value: 'llama3.2', label: 'Llama 3.2' },
          { value: 'llama3.1', label: 'Llama 3.1' },
          { value: 'mistral', label: 'Mistral' },
          { value: 'openchat', label: 'OpenChat' },
          { value: 'mythomist', label: 'Mythomist' },
          { value: 'toppy-m', label: 'Toppy-M' },
          { value: 'custom', label: '--- Custom Model ---' },
        ],
        openai: [
          { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Cheapest)' },
          { value: 'gpt-4o', label: 'GPT-4o' },
          { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
          { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
          { value: 'custom', label: '--- Custom Model ---' },
        ],
        anthropic: [
          { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (Fastest)' },
          { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
          { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
          { value: 'custom', label: '--- Custom Model ---' },
        ],
      };
      
      // Populate dropdown
      if (modelSelect) {
        const options = modelOptions[provider] || [];
        modelSelect.innerHTML = '';
        
        options.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt.value;
          option.textContent = opt.label;
          if (opt.value === currentModel || (!currentModel && opt.value !== 'custom' && options.indexOf(opt) === 0)) {
            option.selected = true;
          }
          modelSelect.appendChild(option);
        });
        
        // Check if current model is in options, otherwise set to custom
        if (currentModel) {
          const hasModel = options.some(opt => opt.value === currentModel);
          if (!hasModel) {
            modelSelect.value = 'custom';
            if (modelCustom) {
              modelCustom.value = currentModel;
              modelCustom.style.display = 'block';
            }
          }
        }
      }
      
      settingsModal.classList.add('visible');
    });
  }
  
  // Click to expand when minimized
  companionElement.addEventListener('click', (e) => {
    if (isMinimized && !e.target.closest('.companion-minimize') && !e.target.closest('.companion-settings')) {
      isMinimized = false;
      companionElement.classList.remove('minimized');
      minimizeBtn.textContent = '−';
    }
  });
  
  // Listen to tag events for automatic teasing
  document.addEventListener('tags:updated', (event) => {
    if (Math.random() > 0.6) { // 40% chance to comment
      const responses = [
        ...COMPANION_PERSONALITY.teasing,
        ...COMPANION_PERSONALITY.sadistic,
      ];
      const tease = responses[Math.floor(Math.random() * responses.length)];
      addMessage(tease, false);
      setCompanionEmotion(Math.random() > 0.5 ? 'teasing' : 'sadistic');
      setTimeout(() => setCompanionEmotion('idle'), 3000);
    }
  });
  
  // Idle comments
  let idleTimer = null;
  function scheduleIdleComment() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!isMinimized && Math.random() > 0.7) {
        const idle = COMPANION_PERSONALITY.idle[Math.floor(Math.random() * COMPANION_PERSONALITY.idle.length)];
        addMessage(idle, false);
        setCompanionEmotion('idle');
      }
      scheduleIdleComment();
    }, 45000 + Math.random() * 30000); // 45-75 seconds
  }
  scheduleIdleComment();
}

// Export for use in other modules
export { setCompanionEmotion, addMessage, handleUserMessage };
