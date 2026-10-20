// NPC data layer for the village slice. Pure TypeScript, no Three.js import, so it stays testable.
// Source of truth: studio/npc/README.md and the per-NPC spec files. Positions are metres, +Y up, +Z south.
// Landmark numbers are copied from src/villageMap.ts and src/village.ts (cited per entry).
import { BUILDINGS } from './villageMap';

const CAFE_BALCONY_Y = BUILDINGS.find(b => b.id === 'cafe')!.floor + 3.25;
const SCHOOL_FLOOR = BUILDINGS.find(b => b.id === 'school')!.floor;

export type NpcId =
  | 'npc_maryam'
  | 'npc_omar'
  | 'npc_elia'
  | 'npc_moreno'
  | 'npc_officer_1'
  | 'npc_officer_2'
  | 'npc_priest'
  | 'npc_farmer'
  | 'npc_farmers_wife'
  | 'npc_square_villager_1'
  | 'npc_square_villager_2'
  | 'npc_square_villager_3'
  | 'npc_square_villager_4'
  | 'npc_square_villager_5'
  | 'npc_square_villager_6';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface NpcTrigger {
  id: string;
  /** English line. */
  line: string;
  /** Arabic line: characters.md for the canon and [new] lines, Noor's studio/world/npc-line-review.md for the lines she
   *  changed; the kept lines carry a draft (marked "AR draft"), to be replaced by Noor's final text. */
  ar: string;
  /** 'canon' only for lines quoted from characters.md; everything else is a draft. */
  status: 'canon' | 'proposed';
  /** When the line can play (all fields must hold); absent = always. From the "Dialogue triggers" of each spec file. */
  when?: TriggerWhen;
}

export interface TriggerWhen {
  /** The chapter, or an inclusive [first, last] range. */
  chapter?: number | readonly [number, number];
  /** Inclusive day range. */
  day?: readonly [number, number];
  /** Binding events done, at least (ORDER prefix length): 5 = Omar has been taken to post [6]. */
  events?: number;
  /** A story flag that must be set, e.g. 'posters' (Lorenzo has seen Joseph's posters on pole [9]). */
  flag?: string;
}

export interface NpcSpec {
  id: NpcId;
  /** Short English role. */
  role: string;
  /** Minimum day the spec allows (Day 1 = 1). */
  spawnDay: number;
  position: Vec3;
  /** Radians. 0 where the spec gives no facing. */
  yaw: number;
  /** false when the floor height is not decided (README: café upstairs, school interior, farmhouse to confirm). */
  floorKnown: boolean;
  /** true only for Omar, cuffed while seated at post [6] in Ch1. */
  cuffed: boolean;
  /** False for staged appearances where an NPC is on-screen but not yet available to talk to. */
  talkable?: boolean;
  triggers: NpcTrigger[];
  /** Runtime story stage supplied by npcsAtDay; the authored base records stay engine-neutral. */
  stage?: 'prologue-search' | 'post-prologue' | 'maryam-home' | 'maryam-going-square' | 'maryam-square' | 'cafe-before-attack' | 'mountain-found' | 'police-post' | 'cafe-upstairs' | 'cafe-balcony';
}

export interface NpcDayOptions {
  /** Chapter number in the story. The current data slice covers Chapters 1, 3 and 4. */
  chapter?: number;
  /** Joseph's prologue, before Lorenzo's Day 1 arrival. Only the farmer is staged in this NPC slice. */
  prologue?: boolean;
  /** Completed binding story events, in order. */
  events?: readonly string[];
  /** Set after Omar's guarded medical check removes his cuffs. */
  medicalCheckComplete?: boolean;
}

/** Binding event order from studio/npc/README.md ("Event order that binds Omar and Elia"). */
export const ORDER: readonly string[] = [
  'Cafe and raven activity',
  'Root attack and gang turns',
  'Omar escapes, loses memory',
  'Found near the mountain (Day 1)',
  'Taken to post [6] in handcuffs',
  'Moreno assigns Elia the cover mission',
  'Elia appears on the cafe balcony (Day 2)',
];

