# ASMR Layer Pack

Drop loop-friendly `.webm` files in this folder to feed the humiliation audio mixer. Each file should be mastered around -18 LUFS, trimmed to seamless loops, and exported as mono Opus to keep bundle size lean. Suggested layers:

1. **breath-soft.webm** — barely audible breaths and throat noise.
2. **whimper-mid.webm** — restrained whimpers that can sit under Azure whispers.
3. **moan-intense.webm** — edge-of-orgasm chokes for the desperate tier.

Keep clips respectful (no explicit words) and under 20 seconds to minimise repetition. See `data/asmr-layers.json` for metadata expectations; running `npm run update:audio` will regenerate that manifest to include any new `.webm` files.

> ⚠️ Consent reminder: only add assets you have the right to redistribute. Contributors should record their own layers or source from licensed CC0/CC-BY packs.
