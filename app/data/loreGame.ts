/**
 * Weezer Lore — the depth game's data.
 *
 * Sources of truth (Oct 26, 2026): the design doc and question bank
 * v2 (Mark's markup of v1) in the goal workspace. Mark's calibration
 * rules from that markup are baked in here: production / other-band
 * trivia runs deep or doesn't run at all; every answer is short (the
 * question flips, never the answer); prompts stay plain-spoken even
 * when the answer is deep.
 *
 * Song depths are EDITORIAL SEEDS derived in code from the catalog's
 * own structure (see SONG_DEPTHS below). The design's endgame is
 * depths computed from the community's per-song recognition data —
 * when that lands, it replaces the derivation, not the shape.
 */

import { FULL_SONG_POOL, SINGLE_SONG_IDS, Song } from './constants';
import {
  LoreAnswerSpec,
  SongConstraint as _SongConstraint,
  normalizeAnswer,
  songTitleVariants,
} from '../lib/loreMatch';

export type { SongConstraint } from '../lib/loreMatch';

/* ------------------------------------------------------------------ */
/* Depth bands (RUN TOTALS)                                            */
/* ------------------------------------------------------------------ */

export interface DepthBand {
  min: number;
  /** Inclusive upper bound; Infinity for the bedrock band. */
  max: number;
  title: string;
  /** One warm line about landing in this band. Draft copy. */
  line: string;
}

export const DEPTH_BANDS: DepthBand[] = [
  {
    min: 0,
    max: 199,
    title: 'Buddy Holly',
    line: 'You know the hits — and the hits are great. The lore goes a lot deeper whenever you want it.',
  },
  {
    min: 200,
    max: 499,
    title: 'Sweater Song',
    line: "Solid '90s footing. You were there, or you've done the homework.",
  },
  {
    min: 500,
    max: 1499,
    title: 'Pinkerton',
    line: 'You have opinions about the second album, and they are not mild ones.',
  },
  {
    min: 1500,
    max: 2999,
    title: 'Fan Club',
    line: 'Mykel and Carli territory — you know the names most fans never learn.',
  },
  {
    min: 3000,
    max: 4999,
    title: 'Karl',
    line: "You know who the fifth Weezer is. That's not trivia, that's citizenship.",
  },
  {
    min: 5000,
    max: Infinity,
    title: 'GOAT PUNISHMENT',
    line: 'The bottom of the lore. Ride or die — there is nothing under this.',
  },
];

export function bandForTotal(total: number): DepthBand {
  for (const band of DEPTH_BANDS) {
    if (total >= band.min && total <= band.max) return band;
  }
  return DEPTH_BANDS[DEPTH_BANDS.length - 1];
}

/* ------------------------------------------------------------------ */
/* Song depths (seed table, derived from the catalog)                  */
/* ------------------------------------------------------------------ */

/**
 * The famous floor — songs so well known they barely sink, whatever
 * tier they'd otherwise land in. Buddy Holly is the scale's zero
 * point by design (bank question 1 prices it at 20).
 */
const FAMOUS_SONG_DEPTHS: Record<string, number> = {
  blue_4: 20, // Buddy Holly
  green_4: 25, // Island in the Sun
  mb_1: 30, // Beverly Hills
  green_3: 30, // Hash Pipe
  blue_7: 35, // Say It Ain't So
  blue_5: 40, // Undone – The Sweater Song
  red_3: 45, // Pork and Beans
  blue_1: 50, // My Name Is Jonas
  mal_3: 50, // Keep Fishin'
  mb_2: 55, // Perfect Situation
  red_1: 60, // Troublemaker
  rad_1: 60, // (If You're Wondering If I Want You To) I Want You To
  hur_1: 70, // Memories
  pink_7: 80, // El Scorcho
  ew_2: 85, // Back to the Shack
  okh_1: 85, // All My Favorite Songs
  wh_3: 90, // Thank God for Girls
  pink_6: 95, // The Good Life
  pd_3: 95, // Feels Like Summer
  vw_1: 95, // Hero
  blk_1: 95, // Can't Knock the Hustle
  sz_su2: 110, // Records
};

/**
 * Album-track depth by album: a base for the album's opening track
 * plus a per-track step, so later tracks on the same record sit a
 * little deeper than the opener. The bases walk the design's tiers —
 * '90s records are the best known, each later era sits deeper, and
 * the SZNZ EPs (the newest, least absorbed) are the deepest studio
 * tracks in the pool.
 */
const ALBUM_TRACK_DEPTH: Record<string, { base: number; step: number }> = {
  'The Blue Album': { base: 90, step: 8 },
  Pinkerton: { base: 110, step: 9 },
  'Green Album': { base: 130, step: 9 },
  Maladroit: { base: 150, step: 9 },
  'Make Believe': { base: 190, step: 10 },
  'Red Album': { base: 200, step: 10 },
  Raditude: { base: 230, step: 10 },
  Hurley: { base: 240, step: 10 },
  EWBAITE: { base: 280, step: 10 },
  'White Album': { base: 300, step: 10 },
  'Pacific Daydream': { base: 340, step: 11 },
  'Black Album': { base: 350, step: 11 },
  'OK Human': { base: 360, step: 11 },
  'Van Weezer': { base: 370, step: 11 },
  'SZNZ: Spring': { base: 430, step: 12 },
  'SZNZ: Summer': { base: 430, step: 12 },
  'SZNZ: Autumn': { base: 430, step: 12 },
  'SZNZ: Winter': { base: 430, step: 12 },
};

/**
 * Depth for every one of the 206 catalog songs. Derivation, in
 * priority order:
 *   1. FAMOUS_SONG_DEPTHS — the hand-priced famous floor.
 *   2. Gold Album — the demo-era material: 920 + 26 per track
 *      (920–1154), the deepest water in the game.
 *   3. B-Sides & Rarities (isBSide) — 620 + 15 per track (620–875).
 *   4. Singles not on the famous floor — 60 plus a small
 *      deterministic spread (60–100).
 *   5. Album tracks — ALBUM_TRACK_DEPTH base + step × track index.
 */
