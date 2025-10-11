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

- `index.html` – Main entry point with inline Tailwind Play config and component layers (no build step required)
- `main.js` – App bootstrap and logic
- `modules/` – Modular JavaScript (gallery, tag explorer, sidebar, etc.)
- `audio/`, `icons/` – Media assets
- `test/` – Test files

## Getting Started

1. Clone the repository
2. Open `index.html` in your browser
3. Explore artists, tags, and sidebar features

## Landing Ritual & Mission Storage

- The landing page now opens with a whisper ritual that locks the **Enter Gallery** call-to-action until you pick a mission profile, consent to local logging, and confirm the choice.
- Once confirmed, TagExplorer stores the mission metadata in `localStorage` under the key `te.mission.profile` with the mission id, display label, description copy, and a UNIX timestamp.
- A `landing:mission-set` `CustomEvent` is dispatched on `document` after the ritual resolves so other modules can react (e.g., updating UI states or scheduling whispers). Azure TTS also emits a `mission_confirm` whisper when available.
- The data never leaves your machine. To reset the ritual, clear that key via the browser console (`localStorage.removeItem('te.mission.profile')`) or delete the entry from Application Storage tools, then refresh the page.

## Customization

- Add new tags or artists by editing the JSON files
- Tweak colors, shadows, or component layers inside `index.html`'s `<style type="text/tailwindcss">` block or the adjacent `tailwind.config` script
- Extend sidebar or gallery features in the `modules/` directory

## License

MIT License
