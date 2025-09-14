# Tag Explorer

A modern, visually unified web app for exploring, filtering, and discovering artists and tags with a focus on a playful, interactive UI/UX.

## Features

- **Artist Explorer**: Browse a gallery of artists with infinite scroll and quick tag-based filtering.
- **Tag Explorer**: Browse, select, and combine tags to filter artists. Sticky, unified bars for navigation.
- **Sidebar**: Minimal, icon-driven, collapsible sidebar for copied artists and actions.
- **Modern UI**: Unified backgrounds, border radii, and compact layouts for all navigation bars and sidebar.
- **Responsive Design**: Works on desktop and mobile, with adaptive layouts and touch-friendly controls.
- **Fun Interactions**: Includes taunt banners, shame badges, and playful iconography.

## Project Structure

- `index.html` – Main HTML entry point
- `src/main.js` – App bootstrap and logic
- `modules/` – Modular JavaScript (gallery, tag explorer, sidebar, etc.)
- `src/style.css` – Unified, modern styles for all UI elements
- `audio/`, `icons/` – Media assets
- `test/` – Test files

## Getting Started

1. Clone the repository
2. Install dependencies with `npm install`
3. Start the development server with `npm run dev` and open the provided URL
4. Run the test suite with `npm test`

## Customization

- Add new tags or artists by editing the JSON files
- Adjust styles in `src/style.css` for further theming
- Extend sidebar or gallery features in the `modules/` directory

## Build

- Create a production build with `npm run build`

## Theming

- Tailwind is configured in `tailwind.config.cjs`; adjust colors, fonts, or plugins there
- Global styles reside in `src/style.css` and can be overridden for custom themes

## License

MIT License