export const SONG_DEPTHS: Record<string, number> = (() => {
  const depths: Record<string, number> = {};
  const albumTrackIndex: Record<string, number> = {};
  FULL_SONG_POOL.forEach((song, poolIndex) => {
    const trackIdx = albumTrackIndex[song.album] ?? 0;
    albumTrackIndex[song.album] = trackIdx + 1;

    const famous = FAMOUS_SONG_DEPTHS[song.id];
    if (famous !== undefined) {
      depths[song.id] = famous;
    } else if (song.album === 'Gold Album') {
      depths[song.id] = 920 + trackIdx * 26;
    } else if (song.isBSide) {
      depths[song.id] = 620 + trackIdx * 15;
    } else if (SINGLE_SONG_IDS.has(song.id)) {
      depths[song.id] = 60 + ((poolIndex * 37) % 41);
    } else {
      const tier = ALBUM_TRACK_DEPTH[song.album] ?? { base: 300, step: 10 };
      depths[song.id] = tier.base + trackIdx * tier.step;
    }
  });
  return depths;
})();

export function songDepth(song: Song): number {
  return SONG_DEPTHS[song.id] ?? 300;
}

/* ------------------------------------------------------------------ */
/* Song-question constraints                                           */
/* ------------------------------------------------------------------ */

/**
 * Girl names for the "girl's name in the title" prompt, matched
 * against normalized title tokens (a trailing possessive "s" is
 * forgiven: "Diane's" counts). Curated, not guessed: Susanne, Jamie,
 * Carli (Mykel and Carli), Mary (Sweet Mary), Francesca, Sheila
 * (Sheila Can Do It), Diane (Any Friend of Diane's), Cleopatra,
 * Elaine (Summer Elaine and Drunk Dori).
 */
const GIRL_NAME_TOKENS: readonly string[] = [
  'susanne',
  'suzanne',
  'jamie',
  'carli',
  'mary',
  'francesca',
  'sheila',
  'diane',
  'cleopatra',
  'elaine',
];

/**
 * First and last catalog song per album, in pool order (the canon
 * lists each album's tracks in order). The B-Sides & Rarities set is
 * a compilation, so the positional cases below exclude it — its
 * first track is nobody's "album opener."
 */
const ALBUM_FIRST_LAST: { first: Map<string, string>; last: Map<string, string> } =
  (() => {
    const first = new Map<string, string>();
    const last = new Map<string, string>();
    for (const s of FULL_SONG_POOL) {
      if (!first.has(s.album)) first.set(s.album, s.id);
      last.set(s.album, s.id);
    }
    return { first, last };
  })();

/** True when the song satisfies a name-a-song prompt's constraint. */
export function songQualifies(
  constraint: _SongConstraint,
  song: Song
): boolean {
  switch (constraint.kind) {
    case 'opener':
      return (
        song.album !== 'B-Sides & Rarities' &&
        ALBUM_FIRST_LAST.first.get(song.album) === song.id
      );
    case 'closer':
      return (
        song.album !== 'B-Sides & Rarities' &&
        ALBUM_FIRST_LAST.last.get(song.album) === song.id
      );
    case 'album-except':
      return (
        song.album === constraint.album && song.title !== constraint.excludeTitle
      );
    case 'album-non-single':
      // "Isn't a single" is judged by the app's own canonical
      // singles set — the same list that drives triage's order.
      return song.album === constraint.album && !SINGLE_SONG_IDS.has(song.id);
    case 'b-side':
      return song.isBSide === true;
    case 'never-on-studio-album':
      // The B-Sides & Rarities set is the catalog's own filing for
      // songs that live outside every studio album. (The Gold Album
      // songs get their own prompt, below.)
      return song.isBSide === true;
    case 'demo-or-unreleased':
      // In this catalog the demo-era material lives on the Gold
      // Album — the design's deepest tier.
      return song.album === 'Gold Album';
    case 'girl-name-in-title': {
      const tokens = normalizeAnswer(song.title).split(' ');
      return tokens.some((token) => {
        if (GIRL_NAME_TOKENS.indexOf(token) !== -1) return true;
        // Possessive: "dianes" (from "Diane's") still counts.
        return (
          token.endsWith('s') &&
          GIRL_NAME_TOKENS.indexOf(token.slice(0, -1)) !== -1
        );
      });
    }
  }
}

/* ------------------------------------------------------------------ */
/* The question bank (v2, Mark's markup applied)                       */
/* ------------------------------------------------------------------ */

export interface LoreQuestion {
  id: string;
  /** Bank band 1–6; the run is composed shallow → deep by band. */
  band: 1 | 2 | 3 | 4 | 5 | 6;
  type: 'lore' | 'song';
  prompt: string;
  /** Lore questions: the fixed depth for knowing the answer. */
  depth?: number;
  /** Lore questions: canonical answer + accepted aliases. */
  spec?: LoreAnswerSpec;
  /** Song questions: what a typed song must satisfy to score. */
  constraint?: _SongConstraint;
  /** Song questions: the example shown when the player misses. */
  exampleSongId?: string;
  /** One warm line of lore for the miss reveal. DRAFT — Mark's markup. */
  loreLine: string;
}

