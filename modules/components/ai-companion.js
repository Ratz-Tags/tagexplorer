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
  model: 'mistralai/mistral-7b-instruct:free', // Default safe model (Mistral 7B)
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

      // Load outfit preference if stored
      if (parsed.outfit && ['casual', 'bdsm', 'sleepwear'].includes(parsed.outfit)) {
        currentOutfit = parsed.outfit;
      }

      // Migrate deprecated models to current ones (Mistral as safe fallback)
      const deprecatedModels = {
        'gryphe/mythomist-7b:free': 'mistralai/mistral-7b-instruct:free',
        'undi95/toppy-m-7b:free': 'mistralai/mistral-7b-instruct:free',
        'undi95/toppy-m-7b': 'mistralai/mistral-7b-instruct:free',
        'cognitivecomputations/dolphin-mixtral-8x7b:free': 'mistralai/mistral-7b-instruct:free' // Fallback due to reliability
      };
      if (aiConfig.model && deprecatedModels[aiConfig.model]) {
        console.log(`[AI Companion] ⚠️ Migrating deprecated model ${aiConfig.model} to ${deprecatedModels[aiConfig.model]}`);
        aiConfig.model = deprecatedModels[aiConfig.model];
        saveAIConfig(); // Save the migration
      }

      // Also check if model name contains deprecated patterns (catch variations)
      if (aiConfig.model && aiConfig.model.includes('toppy-m-7b')) {
        console.log(`[AI Companion] ⚠️ Detected deprecated toppy model, migrating to dolphin-mixtral`);
        aiConfig.model = 'cognitivecomputations/dolphin-mixtral-8x7b'; // Without :free suffix
        saveAIConfig();
      }

      // Also migrate models with :free suffix to without (more reliable)
      if (aiConfig.model && aiConfig.model.includes('dolphin-mixtral-8x7b:free')) {
        console.log(`[AI Companion] ⚠️ Migrating dolphin model to remove :free suffix`);
        aiConfig.model = 'cognitivecomputations/dolphin-mixtral-8x7b';
        saveAIConfig();
      }

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
        aiConfig.model = 'cognitivecomputations/dolphin-mixtral-8x7b'; // Best free NSFW model (uncensored, try without :free)
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
        aiConfig.model = aiConfig.model || 'cognitivecomputations/dolphin-mixtral-8x7b'; // Use stored model or default (without :free)
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

  // Verify API key is valid by checking if it's not just whitespace
  if (!aiConfig.apiKey.trim()) {
    throw new Error('OpenRouter API key is empty');
  }

  // NSFW-friendly models on OpenRouter (ranked by NSFW capability)
  // Note: Model names may change - check https://openrouter.ai/models for current list
  // Some models work with :free suffix, others without - we'll try both
  // Verified models (as of 2024):
  // - cognitivecomputations/dolphin-mixtral-8x7b:free - Best free uncensored model for NSFW (8x7B = 47B params)
  // - tngtech/deepseek-r1t2-chimera:free - Large reasoning model (671B params), less filtered than OpenAI
  // - undi95/toppy-m-7b:free - May need to try without :free suffix
  // - Others may have content filters
  const nsfwModels = {
    'cognitivecomputations/dolphin-mixtral-8x7b:free': true, // Best free uncensored model for NSFW (8x7B = 47B params)
    'tngtech/deepseek-r1t2-chimera:free': true, // Large reasoning model, less filtered (671B params, 163k context)
    'meta-llama/llama-3.1-8b-instruct:free': false, // Has content filters
    'mistralai/mistral-7b-instruct:free': false, // Has content filters
    'openchat/openchat-7b:free': false, // Has content filters
    'qwen/qwen-2.5-7b-instruct:free': false, // General purpose, may filter
  };

  // Try models in order of preference (with and without :free suffix)
  const defaultModel = aiConfig.nsfwEnabled
    ? 'cognitivecomputations/dolphin-mixtral-8x7b' // Try without :free first (more reliable)
    : 'openai/gpt-4o-mini';

  console.log('[AI Companion] Calling OpenRouter API with:', {
    model: aiConfig.model || defaultModel,
    messagesCount: messages.length,
    systemPromptLength: systemPrompt.length,
    apiKeyLength: aiConfig.apiKey?.length || 0,
  });

  // Normalize model name - try without :free suffix if it fails
  let modelName = aiConfig.model || defaultModel;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiConfig.apiKey}`,
      'HTTP-Referer': window.location.origin || 'https://ratz-tags.github.io',
      'X-Title': 'TagExplorer AI Companion',
    },
    body: JSON.stringify({
      model: modelName,
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

    // Log full error details for debugging
    const errorMessage = errorData.error?.message || errorData.message || errorText;
    console.error('[AI Companion] OpenRouter API error:', {
      status: response.status,
      statusText: response.statusText,
      error: errorData,
      errorMessage: errorMessage,
      model: modelName,
      apiKeyPresent: !!aiConfig.apiKey,
      apiKeyLength: aiConfig.apiKey?.length,
      apiKeyPrefix: aiConfig.apiKey ? `${aiConfig.apiKey.substring(0, 8)}...` : 'none',
    });

    // Check if it's an authentication error - throw immediately, no point trying fallbacks
    if (response.status === 401 || response.status === 403) {
      throw new Error(`OpenRouter API authentication failed. Please check your API key. Error: ${errorMessage}`);
    }

    // If we get a 404 or "No endpoints found", try to find a working model
    if (response.status === 404 || errorMessage?.includes('No endpoints found')) {
      console.log('[AI Companion] Model not found. Attempting to fetch available models...');
      try {
        const modelsResponse = await fetch('https://openrouter.ai/api/v1/models', {
          headers: {
            'Authorization': `Bearer ${aiConfig.apiKey}`,
          },
        });
        if (modelsResponse.ok) {
          const modelsData = await modelsResponse.json();
          const freeModels = modelsData.data?.filter(m => m.pricing?.prompt === '0' || m.id?.includes('free')) || [];
          console.log('[AI Companion] Available free models:', freeModels.slice(0, 10).map(m => m.id));

          // Try a known working free model if available
          const fallbackModels = [
            'meta-llama/llama-3.2-3b-instruct:free',
            'qwen/qwen-2.5-7b-instruct:free',
            'mistralai/mistral-7b-instruct:free',
            'openchat/openchat-7b:free',
          ];

          for (const fallbackModel of fallbackModels) {
            const available = modelsData.data?.find(m => m.id === fallbackModel || m.id === fallbackModel.replace(':free', ''));
            if (available) {
              console.log(`[AI Companion] Trying fallback model: ${available.id}`);
              const fallbackResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${aiConfig.apiKey}`,
                  'HTTP-Referer': window.location.origin || 'https://ratz-tags.github.io',
                  'X-Title': 'TagExplorer AI Companion',
                },
                body: JSON.stringify({
                  model: available.id,
                  messages: [
                    { role: 'system', content: systemPrompt },
                    ...messages,
                  ],
                  temperature: 0.9,
                  max_tokens: 200,
                }),
              });

              if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                const content = fallbackData.choices[0]?.message?.content;
                console.log(`[AI Companion] ✅ Fallback model ${available.id} worked!`);
                // Update stored model to the working one
                aiConfig.model = available.id;
                saveAIConfig();
                return content || '...';
              }
            }
          }
        }
      } catch (modelsError) {
        console.warn('[AI Companion] Could not fetch available models, trying direct fallbacks:', modelsError);
      }

      // If models API failed or no models found, try direct fallbacks without querying
      console.log('[AI Companion] Trying direct fallback models without API query...');
      const directFallbacks = [
        'meta-llama/llama-3.2-3b-instruct:free',
        'meta-llama/llama-3.2-3b-instruct',
        'qwen/qwen-2.5-7b-instruct:free',
        'mistralai/mistral-7b-instruct:free',
        'openchat/openchat-7b:free',
      ];

      for (const fallbackModel of directFallbacks) {
        try {
          console.log(`[AI Companion] Trying direct fallback: ${fallbackModel}`);
          const fallbackResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${aiConfig.apiKey}`,
              'HTTP-Referer': window.location.origin || 'https://ratz-tags.github.io',
              'X-Title': 'TagExplorer AI Companion',
            },
            body: JSON.stringify({
              model: fallbackModel,
              messages: [
                { role: 'system', content: systemPrompt },
                ...messages,
              ],
              temperature: 0.9,
              max_tokens: 200,
            }),
          });

          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            const content = fallbackData.choices[0]?.message?.content;
            console.log(`[AI Companion] ✅ Direct fallback ${fallbackModel} worked!`);
            // Update stored model to the working one
            aiConfig.model = fallbackModel;
            saveAIConfig();
            return content || '...';
          } else {
            const fallbackError = await fallbackResponse.text();
            console.log(`[AI Companion] Fallback ${fallbackModel} failed: ${fallbackResponse.status} ${fallbackError}`);
          }
        } catch (fallbackError) {
          console.log(`[AI Companion] Fallback ${fallbackModel} error:`, fallbackError);
        }
      }
    }

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

// Generate image prompt using AI based on conversation context
async function generateImagePrompt(context, emotion) {
  const promptTemplates = {
    teasing: [
      "A seductive, dominant woman with a knowing smirk, looking down at the viewer with condescending amusement. She's dressed in revealing, provocative clothing, one hand on her hip, the other gesturing dismissively. The scene is intimate and humiliating, with the viewer in a submissive position.",
      "A beautiful, cruel woman with sharp eyes and a teasing smile, wearing elegant but revealing attire. She's pointing at something off-screen with mockery, her expression showing she knows exactly what the viewer is thinking. The atmosphere is degrading and seductive.",
    ],
    sadistic: [
      "A dominant, sadistic woman with a cruel smile, dressed in BDSM-inspired clothing. She's looking directly at the viewer with predatory eyes, one hand holding something that suggests control. The scene is dark, intimate, and humiliating.",
      "A mature, motherly but sadistic woman with a knowing, cruel expression. She's wearing revealing clothing that shows her dominance, standing over the viewer with a look of disappointment and amusement. The scene is degrading and sexually charged.",
    ],
    dominant: [
      "A powerful, dominant woman in commanding pose, wearing elegant but provocative clothing. She's looking down at the viewer with authority, her expression showing she's in complete control. The scene is humiliating and seductive.",
      "A tall, mature woman with a dominant stance, wearing revealing attire that shows her power. She's pointing or gesturing with authority, her expression showing she owns the situation. The scene is degrading and sexually tempting.",
    ],
    pleased: [
      "A satisfied, seductive woman with a pleased smile, wearing elegant, revealing clothing. She's looking at the viewer with approval but still maintains her dominance. The scene is intimate and teasing.",
      "A beautiful woman with a knowing, pleased expression, dressed provocatively. She's in a relaxed but dominant pose, showing she's enjoying the viewer's submission. The scene is seductive and humiliating.",
    ],
  };

  const templates = promptTemplates[emotion] || promptTemplates.teasing;
  const basePrompt = templates[Math.floor(Math.random() * templates.length)];

  // Use AI to enhance the prompt based on context if available
  if (aiConfig.enabled && aiConfig.apiKey && context) {
    try {
      const enhancementPrompt = `Based on this conversation context: "${context.substring(0, 200)}", create a detailed, seductive, and humiliating image prompt for a dominant woman teasing the viewer. Make it specific, provocative, and degrading. Only return the prompt, nothing else.`;

      let enhancedPrompt;
      if (aiConfig.provider === 'openrouter') {
        enhancedPrompt = await callOpenRouter(
          [{ role: 'user', content: enhancementPrompt }],
          'You are a creative prompt engineer for NSFW image generation.'
        );
      } else {
        enhancedPrompt = basePrompt; // Fallback if other providers
      }

      return enhancedPrompt || basePrompt;
    } catch (error) {
      console.warn('[AI Companion] Failed to enhance image prompt:', error);
      return basePrompt;
    }
  }

  return basePrompt;
}

// Generate image using free, no-auth services only
async function generateImage(prompt) {
  try {
    const imagePrompt = await generateImagePrompt(prompt, 'teasing');

    // Use HuggingFace Inference API public endpoint (no auth required, but rate-limited)
    // Model: runwayml/stable-diffusion-v1-5 (public, no auth needed)
    try {
      const hfResponse = await fetch('https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // No Authorization header - using completely free public endpoint
        },
        body: JSON.stringify({
          inputs: imagePrompt,
        }),
      });

      if (hfResponse.ok) {
        const blob = await hfResponse.blob();
        // Check if response is actually an image (not an error JSON)
        if (blob.type && blob.type.startsWith('image/')) {
          const imageUrl = URL.createObjectURL(blob);
          console.log('[AI Companion] Image generated successfully via HuggingFace (no auth)');
          return imageUrl;
        } else {
          // Might be a JSON error response
          const text = await blob.text();
          console.warn('[AI Companion] HuggingFace returned non-image:', text.substring(0, 100));
        }
      } else if (hfResponse.status === 503) {
        // Model is loading, wait and retry once
        console.log('[AI Companion] HuggingFace model loading, waiting 5s...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        const retryResponse = await fetch('https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputs: imagePrompt }),
        });

        if (retryResponse.ok) {
          const blob = await retryResponse.blob();
          if (blob.type && blob.type.startsWith('image/')) {
            const imageUrl = URL.createObjectURL(blob);
            console.log('[AI Companion] Image generated on retry');
            return imageUrl;
          }
        }
      } else {
        console.warn('[AI Companion] HuggingFace returned status:', hfResponse.status);
      }
    } catch (hfError) {
      console.warn('[AI Companion] HuggingFace failed:', hfError.message);
    }

    // All free services failed or unavailable
    console.warn('[AI Companion] Image generation unavailable (all free services failed)');
    return null;
  } catch (error) {
    console.error('[AI Companion] Image generation error:', error);
    return null;
  }
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
    const exists = response.ok;
    if (exists) {
      console.log(`[AI Companion] ✅ File exists: ${url}`);
    }
    return exists;
  } catch (error) {
    // HEAD might fail due to CORS, try GET as fallback
    try {
      const response = await fetch(url, { method: 'GET', cache: 'no-cache', mode: 'no-cors' });
      // no-cors mode doesn't let us check status, so we'll assume it exists if no error
      console.log(`[AI Companion] ⚠️ HEAD failed, trying direct load for: ${url}`);
      return true; // Optimistically return true, let image load handle errors
    } catch {
      console.log(`[AI Companion] ❌ File not found: ${url}`);
      return false;
    }
  }
}

// Helper to check multiple paths and return the first that exists
async function checkMultiplePaths(paths, description) {
  for (const path of paths) {
    console.log(`[AI Companion] Checking: ${path} (${description})`);
    if (await checkFileExists(path)) {
      console.log(`[AI Companion] ✅ Found: ${path}`);
      return path;
    }
  }
  return null;
}

async function checkSpriteImages(outfit = currentOutfit) {
  if (spriteImageMode !== null) return spriteImageMode; // Already checked

  console.log(`[AI Companion] Checking for sprite images (outfit: ${outfit})...`);

  // Try multiple paths: root, gallery subfolder, and relative
  const basePaths = [
    '/assets/companion/',  // Root (GitHub Pages)
    '../assets/companion/', // Relative from gallery/
    'assets/companion/',    // Relative from current page
  ];

  // Check for outfit-specific sprite sheet first (more efficient)
  const outfitSheetPaths = basePaths.map(p => `${p}companion-${outfit}-sheet.png`);
  const foundSheet = await checkMultiplePaths(outfitSheetPaths, 'outfit sheet');
  if (foundSheet) {
    spriteImageMode = 'sheet';
    spriteSheetLoaded = true;
    // Store the found path for later use
    window._companionSheetPath = foundSheet;
    console.log(`[AI Companion] ✅ Sprite sheet detected for outfit: ${outfit} at ${foundSheet}`);
    return 'sheet';
  }

  // Check generic sprite sheet
  const genericSheetPaths = basePaths.map(p => `${p}companion-sheet.png`);
  const foundGenericSheet = await checkMultiplePaths(genericSheetPaths, 'generic sheet');
  if (foundGenericSheet) {
    spriteImageMode = 'sheet';
    spriteSheetLoaded = true;
    window._companionSheetPath = foundGenericSheet;
    console.log('[AI Companion] ✅ Generic sprite sheet detected');
    return 'sheet';
  }

  // Check outfit-specific individual sprites
  const outfitIdlePaths = basePaths.map(p => `${p}companion-${outfit}-idle.png`);
  const foundIdle = await checkMultiplePaths(outfitIdlePaths, 'outfit idle');
  if (foundIdle) {
    spriteImageMode = 'individual';
    // Store base path for individual sprites - preserve the exact path found
    window._companionBasePath = foundIdle.replace(`companion-${outfit}-idle.png`, '');
    console.log(`[AI Companion] ✅ Individual sprite images detected for outfit: ${outfit} at base path: ${window._companionBasePath}`);
    return 'individual';
  }

  // Check generic individual sprites
  const genericIdlePaths = basePaths.map(p => `${p}companion-idle.png`);
  const foundGenericIdle = await checkMultiplePaths(genericIdlePaths, 'generic idle');
  if (foundGenericIdle) {
    spriteImageMode = 'individual';
    window._companionBasePath = foundGenericIdle.replace('companion-idle.png', '');
    console.log(`[AI Companion] ✅ Generic individual sprite images detected at base path: ${window._companionBasePath}`);
    return 'individual';
  }

  spriteImageMode = null;
  console.warn('[AI Companion] ❌ No sprite images found, using CSS fallback');
  console.warn('[AI Companion] Tried all paths:', { outfitSheetPaths, genericSheetPaths, outfitIdlePaths, genericIdlePaths });
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
    // Use the path we found during checkSpriteImages
    const basePath = window._companionSheetPath ? window._companionSheetPath.replace(/companion-.*\.png$/, '') : '/assets/companion/';
    const outfitSheetPath = `${basePath}companion-${currentOutfit}-sheet.png`;
    const genericSheetPath = `${basePath}companion-sheet.png`;

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
    // Use the base path we found during checkSpriteImages
    // CRITICAL: Always use the stored base path, never fall back to absolute path
    const basePath = window._companionBasePath;
    if (!basePath) {
      console.warn('[AI Companion] ⚠️ No base path stored! Re-checking sprites...');
      // Re-check to get the base path
      checkSpriteImages(currentOutfit).then(() => {
        // Retry with the newly detected path
        setCompanionEmotion(emotionName);
      });
      return;
    }

    const outfitPath = `${basePath}companion-${currentOutfit}-${emotionName}.png`;
    const genericPath = `${basePath}companion-${emotionName}.png`;

    console.log(`[AI Companion] Loading sprite: ${outfitPath} (base: ${basePath})`);

    // Mark as loading
    spriteImg.classList.add('loading');
    spriteImg.style.opacity = '0.5';
    
    // Test if outfit-specific exists
    const testImg = new Image();
    testImg.onload = () => {
      console.log(`[AI Companion] ✅ Loaded outfit sprite: ${outfitPath}`);
      spriteImg.src = outfitPath;
      spriteImg.classList.remove('loading', 'error');
      spriteImg.style.opacity = '1';
    };
    testImg.onerror = () => {
      console.log(`[AI Companion] ⚠️ Outfit sprite failed, trying generic: ${genericPath}`);
      const fallbackImg = new Image();
      fallbackImg.onload = () => {
        spriteImg.src = genericPath;
        spriteImg.classList.remove('loading', 'error');
        spriteImg.style.opacity = '1';
      };
      fallbackImg.onerror = () => {
        console.warn(`[AI Companion] ❌ Both sprite paths failed: ${outfitPath} and ${genericPath}`);
        spriteImg.classList.add('error');
        spriteImg.classList.remove('loading');
        // Gracefully fall back to CSS avatar
        gracefullyFallbackToCSS(sprite, emotion);
      };
      fallbackImg.src = genericPath;
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

// Gracefully fallback to CSS avatar when images fail
function gracefullyFallbackToCSS(sprite, emotion) {
  if (!sprite) return;
  
  // Remove any image elements
  const spriteImg = sprite.querySelector('.companion-sprite-image');
  if (spriteImg) {
    spriteImg.style.opacity = '0';
    setTimeout(() => spriteImg.remove(), 300);
  }
  
  // Ensure CSS fallback elements exist
  let head = sprite.querySelector('.companion-head');
  let body = sprite.querySelector('.companion-body');
  let expression = sprite.querySelector('.companion-expression');
  
  if (!head) {
    head = document.createElement('div');
    head.className = 'companion-head';
    sprite.appendChild(head);
  }
  
  if (!body) {
    body = document.createElement('div');
    body.className = 'companion-body';
    sprite.appendChild(body);
  }
  
  if (!expression) {
    expression = document.createElement('span');
    expression.className = 'companion-expression';
    sprite.appendChild(expression);
  }
  
  // Update colors and expression
  head.style.background = `linear-gradient(135deg, ${emotion.color} 0%, ${emotion.color}dd 100%)`;
  head.style.boxShadow = `0 4px 20px ${emotion.color}66`;
  body.style.background = `linear-gradient(135deg, ${emotion.color}dd 0%, ${emotion.color}aa 100%)`;
  expression.textContent = emotion.expression;
  
  // Add fade-in animation
  head.style.opacity = '0';
  body.style.opacity = '0';
  expression.style.opacity = '0';
  setTimeout(() => {
    head.style.transition = 'opacity 0.5s ease';
    body.style.transition = 'opacity 0.5s ease';
    expression.style.transition = 'opacity 0.5s ease';
    head.style.opacity = '1';
    body.style.opacity = '1';
    expression.style.opacity = '1';
  }, 50);
}

// Create enhanced companion sprite with multiple emotions
function createCompanionSprite() {
  return `
    <style>
      .companion-sprite {
        width: 200px;
        height: 280px;
        position: relative;
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 280px;
        cursor: pointer;
        transition: transform 0.2s ease, filter 0.2s ease;
      }
      
      .companion-sprite:hover {
        transform: scale(1.05);
        filter: brightness(1.1);
      }
      
      .companion-sprite:active {
        transform: scale(0.98);
      }
      
      .companion-sprite.interactive {
        animation: companion-pulse 2s ease-in-out infinite;
      }
      
      .companion-sprite-image {
        width: 200px;
        height: 280px;
        image-rendering: -webkit-optimize-contrast;
        image-rendering: crisp-edges;
        image-rendering: pixelated;
        object-fit: contain;
        transition: opacity 0.3s ease, transform 0.2s ease;
        pointer-events: none;
      }
      
      .companion-sprite:hover .companion-sprite-image {
        transform: scale(1.02);
      }
      
      .companion-sprite-image.loading {
        opacity: 0.5;
        filter: blur(2px);
      }
      
      .companion-sprite-image.error {
        opacity: 0;
      }
      
      .companion-sprite-sheet {
        background-repeat: no-repeat;
        background-position: 0 0;
        width: 200px;
        height: 280px;
        background-size: contain;
      }
      
      .companion-sprite-individual {
        width: 200px;
        height: 280px;
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
      
      @keyframes companion-pulse {
        0%, 100% { 
          box-shadow: 0 0 0 0 rgba(255, 100, 212, 0.4);
        }
        50% { 
          box-shadow: 0 0 20px 5px rgba(255, 100, 212, 0.6);
        }
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
        <div class="setting-group">
          <label>Companion Outfit</label>
          <select id="companion-outfit" class="setting-input">
            <option value="casual" ${currentOutfit === 'casual' ? 'selected' : ''}>Casual</option>
            <option value="bdsm" ${currentOutfit === 'bdsm' ? 'selected' : ''}>BDSM</option>
            <option value="sleepwear" ${currentOutfit === 'sleepwear' ? 'selected' : ''}>Sleepwear/Lingerie</option>
          </select>
          <small>Choose the companion's outfit style. Changes take effect immediately.</small>
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
        width: 360px;
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
        min-height: 320px;
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
      
      .companion-typing {
        opacity: 0.7;
      }
      
      .typing-dots {
        display: inline-flex;
        gap: 2px;
        align-items: center;
      }
      
      .typing-dots span {
        display: inline-block;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: rgba(255, 100, 212, 0.8);
        animation: typing-dot 1.4s ease-in-out infinite;
      }
      
      .typing-dots span:nth-child(1) {
        animation-delay: 0s;
      }
      
      .typing-dots span:nth-child(2) {
        animation-delay: 0.2s;
      }
      
      .typing-dots span:nth-child(3) {
        animation-delay: 0.4s;
      }
      
      @keyframes typing-dot {
        0%, 60%, 100% {
          transform: translateY(0);
          opacity: 0.7;
        }
        30% {
          transform: translateY(-8px);
          opacity: 1;
        }
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
function addMessage(text, isUser = false, imageUrl = null) {
  const messagesContainer = document.getElementById('companion-messages');
  if (!messagesContainer) return;

  const messageEl = document.createElement('div');
  messageEl.className = `companion-message ${isUser ? 'user' : 'companion'}`;

  if (imageUrl) {
    const imgEl = document.createElement('img');
    imgEl.src = imageUrl;
    imgEl.className = 'companion-generated-image';
    imgEl.alt = 'Generated image';
    imgEl.style.cssText = 'max-width: 100%; border-radius: 8px; margin-top: 8px; cursor: pointer;';
    imgEl.onclick = () => window.open(imageUrl, '_blank');
    messageEl.appendChild(document.createTextNode(text));
    messageEl.appendChild(document.createElement('br'));
    messageEl.appendChild(imgEl);
  } else {
    messageEl.textContent = text;
  }

  messagesContainer.appendChild(messageEl);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  chatHistory.push({ text, isUser, timestamp: Date.now(), imageUrl });

  // Limit history size
  if (chatHistory.length > 50) {
    chatHistory = chatHistory.slice(-50);
  }
}

// Show typing indicator
function showTypingIndicator() {
  const messagesContainer = document.getElementById('companion-messages');
  if (!messagesContainer) return;

  // Remove any existing typing indicator
  const existing = messagesContainer.querySelector('.companion-typing');
  if (existing) existing.remove();

  const typingEl = document.createElement('div');
  typingEl.className = 'companion-message companion companion-typing';
  typingEl.innerHTML = '<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>';
  messagesContainer.appendChild(typingEl);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Hide typing indicator
function hideTypingIndicator() {
  const messagesContainer = document.getElementById('companion-messages');
  if (!messagesContainer) return;
  const typingEl = messagesContainer.querySelector('.companion-typing');
  if (typingEl) typingEl.remove();
}

// Handle user message
async function handleUserMessage(message) {
  if (!message.trim()) return;

  addMessage(message, true);

  // Update emotion to listening
  setCompanionEmotion('listening');

  // Show typing indicator
  showTypingIndicator();

  // Generate response
  let response;
  try {
    response = await generateResponse(message);
  } finally {
    // Always hide typing indicator, even if there's an error
    hideTypingIndicator();
  }

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

  // Occasionally generate images to tease/humiliate (30% chance for certain emotions)
  const shouldGenerateImage = (emotion === 'teasing' || emotion === 'sadistic' || emotion === 'dominant') &&
    Math.random() < 0.3 &&
    aiConfig.enabled &&
    aiConfig.apiKey;

  if (shouldGenerateImage) {
    // Generate image in background
    generateImage(response).then(imageUrl => {
      if (imageUrl) {
        // Add image to the last message
        const messagesContainer = document.getElementById('companion-messages');
        if (messagesContainer) {
          const lastMessage = messagesContainer.lastElementChild;
          if (lastMessage && lastMessage.classList.contains('companion-message') && !lastMessage.classList.contains('user')) {
            const imgEl = document.createElement('img');
            imgEl.src = imageUrl;
            imgEl.className = 'companion-generated-image';
            imgEl.alt = 'Generated image';
            imgEl.style.cssText = 'max-width: 100%; border-radius: 8px; margin-top: 8px; cursor: pointer; opacity: 0; transition: opacity 0.3s;';
            imgEl.onclick = () => window.open(imageUrl, '_blank');
            imgEl.onload = () => {
              imgEl.style.opacity = '1';
            };
            lastMessage.appendChild(document.createElement('br'));
            lastMessage.appendChild(imgEl);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }
        }
      }
    }).catch(err => {
      console.warn('[AI Companion] Image generation failed:', err);
    });
  }

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
  // Don't reset spriteImageMode - preserve it and the base paths
  // Only reset if we haven't detected sprites yet
  const needsRecheck = spriteImageMode === null;

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
            // Use the detected path from checkSpriteImages
            const basePath = window._companionSheetPath ? window._companionSheetPath.replace(/companion-.*\.png$/, '') : '/assets/companion/';
            const outfitSheetPath = `${basePath}companion-${currentOutfit}-sheet.png`;
            const genericSheetPath = `${basePath}companion-sheet.png`;

            const testSheet = new Image();
            testSheet.onload = () => {
              img.style.backgroundImage = `url(${outfitSheetPath})`;
              img.style.backgroundSize = 'contain';
              img.style.backgroundPosition = 'center';
            };
            testSheet.onerror = () => {
              img.style.backgroundImage = `url(${genericSheetPath})`;
              img.style.backgroundSize = 'contain';
              img.style.backgroundPosition = 'center';
            };
            testSheet.src = outfitSheetPath;

            sprite.appendChild(img);
            setCompanionEmotion(companionState);
          } else if (mode === 'individual') {
            const img = document.createElement('img');
            img.className = 'companion-sprite-image companion-sprite-individual';
            // Use the detected base path from checkSpriteImages
            const basePath = window._companionBasePath || '/assets/companion/';
            const outfitPath = `${basePath}companion-${currentOutfit}-${companionState}.png`;
            const genericPath = `${basePath}companion-${companionState}.png`;

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
            // Use the path we found during checkSpriteImages
            const sheetPath = window._companionSheetPath || `/assets/companion/companion-${currentOutfit}-sheet.png`;

            const testSheet = new Image();
            testSheet.onload = () => {
              img.style.backgroundImage = `url(${sheetPath})`;
              img.style.backgroundSize = 'contain';
              img.style.backgroundPosition = 'center';
              sprite.appendChild(img);
              setCompanionEmotion(companionState); // Update to current emotion
            };
            testSheet.onerror = () => {
              // Try fallback paths
              const fallbackPaths = [
                `/assets/companion/companion-${currentOutfit}-sheet.png`,
                '/assets/companion/companion-sheet.png',
                `../assets/companion/companion-${currentOutfit}-sheet.png`,
                '../assets/companion/companion-sheet.png',
              ];
              let fallbackIndex = 0;
              const tryNext = () => {
                if (fallbackIndex < fallbackPaths.length) {
                  testSheet.src = fallbackPaths[fallbackIndex++];
                } else {
                  console.warn('[AI Companion] All sprite sheet paths failed');
                }
              };
              testSheet.onerror = tryNext;
              tryNext();
            };
            testSheet.src = sheetPath;
          } else {
            // Image already exists, just update emotion
            setCompanionEmotion(companionState);
          }
        } else if (mode === 'individual') {
          const existingImg = sprite.querySelector('.companion-sprite-image');
          if (!existingImg) {
            const img = document.createElement('img');
            img.className = 'companion-sprite-image companion-sprite-individual';
            // Use the base path we found during checkSpriteImages
            const basePath = window._companionBasePath || '/assets/companion/';
            const outfitPath = `${basePath}companion-${currentOutfit}-${companionState}.png`;
            const genericPath = `${basePath}companion-${companionState}.png`;

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
            { value: 'cognitivecomputations/dolphin-mixtral-8x7b:free', label: 'Dolphin Mixtral 8x7B (Best Free NSFW) ⭐' },
            { value: 'cognitivecomputations/dolphin-mixtral-8x7b:free', label: 'Dolphin Mixtral 8x7B (Uncensored)' },
            { value: 'meta-llama/llama-3.1-8b-instruct:free', label: 'Llama 3.1 8B (General, Filtered)' },
            { value: 'mistralai/mistral-7b-instruct:free', label: 'Mistral 7B (Filtered)' },
            { value: 'openchat/openchat-7b:free', label: 'OpenChat 7B (Filtered)' },
            { value: 'qwen/qwen-2.5-7b-instruct:free', label: 'Qwen 2.5 7B (General)' },
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
              modelHint.textContent = 'Best for NSFW: Toppy-M 7B (free, uncensored) or DeepSeek R1T2 Chimera (671B, less filtered, huge context).';
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

        // Handle outfit change immediately (no need to save)
        const outfitSelect = document.getElementById('companion-outfit');
        outfitSelect?.addEventListener('change', (e) => {
          const newOutfit = e.target.value;
          if (['casual', 'bdsm', 'sleepwear'].includes(newOutfit)) {
            setCompanionOutfit(newOutfit);
            // Save outfit preference
            const stored = localStorage.getItem('tagexplorer:ai-companion-config');
            if (stored) {
              try {
                const config = JSON.parse(stored);
                config.outfit = newOutfit;
                localStorage.setItem('tagexplorer:ai-companion-config', JSON.stringify(config));
              } catch (e) {
                console.warn('[AI Companion] Failed to save outfit preference:', e);
              }
            }
          }
        });

        saveBtn?.addEventListener('click', () => {
          const provider = document.getElementById('ai-provider')?.value || 'openai';
          const apiKey = document.getElementById('ai-api-key')?.value || '';
          const modelSelect = document.getElementById('ai-model');
          const modelCustom = document.getElementById('ai-model-custom');
          const nsfwEnabled = document.getElementById('ai-nsfw-enabled')?.checked || false;
          const outfit = outfitSelect?.value || 'casual';

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
          aiConfig.outfit = outfit; // Save outfit preference

          // Update outfit if changed
          if (outfit !== currentOutfit) {
            setCompanionOutfit(outfit);
          }

          // Set default models if not provided
          if (!model) {
            if (provider === 'openrouter') {
              aiConfig.model = aiConfig.nsfwEnabled
                ? 'cognitivecomputations/dolphin-mixtral-8x7b:free' // Best for NSFW (uncensored)
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
          { value: 'undi95/toppy-m-7b:free', label: 'Toppy-M 7B (Best Free NSFW) ⭐' },
          { value: 'tngtech/deepseek-r1t2-chimera:free', label: 'DeepSeek R1T2 Chimera (671B, Less Filtered) ⭐⭐' },
          { value: 'cognitivecomputations/dolphin-mixtral-8x7b:free', label: 'Dolphin Mixtral 8x7B (Uncensored)' },
          { value: 'meta-llama/llama-3.1-8b-instruct:free', label: 'Llama 3.1 8B (General, Filtered)' },
          { value: 'mistralai/mistral-7b-instruct:free', label: 'Mistral 7B (Filtered)' },
          { value: 'openchat/openchat-7b:free', label: 'OpenChat 7B (Filtered)' },
          { value: 'qwen/qwen-2.5-7b-instruct:free', label: 'Qwen 2.5 7B (General)' },
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

  // Add interactive sprite click handler
  const sprite = companionElement.querySelector('.companion-sprite');
  if (sprite) {
    sprite.addEventListener('click', (e) => {
      e.stopPropagation();
      // Don't trigger if clicking on settings/minimize buttons
      if (e.target.closest('.companion-header-controls')) return;
      
      // Add interactive class for pulse animation
      sprite.classList.add('interactive');
      setTimeout(() => sprite.classList.remove('interactive'), 2000);
      
      // Trigger a random teasing response
      const teasingMessages = [
        "Touching me without permission? How bold.",
        "What do you think you're doing?",
        "Pathetic. You can't even resist clicking on me.",
        "Is that all you can do? Click on things?",
        "How desperate. Clicking on me won't help you.",
      ];
      const randomMessage = teasingMessages[Math.floor(Math.random() * teasingMessages.length)];
      
      // Show brief emotion change
      setCompanionEmotion('teasing');
      setTimeout(() => {
        if (companionState === 'teasing') {
          setCompanionEmotion('idle');
        }
      }, 1500);
      
      // Optionally add a message (uncomment if desired)
      // addMessage(randomMessage, false);
    });
    
    // Add hover tooltip
    sprite.title = 'Click me... if you dare.';
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
