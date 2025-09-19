const listeners = new Set();
let coverQuery;
let innerQuery;
let currentState = 'standard';

function updateDocument(state) {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.dataset.fold = state;
}

function evaluateState() {
  if (typeof window === 'undefined') {
    currentState = 'standard';
    return currentState;
  }

  const cover = coverQuery?.matches ?? false;
  const inner = innerQuery?.matches ?? false;
  const nextState = inner ? 'inner' : cover ? 'cover' : 'standard';
  if (nextState !== currentState) {
    currentState = nextState;
    updateDocument(currentState);
    listeners.forEach((listener) => {
      try {
        listener(currentState);
      } catch (error) {
        console.warn('fold listener error', error);
      }
    });
  }
  return currentState;
}

function ensureQueries() {
  if (typeof window === 'undefined' || coverQuery) {
    return;
  }

  try {
    coverQuery = window.matchMedia('(max-width: 520px) and (orientation: portrait)');
    innerQuery = window.matchMedia('(min-width: 980px) and (min-height: 980px)');

    coverQuery.addEventListener('change', evaluateState);
    innerQuery.addEventListener('change', evaluateState);
  } catch (error) {
    console.warn('matchMedia unavailable', error);
    currentState = 'standard';
    return;
  }

  evaluateState();
}

export function watchFoldState(listener) {
  if (typeof listener === 'function') {
    listeners.add(listener);
  }

  ensureQueries();
  updateDocument(currentState);
  if (typeof listener === 'function') {
    try {
      listener(currentState);
    } catch (error) {
      console.warn('fold listener error', error);
    }
  }

  return () => {
    listeners.delete(listener);
  };
}

export function getFoldState() {
  ensureQueries();
  return currentState;
}