/** True when events are a complete, correctly ordered prefix of the binding story sequence. */
export function eventOrderOk(events: string[]): boolean {
  return events.length <= ORDER.length && events.every((event, index) => event === ORDER[index]);
}

/**
 * NPCs available in the authored story slice for a day and chapter.
 * Omar's appearance follows the café, escape, and transport beats; Elia is withheld until Moreno's
 * assignment and Day 2. An incomplete or out-of-order event history cannot unlock either appearance.
 */
export function npcsAtDay(day: number, options: NpcDayOptions = {}): NpcSpec[] {
  if (!Number.isInteger(day) || day < 1) return [];
  const chapter = options.chapter ?? 1;
  if (options.prologue && (chapter !== 1 || day !== 1)) return [];
  const events = options.events ?? [];
  if (!eventOrderOk([...events])) return [];

  const chapterDayIds: readonly NpcId[] = options.prologue
    ? ['npc_farmer']
    : chapter === 1 && day === 1
    ? (Object.keys(NPCS) as NpcId[])
    : chapter === 1 && day === 2
      ? ['npc_maryam', 'npc_omar', 'npc_elia', 'npc_moreno']
      : chapter === 3 && day === 3
        ? ['npc_priest']
        : chapter === 4 && day === 8
          ? ['npc_maryam']
          : [];
  const hasEvent = (index: number) => events.length > index;

  return (Object.values(NPCS) as NpcSpec[])
    .filter(npc => chapterDayIds.includes(npc.id) && day >= npc.spawnDay)
    .filter(npc => {
      if (npc.id === 'npc_omar') {
        const inCafeBeforeAttack = events.length === 1;
        return inCafeBeforeAttack || hasEvent(3);
      }
      if (npc.id === 'npc_elia') return day >= 2 && hasEvent(5);
      return true;
    })
    .map((npc): NpcSpec => {
      if (npc.id === 'npc_farmer') return {
        ...npc,
        stage: options.prologue ? 'prologue-search' : 'post-prologue',
        talkable: !options.prologue,
      };
      if (npc.id === 'npc_maryam' && chapter === 1) return { ...npc, stage: 'maryam-home' };
      return npc;
    })
    .map(npc => {
      if (npc.id === 'npc_omar') {
        const inCafeBeforeAttack = events.length === 1;
        const atPost = day === 1 && hasEvent(4);
        const foundBeforeTransport = day === 1 && events.length === 4;
        return {
          ...npc,
          stage: inCafeBeforeAttack
            ? 'cafe-before-attack'
            : foundBeforeTransport
              ? 'mountain-found'
              : atPost
                ? 'police-post'
                : day >= 2 ? 'police-post' : 'cafe-upstairs',
          cuffed: atPost && !options.medicalCheckComplete,
        };
      }
      if (npc.id === 'npc_elia') return { ...npc, stage: 'cafe-balcony' };
      return npc;
    });
}

// Square villager spots (studio/npc/square-villagers.md, from src/villageMap.ts SQUARE, FOUNTAIN, BENCH).
const SQUARE_VILLAGER_SPOTS: readonly { x: number; z: number }[] = [
  { x: 19.0, z: 46.0 },
  { x: 26.0, z: 46.0 },
  { x: 21.0, z: 52.5 },
  { x: 24.5, z: 53.0 },
  { x: 6.0, z: 58.0 },
  { x: -3.0, z: 42.0 },
];

// Noor's review #16 (the village blames the Ravens) and #17 (kept; AR draft).
const SQUARE_ANIMALS_LINE = 'It\'s the Ravens. Who else takes a whole herd in one night?';
const SQUARE_ANIMALS_AR = 'إنهم الغربان. من غيرهم يأخذ قطيعاً كاملاً في ليلة؟';
const SQUARE_OMAR_LINE = 'Is that him? The one from the Ravens?';
const SQUARE_OMAR_AR = 'أهذا هو؟ ذاك الذي من الغربان؟';   // AR draft

