import { defineShellComponents } from './components/index.js';
import type { MountShellOptions, MountShellResult, ShellElements } from './types.js';

export async function mountShell({ page }: MountShellOptions = {}): Promise<MountShellResult> {
  defineShellComponents();

  const upgrades: Promise<unknown>[] = [];
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

  const shellRoot = document.querySelector<HTMLElement>('[data-shell]') || document.body;
  shellRoot.dataset.pageRole = page || document.body.dataset.page || 'unknown';

  const commandBar = shellRoot.querySelector<HTMLElement>('te-command-bar');
  const sidebar = document.querySelector<HTMLElement>('te-pinned-sidebar');
  const audioPanel = document.querySelector<HTMLElement>('te-audio-panel');

  if (audioPanel) {
    const section = audioPanel.querySelector<HTMLElement>('#audio-section');
    if (section) {
      section.dataset.shell = 'audio';
    }
  }

  return { shellRoot, commandBar, sidebar, audioPanel } satisfies MountShellResult;
}

export function getShellElements(): ShellElements {
  return {
    shellRoot: document.querySelector<HTMLElement>('[data-shell]') || document.body,
    commandBar: document.querySelector<HTMLElement>('te-command-bar'),
    sidebar: document.querySelector<HTMLElement>('te-pinned-sidebar'),
    audioPanel: document.querySelector<HTMLElement>('te-audio-panel'),
  } satisfies ShellElements;
}
