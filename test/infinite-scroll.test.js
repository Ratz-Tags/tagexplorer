import { describe, it, expect, vi } from 'vitest';
import { setupInfiniteScroll } from '../modules/ui.js';

describe('setupInfiniteScroll', () => {
  it('invokes callback when near bottom with more pages', () => {
    vi.useFakeTimers();
    const cb = vi.fn();

    global.getPaginationInfo = () => ({ hasMore: true });

    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 600 });
    Object.defineProperty(document.body, 'offsetHeight', { configurable: true, writable: true, value: 1200 });

    setupInfiniteScroll(cb);

    Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: 100 });
    window.dispatchEvent(new Event('scroll'));
    vi.runAllTimers();
    expect(cb).not.toHaveBeenCalled();

    Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: 400 });
    window.dispatchEvent(new Event('scroll'));
    vi.runAllTimers();
    expect(cb).toHaveBeenCalledOnce();
  });
});
