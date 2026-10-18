# grating-metal

- **Output file:** `art-incoming/grating-metal.png`
- **Size:** 1024x1024
- **Transparent background:** no (gaps are dark, not transparent)
- **Palette:** #5B6670 metal, gaps #16181A

## Prompt (paste into ChatGPT)

```
Seamless tileable texture, top-down orthographic, perfectly flat even lighting with no directional shadows, no vignette, low noise, soft local contrast, no feature larger than a quarter of the image, absolutely no text, numbers, logos or watermarks. Square 1:1, 1024x1024. Hand-painted-photographic hybrid, late-1990s game texture feel. Steel floor grating, square mesh, dark gaps showing near-black, slightly worn galvanised steel bars.
```

## Acceptance checks
- [ ] 1024x1024, no alpha
- [ ] 50% offset on both axes shows no seam
- [ ] no text or logos
- [ ] average colour within dE 25 of the named token (check-art.mjs)
- [ ] no baked shadows or vignette
- [ ] Style-guide faults checklist passed
- [ ] `node scripts/check-art.mjs` exits 0
