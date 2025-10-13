export default {
  content: [
    './index.html',
    './gallery/index.html',
    './about/index.html',
    './main.js',
    './modules/**/*.js',
  ],
  safelist: [
    'gallery-layout',
    'gallery-shell',
    'gallery-grid',
  ],
  theme: {
    extend: {
      colors: {
        night: '#0c0b16',
        panel: '#161525',
        glow: '#66f3ff',
        blush: '#ff64d4',
        ember: '#ff8257',
        command: {
          kneel: '#4ee3f5',
          confess: '#ff86d6',
          siren: '#ff4a6d',
          escape: '#7f8cff',
        },
        indulgence: {
          0: '#1b1830',
          1: '#2d1f45',
          2: '#4a1f52',
          3: '#741f4b',
        },
        pressure: {
          idle: '#2a2a40',
          low: '#66f3ff',
          mid: '#ff64d4',
          high: '#ff8257',
          max: '#ff2f64',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Rajdhani', 'system-ui', 'sans-serif'],
        script: ['Parisienne', 'cursive'],
      },
      boxShadow: {
        neon: '0 25px 60px -15px rgba(102, 243, 255, 0.35)',
        pulse: '0 0 0 2px rgba(255, 100, 212, 0.25)',
        'pressure-low': '0 0 28px rgba(102, 243, 255, 0.4)',
        'pressure-mid': '0 0 36px rgba(255, 100, 212, 0.38)',
        'pressure-high': '0 0 42px rgba(255, 130, 87, 0.45)',
        'pressure-max': '0 0 48px rgba(255, 47, 100, 0.55)',
        'ritual-panel': '0 45px 95px -35px rgba(255, 99, 200, 0.52)',
        'command-kneel': '0 22px 56px -28px rgba(78, 227, 245, 0.6)',
        'command-confess': '0 24px 58px -30px rgba(255, 134, 214, 0.55)',
        'command-siren': '0 26px 62px -28px rgba(255, 74, 109, 0.58)',
        'command-escape': '0 22px 54px -28px rgba(127, 140, 255, 0.52)',
      },
      dropShadow: {
        ritual: '0 0 1.8rem rgba(255, 100, 212, 0.55)',
        'ritual-cyan': '0 0 2.2rem rgba(102, 243, 255, 0.5)',
      },
      outlineOffset: {
        3: '0.75rem',
        ritual: '0.375rem',
      },
      screens: {
        'fold-cover': {'raw': '(max-width: 520px) and (orientation: portrait)'},
        'fold-inner': {'raw': '(min-width: 980px) and (min-height: 980px)'},
      },
      backdropBlur: {
        glass: '18px',
      },
      transitionTimingFunction: {
        kink: 'cubic-bezier(.4,-0.2,.2,1.2)',
      },
    },
  },
  plugins: [],
};