export const LORE_QUESTIONS: LoreQuestion[] = [
  /* ---------------- Band 1 — Buddy Holly level ---------------- */
  {
    id: 'L1',
    band: 1,
    type: 'lore',
    prompt: "Who is Weezer's lead singer and main songwriter?",
    depth: 25,
    spec: { answer: 'Rivers Cuomo', aliases: ['Rivers', 'Cuomo'] },
    loreLine:
      "Rivers Cuomo — singer, songwriter, and the band's center of gravity since day one.",
  },
  {
    id: 'L2',
    band: 1,
    type: 'lore',
    prompt: 'What year did the Blue Album come out?',
    depth: 30,
    spec: { answer: '1994', aliases: [] },
    loreLine: '1994 — the Blue Album and the sweater song arrived together.',
  },
  {
    id: 'L3',
    band: 1,
    type: 'lore',
    prompt: 'Name the song with the Happy Days video.',
    depth: 20,
    spec: { answer: 'Buddy Holly', aliases: [] },
    loreLine:
      "Buddy Holly — in the video the band plays at Arnold's while the Fonz approves.",
  },
  {
    id: 'L4',
    band: 1,
    type: 'lore',
    prompt: 'What Weezer song has the Muppets in its video?',
    depth: 50,
    spec: { answer: "Keep Fishin'", aliases: ['Keep Fishin', 'Keep Fishing'] },
    loreLine:
      "Keep Fishin' — the video drops the band straight into the Muppet Show.",
  },
  {
    id: 'L5',
    band: 1,
    type: 'lore',
    prompt: 'Which album is "Say It Ain\'t So" on?',
    depth: 35,
    spec: { answer: 'The Blue Album', aliases: ['Blue', 'Blue Album'] },
    loreLine:
      "The Blue Album — Say It Ain't So sits near the end, right after Surf Wax America.",
  },
  {
    id: 'L6',
    band: 1,
    type: 'lore',
    prompt: 'Finish the SNL line: a real Weezer fan is "ride or ___."',
    depth: 45,
    spec: { answer: 'Die', aliases: ['Ride or Die'] },
    loreLine:
      'Ride or die — in the sketch, two neighbors nearly come to blows over whether Weezer stayed good after Pinkerton.',
  },

  /* ---------------- Band 2 — Sweater Song level ---------------- */
  {
    id: 'L7',
    band: 2,
    type: 'lore',
    prompt: "Who was Weezer's FIRST bassist?",
    depth: 120,
    spec: { answer: 'Matt Sharp', aliases: ['Matt', 'Sharp', 'Matthew Sharp'] },
    loreLine:
      'Matt Sharp — the first bassist, theatrical falsetto and all, before The Rentals took him full-time.',
  },
  {
    id: 'L8',
    band: 2,
    type: 'lore',
    prompt: "What was Matt Sharp's own band?",
    depth: 160,
    spec: { answer: 'The Rentals', aliases: ['Rentals'] },
    loreLine: "The Rentals — Matt Sharp's own band, all Moog synths and harmonies.",
  },
  {
    id: 'L9',
    band: 2,
    type: 'lore',
    prompt: 'What song opens Pinkerton?',
    depth: 140,
    spec: { answer: 'Tired of Sex', aliases: [] },
    loreLine:
      'Tired of Sex opens Pinkerton — Rivers starts the album at his most brutally honest.',
  },
  {
    id: 'L10',
    band: 2,
    type: 'lore',
    prompt: 'What was the first song Weezer ever released as a single?',
    depth: 150,
    spec: {
      answer: 'Undone – The Sweater Song',
      aliases: ['Undone', 'The Sweater Song', 'Sweater Song'],
    },
    loreLine:
      'Undone — the sweater song was the first single, in 1994. Buddy Holly came after.',
  },
  {
    id: 'S11',
    band: 2,
    type: 'song',
    prompt: "Name a song with a girl's name in the title.",
    constraint: { kind: 'girl-name-in-title' },
    exampleSongId: 'bs_5',
    loreLine:
      'The catalog is full of named girls — Susanne and Jamie were B-sides before they were trivia.',
  },
  {
    id: 'S12',
    band: 2,
    type: 'song',
    prompt: 'Name a song from Make Believe that isn\'t "Beverly Hills."',
    constraint: {
      kind: 'album-except',
      album: 'Make Believe',
      excludeTitle: 'Beverly Hills',
    },
    exampleSongId: 'mb_3',
    loreLine:
      'Make Believe is bigger than its biggest single — eleven other songs deep.',
  },

  /* ---------------- Band 3 — Pinkerton level ---------------- */
  {
    id: 'L13',
    band: 3,
    type: 'lore',
    prompt: 'Who produced the Blue Album?',
    depth: 300,
    spec: { answer: 'Ric Ocasek', aliases: ['Ocasek', 'Rick Ocasek'] },
    loreLine:
      'Ric Ocasek of The Cars produced the Blue Album — and came back years later for the Green Album.',
  },
  {
    id: 'L14',
    band: 3,
    type: 'lore',
    prompt: 'Who is the only drummer Weezer has ever had?',
    depth: 220,
    spec: {
      answer: 'Patrick Wilson',
      aliases: ['Patrick', 'Pat', 'Wilson', 'Pat Wilson'],
    },
    loreLine:
      'Patrick Wilson — the only drummer Weezer has ever had. Every era, same guy.',
  },
  {
    id: 'L15',
    band: 3,
    type: 'lore',
    prompt: 'Type out the flying W symbol.',
    depth: 250,
    spec: { answer: '=w=', aliases: ['Flying W', 'Weezer W', 'The Flying W'] },
    loreLine: "=w= — the flying W, typed out. The band's shorthand for itself.",
  },
  {
    id: 'L16',
    band: 3,
    type: 'lore',
    prompt: 'Pinkerton is named after a character from which opera?',
    depth: 280,
    spec: {
      answer: 'Madama Butterfly',
      aliases: ['Madame Butterfly', 'Butterfly'],
    },
    loreLine:
      'Madama Butterfly — B.F. Pinkerton is the opera\'s American naval officer, and not its hero.',
  },
  {
    id: 'S17',
    band: 3,
    type: 'song',
    prompt: "Name a song from the Red Album that ISN'T a single.",
    constraint: { kind: 'album-non-single', album: 'Red Album' },
    exampleSongId: 'red_4',
    loreLine:
      "The Red Album's non-singles are where that record hides its weird heart.",
  },
  {
    id: 'L18',
    band: 3,
    type: 'lore',
    prompt: 'Rivers went to which university during the hiatus years?',
    depth: 320,
    spec: { answer: 'Harvard', aliases: ['Harvard University'] },
    loreLine:
      'Harvard — Rivers enrolled during the hiatus and finally finished the degree years later.',
  },

  /* ---------------- Band 4 — Fan Club level ---------------- */
  {
    id: 'L19',
    band: 4,
    type: 'lore',
    prompt:
      'Two sisters ran the Weezer fan club, and a song carries their names. What are their names?',
    depth: 480,
    spec: {
      answer: 'Mykel and Carli',
      aliases: ['Mykel', 'Carli', 'Mykel Allan and Carli Allan'],
    },
    loreLine:
      'Mykel and Carli Allan ran the official fan club — the song with their names is how most fans meet them.',
  },
  {
    id: 'L20',
    band: 4,
    type: 'lore',
    prompt:
      'From the song: what did Mykel and Carli give Rivers that he thought was rad?',
    depth: 560,
    // VERIFY (bank v2 flags this one): the lyric wording has not been
    // confirmed — draft answer, Mark to check before this ships wide.
    spec: { answer: 'A Ride', aliases: ['Ride'] },
    loreLine:
      'A ride — the song says Mykel and Carli gave him one, and he thought it was rad.',
  },
  {
    id: 'L21',
    band: 4,
    type: 'lore',
    prompt:
      '"You Gave Your Love to Me Softly" — what movie soundtrack is it from?',
    depth: 520,
    spec: { answer: 'Angus', aliases: [] },
    loreLine:
      'Angus — the 1995 soundtrack carried that song years before most fans ever heard it.',
  },
  {
    id: 'L22',
    band: 4,
    type: 'lore',
    prompt: 'Suzanne and Jamie were B-sides of which single?',
    depth: 460,
    // Bank v2 flags "Verify": Blue-era B-side pairing, Mark to confirm.
    spec: { answer: 'Buddy Holly', aliases: [] },
    loreLine: 'Buddy Holly — Suzanne and Jamie both rode along as its B-sides.',
  },
  {
    id: 'L23',
    band: 4,
    type: 'lore',
    prompt: 'What unfinished Weezer concept album was a rock opera set in space?',
    depth: 540,
    spec: {
      answer: 'Songs from the Black Hole',
      aliases: ['Black Hole', 'The Black Hole'],
    },
    loreLine:
      'Songs from the Black Hole — the space rock opera Rivers shelved; Pinkerton grew out of its ashes.',
  },
  {
    id: 'S24',
    band: 4,
    type: 'song',
    prompt: 'Name a B-side.',
    constraint: { kind: 'b-side' },
    exampleSongId: 'bs_12',
    loreLine:
      "B-sides were the fan club's currency — Suzanne, Jamie and Mykel and Carli all lived there.",
  },

  /* ---------------- Band 5 — Karl level ---------------- */
  {
    id: 'L25',
    band: 5,
    type: 'lore',
    prompt:
      'The band\'s historian and webmaster — "the fifth Weezer" — what\'s his first name?',
    depth: 720,
    spec: { answer: 'Karl', aliases: ['Karl Koch', 'Koch'] },
    loreLine:
      "Karl Koch — archivist, webmaster, and the band's memory since the beginning.",
  },
  {
    id: 'L26',
    band: 5,
    type: 'lore',
    prompt: "What was Karl's long-running feature on weezer.com called?",
    depth: 800,
    spec: { answer: "Karl's Corner", aliases: [] },
    loreLine:
      "Karl's Corner — his long-running dispatches from inside the band's world.",
  },
  {
    id: 'L27',
    band: 5,
    type: 'lore',
    prompt: "What is Patrick Wilson's side project called?",
    depth: 780,
    spec: { answer: 'The Special Goodness', aliases: ['Special Goodness'] },
    loreLine:
      "The Special Goodness — Patrick Wilson's side band, running quietly alongside Weezer for decades.",
  },
  {
    id: 'L28',
    band: 5,
    type: 'lore',
    prompt: "What was the name of Rivers' band during the hiatus?",
    depth: 880,
    spec: { answer: 'Goat Punishment', aliases: ['Goat'] },
    loreLine:
      'Goat Punishment — Rivers\' hiatus project, named like a joke and remembered like scripture.',
  },
  {
    id: 'L29',
    band: 5,
    type: 'lore',
    prompt: 'What record label first signed Weezer?',
    depth: 840,
    spec: { answer: 'Geffen', aliases: ['DGC', 'Geffen Records'] },
    loreLine: 'Geffen, through its DGC imprint — the label that put out the Blue Album.',
  },
  {
    id: 'S30',
    band: 5,
    type: 'song',
    prompt: 'Name a Weezer song that never appeared on a studio album.',
    constraint: { kind: 'never-on-studio-album' },
    exampleSongId: 'bs_9',
    loreLine: 'Some of the most loved Weezer songs never made a studio album at all.',
  },

  /* ---------------- Band 6 — GOAT PUNISHMENT bedrock ---------------- */
  {
    id: 'L31',
    band: 6,
    type: 'lore',
    prompt: 'Goat Punishment mostly played covers of which band?',
    depth: 1000,
    spec: { answer: 'Nirvana', aliases: [] },
    loreLine: 'Nirvana — Goat Punishment mostly tore through their covers in tiny rooms.',
  },
  {
    id: 'L32',
    band: 6,
    type: 'lore',
    prompt: "Scott Shriner once played bass in which unlikely performer's band?",
    depth: 980,
    spec: { answer: 'Vanilla Ice', aliases: [] },
    loreLine: "Vanilla Ice — yes, really. Scott Shriner played in his band before Weezer.",
  },
  {
    id: 'S33',
    band: 6,
    type: 'song',
    prompt: 'Name a demo or unreleased Weezer song.',
    constraint: { kind: 'demo-or-unreleased' },
    exampleSongId: 'gold_4',
    loreLine:
      'The demo vault is the deepest water there is — some of those songs waited decades to surface.',
  },
];

