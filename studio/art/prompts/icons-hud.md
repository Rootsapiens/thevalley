# icons-hud

- **Output file:** `art-incoming/icons-hud.png`
- **Size:** 1024x1024
- **Transparent background:** no (black background, keyed by luminance)
- **Palette:** #FFB000 on #07090C

## Prompt (paste into ChatGPT)

```
HUD icon set on a pure black background: a 4x2 grid of 8 simple monochrome pictograms drawn in flat amber (#FFB000) with no gradient: health cross, suit charge battery, nail ammo (three nails), wrench, nail driver, key card, breaker switch, crosshair. Clean thick strokes, 1998-era pixel-art-inspired but crisp, consistent 8px-equivalent stroke, equal spacing, no labels, no text, no numbers.
```

## Acceptance checks
- [ ] exactly 8 icons in a 4x2 grid
- [ ] single colour #FFB000 only
- [ ] no text or numerals
- [ ] icons distinguishable at 32px
- [ ] Style-guide faults checklist passed
- [ ] `node scripts/check-art.mjs` exits 0
