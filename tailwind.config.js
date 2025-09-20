export default {
  content: [
    './index.html',
    './main.js',
    './modules/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        night: '#0c0b16',
        panel: '#161525',
        glow: '#66f3ff',
        blush: '#ff64d4',
        ember: '#ff8257',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Rajdhani', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        neon: '0 25px 60px -15px rgba(102, 243, 255, 0.35)',
        pulse: '0 0 0 2px rgba(255, 100, 212, 0.25)',
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
