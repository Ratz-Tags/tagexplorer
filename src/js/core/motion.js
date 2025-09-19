import { animate, stagger, timeline } from 'motion';

const state = {
  prefersReduced: false,
  userDisabled: false,
  ready: false
};

let mediaQuery;

function updateDataset() {
  const root = document.documentElement;
  const disabled = state.prefersReduced || state.userDisabled;
  root.dataset.motion = disabled ? 'off' : 'on';
  state.ready = true;
}

function handleMediaChange(event) {
  state.prefersReduced = event.matches;
  updateDataset();
}

export function configureMotion(preferences) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!mediaQuery) {
    mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    state.prefersReduced = mediaQuery.matches;
    mediaQuery.addEventListener('change', handleMediaChange);
  }

  state.userDisabled = Boolean(preferences?.motion?.reduced);
  updateDataset();
}

export function safeAnimate(targets, keyframes, options = {}) {
  if (!state.ready) {
    updateDataset();
  }
  if (state.prefersReduced || state.userDisabled) {
    return {
      cancel() {},
      finished: Promise.resolve()
    };
  }
  return animate(targets, keyframes, {
    easing: 'cubic-bezier(.4,-0.2,.2,1.2)',
    ...options
  });
}

export { stagger, timeline };
