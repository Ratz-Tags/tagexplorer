import './command-bar.js';
import './sidebar.js';
import './audio-panel.js';

export function defineShellComponents() {
  // importing the modules registers the custom elements
  return {
    hasCommandBar: Boolean(customElements.get('te-command-bar')),
    hasSidebar: Boolean(customElements.get('te-pinned-sidebar')),
    hasAudioPanel: Boolean(customElements.get('te-audio-panel')),
  };
}
