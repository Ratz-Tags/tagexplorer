// Prompt Cache Module
// Stores up to 10 prompts in localStorage, provides add/view/copy/delete UI

const PROMPT_CACHE_KEY = "prompt-cache-v1";
const MAX_PROMPTS = 10;

function getPrompts() {
  try {
    const arr = JSON.parse(localStorage.getItem(PROMPT_CACHE_KEY));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function savePrompts(prompts) {
  localStorage.setItem(
    PROMPT_CACHE_KEY,
    JSON.stringify(prompts.slice(0, MAX_PROMPTS))
  );
}

function addPrompt(prompt) {
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) return;
  let prompts = getPrompts();
  prompts.unshift(prompt.trim());
  prompts = [...new Set(prompts)]; // Remove duplicates
  savePrompts(prompts);
}

function deletePrompt(idx) {
  let prompts = getPrompts();
  prompts.splice(idx, 1);
  savePrompts(prompts);
}

function renderPromptCacheUI() {
  let container = document.getElementById("prompt-cache-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "prompt-cache-container";
    container.style =
      "position:fixed;bottom:1em;left:1em;z-index:2000;background:#fff0fa;border:2px solid #fd7bc5;border-radius:1.2em;padding:1em;box-shadow:0 2px 16px #fd7bc540;max-width:90vw;width:340px;";
    document.body.appendChild(container);
  }
  container.innerHTML = `<div style="font-family:'Hi Melody',cursive,sans-serif;font-size:1.1em;color:#a0005a;margin-bottom:0.5em;">Prompt Cache</div>`;
  const input = document.createElement("textarea");
  input.placeholder = "Paste or type your prompt...";
  input.style =
    "width:100%;min-height:48px;border-radius:0.7em;border:1.5px solid #fd7bc5;padding:0.5em;font-size:1em;margin-bottom:0.5em;resize:vertical;";
  container.appendChild(input);
  const addBtn = document.createElement("button");
  addBtn.textContent = "Add Prompt";
  addBtn.className = "browse-btn";
  addBtn.style = "margin-bottom:0.7em;float:right;";
  addBtn.onclick = () => {
    addPrompt(input.value);
    input.value = "";
    renderPromptCacheUI();
  };
  container.appendChild(addBtn);
  const prompts = getPrompts();
  if (prompts.length === 0) {
    const empty = document.createElement("div");
    empty.textContent = "No prompts saved.";
    empty.style = "color:#ff63a5;font-size:0.98em;margin-top:0.7em;";
    container.appendChild(empty);
  } else {
    const list = document.createElement("ul");
    list.style = "list-style:none;padding:0;margin:0;";
    prompts.forEach((prompt, idx) => {
      const li = document.createElement("li");
      li.style =
        "margin-bottom:0.7em;background:#ffd6f6;border-radius:0.7em;padding:0.5em;position:relative;";
      const text = document.createElement("div");
      text.textContent =
        prompt.length > 120 ? prompt.slice(0, 120) + "…" : prompt;
      text.style = "font-size:0.98em;word-break:break-all;";
      li.appendChild(text);
      const copyBtn = document.createElement("button");
      copyBtn.textContent = "Copy";
      copyBtn.className = "copy-button";
      copyBtn.style = "margin-left:0.5em;float:right;";
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(prompt);
        copyBtn.textContent = "Copied!";
        setTimeout(() => (copyBtn.textContent = "Copy"), 1200);
      };
      li.appendChild(copyBtn);
      const delBtn = document.createElement("button");
      delBtn.textContent = "✕";
      delBtn.className = "reload-button";
      delBtn.style =
        "margin-left:0.5em;float:right;background:#ff63a5;color:#fff;";
      delBtn.onclick = () => {
        deletePrompt(idx);
        renderPromptCacheUI();
      };
      li.appendChild(delBtn);
      list.appendChild(li);
    });
    container.appendChild(list);
  }
  // Add close button
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.className = "zoom-close";
  closeBtn.style = "position:absolute;top:0.7em;right:1.2em;";
  closeBtn.onclick = () => container.remove();
  container.appendChild(closeBtn);
}

// Expose for use in main.js
export { renderPromptCacheUI };
