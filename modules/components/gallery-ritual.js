const MOTION_URL = 'https://cdn.jsdelivr.net/npm/motion@10.16.4/+esm';
let motionModulePromise = null;
const scheduleMicrotask = typeof queueMicrotask === 'function'
  ? queueMicrotask
  : (callback) => Promise.resolve().then(callback);

function shouldReduceMotion() {
  if (typeof window === 'undefined') return true;
  try {
    if (document?.documentElement?.dataset?.motion === 'reduced') {
      return true;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (error) {
    console.warn('[gallery-ritual] motion check failed', error);
    return false;
  }
}

async function loadMotion() {
  if (shouldReduceMotion()) return null;
  if (!motionModulePromise) {
    motionModulePromise = import(MOTION_URL).catch((error) => {
      console.warn('[gallery-ritual] Motion import failed', error);
      return null;
    });
  }
  try {
    return await motionModulePromise;
  } catch (error) {
    console.warn('[gallery-ritual] Motion load error', error);
    return null;
  }
}

function createTemplate({
  name,
  caption,
  description,
  glyphs,
}) {
  const glyphMarkup = Array.isArray(glyphs)
    ? glyphs
        .map(
          (glyph, index) => `
            <span class="ritual__glyph" data-index="${index}">
              <span class="ritual__glyph-symbol" aria-hidden="true">${glyph}</span>
            </span>
          `,
        )
        .join('')
    : '';

  return `
    <style>
      :host {
        position: fixed;
        inset: 0;
        z-index: 160;
        pointer-events: none;
        display: block;
        color: #f8f9ff;
      }

      .ritual-overlay {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        pointer-events: none;
        background: transparent;
      }

      :host([data-fold-mode='fold-cover']) .ritual-overlay {
        padding: 2.25rem 1.5rem 4.5rem;
        align-content: end;
      }

      :host([data-fold-mode='fold-inner']) .ritual-overlay {
        padding: 3rem;
        align-content: center;
      }

      .ritual-overlay__backdrop {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at 20% 18%, rgba(255, 100, 212, 0.32), transparent 62%),
          radial-gradient(circle at 80% 82%, rgba(102, 243, 255, 0.24), transparent 68%),
          rgba(9, 8, 16, 0.82);
        opacity: 0;
        transition: opacity 280ms ease;
      }

      :host([data-visible='true']) .ritual-overlay__backdrop {
        opacity: 1;
        pointer-events: auto;
      }

      .ritual-dialog {
        position: relative;
        pointer-events: auto;
        display: grid;
        gap: 1.5rem;
        padding: 2.75rem clamp(1.5rem, 3vw, 3.25rem);
        border-radius: 1.75rem;
        border: 1px solid rgba(255, 255, 255, 0.16);
        background:
          linear-gradient(145deg, rgba(12, 11, 22, 0.95), rgba(14, 16, 30, 0.85));
        box-shadow:
          0 45px 95px -35px rgba(255, 99, 200, 0.52),
          inset 0 0 0 1px rgba(102, 243, 255, 0.22);
        min-width: min(92vw, 540px);
        max-width: min(94vw, 620px);
        transform: translateY(24px);
        opacity: 0;
        transition: opacity 260ms ease, transform 320ms cubic-bezier(.4,-0.2,.2,1.2);
      }

      :host([data-visible='true']) .ritual-dialog {
        opacity: 1;
        transform: translateY(0);
      }

      :host([data-fold-mode='fold-cover']) .ritual-dialog {
        width: 100%;
        max-width: none;
      }

      .ritual-header {
        display: grid;
        gap: 0.65rem;
        text-transform: uppercase;
        letter-spacing: 0.32em;
      }

      .ritual-title {
        font-size: clamp(1.05rem, 2.2vw, 1.45rem);
        font-family: 'Rajdhani', system-ui, sans-serif;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
      }

      .ritual-caption {
        font-size: 0.68rem;
        color: rgba(240, 242, 255, 0.75);
        line-height: 1.6;
      }

      .ritual-body {
        display: grid;
        gap: 0.85rem;
      }

      .ritual-description {
        font-size: 0.9rem;
        line-height: 1.6;
        color: rgba(244, 247, 255, 0.9);
      }

      .ritual-glyphs {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
      }

      .ritual__glyph {
        width: clamp(52px, 12vw, 76px);
        aspect-ratio: 1 / 1;
        border-radius: 28%;
        display: grid;
        place-items: center;
        background: radial-gradient(circle at 50% 35%, rgba(255, 118, 214, 0.35), rgba(12, 11, 22, 0.4));
        border: 1px solid rgba(255, 118, 214, 0.32);
        box-shadow:
          0 0 0 1px rgba(102, 243, 255, 0.2),
          0 18px 38px -20px rgba(102, 243, 255, 0.55);
        position: relative;
        overflow: hidden;
      }

      .ritual__glyph::after {
        content: '';
        position: absolute;
        inset: 12%;
        border-radius: inherit;
        background:
          radial-gradient(circle at 50% 20%, rgba(255, 255, 255, 0.2), transparent 70%);
        mix-blend-mode: screen;
      }

      .ritual__glyph-symbol {
        font-size: clamp(1.75rem, 4vw, 2.35rem);
        color: rgba(249, 250, 255, 0.92);
        text-shadow: 0 0 22px rgba(255, 118, 214, 0.8);
      }

      .ritual-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        justify-content: flex-end;
      }

      .ritual-btn {
        appearance: none;
        border: none;
        border-radius: 999px;
        padding: 0.65rem 1.4rem;
        text-transform: uppercase;
        letter-spacing: 0.28em;
        font-size: 0.62rem;
        font-weight: 600;
        cursor: pointer;
        transition: transform 180ms ease, box-shadow 220ms ease;
        position: relative;
        overflow: hidden;
      }

      .ritual-btn:focus-visible {
        outline: 2px solid rgba(255, 100, 212, 0.7);
        outline-offset: 3px;
      }

      .ritual-btn[data-variant='dismiss'] {
        background: rgba(9, 10, 18, 0.65);
        color: rgba(222, 230, 255, 0.8);
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
      }

      .ritual-btn[data-variant='complete'] {
        background: linear-gradient(120deg, rgba(255, 100, 212, 0.9), rgba(102, 243, 255, 0.9));
        color: #05030a;
        box-shadow: 0 18px 40px -20px rgba(102, 243, 255, 0.65);
      }

      .ritual-btn[data-variant='reset'] {
        background: rgba(8, 9, 16, 0.4);
        color: rgba(255, 255, 255, 0.6);
        border: 1px dashed rgba(255, 255, 255, 0.18);
      }

      .ritual-btn:hover {
        transform: translateY(-2px);
      }

      .ritual-meta {
        font-size: 0.68rem;
        color: rgba(210, 220, 255, 0.65);
        line-height: 1.5;
      }

      @media (prefers-reduced-motion: reduce) {
        .ritual-dialog,
        .ritual-overlay__backdrop,
        .ritual-btn {
          transition: none !important;
        }
      }
    </style>
    <div class="ritual-overlay" part="overlay">
      <div class="ritual-overlay__backdrop" part="backdrop"></div>
      <article
        class="ritual-dialog"
        part="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ritual-title"
      >
        <header class="ritual-header">
          <h2 id="ritual-title" class="ritual-title">${name}</h2>
          <p class="ritual-caption">${caption}</p>
        </header>
        <div class="ritual-body">
          <p class="ritual-description">${description}</p>
          <div class="ritual-glyphs" aria-hidden="true">
            ${glyphMarkup}
          </div>
        </div>
        <p class="ritual-meta">Dismiss if you want the gallery to pretend it never saw this combo. Complete it to keep the glow watching.</p>
        <div class="ritual-actions">
          <button type="button" class="ritual-btn" data-variant="dismiss">Not yet</button>
          <button type="button" class="ritual-btn" data-variant="complete">Submit</button>
          <button type="button" class="ritual-btn" data-variant="reset">Reset</button>
        </div>
      </article>
    </div>
  `;
}

class GalleryRitualElement extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._ritual = null;
    this._foldMode = 'default';
    this._visible = false;
    this._cleanup = [];
    this._focusables = [];
    this._handleKeyDown = (event) => this.onKeyDown(event);
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    this.disposeListeners();
  }

  configure({ ritual, foldMode } = {}) {
    this._ritual = ritual || null;
    if (foldMode) {
      this._foldMode = foldMode;
    }
    this.render();
  }

  setFoldMode(mode) {
    this._foldMode = mode || 'default';
    this.setAttribute('data-fold-mode', this._foldMode);
  }

  render() {
    if (!this._ritual) {
      this.disposeListeners();
      this.shadowRoot.innerHTML = '';
      this.removeAttribute('data-visible');
      return;
    }
    this.disposeListeners();
    this.shadowRoot.innerHTML = createTemplate(this._ritual);
    this.setAttribute('data-fold-mode', this._foldMode);
    scheduleMicrotask(() => {
      this.setupInteractions();
      this.open();
    });
  }

  setupInteractions() {
    const dismissBtn = this.shadowRoot.querySelector('[data-variant="dismiss"]');
    const completeBtn = this.shadowRoot.querySelector('[data-variant="complete"]');
    const resetBtn = this.shadowRoot.querySelector('[data-variant="reset"]');
    const backdrop = this.shadowRoot.querySelector('.ritual-overlay__backdrop');
    const dialog = this.shadowRoot.querySelector('.ritual-dialog');

    if (dismissBtn) {
      const dismissHandler = () => this.emitAndClose('ritual:dismiss');
      dismissBtn.addEventListener('click', dismissHandler);
      this._cleanup.push(() => dismissBtn.removeEventListener('click', dismissHandler));
    }
    if (completeBtn) {
      const completeHandler = () => this.emitAndClose('ritual:complete');
      completeBtn.addEventListener('click', completeHandler);
      this._cleanup.push(() => completeBtn.removeEventListener('click', completeHandler));
    }
    if (resetBtn) {
      const resetHandler = () => this.dispatchEvent(new CustomEvent('ritual:reset', { detail: { id: this._ritual.id } }));
      resetBtn.addEventListener('click', resetHandler);
      this._cleanup.push(() => resetBtn.removeEventListener('click', resetHandler));
    }
    if (backdrop) {
      const onBackdrop = (event) => {
        if (event.target === backdrop) {
          this.emitAndClose('ritual:dismiss');
        }
      };
      backdrop.addEventListener('click', onBackdrop);
      this._cleanup.push(() => backdrop.removeEventListener('click', onBackdrop));
    }
    if (dialog) {
      dialog.setAttribute('tabindex', '-1');
    }

    this.shadowRoot.addEventListener('keydown', this._handleKeyDown);
    this._cleanup.push(() => this.shadowRoot.removeEventListener('keydown', this._handleKeyDown));

    this._focusables = Array.from(
      this.shadowRoot.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute('disabled'));

    if (dialog) {
      dialog.focus({ preventScroll: true });
    } else if (this._focusables[0]) {
      this._focusables[0].focus({ preventScroll: true });
    }
  }

  async open() {
    this._visible = true;
    this.setAttribute('data-visible', 'true');
    const motion = await loadMotion();
    if (!motion) return;
    const glyphs = this.shadowRoot.querySelectorAll('.ritual__glyph');
    glyphs.forEach((glyph, index) => {
      motion
        .animate(
          glyph,
          {
            opacity: [0, 1],
            scale: [0.75, 1],
            filter: ['blur(6px)', 'blur(0px)'],
          },
          {
            duration: 520,
            delay: index * 80,
            easing: 'cubic-bezier(.4,-0.2,.2,1.2)',
          },
        )
        .finished.catch(() => {});
    });
  }

  emitAndClose(eventName) {
    this.dispatchEvent(new CustomEvent(eventName, { detail: { id: this._ritual?.id } }));
    this.close();
  }

  close() {
    this._visible = false;
    this.removeAttribute('data-visible');
    this.disposeListeners();
    this.shadowRoot.innerHTML = '';
  }

  onKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.emitAndClose('ritual:dismiss');
      return;
    }
    if (event.key !== 'Tab') return;
    if (!this._focusables.length) return;
    const focusables = this._focusables;
    const active = this.shadowRoot.activeElement || document.activeElement;
    const currentIndex = focusables.indexOf(active);
    if (event.shiftKey) {
      if (currentIndex <= 0) {
        event.preventDefault();
        focusables[focusables.length - 1].focus();
      } else if (currentIndex === -1) {
        event.preventDefault();
        focusables[focusables.length - 1].focus();
      }
    } else {
      if (currentIndex === focusables.length - 1 || currentIndex === -1) {
        event.preventDefault();
        focusables[0].focus();
      }
    }
  }

  disposeListeners() {
    if (!this._cleanup.length) return;
    this._cleanup.forEach((dispose) => {
      try {
        dispose();
      } catch (error) {
        console.warn('[gallery-ritual] dispose failed', error);
      }
    });
    this._cleanup = [];
  }
}

if (!customElements.get('te-gallery-ritual')) {
  customElements.define('te-gallery-ritual', GalleryRitualElement);
}
