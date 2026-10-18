# stripe-hazard

- **Output file:** `art-incoming/stripe-hazard.png`
- **Size:** 1024x1024
- **Transparent background:** no
- **Palette:** #E8B820 hazardYellow and #16181A hazardBlack

## Prompt (paste into ChatGPT)

```
Seamless tileable texture, top-down orthographic, perfectly flat even lighting with no directional shadows, no vignette, low noise, soft local contrast, no feature larger than a quarter of the image, absolutely no text, numbers, logos or watermarks. Square 1:1, 1024x1024. Hand-painted-photographic hybrid, late-1990s game texture feel. Hazard stripes, alternating yellow and black diagonal bands at 45 degrees, exactly 8 yellow bands across the tile, painted on concrete, worn edges.
```

## Acceptance checks
- [ ] 1024x1024, no alpha
- [ ] 50% offset on both axes shows no seam
- [ ] no text or logos
- [ ] average colour within dE 25 of the named token (check-art.mjs)
- [ ] no baked shadows or vignette
- [ ] stripes tile continuously at the edges
- [ ] Style-guide faults checklist passed
- [ ] `node scripts/check-art.mjs` exits 0
