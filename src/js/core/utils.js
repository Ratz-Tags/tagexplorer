export function deepClone(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

export function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

export function deepMerge(target, source) {
  if (Array.isArray(target) && Array.isArray(source)) {
    return [...source];
  }

  if (isPlainObject(target) && isPlainObject(source)) {
    const result = { ...target };
    Object.keys(source).forEach((key) => {
      const next = source[key];
      if (next === undefined) {
        return;
      }
      if (Array.isArray(next)) {
        result[key] = [...next];
      } else if (isPlainObject(next)) {
        result[key] = deepMerge(target[key] ?? {}, next);
      } else {
        result[key] = next;
      }
    });
    return result;
  }

  return source !== undefined ? source : target;
}

export function createEmitter() {
  const listeners = new Set();

  return {
    emit(value) {
      listeners.forEach((listener) => {
        listener(value);
      });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    clear() {
      listeners.clear();
    }
  };
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function parseSearchParams() {
  if (typeof window === 'undefined') {
    return new URLSearchParams();
  }
  return new URLSearchParams(window.location.search);
}
