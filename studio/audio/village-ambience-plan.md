# Village ambience and footsteps plan (barn slice)
Source read: src/villageAudio.ts (not edited), studio/world/regions/village.md. All synthesized, no ElevenLabs spend.
Budget: studio/audio/elevenlabs-ledger.md does not exist, so 0 credits logged. Remaining = 6,000 of 6,000. Create the ledger before any generation.

## Existing (keep)
Beds: windBed (brown noise, 3 bands, gust/indoor/fade), streamBed (babble + hiss, level by distance). One-shots: step (dirt/wood/straw/stone), creak, latch, rattle, dog, chime, drone. Master 0.8 into limiter -3 dB.

## Gaps for the plan
- Surface map: dirt-road -> `dirt` (valley road `=`), grass-dry -> new `grass` (`,` cells), wood-planks-barn -> `wood`, stone-wall -> `stone` (cobbles `.`, wall tops). `straw` stays for stall floors.
- New `grass` step: lowpass 900 Hz burst + two 3-5 kHz swishes, peak ~0.4 (quieter than dirt). Extend `Step` type and measureVillagePeaks list.
- Step cadence: walk 0.5 s, crouch 0.75 s at k=0.5, jump landing k=1.3. Pitch/filter jitter via rand() already; add +-8% gain jitter.
- Surface lookup: tile char at player cell -> Step (dirt `=`, grass `,`, stone `.` `#`, wood inside barn B, straw inside stalls).

## Reverb zones (from village.md)
- Outdoor village: dry, no send (open valley, 200 x 130 m).
- Barn 1 (20 x 20 m, wood): convolver IR 1.1 s, wet 0.25, lowpass 4 kHz; wind indoor=0.8; creak and straw rustle ambient.
- Stone church/tower (nave C, tower 3): IR 2.6 s, wet 0.35, bright tail; footsteps forced to `stone`.
- Pasture to cave mouth (hoofprint trail NE): long single-slap echo 0.4 s, wet 0.15 for dog.
- Build: one shared `ConvolverNode` per zone from reverbIR(c, secs) (reuse existing), route a send gain per zone; crossfade wet gains with setTargetAtTime(0.3) on zone change; zone = AABB of building cells (5 m per cell).

## Ambience layers to add (synth)
1. Wind bed (exists) -12 dB outdoors at -28 LUFS target; indoor muffle already in windAt.
2. Stream bed near x=35-36 (exists); level = 1 - dist/60 m.
3. Barn interior: low room tone (brown noise lowpass 200 Hz, -34 LUFS), dripping-free; occasional straw shift (straw burst, 20-40 s random).
4. Distant dog every 25-60 s (exists), cow low moo 40-90 s (new: sawtooth 90->70 Hz glide through two formants, 0.9 s), none at dusk-prologue animal absence? keep moo off after the herd leaves.
5. Pre-event cue: creak plus dust (white burst highpass 3 kHz) 0.6 s before root lash.

## Measure
Run measureVillagePeaks(): every peak < 0.89 (-1 dBFS). Render beds 30 s and check ebur128 (beds -28, SFX -18 LUFS). Log in studio/audio/mix-sheet.md. Propose patch to Rajaie/Zurub; no src edit by Khaled.
