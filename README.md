# Tag Explorer

A modern, visually unified web app for exploring, filtering, and discovering artists and tags with a focus on a playful, interactive UI/UX.

## Features

- **Artist Explorer**: Browse a gallery of artists with infinite scroll and quick tag-based filtering.
- **Tag Explorer**: Browse, select, and combine tags to filter artists. Sticky, unified bars for navigation.
- **Sidebar**: Minimal, icon-driven, collapsible sidebar for copied artists and actions.
- **Modern UI**: Unified backgrounds, border radii, and compact layouts for all navigation bars and sidebar.
- **Responsive Design**: Works on desktop and mobile, with adaptive layouts and touch-friendly controls.
- **Fun Interactions**: Includes taunt banners, shame badges, and playful iconography.

## Shame Dossier

- Open the dossier from the **DOSSIER** controls in the command bar (inner layout) or the cover toolbar to review a glassmorphic timeline of every tag edit, gallery crawl milestone, favorite toggle, and taunt.
- Use the **Wipe log** action inside the overlay (or clear `localStorage['te.dossier.entries']` in the console) to purge local history instantly.
- Dossier whispers respect the TTS intensity slider: higher intensities surface harsher `dossier_open` / `dossier_revisit` lines, while disabled TTS falls back to a soft on-screen caption inside the panel.

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

## Customization

- Add new tags or artists by editing the JSON files
- Tweak colors, shadows, or component layers inside `index.html`'s `<style type="text/tailwindcss">` block or the adjacent `tailwind.config` script
- Extend sidebar or gallery features in the `modules/` directory

## License

MIT License
