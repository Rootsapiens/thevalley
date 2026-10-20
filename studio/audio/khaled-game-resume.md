# Khaled — village ambience resume

## Change

Added two procedural ambience voices to `src/villageAudio.ts`:

- A quiet, low cow bellow with two filtered formants (`moo`).
- A short straw shift with soft rustle and stall-floor thump (`straw`).

Added a `barn(inside, animalsPresent)` controller. It fades a low brown-noise room tone when the listener enters or leaves the barn and schedules straw shifts every 20–40 seconds and cow calls every 40–90 seconds while the herd is present. Leaving the barn or marking the herd absent stops scheduling calls. Both new voices are included in `measureVillagePeaks()`.

Everything is synthesized locally with Web Audio. No downloaded samples, paid services, or dialogue recording were used.

## Integration still needed

`src/villageMain.ts` must call `audio.barn(inBarn, PROLOGUE_MODE && prologueAttackT < 0 && endT < 0)` in its update loop after computing `inBarn`. This keeps the ambience local to the barn and turns the animal calls off after the prologue attack. This call-site edit is outside Khaled's assigned files and was sent to the lead.

## Validation

- `npm run typecheck` — passed.
- `npm run build` — passed, 83 modules. Existing materials chunk warning remains at about 641 kB.
- Runtime playback and loudness were not measured. The `barn` method is not audible in the game until the call site above is added.
