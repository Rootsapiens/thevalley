# panel-control

- **Output file:** `art-incoming/panel-control.png`
- **Size:** 1024x1024
- **Transparent background:** no
- **Palette:** #5B6670 metal, #16181A, lamps #FF9A3C and #D62828

## Prompt (paste into ChatGPT)

```
Seamless tileable texture, top-down orthographic, perfectly flat even lighting with no directional shadows, no vignette, low noise, soft local contrast, no feature larger than a quarter of the image, absolutely no text, numbers, logos or watermarks. Square 1:1, 1024x1024. Hand-painted-photographic hybrid, late-1990s game texture feel. Control room panel surface: dark grey steel with rows of blank rubber buttons, unlabeled toggle switches and round unlit lamps. All labels blank. A few lamps amber, one red.
```

## Acceptance checks
- [ ] 1024x1024, no alpha
- [ ] 50% offset on both axes shows no seam
- [ ] no text or logos
- [ ] average colour within dE 25 of the named token (check-art.mjs)
- [ ] no baked shadows or vignette
- [ ] all buttons and plates are blank (no glyphs)
- [ ] Style-guide faults checklist passed
- [ ] `node scripts/check-art.mjs` exits 0
