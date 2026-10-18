// NPC data layer for the village slice. Pure TypeScript, no Three.js import, so it stays testable.
// Source of truth: studio/npc/README.md and the per-NPC spec files. Positions are metres, +Y up, +Z south.
// Landmark numbers are copied from src/villageMap.ts and src/village.ts (cited per entry).

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
  /** English line. Arabic text is added later by Noor. */
  line: string;
  /** 'canon' only for lines quoted from characters.md; everything else is a draft. */
  status: 'canon' | 'proposed';
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
  triggers: NpcTrigger[];
  /** Runtime story stage supplied by npcsAtDay; the authored base records stay engine-neutral. */
  stage?: 'cafe-before-attack' | 'mountain-found' | 'police-post' | 'cafe-upstairs' | 'cafe-balcony';
}

export interface NpcDayOptions {
  /** Chapter number in the story. The current data slice covers Chapters 1, 3 and 4. */
  chapter?: number;
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
  const events = options.events ?? [];
  if (!eventOrderOk([...events])) return [];

  const chapterDayIds: readonly NpcId[] = chapter === 1 && day === 1
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
                : 'cafe-upstairs',
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

const SQUARE_ANIMALS_LINE = 'Have you seen the animals? They just walked up the hill.';
const SQUARE_OMAR_LINE = 'Is that him? The one from the Ravens?';

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
      { id: `${id}_animals`, line: SQUARE_ANIMALS_LINE, status: 'proposed' },
      { id: `${id}_omar`, line: SQUARE_OMAR_LINE, status: 'proposed' },
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
      { id: 'maryam_door', line: 'Have you seen my son? He had the cow\'s rope with him.', status: 'proposed' },
      { id: 'maryam_posters', line: 'I put those up myself. Nobody has called.', status: 'proposed' },
      { id: 'maryam_gate', line: 'I am not leaving until he comes back.', status: 'proposed' },
    ],
  },

  npc_omar: {
    id: 'npc_omar',
    role: 'Former Raven leader, memory lost',
    spawnDay: 1,
    // Seated, cuffed, at post [6] by Moreno's table (spec: about (-15.0, 0, 47.5)).
    // placeholder, owner to confirm: the found spot near the mountain is not placed yet, so the post seat is used.
    position: { x: -15.0, y: 0, z: 47.5 },
    yaw: 0,
    floorKnown: false, // school interior floor not decided
    cuffed: true,
    triggers: [
      {
        id: 'omar_mountain',
        line: "They say I know this mountain. I don't even know my name the way they say it.",
        status: 'proposed', // characters.md [new], owner approval pending
      },
      { id: 'omar_watcher', line: 'Who is that woman who keeps looking at me?', status: 'proposed' },
    ],
  },

  npc_elia: {
    id: 'npc_elia',
    role: 'Undercover officer, Omar\'s cover girlfriend',
    spawnDay: 2,
    // Balcony rail on the cafe's north face (villageTown: z = 60.5). Y is not decided, so y = 0 is temporary.
    // placeholder, owner to confirm: balcony floor height.
    position: { x: 9.0, y: 0, z: 60.3 },
    yaw: 0,
    floorKnown: false,
    cuffed: false,
    triggers: [
      { id: 'elia_rest', line: "He's resting. Please come back later.", status: 'proposed' },
      { id: 'elia_photos', line: 'Are you the one putting up the photos?', status: 'proposed' },
      {
        id: 'elia_remember',
        line: "Tell me what you remember, even something small. I'm here.",
        status: 'proposed', // characters.md [new], owner approval pending
      },
    ],
  },

  npc_moreno: {
    id: 'npc_moreno',
    role: 'Police chief, post [6]',
    spawnDay: 1,
    // placeholder, owner to confirm: table position inside [6] is approximate (spec says to confirm in villageTown.ts).
    position: { x: -15.5, y: 0, z: 45.0 },
    yaw: 0,
    floorKnown: false, // school interior floor not decided
    cuffed: false,
    triggers: [
      {
        id: 'moreno_reporter',
        line: "You're the reporter who was asking about Joseph. What do you want from me?",
        status: 'proposed',
      },
      { id: 'moreno_said', line: 'Did he say anything when they brought him in?', status: 'proposed' },
      { id: 'moreno_report', line: 'There are people inside. Write that in your report.', status: 'proposed' },
    ],
  },

  npc_officer_1: {
    id: 'npc_officer_1',
    role: 'Police officer, guards the car (unnamed)',
    spawnDay: 1,
    position: { x: -8.0, y: 0, z: 44.6 }, // police-officers.md, beside POLICE_CAR (-7.2, 44.2)
    yaw: 0,
    floorKnown: true, // outside, on the square
    cuffed: false,
    triggers: [{ id: 'officer_1_car', line: 'Step back from the car, please.', status: 'proposed' }],
  },

  npc_officer_2: {
    id: 'npc_officer_2',
    role: 'Police officer, school doorway (unnamed)',
    spawnDay: 1,
    position: { x: -11.5, y: 0, z: 47.5 }, // police-officers.md, school east doorway
    yaw: 0,
    floorKnown: false, // school interior floor not decided
    cuffed: false,
    triggers: [{ id: 'officer_2_door', line: 'The chief is busy. Wait out here.', status: 'proposed' }],
  },

  npc_priest: {
    id: 'npc_priest',
    role: 'Village priest (unnamed)',
    spawnDay: 1,
    // Altar at the north end of the church nave (villageMap church x 5..24, z 26.5..35).
    position: { x: 14.5, y: 0, z: 28.5 },
    yaw: 0,
    floorKnown: true,
    cuffed: false,
    triggers: [
      { id: 'priest_altar', line: 'Go home. And stay away from the mountain.', status: 'canon' }, // characters.md [ref]
      { id: 'priest_ladder', line: 'The ladder is old. Mind the fourth flight.', status: 'proposed' },
      {
        id: 'priest_mother',
        line: 'The boy\'s mother came in this morning. She did not sit down.',
        status: 'proposed',
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
      {
        id: 'farmer_light',
        line: "My wife keeps the light on for me. I'm going back out.",
        status: 'proposed',
      },
    ],
  },

  npc_farmers_wife: {
    id: 'npc_farmers_wife',
    role: "Farmer's wife (unnamed)",
    spawnDay: 1,
    // Seated in front of the TV inside farmhouse [2] (village.ts FARMHOUSE x -25..-15, z -5..5).
    position: { x: -21.0, y: 0, z: 0.0 },
    yaw: 0,
    floorKnown: false, // spec: floor to confirm inside the farmhouse
    cuffed: false,
    triggers: [
      { id: 'wife_back', line: 'He\'ll come back. He always does.', status: 'proposed' },
      {
        id: 'wife_cow',
        line: 'The cow was the first one to go. She walked up the hill.',
        status: 'proposed',
      },
    ],
  },

  npc_square_villager_1: squareVillager(1, SQUARE_VILLAGER_SPOTS[0]),
  npc_square_villager_2: squareVillager(2, SQUARE_VILLAGER_SPOTS[1]),
  npc_square_villager_3: squareVillager(3, SQUARE_VILLAGER_SPOTS[2]),
  npc_square_villager_4: squareVillager(4, SQUARE_VILLAGER_SPOTS[3]),
  npc_square_villager_5: squareVillager(5, SQUARE_VILLAGER_SPOTS[4]),
  npc_square_villager_6: squareVillager(6, SQUARE_VILLAGER_SPOTS[5]),
};
