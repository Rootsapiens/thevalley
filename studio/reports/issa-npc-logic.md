# Issa NPC logic report
- Changed: `C:\Users\nadee\Desktop\OmegaValley\src\npcData.ts` and `C:\Users\nadee\Desktop\OmegaValley\tests\npcData.test.ts`.
- Created: `C:\Users\nadee\Desktop\OmegaValley\studio\reports\issa-npc-logic.md`.
- Verification: `npm run check` exited `0`; `82` tests passed (`npm run check`).
- Data counts and unknown floors from `node --experimental-strip-types -e "import('./src/npcData.ts').then(({NPCS}) => { const a=Object.values(NPCS); console.log(JSON.stringify({npcIds:a.length, floorUnknown:a.filter(n=>!n.floorKnown).map(n=>({id:n.id,y:n.position.y})), triggers:a.reduce((s,n)=>s+n.triggers.length,0), proposed:a.reduce((s,n)=>s+n.triggers.filter(t=>t.status==='proposed').length,0), canon:a.reduce((s,n)=>s+n.triggers.filter(t=>t.status==='canon').length,0)})); })"`: `15` NPCs, `31` triggers (`30` proposed, `1` canon); unknown-floor positions are Omar, Elia, Moreno, officer two, and the farmer's wife, each at temporary `y=0`.
- Omar moves through café, mountain-find, police-post, and upstairs story stages; transport and medical-check state control his appearance and cuffs. Elia requires Day Two and Moreno's assignment.
- Maryam's kitchen position uses the yard floor plus the specified `0.02m` offset (asserted by `npm run check`).
- The farmer/wife `[ref]` line stays unmapped: `studio/world/characters.md` gives no speaker attribution.
- Exact café-room and mountain-find coordinates remain open; the specs give only room bounds or defer placement to the scene.
- Not verified: browser run, UE import, or live Unreal Editor; UE5 remains paused in `studio/decisions.md`.
