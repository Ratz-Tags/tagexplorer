import defaultTheme from 'tailwindcss/defaultTheme.js';

export default {
  content: ['./public/**/*.html', './src/**/*.js'],
  theme: {
    extend: {
      colors: {
        base: 'oklch(0.1 0.02 260 / <alpha-value>)',
        panel: 'oklch(0.19 0.02 260 / <alpha-value>)',
        accent: {
          cyan: 'oklch(0.8 0.14 205 / <alpha-value>)',
          pink: 'oklch(0.8 0.18 350 / <alpha-value>)'
        },
        heat: {
          red: 'oklch(0.66 0.25 25 / <alpha-value>)'
        },
        glass: 'rgba(10, 10, 16, 0.62)'
      },
      fontFamily: {
        display: ['\'Rajdhani\'', '\'Orbitron\'', ...defaultTheme.fontFamily.sans],
        body: ['\'Inter\'', '\'Satoshi\'', ...defaultTheme.fontFamily.sans]
      },
      screens: {
        'fold-cover': { raw: '(max-width: 520px) and (orientation: portrait)' },
        'fold-inner': { raw: '(min-width: 980px) and (min-height: 980px)' }
      },
      boxShadow: {
        neon: '0 0 30px oklch(0.8 0.18 350 / 0.45)',
        'neon-cyan': '0 0 30px oklch(0.8 0.14 205 / 0.45)',
        glass: '0 16px 48px rgba(2, 4, 24, 0.8)'
      },
      backdropBlur: {
        galaxy: '24px'
      },
      animation: {
        'pulse-slow': 'pulse 5s ease-in-out infinite',
        shimmer: 'shimmer 8s linear infinite'
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '0% 0%' },
          '100%': { backgroundPosition: '200% 200%' }
        }
      }
    }
  },
  plugins: []
};
