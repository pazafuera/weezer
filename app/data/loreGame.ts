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

/** True when the song satisfies a name-a-song prompt's constraint. */
export function songQualifies(
  constraint: _SongConstraint,
  song: Song
): boolean {
  switch (constraint.kind) {
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