/**
 * The matcher's plausible-answer universe: every bank answer and
 * alias plus every catalog title variant, all normalized. Judging an
 * input subtracts the target question's own forms (the matcher does
 * that itself), so one shared list serves every question.
 */
export const LORE_ANSWER_UNIVERSE: string[] = (() => {
  const set = new Set<string>();
  for (const q of LORE_QUESTIONS) {
    if (q.spec) {
      set.add(normalizeAnswer(q.spec.answer));
      q.spec.aliases.forEach((a) => set.add(normalizeAnswer(a)));
    }
  }
  for (const song of FULL_SONG_POOL) {
    songTitleVariants(song.title).forEach((v) => set.add(v));
  }
  return Array.from(set);
})();

/** The example song a song-question shows on a miss. */
export function exampleSongFor(question: LoreQuestion): Song | undefined {
  if (!question.exampleSongId) return undefined;
  return FULL_SONG_POOL.find((s) => s.id === question.exampleSongId);
}

/* ------------------------------------------------------------------ */
/* Run composition                                                     */
/* ------------------------------------------------------------------ */

/**
 * The run's shape: ten slots by bank band, shallow → deep — two from
 * each of the first two bands, then one each through the middle, and
 * two bedrock slots to finish. Within a band the pick is random;
 * lore questions never repeat within a run.
 */
