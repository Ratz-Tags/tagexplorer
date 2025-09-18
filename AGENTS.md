# Agent Guidelines for Tag Explorer

## Scope
These instructions apply to the entire repository.

## Development Workflow
- This project uses Node.js ECMAScript modules. Use `import`/`export` syntax and avoid CommonJS helpers like `require`.
- Prefer `const` and `let`; never introduce `var`.
- Follow the existing two-space indentation and keep semicolons on statements, matching the current code style.
- When adding or editing exported functions, include brief JSDoc-style block comments (`/** ... */`) describing the purpose and key parameters.
- Keep modules focused: new logic should live in the module that owns the feature (e.g., gallery behavior in `modules/gallery.js`, tag logic in `modules/tags.js`).
- DOM-manipulating code must guard against missing elements so the app can fail gracefully when markup changes.

## Data Files
- JSON files act as data sources for the UI. Keep arrays sorted alphabetically unless a different order is explicitly documented in the file.
- Ensure JSON files remain valid UTF-8 with a trailing newline and no trailing commas.

## Styling
- Reuse existing CSS custom properties in `style.css` whenever possible instead of hard-coding new colors or fonts.
- Preserve the mobile-first approach: test layout changes at widths below 700px and ensure sticky bars and sidebar remain usable.

## Testing & Verification
- Run `npm test` after making code changes, and update or add tests in the `test/` directory when you introduce new behavior.
- Avoid introducing tests that depend on network access; mock or stub browser and fetch APIs similarly to existing tests.

## Tooling Notes
- The `npm run update:tags` script reaches out to Danbooru; do not run it as part of routine test commands or in CI documentation.
- If you modify the tag update scripts, document rate limiting and concurrency assumptions in code comments.

## PR / Summary Expectations
- Summaries should mention user-visible changes (UI, data, or behavior) alongside backend or tooling updates when applicable.
- Always list the test commands you executed in the testing section of the final response.
