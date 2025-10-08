import { defineShellComponents } from './components/index.js';

export async function mountShell({ page } = {}) {
  defineShellComponents();

  const upgrades = [];
  if (document.querySelector('te-command-bar')) {
    upgrades.push(customElements.whenDefined('te-command-bar'));
  }
  if (document.querySelector('te-pinned-sidebar')) {
    upgrades.push(customElements.whenDefined('te-pinned-sidebar'));
  }
  if (document.querySelector('te-audio-panel')) {
    upgrades.push(customElements.whenDefined('te-audio-panel'));
  }
  await Promise.all(upgrades);

  const shellRoot = document.querySelector('[data-shell]') || document.body;
  shellRoot.dataset.pageRole = page || document.body.dataset.page || 'unknown';

  const commandBar = shellRoot.querySelector('te-command-bar');
  const sidebar = document.querySelector('te-pinned-sidebar');
  const audioPanel = document.querySelector('te-audio-panel');

  if (audioPanel) {
    const section = audioPanel.querySelector('#audio-section');
    if (section) {
      section.dataset.shell = 'audio';
    }
  }

  return { shellRoot, commandBar, sidebar, audioPanel };
}

export function getShellElements() {
  return {
    commandBar: document.querySelector('te-command-bar'),
    sidebar: document.querySelector('te-pinned-sidebar'),
    audioPanel: document.querySelector('te-audio-panel'),
  };
}
