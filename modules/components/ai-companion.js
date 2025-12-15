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
let aiConfig = {
  provider: 'openai', // 'openai', 'anthropic', 'openrouter', or 'local'
  apiKey: null,
  model: 'gpt-4o-mini', // Model varies by provider
  enabled: false,
  nsfwEnabled: false, // Enable NSFW content (requires NSFW-capable provider)
};

// Load OpenRouter API key from window (injected via GitHub Actions or local file)
async function loadOpenRouterKey() {
  // Check if already set
  if (typeof window !== 'undefined' && window._openRouterApiKey) {
    return window._openRouterApiKey;
  }
  
  // Try to load from local file (for development)
  try {
    const module = await import('../../openrouter-api.local.js');
    if (typeof window !== 'undefined' && window._openRouterApiKey) {
      return window._openRouterApiKey;
    }
  } catch (error) {
    // File doesn't exist or can't be loaded - that's okay
  }
  
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
    }
    
    // If OpenRouter is selected but no key is set, try to use default from GitHub secret
    if (aiConfig.provider === 'openrouter' && !aiConfig.apiKey) {
      const defaultKey = await loadOpenRouterKey();
      if (defaultKey) {
        aiConfig.apiKey = defaultKey;
        aiConfig.enabled = true;
        // Auto-enable NSFW for default key (since it's provided)
        if (!aiConfig.nsfwEnabled) {
          aiConfig.nsfwEnabled = true;
        }
        saveAIConfig();
      }
    }
  } catch (e) {
    console.warn('Failed to load AI config:', e);
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

  // NSFW-friendly models on OpenRouter
  const nsfwModels = {
    'meta-llama/llama-3.1-8b-instruct:free': true,
    'mistralai/mistral-7b-instruct:free': true,
    'openchat/openchat-7b:free': true,
    'gryphe/mythomist-7b:free': true,
    'undi95/toppy-m-7b:free': true,
  };

  const defaultModel = aiConfig.nsfwEnabled 
    ? 'meta-llama/llama-3.1-8b-instruct:free'
    : 'openai/gpt-4o-mini';

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
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error?.message || 'OpenRouter API error');
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '...';
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
  if (aiConfig.enabled && aiConfig.apiKey) {
    try {
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
        return response.trim();
      }
    } catch (error) {
      console.warn('AI API call failed, using fallback:', error);
      // Fall through to rule-based fallback
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

// Set companion emotion
function setCompanionEmotion(emotionName) {
  const emotion = COMPANION_EMOTIONS[emotionName] || COMPANION_EMOTIONS.idle;
  currentEmotion = emotion;
  companionState = emotionName;
  
  const sprite = companionElement?.querySelector('.companion-sprite');
  if (sprite) {
    sprite.setAttribute('data-emotion', emotionName);
    sprite.setAttribute('data-state', emotionName);
    
    // Update colors
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
        <button class="companion-settings-close">×</button>
      </div>
      <div class="companion-settings-body">
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
          <input 
            type="text" 
            id="ai-model" 
            class="setting-input" 
            placeholder="See guide for model suggestions"
            value="${aiConfig.model || ''}"
          />
          <small id="model-hint">OpenRouter: meta-llama/llama-3.1-8b-instruct:free (NSFW) | Local: llama3.2, mistral, etc.</small>
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
        z-index: 1000;
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
    const ssml = composeWhisperSSML(response, {
      rate: '-10%',
      volume: '-25%',
    });
    await azureSpeak(ssml);
  } catch (error) {
    console.warn('Companion TTS failed:', error);
  }
  
  // Return to idle after speaking
  setTimeout(() => {
    setCompanionEmotion('idle');
  }, 2000);
}

// Initialize companion
export async function initAICompanion() {
  if (companionElement) return;
  
  // Load AI config (async to load OpenRouter key if available)
  await loadAIConfig();
  
  companionElement = createCompanionElement();
  document.body.appendChild(companionElement);
  
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
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
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
        
        // Update model hint based on provider
        const providerSelect = document.getElementById('ai-provider');
        const modelInput = document.getElementById('ai-model');
        const modelHint = document.getElementById('model-hint');
        
        providerSelect?.addEventListener('change', (e) => {
          const provider = e.target.value;
          if (provider === 'openrouter') {
            modelInput.placeholder = 'meta-llama/llama-3.1-8b-instruct:free';
            modelHint.textContent = 'NSFW models: meta-llama/llama-3.1-8b-instruct:free, mistralai/mistral-7b-instruct:free';
          } else if (provider === 'local') {
            modelInput.placeholder = 'llama3.2';
            modelHint.textContent = 'Common models: llama3.2, mistral, openchat, mythomist (install via: ollama pull <model>)';
          } else if (provider === 'openai') {
            modelInput.placeholder = 'gpt-4o-mini';
            modelHint.textContent = 'Recommended: gpt-4o-mini (cheapest), gpt-4o, gpt-3.5-turbo';
          } else if (provider === 'anthropic') {
            modelInput.placeholder = 'claude-3-haiku-20240307';
            modelHint.textContent = 'Recommended: claude-3-haiku-20240307 (fastest), claude-3-sonnet-20240229';
          }
        });
        
        saveBtn?.addEventListener('click', () => {
          const provider = document.getElementById('ai-provider')?.value || 'openai';
          const apiKey = document.getElementById('ai-api-key')?.value || '';
          const model = document.getElementById('ai-model')?.value || '';
          const nsfwEnabled = document.getElementById('ai-nsfw-enabled')?.checked || false;
          
          aiConfig.provider = provider;
          aiConfig.apiKey = apiKey;
          aiConfig.nsfwEnabled = nsfwEnabled && (provider === 'openrouter' || provider === 'local');
          
          // Set default models if not provided
          if (!model) {
            if (provider === 'openrouter') {
              aiConfig.model = 'meta-llama/llama-3.1-8b-instruct:free';
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
      
      // Populate fields
      document.getElementById('ai-provider').value = aiConfig.provider;
      document.getElementById('ai-api-key').value = aiConfig.apiKey || '';
      document.getElementById('ai-model').value = aiConfig.model || '';
      
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
