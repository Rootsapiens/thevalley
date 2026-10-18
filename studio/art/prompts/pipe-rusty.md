# pipe-rusty

- **Output file:** `art-incoming/pipe-rusty.png`
- **Size:** 1024x1024
- **Transparent background:** no
- **Palette:** #8C4A2A rust, base #4A4C4B

## Prompt (paste into ChatGPT)

```
Seamless tileable texture, top-down orthographic, perfectly flat even lighting with no directional shadows, no vignette, low noise, soft local contrast, no feature larger than a quarter of the image, absolutely no text, numbers, logos or watermarks. Square 1:1, 1024x1024. Hand-painted-photographic hybrid, late-1990s game texture feel. Rusty industrial pipe surface, view straight on, horizontal cylinder with flange seams, orange-brown corrosion over dark steel.
```

## Acceptance checks
- [ ] 1024x1024, no alpha
- [ ] 50% offset on both axes shows no seam
- [ ] no text or logos
- [ ] average colour within dE 25 of the named token (check-art.mjs)
- [ ] no baked shadows or vignette
- [ ] Style-guide faults checklist passed
- [ ] `node scripts/check-art.mjs` exits 0