export const RUN_SLOT_BANDS: readonly number[] = [1, 1, 2, 2, 3, 4, 5, 5, 6, 6];

/**
 * Deals one run of ten questions. After the draw, a family guarantee
 * runs: a run always carries at least two name-a-song questions —
 * if the draw came up short, the deepest lore picks whose band still
 * holds an undealt song question are swapped for one.
 */
export function buildRun(rand: () => number = Math.random): LoreQuestion[] {
  const used = new Set<string>();
  const picks: (LoreQuestion | undefined)[] = RUN_SLOT_BANDS.map((band) => {
    const pool = LORE_QUESTIONS.filter(
      (q) => q.band === band && !used.has(q.id)
    );
    if (pool.length === 0) return undefined;
    const pick = pool[Math.floor(rand() * pool.length)];
    used.add(pick.id);
    return pick;
  });

  let songCount = picks.filter((q) => q && q.type === 'song').length;
  for (let i = picks.length - 1; i >= 0 && songCount < 2; i--) {
    const current = picks[i];
    if (!current || current.type === 'song') continue;
    const alt = LORE_QUESTIONS.find(
      (q) => q.band === current.band && q.type === 'song' && !used.has(q.id)
    );
    if (!alt) continue;
    used.delete(current.id);
    used.add(alt.id);
    picks[i] = alt;
    songCount += 1;
  }

  return picks.filter((q): q is LoreQuestion => q !== undefined);
}

/* ================================================================== */
/* V2 — OPEN RARITY PROMPTS (the Krillion pivot, Oct 26, 2026)         */
/*                                                                     */
/* The playtest verdict on v1: fixed trivia "feels basic." V2 runs     */
/* draw from the open prompts below instead — any valid answer        */
/* counts, and the RARITY of the answer sets the depth. The 15        */
/* prompts and their rarity tables come from the open-prompts file    */
/* in the goal workspace (draft tables, Mark's markup pending). The   */
/* v1 fixed bank above stays in the codebase as reserve content:      */
/* v2's visual rounds reused three of its questions, but v5 (Oct     */
/* 27) removed single-answer questions from runs entirely — runs     */
/* are ten open prompts, and nothing draws from the fixed bank.      */
/* ================================================================== */

/** Rarity tier names, by the depth an answer earns. */
export type RarityTier = 'Common' | 'Uncommon' | 'Rare' | 'Super rare';

/**
 * Tier for a depth. The content file's bands (Common 20–60,
 * Uncommon 100–200, Rare 300–550, Super rare 700–1,200) leave gaps
 * and a few of its own rows break them (The Rentals priced Common
 * at 90, the Black Album Super rare at 650), so the tier is DERIVED
 * from depth with gapless thresholds that reproduce every tier the
 * file intends: Common <100, Uncommon 100–299, Rare 300–649,
 * Super rare 650+.
 */
export function tierForDepth(depth: number): RarityTier {
  if (depth >= 650) return 'Super rare';
  if (depth >= 300) return 'Rare';
  if (depth >= 100) return 'Uncommon';
  return 'Common';
}

/** One row of an open prompt's rarity table (table-kind prompts). */
export interface OpenAnswer {
  /** The answer as displayed. */
  text: string;
  aliases: string[];
  depth: number;
  /** Shown on the reveal when this exact answer is the one played. */
  note?: string;
  /**
   * Present ⇒ this row is a TRAP: a plausible-but-invalid answer.
   * Naming it scores 0 and the reveal carries this correction.
   */
  trapNote?: string;
}

export interface OpenPrompt {
  id: string;
  prompt: string;
  kind: 'table' | 'song';
  /**
   * Breadth order across the pool, 1 = broadest. Composition draws
   * the run's first half from the broad end and its second half from
   * the narrow end — the ramp the content file specifies (broad
   * early: member, album, covers; narrow late: soundtrack,
   * question-titles, guests).
   */
  ramp: number;
  /** Table kind: the rarity table. */
  answers?: OpenAnswer[];
  /** Song kind: the constraint a typed song must satisfy... */
  songConstraint?: _SongConstraint;
  /** ...or membership in this explicit catalog set (curated calls). */
  songIds?: readonly string[];
  /** Song kind: per-song depth overrides on top of SONG_DEPTHS. */
  depthOverrides?: Record<string, number>;
  /** Song kind: catalog song id → its specific warm correction. */
  songTraps?: Record<string, string>;
  /** One warm line for the reveal. DRAFT — Mark's markup. */
  loreLine: string;
}

/** True when a catalog song is a valid answer to an open song prompt. */
export function openSongQualifies(prompt: OpenPrompt, song: Song): boolean {
  if (prompt.songIds) return prompt.songIds.indexOf(song.id) !== -1;
  if (prompt.songConstraint) return songQualifies(prompt.songConstraint, song);
  return false;
}

/** The depth a song earns under one open prompt (override wins). */
export function openSongDepth(prompt: OpenPrompt, song: Song): number {
  const override = prompt.depthOverrides?.[song.id];
  return override !== undefined ? override : songDepth(song);
}

export interface AnswerExtreme {
  text: string;
  depth: number;
}

const extremesCache = new Map<
  string,
  { common: AnswerExtreme; deepest: AnswerExtreme }
>();

/**
 * The Krillion contrast for a prompt: the answer "most fans say"
 * (shallowest valid) and the deepest answer there is. Every reveal
 * shows both, hit or miss.
 */
