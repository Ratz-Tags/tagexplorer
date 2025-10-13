console.log('🔧 Tag Debug Injector Loaded');

// Create a debug panel
const debugPanel = document.createElement('div');
debugPanel.style.cssText = `
  position: fixed;
  top: 10px;
  left: 10px;
  width: 400px;
  max-height: 300px;
  background: rgba(0, 0, 0, 0.9);
  color: #00ff00;
  font-family: monospace;
  font-size: 12px;
  padding: 10px;
  border: 1px solid #00ff00;
  z-index: 9999;
  overflow-y: auto;
  border-radius: 4px;
`;
debugPanel.innerHTML = '<div style="font-weight:bold; color:#00ffff;">🔧 Tag Loading Debug</div>';

// Store original console.log
const originalLog = console.log;

// Override console.log to also display in our panel
console.log = function(...args) {
  // Call original log
  originalLog.apply(console, args);
  
  // Filter for tag-related messages
  const message = args.join(' ');
  if (message.includes('[tags]') || message.includes('kink') || message.includes('Tag')) {
    const logDiv = document.createElement('div');
    logDiv.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
    logDiv.style.marginBottom = '2px';
    
    if (message.includes('ERROR') || message.includes('❌')) {
      logDiv.style.color = '#ff0000';
    } else if (message.includes('SUCCESS') || message.includes('✅')) {
      logDiv.style.color = '#00ff00';
    } else if (message.includes('WARN')) {
      logDiv.style.color = '#ffaa00';
    }
    
    debugPanel.appendChild(logDiv);
    debugPanel.scrollTop = debugPanel.scrollHeight;
  }
};

// Add to page
document.addEventListener('DOMContentLoaded', () => {
  document.body.appendChild(debugPanel);
});

// If already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(debugPanel);
  });
} else {
  document.body.appendChild(debugPanel);
}

// Add manual test buttons
setTimeout(() => {
  const testDiv = document.createElement('div');
  testDiv.style.cssText = `
    position: fixed;
    bottom: 10px;
    left: 10px;
    background: rgba(0, 0, 0, 0.9);
    padding: 10px;
    border: 1px solid #00ff00;
    z-index: 9999;
  `;
  
  testDiv.innerHTML = `
    <button onclick="testTagsFetch()" style="margin:2px; padding:5px; font-size:11px;">Test Fetch</button>
    <button onclick="testTagsModule()" style="margin:2px; padding:5px; font-size:11px;">Test Module</button>
  `;
  
  document.body.appendChild(testDiv);
}, 1000);

// Test functions
window.testTagsFetch = async function() {
  console.log('🔧 Manual fetch test starting...');
  try {
    const response = await fetch('kink-tags.json');
    console.log('🔧 Fetch response:', response.status, response.statusText);
    const data = await response.json();
    console.log('🔧 Fetch data type:', typeof data, 'length:', Array.isArray(data) ? data.length : 'N/A');
  } catch (error) {
    console.log('🔧 Fetch ERROR:', error.message);
  }
};

window.testTagsModule = async function() {
  console.log('🔧 Manual module test starting...');
  try {
    const module = await import('./modules/tags.js');
    const tags = module.getKinkTags();
    console.log('🔧 Module getKinkTags returned:', Array.isArray(tags) ? tags.length : typeof tags, 'categories');
    
    // Force reinit
    console.log('🔧 Forcing tag reinit...');
    await module.initTags([], () => {}, () => {});
  } catch (error) {
    console.log('🔧 Module ERROR:', error.message);
  }
};