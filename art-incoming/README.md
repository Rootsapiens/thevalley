# art-incoming
Drop raw ChatGPT PNGs here, uncropped, named `<asset>.png` (asset names = files in `studio/art/prompts/`).

1. Open `studio/art/prompts/<asset>.md` and paste the **Prompt** block into ChatGPT image generation. Use the stated size and background.
2. Save the result here under the asset name.
3. Run `node scripts/check-art.mjs` (needs `npm i -D pngjs`).
4. Walk the faults checklist in `studio/art/style-guide.md`. Regenerate on any fail.
5. Shipped images get one line in `/CREDITS.md`.