export function openPromptExtremes(
  prompt: OpenPrompt
): { common: AnswerExtreme; deepest: AnswerExtreme } {
  const cached = extremesCache.get(prompt.id);
  if (cached) return cached;

  let common: AnswerExtreme | undefined;
  let deepest: AnswerExtreme | undefined;
  const consider = (text: string, depth: number) => {
    if (!common || depth < common.depth) common = { text, depth };
    if (!deepest || depth > deepest.depth) deepest = { text, depth };
  };

  if (prompt.kind === 'table' && prompt.answers) {
    for (const a of prompt.answers) {
      if (a.trapNote) continue;
      consider(a.text, a.depth);
    }
  } else {
    for (const song of FULL_SONG_POOL) {
      if (openSongQualifies(prompt, song)) {
        consider(song.title, openSongDepth(prompt, song));
      }
    }
  }

  const result = {
    common: common ?? { text: '', depth: 0 },
    deepest: deepest ?? { text: '', depth: 0 },
  };
  extremesCache.set(prompt.id, result);
  return result;
}

export const OPEN_PROMPTS: OpenPrompt[] = [
  {
    id: 'O1',
    prompt: 'Name any Weezer band member.',
    kind: 'table',
    ramp: 1,
    answers: [
      { text: 'Rivers Cuomo', aliases: ['Rivers', 'Cuomo'], depth: 30 },
      { text: 'Brian Bell', aliases: ['Brian', 'Bell'], depth: 45 },
      { text: 'Patrick Wilson', aliases: ['Patrick', 'Pat', 'Wilson'], depth: 50 },
      { text: 'Scott Shriner', aliases: ['Scott', 'Shriner'], depth: 55 },
      { text: 'Matt Sharp', aliases: ['Matt', 'Sharp'], depth: 160 },
      { text: 'Mikey Welsh', aliases: ['Mikey', 'Welsh'], depth: 420 },
      {
        text: 'Karl Koch',
        aliases: ['Karl', 'Koch'],
        depth: 700,
        note: "Not an official member — but you knew that, didn't you.",
      },
      { text: 'Jason Cropper', aliases: ['Jason', 'Cropper'], depth: 950 },
    ],
    loreLine:
      'Four men are in the band today — but the family tree has deeper roots.',
  },
  {
    id: 'O4',
    prompt: 'Name a Weezer album.',
    kind: 'table',
    ramp: 2,
    answers: [
      { text: 'The Blue Album', aliases: ['Blue', 'Blue Album'], depth: 25 },
      { text: 'Pinkerton', aliases: [], depth: 45 },
      { text: 'The Green Album', aliases: ['Green', 'Green Album'], depth: 50 },
      { text: 'The White Album', aliases: ['White', 'White Album'], depth: 60 },
      { text: 'The Red Album', aliases: ['Red', 'Red Album'], depth: 110 },
      { text: 'Make Believe', aliases: [], depth: 130 },
      { text: 'Raditude', aliases: [], depth: 160 },
      { text: 'Hurley', aliases: [], depth: 180 },
      { text: 'Van Weezer', aliases: [], depth: 300 },
      {
        text: 'EWBAITE',
        aliases: ['Everything Will Be Alright in the End'],
        depth: 320,
      },
      { text: 'OK Human', aliases: [], depth: 350 },
      { text: 'Pacific Daydream', aliases: [], depth: 380 },
      { text: 'The Black Album', aliases: ['Black', 'Black Album'], depth: 650 },
      { text: 'The Teal Album', aliases: ['Teal', 'Teal Album'], depth: 700 },
      { text: 'Death to False Metal', aliases: ['DTFM'], depth: 750 },
      { text: 'SZNZ: Spring', aliases: ['SZNZ Spring', 'Spring'], depth: 800 },
      { text: 'SZNZ: Summer', aliases: ['SZNZ Summer', 'Summer'], depth: 800 },
      { text: 'SZNZ: Autumn', aliases: ['SZNZ Autumn', 'Autumn'], depth: 800 },
      { text: 'SZNZ: Winter', aliases: ['SZNZ Winter', 'Winter'], depth: 800 },
    ],
    loreLine:
      'The color albums are just where the catalog starts — it runs a lot deeper than the famous ones.',
  },
  {
    id: 'O7',
    prompt: 'Name a song Weezer has covered.',
    kind: 'table',
    ramp: 3,
    answers: [
      { text: 'Africa', aliases: [], depth: 30 },
      { text: 'Take On Me', aliases: [], depth: 90 },
      { text: 'Mr. Blue Sky', aliases: [], depth: 120 },
      {
        text: 'Everybody Wants to Rule the World',
        aliases: ['Rule the World'],
        depth: 200,
      },
      { text: 'No Scrubs', aliases: [], depth: 260 },
      {
        text: 'Sweet Dreams (Are Made of This)',
        aliases: ['Sweet Dreams'],
        depth: 300,
      },
      { text: 'Happy Together', aliases: [], depth: 350 },
      { text: 'Billie Jean', aliases: [], depth: 380 },
      { text: 'Stand by Me', aliases: [], depth: 420 },
      { text: 'Paranoid', aliases: [], depth: 500 },
      { text: 'Paranoid Android', aliases: [], depth: 550 },
    ],
    loreLine:
      'A single covers album restarted the whole band — and it started as an internet meme.',
  },
  {
    id: 'O2',
    prompt: 'Name someone who has produced a Weezer record.',
    kind: 'table',
    ramp: 4,
    answers: [
      { text: 'Ric Ocasek', aliases: ['Ocasek'], depth: 40 },
      { text: 'Jake Sinclair', aliases: ['Jake', 'Sinclair'], depth: 150 },
      { text: 'Butch Walker', aliases: ['Butch', 'Walker'], depth: 170 },
      { text: 'Rick Rubin', aliases: ['Rubin'], depth: 300 },
      { text: 'Dave Sitek', aliases: ['Sitek'], depth: 380 },
      { text: 'Suzy Shinn', aliases: ['Suzy', 'Shinn'], depth: 520 },
      {
        text: 'Robopop',
        aliases: ['Daniel Omelio', 'Omelio', 'Daniel'],
        depth: 780,
      },
      { text: 'Tyler Cole', aliases: ['Tyler', 'Cole'], depth: 850 },
    ],
    loreLine:
      "The producer's chair has held everyone from a Cars frontman to half of TV on the Radio.",
  },
  {
    id: 'O14',
    prompt: 'Name a band or artist Weezer has covered.',
    kind: 'table',
    ramp: 5,
    answers: [
      { text: 'Toto', aliases: [], depth: 40 },
      { text: 'a-ha', aliases: ['Aha'], depth: 90 },
      { text: 'ELO', aliases: ['Electric Light Orchestra'], depth: 180 },
      { text: 'TLC', aliases: [], depth: 240 },
      { text: 'Tears for Fears', aliases: [], depth: 300 },
      { text: 'The Eurythmics', aliases: ['Eurythmics'], depth: 320 },
      { text: 'The Turtles', aliases: ['Turtles'], depth: 350 },
      { text: 'Michael Jackson', aliases: ['Jackson'], depth: 380 },
      { text: 'Radiohead', aliases: [], depth: 420 },
      { text: 'Ben E. King', aliases: [], depth: 460 },
      { text: 'Black Sabbath', aliases: ['Sabbath'], depth: 500 },
    ],
    loreLine:
      'The covers run from Toto to Black Sabbath — one teal-colored album spans most of this list.',
  },
  {
    id: 'O10',
    prompt: 'Name a Weezer song with a place in the title.',
    kind: 'song',
    ramp: 6,
    // Curated set — the judgment calls the content file blesses
    // ("fans will argue — that's good"). "America," LA, California,
    // the garage, the mall, La Brea: all places. Acapulco, the
    // file's deepest example, is not in this app's 206-song
    // catalog, so it can't be scored here (flagged in REPORT).
    songIds: [
      'mb_1', // Beverly Hills
      'green_4', // Island in the Sun
      'blue_8', // In the Garage
      'blue_6', // Surf Wax America
      'wh_1', // California Kids
      'wh_8', // L.A. Girlz
      'blk_4', // Living in L.A.
      'blk_10', // California Snow
      'pd_1', // Mexican Fender
      'pd_9', // La Mancha Screwjob
      'ew_6', // The British Are Coming
      'okh_12', // La Brea Tar Pits
      'rad_9', // In the Mall
      'sz_su6', // Cuomoville
    ],
    depthOverrides: { mb_1: 25, green_4: 30, blue_8: 120 },
    loreLine:
      'Half this catalog happens within a mile of a garage in Los Angeles.',
  },
  {
    id: 'O8',
    prompt: 'Name the opening track of any Weezer album.',
    kind: 'song',
    ramp: 7,
    songConstraint: { kind: 'opener' },
    depthOverrides: { blue_1: 40, pink_1: 140, green_1: 380 },
    songTraps: {
      blue_10:
        "Only in Dreams is the LAST song on the Blue Album — it closes records, it doesn't open them.",
      blue_3:
        'The World Has Turned and Left Me Here is track two. My Name Is Jonas opens the Blue Album.',
    },
    loreLine:
      'First tracks are statements — Jonas and Tired of Sex are two very different ways to say hello.',
  },
  {
    id: 'O9',
    prompt: 'Name the closing track of any Weezer album.',
    kind: 'song',
    ramp: 8,
    songConstraint: { kind: 'closer' },
    depthOverrides: { blue_10: 90, pink_10: 210, red_10: 480, mb_12: 350 },
    songTraps: {
      blue_1:
        "My Name Is Jonas is the FIRST song on the Blue Album — it opens records, it doesn't close them.",
    },
    loreLine:
      'Closers are where this band parks its biggest feelings — Only in Dreams built that tradition.',
  },
  {
    id: 'O3',
    prompt:
      "Name a Weezer side project, or a band a member plays in when he's not in Weezer.",
    kind: 'table',
    ramp: 9,
    answers: [
      { text: 'The Rentals', aliases: ['Rentals'], depth: 90 },
      { text: 'The Special Goodness', aliases: ['Special Goodness'], depth: 420 },
      { text: 'Goat Punishment', aliases: ['Goat'], depth: 600 },
      { text: 'The Relationship', aliases: ['Relationship'], depth: 820 },
      { text: 'Homie', aliases: [], depth: 880 },
    ],
    loreLine:
      'Every man in this band has a second life somewhere else on the family tree.',
  },
  {
    id: 'O6',
    prompt: 'Name a Weezer B-side.',
    kind: 'song',
    ramp: 10,
    songConstraint: { kind: 'b-side' },
    loreLine:
      "B-sides were the fan club's currency — the deeper cuts lived there.",
  },
  {
    id: 'O12',
    prompt: 'Name a song Rivers wrote about a real person.',
    kind: 'song',
    ramp: 11,
    // Curated: the fan-club sisters, the B-side girls, the fan whose
    // letter became Across the Sea, the girl behind Pink Triangle —
    // and The Good Life, which is about Rivers himself.
    songIds: ['bs_4', 'bs_5', 'bs_12', 'pink_5', 'pink_6', 'pink_8'],
    depthOverrides: { bs_12: 700, bs_5: 800, bs_4: 900 },
    loreLine:
      'Rivers writes about real people — two of them ran his fan club.',
  },
  {
    id: 'O5',
    prompt: "Name a song with a girl's name in the title.",
    kind: 'song',
    ramp: 12,
    songConstraint: { kind: 'girl-name-in-title' },
    depthOverrides: { bs_12: 700, bs_5: 800, bs_4: 900 },
    songTraps: {
      blue_1:
        "Jonas is a guy. Right band, wrong prompt — this one wants a girl's name.",
    },
    loreLine:
      'Some categories are all deep water: the named girls in this catalog mostly lived on B-sides.',
  },
  {
    id: 'O11',
    prompt:
      'Name someone who has sung or played on a Weezer record besides the four current members.',
    kind: 'table',
    ramp: 13,
    answers: [
      { text: 'Lil Wayne', aliases: ['Wayne'], depth: 120 },
      { text: 'Michael Cera', aliases: ['Cera'], depth: 260 },
      { text: 'Ryan Adams', aliases: ['Adams'], depth: 450 },
      { text: 'Petra Haden', aliases: ['Petra', 'Haden'], depth: 800 },
    ],
    loreLine:
      'Weezer records hide some unlikely names in the credits, if you read the small print.',
  },
  {
    id: 'O15',
    prompt: 'Name a Weezer song whose title asks a question.',
    kind: 'song',
    ramp: 14,
    // The catalog's genuine question titles — phrased as questions,
    // no punctuation tricks.
    songIds: ['pink_4', 'wh_5', 'hur_5', 'sz_au3', 'sz_su5', 'sz_au5'],
    loreLine:
      'Not many titles in this catalog actually ask you anything — and the ones that do span every era.',
  },
  {
    id: 'O13',
    prompt:
      'Name a Weezer song that appeared in a movie, or on a movie soundtrack.',
    kind: 'song',
    ramp: 15,
    songIds: ['green_4', 'bs_3'],
    depthOverrides: { green_4: 80, bs_3: 520 },
    songTraps: {
      blue_4:
        "Buddy Holly's video is a Happy Days TV moment — beloved, but it was never in a movie.",
    },
    loreLine:
      'A mid-90s movie soundtrack carried one of these years before most fans ever found it.',
  },
];