function squareVillager(n: number, spot: { x: number; z: number }): NpcSpec {
  const id = `npc_square_villager_${n}` as NpcId;
  return {
    id,
    role: 'Square villager (unnamed)',
    spawnDay: 1,
    position: { x: spot.x, y: 0, z: spot.z },
    yaw: 0,
    floorKnown: true, // square floor y = 0 (villageMap SQUARE)
    cuffed: false,
    triggers: [
      { id: `${id}_animals`, line: SQUARE_ANIMALS_LINE, ar: SQUARE_ANIMALS_AR, status: 'proposed', when: { chapter: 1 } },
      // "after Omar is brought in"
      { id: `${id}_omar`, line: SQUARE_OMAR_LINE, ar: SQUARE_OMAR_AR, status: 'proposed', when: { chapter: 1, events: 5 } },
    ],
  };
}

export const NPCS: Record<NpcId, NpcSpec> = {
  npc_maryam: {
    id: 'npc_maryam',
    role: "Joseph's mother",
    spawnDay: 1,
    // Kitchen, just inside the south door of house [7] (villageMap MARYAM_YARD.y = -3.9).
    position: { x: 74.0, y: -3.88, z: 12.0 },
    yaw: 0,
    floorKnown: true,
    cuffed: false,
    triggers: [
      // Noor's review #1, #2 (changed), #3 (kept; AR draft).
      { id: 'maryam_door', line: 'Have you seen my son, Joseph? His bed was empty this morning.', ar: 'هل رأيتَ ابني جوزيف؟ كان سريره فارغاً هذا الصباح.', status: 'proposed', when: { chapter: 1 } },
      // Draft follow-up: after Lorenzo has been there long enough for Maryam to wait and confirm Joseph did not return.
      { id: 'maryam_confirmed_missing', line: 'I waited, then checked the house. He has not come back.', ar: 'انتظرتُه، ثم تفقدتُ البيت. لم يرجع.', status: 'proposed', when: { chapter: 1, flag: 'maryam_waited_without_joseph' } },
      { id: 'maryam_posters', line: 'I drew them myself. Nobody has knocked on my door.', ar: 'رسمتُها بيدي. لم يطرق أحد بابي.', status: 'proposed', when: { chapter: 1, flag: 'posters' } },
      { id: 'maryam_gate', line: 'I am not leaving until he comes back.', ar: 'لن أرحل حتى يعود.', status: 'proposed', when: { chapter: 4 } },
    ],
  },

  npc_omar: {
    id: 'npc_omar',
    role: 'Former Raven leader, memory lost',
    spawnDay: 1,
    // Seated, cuffed, at post [6] by Moreno's table: Noor's interior target (decisions-noor-npc.md), now that the old
    // school has an interior (src/interiors.ts), in line with the door. Floor y = the school's (villageMap).
    // Current day-1 arrival follows event 5, after the handcuffed mountain transport. On Day 2 he remains guarded at
    // the post after the medical check; café upstairs geometry/height remains unbuilt and is not guessed.
    // Keep Omar on the authored police-post floor. The old fixed zero placed him below the school when terrain changed.
    position: { x: -15.0, y: SCHOOL_FLOOR, z: 47.5 },
    yaw: -Math.PI / 2, // faces east, the door
    floorKnown: true,
    cuffed: true,
    triggers: [
      {
        id: 'omar_mountain',
        line: "They say I know this mountain. I don't even know my name the way they say it.",
        ar: 'يقولون إنني أعرف هذا الجبل. لا أعرف حتى اسمي كما ينطقونه.',
        status: 'proposed', // characters.md [new], owner approval pending
        when: { chapter: 1, events: 5 },   // seated at post [6]
      },
      // Noor's review #4 (changed; +owner: when it plays). Day 2+, after Elia's cover starts.
      { id: 'omar_watcher', line: "She says she's my girlfriend. I don't remember her face.", ar: 'تقول إنها حبيبتي. لا أتذكّر وجهها.', status: 'proposed', when: { day: [2, 99], events: 6, flag: 'elia_cover_introduced' } },
    ],
  },

  npc_elia: {
    id: 'npc_elia',
    role: 'Undercover officer, Omar\'s cover girlfriend',
    spawnDay: 2,
    // Balcony floor is measured from villageTown.cafeExtras: cafe floor + 3.25 m; z is on the built balcony slab.
    position: { x: 9.0, y: CAFE_BALCONY_Y, z: 59.9 },
    yaw: 0,
    floorKnown: true,
    cuffed: false,
    triggers: [
      // Noor's review #5 (kept; AR draft), #6 (changed). Day 2+, balcony.
      { id: 'elia_rest', line: "He's resting. Please come back later.", ar: 'إنه يرتاح. عُد لاحقاً من فضلك.', status: 'proposed', when: { day: [2, 99] } },
      { id: 'elia_photos', line: "You're the one showing people a photo of a missing man?", ar: 'أنت الذي يُري الناس صورة رجل مفقود؟', status: 'proposed', when: { day: [2, 99] } },
      {
        id: 'elia_remember',
        line: "Tell me what you remember, even something small. I'm here.",
        ar: 'قل لي ما تتذكّره، حتى لو كان صغيراً. أنا هنا.',
        status: 'proposed', // characters.md [new], owner approval pending
        when: { chapter: [2, 99] },   // "Later (Ch2+)"
      },
    ],
  },

  npc_moreno: {
    id: 'npc_moreno',
    role: 'Police chief, post [6]',
    spawnDay: 1,
    // At his table inside post [6]: Noor's interior target (decisions-noor-npc.md), now that the old school has an
    // interior (src/interiors.ts: the table stands west of him). Floor y = the school's (villageMap).
    position: { x: -15.5, y: 0.02, z: 45.0 },
    yaw: Math.PI / 2, // faces west, his table and the map ("stands at the table, reads a map")
    floorKnown: true,
    cuffed: false,
    triggers: [
      // Noor's review #7 (changed; +owner: whether he talks to Lorenzo on Day 1), #8 (changed: what he says about Omar).
      {
        id: 'moreno_reporter',
        line: "You're the one with the camera, asking about a missing man. What do you want from me?",
        ar: 'أنت صاحب الكاميرا الذي يسأل عن رجل مفقود. ماذا تريد مني؟',
        status: 'proposed',
        when: { chapter: 1, day: [1, 1] },
      },
      { id: 'moreno_said', line: 'He says he remembers nothing. A man like him remembers everything.', ar: 'يقول إنه لا يتذكّر شيئاً. رجل مثله يتذكّر كل شيء.', status: 'proposed', when: { chapter: 1, events: 5 } },
      // characters.md [new]; Ch3+ (Act III radio), not in this slice.
      { id: 'moreno_report', line: 'There are people inside. Write that in your report.', ar: 'هناك أناس في الداخل. اكتبوا ذلك في تقريركم.', status: 'proposed', when: { chapter: [3, 99] } },
    ],
  },

  npc_officer_1: {
    id: 'npc_officer_1',
    role: 'Police officer, guards the car (unnamed)',
    spawnDay: 1,
    position: { x: -5.3, y: 0, z: 44.2 }, // police-officers.md: square side of POLICE_CAR (box x -8.3..-6.1), 0.8 m clear
    yaw: -Math.PI / 2, // faces east, the square
    floorKnown: true, // outside, on the square
    cuffed: false,
    triggers: [{ id: 'officer_1_car', line: 'Step back from the car, please.', ar: 'ابتعد عن السيارة، من فضلك.', status: 'proposed' }],   // AR draft
  },

  npc_officer_2: {
    id: 'npc_officer_2',
    role: 'Police officer, school doorway (unnamed)',
    spawnDay: 1,
    position: { x: -9.4, y: 0, z: 45.8 }, // police-officers.md: outside the locked east door (z 47.5), north side; the door spot (-9.2, 47.5) stays free
    yaw: -Math.PI / 2, // faces east, the square
    floorKnown: true, // square ground, y = 0
    cuffed: false,
    // AR draft. Noor's review #10: only while Omar is inside [6].
    triggers: [{ id: 'officer_2_door', line: 'The chief is busy. Wait out here.', ar: 'الرئيس مشغول. انتظر هنا في الخارج.', status: 'proposed', when: { events: 5 } }],
  },

  npc_priest: {
    id: 'npc_priest',
    role: 'Village priest (unnamed)',
    spawnDay: 1,
    // Near the altar at the east end of the nave, but on the clear central aisle so he remains visible from the south door.
    position: { x: 18.5, y: 0, z: 31.0 },
    yaw: -Math.PI / 2,
    floorKnown: true,
    cuffed: false,
    triggers: [
      { id: 'priest_altar', line: 'Go home. And stay away from the mountain.', ar: 'عُد إلى بيتك. وابتعد عن الجبل.', status: 'canon', when: { chapter: 1 } }, // characters.md [ref]
      // Noor's review #11 (changed: real facts, sets up Ch3), #12 (kept; AR draft, "after the posters").
      { id: 'priest_ladder', line: "The ladder is old, four flights. If it's signal you want, it's only up by the bells.", ar: 'السلّم قديم، أربع طبقات. إن كنت تريد إشارة، فهي فوق عند الأجراس فقط.', status: 'proposed', when: { chapter: 3 } },
      {
        id: 'priest_mother',
        line: 'The boy\'s mother came in this morning. She did not sit down.',
        ar: 'جاءت أمّ الصبي هذا الصباح. لم تجلس.',
        status: 'proposed',
        when: { chapter: 1, flag: 'posters' },
      },
    ],
  },

  npc_farmer: {
    id: 'npc_farmer',
    role: 'Farmer, barn [1] and farmhouse [2] (unnamed)',
    spawnDay: 1,
    // Beside the trough (villageMap/village.ts TROUGH z 6.0..6.7), Ch1 spot.
    position: { x: -12.5, y: 0, z: 8.5 },
    yaw: 0,
    floorKnown: true,
    cuffed: false,
    triggers: [
      // Noor's review #13 (changed: the TV is the only light in the farmhouse window).
      { id: 'farmer_light', line: "I'm going back out before it gets dark.", ar: 'سأخرج مرة أخرى قبل أن يحلّ الظلام.', status: 'proposed', when: { chapter: 1 } },
    ],
  },

  npc_farmers_wife: {
    id: 'npc_farmers_wife',
    role: "Farmer's wife (unnamed)",
    spawnDay: 1,
    // Interim (decisions-noor-npc.md): at the farmhouse east door (village.ts FARMHOUSE x -25..-15), until it has an
    // interior. Interior target when it exists: seated at the TV, (-21.0, 0, 0.0).
    position: { x: -14.2, y: 0, z: 0.4 },
    yaw: -Math.PI / 2, // faces east, the farmyard
    floorKnown: true, // farmyard ground, y = 0
    cuffed: false,
    // Noor's review #14 (kept; AR draft). #15 "The cow was the first one to go…" is cut (contradicts [ref]).
    triggers: [
      { id: 'wife_back', line: 'He\'ll come back. He always does.', ar: 'سيعود. هو يعود دائماً.', status: 'proposed', when: { chapter: 1 } },
    ],
  },

  npc_square_villager_1: squareVillager(1, SQUARE_VILLAGER_SPOTS[0]),
  npc_square_villager_2: squareVillager(2, SQUARE_VILLAGER_SPOTS[1]),
  npc_square_villager_3: squareVillager(3, SQUARE_VILLAGER_SPOTS[2]),
  npc_square_villager_4: squareVillager(4, SQUARE_VILLAGER_SPOTS[3]),
  npc_square_villager_5: squareVillager(5, SQUARE_VILLAGER_SPOTS[4]),
  npc_square_villager_6: squareVillager(6, SQUARE_VILLAGER_SPOTS[5]),
};
