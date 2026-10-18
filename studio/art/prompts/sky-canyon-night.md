# sky-canyon-night

- **Output file:** `art-incoming/sky-canyon-night.png`
- **Size:** 3072x1024 (3:1 wide) if offered, else 1536x1024
- **Transparent background:** no
- **Palette:** sky zenith #0B1220, horizon haze #2A3440, glow #2FE0C8

## Prompt (paste into ChatGPT)

```
Panoramic night backdrop of a desert canyon seen from a dam catwalk. Flat horizon exactly at the vertical centre of the image, perfectly level. Sheer rock canyon walls on both sides rising above the horizon, silhouetted in deep blue-black. Clear starry sky, cold pale moon glow coming from the upper left behind the viewer, no moon disc visible. Distant haze at the horizon. Far in the centre, small teal glow (#2FE0C8) of a rupture, with a few rock slabs drifting upward. No buildings in the foreground, no text.
```

## Acceptance checks
- [ ] horizon at 50% +/- 1% height and level
- [ ] left and right edges roughly continue (for wrap)
- [ ] light from upper left
- [ ] no text
- [ ] dE within 25
- [ ] Style-guide faults checklist passed
- [ ] `node scripts/check-art.mjs` exits 0