/* ------------------------------------------------------------------ */
/* Visual rounds — fixed questions with media reveals                  */
/* ------------------------------------------------------------------ */

/**
 * RESERVE CONTENT (v5): three rounds that reused fixed questions
 * from the v1 bank, with the moment itself as a GIF on the reveal.
 * Mark's call (Oct 27): every question with exactly one correct
 * answer is out of the game — runs no longer deal these, and the
 * GIFs went with their questions. The data stays, like the v1 bank,
 * in case a media moment ever earns its way back. Media URLs are
 * Tenor CDN links, verified live (HTTP 200, image/gif) on Oct 26,
 * 2026 — prototype-grade sourcing, per the content file.
 */
export interface VisualRound {
  id: string;
  /** The v1 bank question this round reuses (prompt/spec/depth/lore). */
  questionId: string;
  mediaUrl: string;
  mediaAlt: string;
}

export const VISUAL_ROUNDS: VisualRound[] = [
  {
    id: 'V1',
    questionId: 'L3', // Name the song with the Happy Days video.
    mediaUrl:
      'https://media1.tenor.com/m/MTK1KCqCtRsAAAAd/buddy-holly-weezer.gif',
    mediaAlt:
      'Rivers singing inside the Happy Days diner in the Buddy Holly video',
  },
  {
    id: 'V2',
    questionId: 'L4', // What Weezer song has the Muppets in its video?
    mediaUrl:
      'https://media1.tenor.com/m/cM1wBPs30McAAAAd/muppets-weezer.gif',
    mediaAlt: "The band posing with the Muppets in the Keep Fishin' video",
  },
  {
    id: 'V3',
    questionId: 'L6', // Finish the SNL line: "ride or ___."
    mediaUrl:
      'https://media1.tenor.com/m/1Z3gU-SZ7MwAAAAd/ride-or-die-weezer.gif',
    mediaAlt:
      'The SNL dinner-party argument about Weezer, mid-"ride or die"',
  },
];

