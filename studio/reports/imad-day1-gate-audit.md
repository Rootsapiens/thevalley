# Day 1 → Day 2 causal gate audit (source only)

2026-10-21. Scope: the normal earned campaign, not direct `?day=2` preview URLs. No runtime playthrough or code change.

## Finding

**Yes, Day 1 can advance before Maryam confirms Joseph is missing or reaches the square.** `src/villageMain.ts:669-675` schedules the Day 2 transition when Moreno's `moreno_said` plays after Omar is heard and the guarded medical check finishes. `:725-733` then changes the phase and URL using only `omarHeard`, `medicalCheckComplete`, and `morenoHeard`. The saved Maryam stage is absent from that gate (`src/campaignProgress.ts:9, 14-18, 42-49`). Lorenzo can therefore visit the post first, hear Omar, wait for the check, and talk to Moreno without visiting Maryam. Her `maryam_confirmed_missing` line is what starts her walk (`src/villageMain.ts:640-650`); arrival is recorded separately (`:930-935`). The objective sequence points toward Maryam but does not constrain the post branch.

**No, the earned transition cannot advance before Omar's guarded check completes.** Hearing `omar_mountain` schedules it (`src/villageMain.ts:651-654`); completion later sets `story.medicalCheckComplete`, releases cuffs, and saves the bit (`:715-723`). Moreno's transition requires that bit in the current story and, for saved campaign phase, the saved medical bit (`:669-674, :729-733`). The campaign loader rejects an earned `morenoHeard` without medical completion (`src/campaignProgress.ts:46-47`). Direct `?day=2` is a preview path, not evidence of earned progress.

## Story interpretation and bounded fix

Owner canon orders Maryam's **own** actions: she goes to the square after Joseph is late and she confirms he has not returned. It does not explicitly order her search against Lorenzo's separate Omar/Moreno visit. Current code respects that internal Maryam order (`src/villageMain.ts:640-650`, `src/npcTalk.ts:267-286`). The episode treatment presents a Maryam → square → post objective trail (`studio/script/episode-one-gameplay.md`, Chapter 1, steps 4–6), while also calling the medical prerequisite an implementation gate rather than fixed canon. Thus the Day 2 skip is a **gameplay continuity gap if the objective trail is intended as mandatory**, not proof that the locked Maryam chronology itself is broken.

If the intended Episode One route requires Maryam's confirmation before Day 2, gate Moreno's **transition** on a persisted Maryam stage at least `confirmed-moving`; require `square` only if reaching the square is explicitly mandatory. Reflect the same prerequisite in campaign progress validation and reload handling. Do not gate Moreno's ordinary line or invent dialogue. If Maryam's branch is optional, keep the current progression and describe the objective sequence as guidance rather than mandatory. This source audit does not choose between those product rules.
