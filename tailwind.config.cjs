const colors = require('tailwindcss/colors');

module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}', './modules/**/*.js'],
  theme: {
    extend: {
      colors: {
        primary: colors.pink,
      },
      backgroundImage: {
        'pink-gradient':
          'linear-gradient(120deg, rgba(255,214,246,0.82) 60%, rgba(253,123,197,0.92) 100%)',
      },
      borderRadius: {
        card: '2px',
      },
      boxShadow: {
        card: '0 2px 16px rgba(214,51,132,0.15), 0 1.5px 8px rgba(255,105,180,0.10)',
      },
    },
  },
  plugins: [],
};