/** The bank question a visual round reuses. */
export function visualRoundQuestion(round: VisualRound): LoreQuestion {
  const q = LORE_QUESTIONS.find((x) => x.id === round.questionId);
  if (!q) throw new Error(`Visual round ${round.id} lost its question`);
  return q;
}

/* ------------------------------------------------------------------ */
/* Run composition                                                     */
/* ------------------------------------------------------------------ */

export type RunItem = { kind: 'open'; prompt: OpenPrompt };

/**
 * Deals one run: 10 open prompts, nothing else (v5 — Mark removed
 * every single-answer question, visual rounds included). The ten
 * split across the pool's breadth ramp — five from the broad half
 * (ramps 1–7), five from the narrow half (8–15) — each half dealt
 * in ramp order, so the run narrows as it goes: broad prompts early,
 * narrow prompts late.
 */
export function buildRunV2(rand: () => number = Math.random): RunItem[] {
  const byRamp = [...OPEN_PROMPTS].sort((a, b) => a.ramp - b.ramp);
  const drawHalf = (pool: OpenPrompt[], count: number): OpenPrompt[] => {
    const copy = [...pool];
    const drawn: OpenPrompt[] = [];
    while (drawn.length < count && copy.length > 0) {
      drawn.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
    }
    return drawn.sort((a, b) => a.ramp - b.ramp);
  };

  return [
    ...drawHalf(byRamp.slice(0, 7), 5),
    ...drawHalf(byRamp.slice(7), 5),
  ].map((prompt) => ({ kind: 'open' as const, prompt }));
}

/* ------------------------------------------------------------------ */
/* The unlock gate                                                     */
/* ------------------------------------------------------------------ */

/**
 * The game unlocks when the Blue Album and Pinkerton triage sections
 * are complete — "complete" in the milestone system's own sense
 * (Step1Deck's sectionIsComplete): every song in the section has a
 * triage entry, a bucket OR a "Don't Know It" mark.
 */
export const LORE_GATE_ALBUMS: readonly string[] = ['The Blue Album', 'Pinkerton'];

export function loreGateRemainingAlbums(
  triageMap: Record<string, unknown>
): string[] {
  return LORE_GATE_ALBUMS.filter((album) =>
    FULL_SONG_POOL.some(
      (s) => s.album === album && triageMap[s.id] === undefined
    )
  );
}

export function isLoreUnlocked(triageMap: Record<string, unknown>): boolean {
  return loreGateRemainingAlbums(triageMap).length === 0;
}

/* ------------------------------------------------------------------ */
/* Best run (localStorage)                                             */
/* ------------------------------------------------------------------ */

/** The fan's deepest finished run, kept on this device. */
export interface LoreBest {
  depth: number;
  band: string;
}

const LORE_BEST_KEY = 'weezer-lore-best';

export function readLoreBest(): LoreBest | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LORE_BEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LoreBest>;
    if (typeof parsed.depth === 'number' && typeof parsed.band === 'string') {
      return { depth: parsed.depth, band: parsed.band };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeLoreBest(best: LoreBest): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LORE_BEST_KEY, JSON.stringify(best));
  } catch {
    /* storage unavailable — the best simply doesn't persist */
  }
}
