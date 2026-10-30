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

import {
  ALBUMS_BY_ID,
  ALBUM_NAME_TO_ID,
  FULL_SONG_POOL,
  SINGLE_SONG_IDS,
  Song,
} from './constants';
import {
  LoreAnswerSpec,
  SongConstraint as _SongConstraint,
  normalizeAnswer,
  songTitleVariants,
} from '../lib/loreMatch';

export type { SongConstraint } from '../lib/loreMatch';

/* ------------------------------------------------------------------ */
/* The stops (RUN TOTALS) — the game's ONE ladder (Oct 28, 2026)       */
/* ------------------------------------------------------------------ */

/**
 * The journey back: six stops between the hits and the beginning,
 * named for places in the band's story. A run's score says how far
 * back it got (these bands); the five-game total reads the SAME
 * stop names off TOTAL_STOPS below. One vocabulary everywhere —
 * the fanhood titles this ladder used to parallel are retired.
 */
export interface DepthBand {
  min: number;
  /** Inclusive upper bound; Infinity for the bedrock band. */
  max: number;
  title: string;
  /** One line about the stop. */
  line: string;
}

export const DEPTH_BANDS: DepthBand[] = [
  {
    min: 0,
    max: 199,
    title: "Arnold's Diner",
    line: 'The hit, the Happy Days video, TV-land. Every trip back starts here.',
  },
  {
    min: 200,
    max: 499,
    title: 'Island in the Sun',
    line: "Out on the golden sea — still sunny, but the shore's behind you now.",
  },
  {
    min: 500,
    max: 1499,
    title: 'Across the Sea',
    line: 'The crossing. It gets confessional from here.',
  },
  {
    min: 1500,
    max: 2999,
    title: 'La Brea Tar Pits',
    line: "Things down here don't fade — they're preserved: the demos, the lost songs, the vault.",
  },
  {
    min: 3000,
    max: 4999,
    title: 'The Garage',
    line: "The sanctuary — the Dungeon Master's Guide, a 12-sided die, Kiss records on the shelf.",
  },
  {
    min: 5000,
    max: Infinity,
    title: 'The Shack',
    line: 'The last stop is the first place. Nothing sits below the beginning.',
  },
];

export function bandForTotal(total: number): DepthBand {
  for (const band of DEPTH_BANDS) {
    if (total >= band.min && total <= band.max) return band;
  }
  return DEPTH_BANDS[DEPTH_BANDS.length - 1];
}

/**
 * The layers a plunge ENTERS as the total moves from `fromTotal` to
 * `toTotal`: every band (past the first) whose floor the move
 * crosses, shallow → deep. Drives the during-the-fall layer-name
 * flashes (Oct 27, 2026 — Mark: the descent needs to REGISTER, layer
 * by layer). A move that stays inside one band enters nothing.
 */
export function bandsEnteredBetween(
  fromTotal: number,
  toTotal: number
): { index: number; title: string; atDepth: number }[] {
  const entered: { index: number; title: string; atDepth: number }[] = [];
  DEPTH_BANDS.forEach((band, i) => {
    if (i > 0 && fromTotal < band.min && toTotal >= band.min) {
      entered.push({ index: i, title: band.title, atDepth: band.min });
    }
  });
  return entered;
}

/* ------------------------------------------------------------------ */
/* Stop derivations (the one ladder, both scales)                      */
/* ------------------------------------------------------------------ */

/** The stop a single game's score reached — its band, by name. */
export function stopForScore(score: number): DepthBand {
  return bandForTotal(score);
}

export interface JourneyStop {
  /** The five-game total at which this stop is reached. */
  min: number;
  title: string;
  /**
   * How a standing sentence names being at this stop — the
   * fragment after "You're" ("You're on an Island in the Sun",
   * never "You're at Island in the Sun"). Per-stop because the
   * blanket "at" is wrong for half the road (Mark, Oct 30, 2026).
   */
  phrase: string;
}

/**
 * The stops on the TOTAL scale: where the sum of the five game
 * scores has gotten you. Same names, same order as DEPTH_BANDS
 * (the harness holds the two lists to it) — the route strip on
 * the picker reads off this table, and every standing line names
 * its stop from here. Thresholds (Oct 28, 2026): the retired
 * total ladder's 2,500 / 6,000 / 12,500 / 21,000 cuts, with the
 * old top band split at 17,000 so the Garage gets its own floor.
 */
export const TOTAL_STOPS: JourneyStop[] = [
  { min: 0, title: "Arnold's Diner", phrase: "at Arnold's Diner" },
  { min: 2500, title: 'Island in the Sun', phrase: 'on an Island in the Sun' },
  { min: 6000, title: 'Across the Sea', phrase: 'across the Sea' },
  { min: 12500, title: 'La Brea Tar Pits', phrase: 'in the La Brea Tar Pits' },
  { min: 17000, title: 'The Garage', phrase: 'in The Garage' },
  { min: 21000, title: 'The Shack', phrase: 'back to The Shack' },
];

/** The stop a five-game total has reached. */
export function stopForTotal(total: number): JourneyStop {
  let reached = TOTAL_STOPS[0];
  for (const stop of TOTAL_STOPS) {
    if (total >= stop.min) reached = stop;
  }
  return reached;
}

/**
 * The standing sentence for a stop: "You're " + the stop's own
 * fragment, so every surface says it the stop's way ("You're on
 * an Island in the Sun", "You're across the Sea", "You're back
 * to The Shack"). Unknown names fall back to the plain "at".
 */
export function youreAtPhrase(stopName: string): string {
  const stop = TOTAL_STOPS.find((s) => s.title === stopName);
  return stop ? `You're ${stop.phrase}` : `You're at ${stopName}`;
}

/** The next stop up the road and the points still needed to
 *  reach it — null once the total is back to the Shack. */
export function nextStopForTotal(
  total: number
): { title: string; pointsTo: number } | null {
  for (const stop of TOTAL_STOPS) {
    if (total < stop.min) {
      return { title: stop.title, pointsTo: stop.min - total };
    }
  }
  return null;
}

/**
 * The route strip's threshold label for one stop, derived from
 * TOTAL_STOPS itself so the strip can never disagree with
 * stopForTotal: the first stop reads "You start here", every
 * other "{floor} total".
 */
export function totalStopThresholdLabel(index: number): string {
  const stop = TOTAL_STOPS[index];
  if (index === 0) return 'You start here';
  return `${stop.min.toLocaleString('en-US')} total`;
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

  /* ---------------- Band 6 — The Shack bedrock ---------------- */
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
    songTitleVariants(song.title, song.id).forEach((v) => set.add(v));
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

/**
 * One warm line for the landing, keyed by the answer's rarity tier.
 * DRAFT copy for Mark's markup (v6): written for Weezer Lore's own
 * voice, deliberately not borrowed from Krillion's tier lines.
 */
export const TIER_TAGLINES: Record<RarityTier, string> = {
  Common: "The first answer in every fan's head.",
  Uncommon: 'You skipped the obvious one — good instinct.',
  Rare: 'Most fans never get back this far.',
  'Super rare': 'Bedrock knowledge — almost nobody gets back this far.',
};

/** One row of an open prompt's rarity table. */
export interface OpenAnswer {
  /** The answer as displayed. */
  text: string;
  /**
   * Extra accepted forms, beyond the derived ones (see
   * openAnswerEntries): short forms, name parts, spelling variants.
   */
  aliases?: string[];
  depth: number;
  /** Shown on the reveal when this exact answer is the one played. */
  note?: string;
  /**
   * Present ⇒ this row is a TRAP: a plausible-but-invalid answer.
   * Naming it scores 0 and the reveal carries this correction.
   */
  trapNote?: string;
  /**
   * Song answers only: the ranking catalog's title for this song
   * when it differs from the display text (the bank carries the
   * corrected title; the catalog carries another spelling). Used
   * only to resolve the catalog song (duplicate tracking + reveal
   * covers) — matching itself runs on text + aliases + variants.
   */
  catalogTitle?: string;
  /**
   * Set false to keep this row from resolving to a catalog song
   * even when its title matches one — the covers prompt's Clash
   * title shares its name with a Weezer original on SZNZ: Spring,
   * and the two are different songs.
   */
  catalog?: boolean;
}

export interface OpenPrompt {
  id: string;
  prompt: string;
  /**
   * The complete scoring table. Since the five-game rebuild (Oct
   * 27, 2026), membership in this table is the ONLY way to score:
   * a catalog song that isn't in a prompt's table doesn't score
   * for that prompt, and a beyond-the-catalog (†) row in the table
   * does. Transcribed from the v2 bank
   * (weezer-lore-open-prompts-v2.md) — depths exactly as printed
   * there; the few † rows the bank prints without depths carry
   * editorial assignments flagged in REPORT.md.
   */
  answers: OpenAnswer[];
  /** True when the answers are songs (copy choices only — the
      matcher treats every prompt's table the same way). */
  songs?: boolean;
  /** One warm line for the reveal. */
  loreLine: string;
}

/* ------------------------------------------------------------------ */
/* Catalog resolution for song answers                                 */
/* ------------------------------------------------------------------ */

const SONG_BY_NORMALIZED_TITLE = new Map<string, Song>();
for (const song of FULL_SONG_POOL) {
  const key = normalizeAnswer(song.title);
  if (!SONG_BY_NORMALIZED_TITLE.has(key)) {
    SONG_BY_NORMALIZED_TITLE.set(key, song);
  }
}

/** The catalog song an answer row names, when it names one. */
export function openAnswerSong(answer: OpenAnswer): Song | undefined {
  if (answer.catalog === false) return undefined;
  return SONG_BY_NORMALIZED_TITLE.get(
    normalizeAnswer(answer.catalogTitle ?? answer.text)
  );
}

/**
 * The identity a scored answer consumes for the rest of a run: the
 * catalog song when there is one, else the answer's own text. One
 * song can sit in several prompts of the same game (the Vault's
 * Christmas/soundtrack/B-side overlap is the known case) — it
 * still only pays out once per run.
 */
export function openAnswerKey(answer: OpenAnswer): string {
  const song = openAnswerSong(answer);
  return song ? `song:${song.id}` : `text:${normalizeAnswer(answer.text)}`;
}

export interface OpenAnswerEntry {
  spec: { answer: string; aliases: string[] };
  trap: boolean;
}

/**
 * Matcher entries for a prompt's table: each row's canonical text,
 * its hand-written aliases, and — for rows that name a catalog
 * song — the song's derived title variants (dash splits,
 * parenthetical drops, and the curated short forms like "Sheila",
 * via app/lib/loreMatch.ts). The forgiving matcher (normalization,
 * Levenshtein tolerance, confusables guard) runs over these.
 */
export function openAnswerEntries(prompt: OpenPrompt): OpenAnswerEntry[] {
  const canonicals = new Set(
    prompt.answers.map((a) => normalizeAnswer(a.text))
  );
  return prompt.answers.map((answer) => {
    const own = normalizeAnswer(answer.text);
    const aliases = [...(answer.aliases ?? [])];
    // Derived title variants only for scoring rows: a trap is
    // caught by its own name, never by a variant — and no alias,
    // derived or written, may equal another row's canonical name
    // (the question prompt's corrected title vs. its Clash trap
    // is the case that forces the rule).
    if (answer.trapNote === undefined) {
      const song = openAnswerSong(answer);
      if (song) {
        for (const variant of songTitleVariants(song.title, song.id)) {
          if (
            variant !== own &&
            !canonicals.has(variant) &&
            !aliases.includes(variant)
          ) {
            aliases.push(variant);
          }
        }
      }
    }
    return {
      spec: {
        answer: answer.text,
        aliases: aliases.filter(
          (alias) => normalizeAnswer(alias) !== own && !canonicals.has(normalizeAnswer(alias))
        ),
      },
      trap: answer.trapNote !== undefined,
    };
  });
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
 * (shallowest valid row) and the deepest answer there is. Every
 * reveal shows both, hit or miss.
 */
export function openPromptExtremes(
  prompt: OpenPrompt
): { common: AnswerExtreme; deepest: AnswerExtreme } {
  const cached = extremesCache.get(prompt.id);
  if (cached) return cached;

  let common: AnswerExtreme | undefined;
  let deepest: AnswerExtreme | undefined;
  for (const a of prompt.answers) {
    if (a.trapNote) continue;
    if (!common || a.depth < common.depth) common = { text: a.text, depth: a.depth };
    if (!deepest || a.depth > deepest.depth) deepest = { text: a.text, depth: a.depth };
  }

  const result = {
    common: common ?? { text: '', depth: 0 },
    deepest: deepest ?? { text: '', depth: 0 },
  };
  extremesCache.set(prompt.id, result);
  return result;
}

/** One valid row in a prompt's full post-run answer table. */
export interface DigAnswer {
  text: string;
  depth: number;
  tier: RarityTier;
}

/**
 * The full valid answer table for one prompt: its non-trap rows,
 * deepest first (then by title) so the table can group the rows by
 * tier without re-sorting.
 */
export function openPromptAnswerTable(prompt: OpenPrompt): DigAnswer[] {
  const rows: DigAnswer[] = [];
  for (const answer of prompt.answers) {
    if (answer.trapNote) continue;
    rows.push({
      text: answer.text,
      depth: answer.depth,
      tier: tierForDepth(answer.depth),
    });
  }
  return rows.sort(
    (a, b) => b.depth - a.depth || a.text.localeCompare(b.text)
  );
}

/** A resolved album cover for a scoring reveal. */
export interface AnswerCover {
  album: string;
  src: string;
}

const normalizeAlbumName = (value: string): string =>
  normalizeAnswer(value).replace(/^the /, '');

/**
 * Cover files actually present under public/albums. The registry
 * also points at Death to False Metal and Teal cover paths that are
 * not shipped in this tree; returning those would render a broken
 * image, so they resolve to no visual instead.
 */
const SHIPPED_ALBUM_COVER_PATHS = new Set([
  '/albums/b-sides.jpg',
  '/albums/black.png',
  '/albums/blue.jpg',
  '/albums/ewbaite.jpg',
  '/albums/gold.jpg',
  '/albums/green.jpg',
  '/albums/hurley.jpg',
  '/albums/make-believe.jpg',
  '/albums/maladroit.jpg',
  '/albums/ok-human.jpg',
  '/albums/pacific-daydream.png',
  '/albums/pinkerton.jpg',
  '/albums/raditude.jpg',
  '/albums/red.jpg',
  '/albums/sznz-autumn.jpg',
  '/albums/sznz-spring.jpg',
  '/albums/sznz-summer.jpg',
  '/albums/sznz-winter.jpg',
  '/albums/van-weezer.png',
  '/albums/white.jpg',
]);

function shippedCover(album: { name: string; cover: string }): AnswerCover | undefined {
  return SHIPPED_ALBUM_COVER_PATHS.has(album.cover)
    ? { album: album.name, src: album.cover }
    : undefined;
}

function coverForAlbumName(albumName: string): AnswerCover | undefined {
  const wanted = normalizeAlbumName(
    albumName === 'EWBAITE'
      ? 'Everything Will Be Alright in the End'
      : albumName
  );
  const album = Object.values(ALBUMS_BY_ID).find(
    (candidate) => normalizeAlbumName(candidate.name) === wanted
  );
  if (album) return shippedCover(album);

  const bridgedId = Object.entries(ALBUM_NAME_TO_ID).find(
    ([name]) => normalizeAlbumName(name) === wanted
  )?.[1];
  const bridged = bridgedId ? ALBUMS_BY_ID[bridgedId] : undefined;
  return bridged ? shippedCover(bridged) : undefined;
}

/**
 * The ten studio-album tracks on the Teal Album — the one explicit
 * song-to-album association the covers prompt needs that the
 * 206-song pool cannot supply (its covers are not catalog songs).
 * Paranoid Android is deliberately absent: it is not a Teal Album
 * track, so it gets no visual rather than a wrong one.
 */
const TEAL_ALBUM_COVER_SONGS = new Set([
  'africa',
  'take on me',
  'mr blue sky',
  'everybody wants to rule the world',
  'no scrubs',
  'sweet dreams are made of this',
  'happy together',
  'billie jean',
  'stand by me',
  'paranoid',
]);

/**
 * Resolve a valid answer to exactly one album cover, or return
 * undefined when the association is not known. A missing cover is
 * always preferable to a wrong or placeholder image: the reveal
 * simply shows no visual.
 */
export function answerCoverFor(
  prompt: OpenPrompt,
  answerText: string
): AnswerCover | undefined {
  if (prompt.id === 'P4') return coverForAlbumName(answerText);

  const row = prompt.answers.find((a) => a.text === answerText);
  if (row) {
    const song = openAnswerSong(row);
    if (song) return coverForAlbumName(song.album);
  }

  if (prompt.id === 'P7') {
    return TEAL_ALBUM_COVER_SONGS.has(normalizeAnswer(answerText))
      ? coverForAlbumName('The Teal Album')
      : undefined;
  }

  return undefined;
}

export const OPEN_PROMPTS: OpenPrompt[] = [
  {
    id: 'P1',
    prompt: 'Name any Weezer band member.',
    loreLine:
      'Four men are in the band today — but the family tree has deeper roots.',
    answers: [
      { text: 'Rivers Cuomo', depth: 30, aliases: ['Rivers', 'Cuomo'] },
      { text: 'Brian Bell', depth: 45, aliases: ['Brian', 'Bell'] },
      { text: 'Patrick Wilson', depth: 50, aliases: ['Patrick', 'Wilson'] },
      { text: 'Scott Shriner', depth: 55, aliases: ['Scott', 'Shriner'] },
      { text: 'Matt Sharp', depth: 160, aliases: ['Matt', 'Sharp'] },
      { text: 'Mikey Welsh', depth: 420, aliases: ['Mikey', 'Welsh'] },
      {
        text: 'Karl Koch',
        depth: 700,
        aliases: ['Karl', 'Koch'],
        note: "Not an official member — but you knew that, didn't you.",
      },
      { text: 'Jason Cropper', depth: 950, aliases: ['Jason', 'Cropper'] },
      {
        text: 'Josh Freese',
        depth: 550,
        aliases: ['Josh', 'Freese'],
        note: 'Touring musician, never an official member.',
      },
      {
        text: 'Bobby Schneck',
        depth: 800,
        aliases: ['Bobby', 'Schneck'],
        note: 'Touring musician, never an official member.',
      },
      {
        text: 'Daniel Brummel',
        depth: 950,
        aliases: ['Daniel', 'Brummel'],
        note: 'Touring musician, never an official member.',
      },
      {
        text: 'Dave Elitch',
        depth: 1100,
        aliases: ['Dave', 'Elitch'],
        note: 'Touring musician, never an official member.',
      },
      {
        text: 'Atom Willard',
        depth: 0,
        trapNote: 'Drum tech and guest — never a touring member.',
      },
      {
        text: 'Pat Finn',
        depth: 0,
        trapNote: 'Pre-Weezer bands only — never a member of Weezer.',
      },
      {
        text: 'Scottie Chapman',
        depth: 0,
        trapNote: 'Pre-Weezer bands only — never a member of Weezer.',
      },
    ],
  },
  {
    id: 'P2',
    prompt: 'Name a Weezer producer.',
    loreLine:
      "The producer's chair has held everyone from a Cars frontman to half of TV on the Radio.",
    answers: [
      { text: 'Ric Ocasek', depth: 40, aliases: ['Ric', 'Ocasek'] },
      { text: 'Rivers Cuomo', depth: 55, aliases: ['Rivers', 'Cuomo'] },
      { text: 'Jake Sinclair', depth: 150, aliases: ['Jake', 'Sinclair'] },
      { text: 'Butch Walker', depth: 170, aliases: ['Butch', 'Walker'] },
      { text: 'Jacknife Lee', depth: 180, aliases: ['Jacknife', 'Lee'] },
      { text: 'Rick Rubin', depth: 300, aliases: ['Rick', 'Rubin'] },
      { text: 'Shawn Everett', depth: 320, aliases: ['Shawn', 'Everett'] },
      { text: 'Dr. Luke', depth: 350, aliases: ['Luke'] },
      { text: 'Dave Sitek', depth: 380, aliases: ['Dave', 'Sitek'] },
      { text: 'Polow da Don', depth: 450, aliases: ['Polow'] },
      { text: 'Suzy Shinn', depth: 520, aliases: ['Suzy', 'Shinn'] },
      { text: 'Toby Gad', depth: 650, aliases: ['Toby', 'Gad'] },
      { text: 'Ethan Gruska', depth: 700, aliases: ['Ethan', 'Gruska'] },
      { text: 'Jonny Coffer', depth: 750, aliases: ['Jonny', 'Coffer'] },
      { text: 'Robopop', depth: 780, aliases: ['Daniel Omelio'] },
      { text: 'J.R. Rotem', depth: 800, aliases: ['Rotem'] },
      { text: 'Tyler Cole', depth: 850, aliases: ['Tyler', 'Cole'] },
      { text: 'Mark Rankin', depth: 850, aliases: ['Mark', 'Rankin'] },
      { text: 'Oh, Hush!', depth: 900 },
      { text: 'James Flannigan', depth: 950, aliases: ['James', 'Flannigan'] },
      { text: 'Klas Åhlund', depth: 1000, aliases: ['Klas', 'Ahlund', 'Klas Ahlund'] },
      { text: 'Kenneth Blume', depth: 1100, aliases: ['Kenneth', 'Blume'] },
      { text: 'Chad Bamford', depth: 1100, aliases: ['Chad', 'Bamford'] },
      {
        text: 'Jermaine Dupri',
        depth: 0,
        trapNote: 'He wrote with Rivers — he never produced a Weezer record.',
      },
      {
        text: 'Rich Costey',
        depth: 0,
        trapNote: 'A mixer — he never produced a Weezer record.',
      },
      {
        text: 'Eric Valentine',
        depth: 0,
        trapNote: 'Mixer and engineer — never the producer.',
      },
    ],
  },
  {
    id: 'P3',
    prompt:
      "Name a Weezer side project, or a band a member plays in when he's not in Weezer.",
    loreLine:
      'Every man in this band has a second life somewhere else on the family tree.',
    answers: [
      { text: 'The Rentals', depth: 90, aliases: ['Rentals'] },
      { text: 'Space Twins', depth: 180 },
      { text: 'The Special Goodness', depth: 420, aliases: ['Special Goodness'] },
      { text: 'Scott & Rivers', depth: 550, aliases: ['Scott and Rivers'] },
      { text: 'Matt Sharp', depth: 600, aliases: ['Matt', 'Sharp'] },
      {
        text: 'Goat Punishment',
        depth: 600,
        note: "That's Weezer in disguise.",
      },
      { text: 'The Kickovers', depth: 800, aliases: ['Kickovers'] },
      { text: 'The Relationship', depth: 820, aliases: ['Relationship'] },
      { text: 'Carnival Art', depth: 850 },
      { text: 'Homie', depth: 880 },
      { text: 'Shriners', depth: 900 },
      { text: 'Avant Garde', depth: 900 },
      { text: 'PusherJones', depth: 950 },
      { text: 'Chopper One', depth: 950 },
      { text: 'Karlophone', depth: 1000 },
      { text: 'Zoom', depth: 1000 },
      { text: 'Heretix', depth: 1000 },
      { text: 'Fuzz', depth: 1050 },
      { text: 'Sixty Wrong Sausages', depth: 1100 },
      { text: 'Left Nut', depth: 1100 },
      { text: 'Jocobono', depth: 1100 },
    ],
  },
  {
    id: 'P4',
    prompt: 'Name a Weezer album.',
    loreLine:
      'The color albums are just where the catalog starts — it runs a lot deeper than the famous ones.',
    answers: [
      { text: 'The Blue Album', depth: 25 },
      { text: 'Pinkerton', depth: 45 },
      { text: 'The Green Album', depth: 50 },
      { text: 'The White Album', depth: 60 },
      { text: 'Maladroit', depth: 70 },
      { text: 'The Red Album', depth: 110 },
      { text: 'Make Believe', depth: 130 },
      { text: 'Raditude', depth: 160 },
      { text: 'Hurley', depth: 180 },
      { text: 'Van Weezer', depth: 300 },
      {
        text: 'EWBAITE',
        depth: 320,
        aliases: ['Everything Will Be Alright in the End'],
      },
      { text: 'OK Human', depth: 350 },
      { text: 'Pacific Daydream', depth: 380 },
      { text: 'The Gold Album', depth: 450 },
      { text: 'The Black Album', depth: 650 },
      { text: 'The Teal Album', depth: 700 },
      { text: 'Death to False Metal', depth: 750 },
      { text: 'SZNZ: Spring', depth: 800 },
      { text: 'SZNZ: Summer', depth: 800 },
      { text: 'SZNZ: Autumn', depth: 800 },
      { text: 'SZNZ: Winter', depth: 800 },
      {
        text: 'Alone',
        depth: 0,
        trapNote: 'A Rivers solo record — not a Weezer album.',
      },
      {
        text: 'Alone II',
        depth: 0,
        trapNote: 'A Rivers solo record — not a Weezer album.',
      },
      {
        text: 'Alone III',
        depth: 0,
        trapNote: 'A Rivers solo record — not a Weezer album.',
      },
      {
        text: 'Songs from the Black Hole',
        depth: 0,
        trapNote: 'Never released — it exists as demos, not an album.',
      },
      {
        text: 'The Kitchen Tape',
        depth: 0,
        trapNote: 'A demo tape, not an album.',
      },
    ],
  },
  {
    id: 'P5',
    prompt: "Name a song with a girl's name in the title.",
    songs: true,
    loreLine:
      'Some categories are all deep water: the named girls in this catalog mostly lived on B-sides.',
    answers: [
      { text: 'Cleopatra', depth: 98 },
      {
        text: 'Summer Elaine and Drunk Dori',
        depth: 360,
        aliases: ['Dori'],
      },
      { text: 'Sweet Mary', depth: 406 },
      { text: "Any Friend of Diane's", depth: 439, aliases: ['Diane'] },
      { text: 'Sheila Can Do It', depth: 447 },
      { text: 'Francesca', depth: 466 },
      { text: 'Miss Sweeney', depth: 710 },
      { text: 'Susanne', depth: 800, aliases: ['Suzanne'] },
      { text: 'Mykel and Carli', depth: 900, aliases: ['Mykel'] },
      { text: 'Jamie', depth: 700 },
      // † beyond the 206 — score like any other row (Mark, Oct 27).
      { text: 'My Evaline', depth: 1000 },
      { text: 'Billie Jean', depth: 380 },
      { text: 'Rosanna', depth: 150 },
      // † with no depth printed anywhere in the bank — editorial
      // assignments, flagged in REPORT.md.
      { text: 'Portia', depth: 950 },
      { text: 'Lisa', depth: 900 },
      { text: "Maria's Theme", depth: 950 },
      {
        text: 'My Name Is Jonas',
        depth: 0,
        trapNote: "Jonas is a guy — that song is about Rivers' brother.",
      },
      {
        text: 'Lullabye for Wayne',
        depth: 0,
        trapNote: 'Wayne is a guy.',
      },
      { text: 'Da Vinci', depth: 0, trapNote: 'Da Vinci is a guy.' },
      {
        text: 'Run, Raven, Run',
        depth: 0,
        trapNote: 'The raven is a bird, not a girl.',
      },
    ],
  },
  {
    id: 'P6',
    prompt: 'Name a Weezer B-side.',
    songs: true,
    loreLine:
      "B-sides were the fan club's currency — the deeper cuts lived there.",
    answers: [
      { text: 'Tragic Girl', depth: 620 },
      { text: 'I Just Threw Out the Love of My Dreams', depth: 635 },
      { text: 'You Gave Your Love to Me Softly', depth: 650 },
      { text: 'Mykel and Carli', depth: 665 },
      { text: 'Susanne', depth: 680 },
      { text: 'Waiting on You', depth: 695 },
      { text: 'Devotion', depth: 740 },
      { text: 'Jamie', depth: 785 },
      { text: 'Miss Sweeney', depth: 710 },
      { text: 'Pig', depth: 755 },
      { text: 'The Spider', depth: 770 },
      { text: 'King', depth: 815 },
      { text: 'The Prettiest Girl in the Whole Wide World', depth: 860 },
      { text: 'Fake Smiles and Nervous Laughter', depth: 875 },
      { text: 'Long Time Sunshine', depth: 725 },
      { text: 'Paperface', depth: 800 },
      { text: 'Lullabye for Wayne', depth: 830 },
      { text: "I Swear It's True", depth: 845 },
      // † beyond the 206 — depths carried from the bank's other
      // tables where it prints them.
      { text: 'Viva la Vida', depth: 200 },
      { text: 'The Weight', depth: 550 },
      { text: "Are 'Friends' Electric?", depth: 700 },
      { text: "Life's What You Make It", depth: 700 },
      { text: 'Love My Way', depth: 750 },
      { text: 'Oddfellows Local 151', depth: 800 },
      { text: 'My Evaline', depth: 1000 },
      { text: 'Meri Kuri', depth: 1200 },
      // † Christmas Celebration: depth assigned with The Christmas
      // Song's (750/850 — the fan-club EP originals sit deeper than
      // the 2008 carols). Flagged DRAFT in REPORT.md.
      { text: 'Christmas Celebration', depth: 850 },
      // † with no depth printed anywhere in the bank — editorial
      // assignments in the B-side cluster, flagged in REPORT.md.
      { text: 'Starlight', depth: 700 },
      { text: 'I Love the USA', depth: 700 },
      { text: 'Always', depth: 750 },
      { text: 'I Do', depth: 800 },
      { text: 'Oh Lisa', depth: 800 },
      { text: 'Get Me Some', depth: 800 },
      { text: 'The Underdogs', depth: 800 },
      { text: 'Teenage Victory Song', depth: 850 },
      { text: 'Brightening Day', depth: 850 },
      { text: "It's Easy", depth: 850 },
      { text: 'Run Over by a Truck', depth: 850 },
      { text: 'Friend of a Friend', depth: 850 },
      { text: 'Sugar Booger', depth: 900 },
      { text: 'Living Without You', depth: 900 },
      { text: 'Turn Me Round', depth: 900 },
      { text: 'All My Friends Are Insects', depth: 900 },
      { text: 'Prom Night', depth: 900 },
      { text: 'The Way I Hate You Now', depth: 900 },
      { text: 'I Can Love', depth: 950 },
      { text: 'The Story of My Life', depth: 950 },
      { text: 'I Want to Be Something', depth: 950 },
      { text: 'Across the Meadow', depth: 950 },
      { text: 'Portia', depth: 950 },
      { text: "Why Don't You Get Me", depth: 950 },
      { text: "I've Thrown It All Away", depth: 1000 },
      {
        text: 'Velouria',
        depth: 0,
        trapNote: 'A tribute-compilation track, not a B-side.',
      },
      {
        text: 'Hot Tub',
        depth: 0,
        trapNote: 'An unreleased demo, not a B-side.',
      },
      {
        // The bank lists this song as a B-side-prompt TRAP even
        // though it sits in the prompt's † gap list: the EP/bonus
        // release is not the B-side — its partner is. It still
        // scores in the Christmas prompt (N6) at 750.
        text: 'The Christmas Song',
        depth: 0,
        trapNote:
          'An EP and bonus-track release — its partner Christmas Celebration is the B-side.',
      },
    ],
  },
  {
    id: 'P7',
    prompt: 'Name a song Weezer has covered.',
    songs: true,
    loreLine:
      'A single covers album restarted the whole band — and it started as an internet meme.',
    answers: [
      { text: 'Africa', depth: 30 },
      { text: 'Take On Me', depth: 90 },
      { text: 'Mr. Blue Sky', depth: 120 },
      { text: 'Rosanna', depth: 150 },
      { text: "I'm a Believer", depth: 150 },
      { text: 'You Might Think', depth: 180 },
      { text: 'Everybody Wants to Rule the World', depth: 200 },
      { text: 'Enter Sandman', depth: 200 },
      { text: 'Viva la Vida', depth: 200 },
      { text: 'No Scrubs', depth: 260 },
      { text: 'Sweet Dreams (Are Made of This)', depth: 300 },
      { text: 'We Wish You a Merry Christmas', depth: 300 },
      {
        text: 'Kids / Poker Face',
        depth: 300,
        aliases: ['Kids', 'Poker Face'],
      },
      {
        // The Clash's song — NOT the SZNZ: Spring original that
        // shares the title (see the catalog flag on OpenAnswer).
        text: 'Should I Stay or Should I Go',
        depth: 300,
        catalog: false,
      },
      { text: 'Silent Night', depth: 300 },
      { text: 'Happy Together', depth: 350 },
      { text: 'Lost in the Woods', depth: 350 },
      { text: 'Unbreak My Heart', depth: 350 },
      { text: 'O Come All Ye Faithful', depth: 350 },
      { text: 'O Holy Night', depth: 350 },
      { text: 'Rainbow Connection', depth: 400 },
      { text: 'Brain Stew', depth: 400 },
      { text: 'War Pigs', depth: 400 },
      { text: 'Velouria', depth: 450 },
      { text: 'Worry Rock', depth: 500 },
      { text: 'Paranoid', depth: 500 },
      { text: 'Paranoid Android', depth: 550 },
      { text: 'The Weight', depth: 550 },
      { text: "Are 'Friends' Electric?", depth: 700 },
      { text: "Life's What You Make It", depth: 700 },
      { text: 'The First Noel', depth: 700 },
      { text: 'Hark! The Herald Angels Sing', depth: 700 },
      { text: 'Love My Way', depth: 750 },
      { text: 'Oddfellows Local 151', depth: 800 },
      { text: 'Hot for Teacher', depth: 800 },
      { text: 'Just What I Needed', depth: 850 },
      { text: "I Think We're Alone Now", depth: 850 },
      { text: 'I Woke Up in Love This Morning', depth: 900 },
      { text: 'My Evaline', depth: 1000 },
      { text: 'Meri Kuri', depth: 1200 },
      {
        text: 'Buddy Holly',
        depth: 0,
        trapNote: 'Rivers wrote that one — the title is a compliment, not a cover.',
      },
      {
        text: 'The Christmas Song',
        depth: 0,
        trapNote: 'A Cuomo original, not a cover.',
      },
      {
        text: 'Christmas Celebration',
        depth: 0,
        trapNote: 'A Cuomo original, not a cover.',
      },
      {
        text: 'Heroin',
        depth: 0,
        trapNote: 'Members-only film work — never released as a Weezer cover.',
      },
      {
        text: 'Love Is the Answer',
        depth: 0,
        trapNote: 'An original with a borrowed-sounding title — Rivers wrote it.',
      },
    ],
  },
  {
    id: 'P8',
    prompt: 'Name the opening track of any Weezer album.',
    songs: true,
    loreLine:
      'First tracks are statements — Jonas and Tired of Sex are two very different ways to say hello.',
    answers: [
      { text: 'Beverly Hills', depth: 30 },
      { text: 'My Name Is Jonas', depth: 40 },
      { text: 'Troublemaker', depth: 60 },
      { text: '(If You\'re Wondering If I Want You To) I Want You To', depth: 60 },
      { text: 'Memories', depth: 70 },
      { text: 'All My Favorite Songs', depth: 85 },
      { text: "Can't Knock the Hustle", depth: 95 },
      { text: 'Hero', depth: 95 },
      { text: 'Tired of Sex', depth: 140 },
      { text: 'American Gigolo', depth: 150 },
      { text: "Ain't Got Nobody", depth: 280 },
      { text: 'California Kids', depth: 300 },
      { text: 'Mexican Fender', depth: 340 },
      { text: "Don't Let Go", depth: 380 },
      { text: 'Opening Night', depth: 430 },
      { text: 'Lawn Chair', depth: 430 },
      {
        // The catalog shortens this title ("Can't Dance, Don't
        // Ask") — flagged in REPORT.md.
        text: "Can't Dance, Don't Ask Me",
        depth: 430,
        catalogTitle: "Can't Dance, Don't Ask",
      },
      { text: 'I Want a Dog', depth: 430 },
      { text: 'Say Yes', depth: 920 },
      // † beyond the 206.
      { text: 'Africa', depth: 30 },
      // † with no depth printed anywhere in the bank — editorial
      // assignment, flagged in REPORT.md.
      { text: 'Turning Up the Radio', depth: 750 },
      {
        text: 'Only in Dreams',
        depth: 0,
        trapNote: 'That one closes the Blue Album — openers are the other end.',
      },
      {
        text: 'The World Has Turned and Left Me Here',
        depth: 0,
        trapNote: 'Track 2 — My Name Is Jonas opens the Blue Album.',
      },
    ],
  },
  {
    id: 'P9',
    prompt: 'Name the closing track of any Weezer album.',
    songs: true,
    loreLine:
      'Closers are where this band parks its biggest feelings — Only in Dreams built that tradition.',
    answers: [
      { text: 'Only in Dreams', depth: 90 },
      { text: 'Butterfly', depth: 210 },
      { text: 'O Girlfriend', depth: 211 },
      { text: 'December', depth: 249 },
      { text: "I Don't Want to Let You Go", depth: 320 },
      { text: 'Time Flies', depth: 330 },
      { text: 'Haunt You Every Day', depth: 350 },
      { text: 'Endless Bummer', depth: 390 },
      { text: 'III. Return to Ithaka', depth: 400 },
      { text: "Any Friend of Diane's", depth: 439 },
      { text: 'California Snow', depth: 449 },
      { text: 'Precious Metal Girl', depth: 469 },
      { text: 'The Angel and the One', depth: 480 },
      { text: 'La Brea Tar Pits', depth: 481 },
      { text: 'Wild At Heart', depth: 502 },
      { text: 'Thank You and Good Night', depth: 502 },
      { text: 'Run, Raven, Run', depth: 502 },
      { text: 'The Deep and Dreamless Sleep', depth: 502 },
      { text: 'King', depth: 815 },
      { text: 'Fake Smiles and Nervous Laughter', depth: 875 },
      { text: 'The LA Sound', depth: 1154 },
      // † beyond the 206.
      { text: 'Stand by Me', depth: 420 },
      { text: 'Unbreak My Heart', depth: 350 },
      // † carrying the depths assigned in the B-side table (P6),
      // flagged there and in REPORT.md.
      { text: 'The Underdogs', depth: 800 },
      { text: 'Living Without You', depth: 900 },
      { text: 'The Way I Hate You Now', depth: 900 },
      { text: 'Across the Meadow', depth: 950 },
      { text: 'Portia', depth: 950 },
      { text: "Why Don't You Get Me", depth: 950 },
      { text: "I've Thrown It All Away", depth: 1000 },
      // † with no depth printed anywhere in the bank — editorial
      // assignment, flagged in REPORT.md.
      { text: 'Represent (Rocked Out Mix)', depth: 850 },
      {
        text: 'Slave',
        depth: 0,
        trapNote: 'Track 9 of 13 — December closes Maladroit.',
      },
      {
        text: 'Billie Jean',
        depth: 0,
        trapNote: 'Track 9 on the Teal Album — Stand by Me closes it.',
      },
      {
        text: 'My Name Is Jonas',
        depth: 0,
        trapNote: 'That one is an opener.',
      },
    ],
  },
  {
    id: 'P10',
    prompt: 'Name a Weezer song with a place in the title.',
    songs: true,
    loreLine:
      'Half this catalog happens within a mile of a garage in Los Angeles.',
    answers: [
      { text: 'Beverly Hills', depth: 25 },
      { text: 'Island in the Sun', depth: 30 },
      { text: 'Living in L.A.', depth: 68 },
      { text: 'In the Garage', depth: 120 },
      { text: 'Surf Wax America', depth: 130 },
      { text: 'California Kids', depth: 300 },
      { text: 'In the Mall', depth: 310 },
      { text: 'The British Are Coming', depth: 330 },
      { text: 'Mexican Fender', depth: 340 },
      { text: 'L.A. Girlz', depth: 370 },
      { text: 'III. Return to Ithaka', depth: 400 },
      { text: 'La Mancha Screwjob', depth: 428 },
      { text: 'California Snow', depth: 449 },
      { text: 'Sheraton Commander', depth: 466 },
      { text: 'La Brea Tar Pits', depth: 481 },
      { text: 'Cuomoville', depth: 490 },
      { text: 'The LA Sound', depth: 1154 },
      // † beyond the 206.
      { text: 'Africa', depth: 30 },
      // † with no depth printed anywhere in the bank — editorial
      // assignment, flagged in REPORT.md.
      { text: 'Acapulco', depth: 950, aliases: ['Puerto Vallarta'] },
      {
        text: 'Beach Boys',
        depth: 0,
        trapNote: 'That is a band, not a place.',
      },
      {
        text: 'Holiday',
        depth: 0,
        trapNote: 'A trip — not a place in the title.',
      },
      {
        text: 'December',
        depth: 0,
        trapNote: 'A time, not a place.',
      },
    ],
  },
  {
    id: 'P11',
    prompt:
      'Name someone who has sung or played on a Weezer record besides the four current members.',
    loreLine:
      'Weezer records hide some unlikely names in the credits, if you read the small print.',
    answers: [
      { text: 'Lil Wayne', depth: 120, aliases: ['Wayne'] },
      { text: 'Hayley Williams', depth: 150, aliases: ['Hayley', 'Williams'] },
      { text: 'Michael Cera', depth: 300, aliases: ['Cera'] },
      { text: 'Bethany Cosentino', depth: 300, aliases: ['Bethany', 'Cosentino'] },
      { text: 'Josh Freese', depth: 350, aliases: ['Josh'] },
      { text: 'Ric Ocasek', depth: 350, aliases: ['Ocasek'] },
      { text: 'Michael Fitzpatrick', depth: 400, aliases: ['Fitzpatrick', 'Fitz'] },
      { text: 'Butch Walker', depth: 400, aliases: ['Butch', 'Walker'] },
      { text: 'Ryan Adams', depth: 450, aliases: ['Adams'] },
      { text: 'Desmond Child', depth: 450, aliases: ['Desmond', 'Child'] },
      { text: 'Nadya Tolokonnikova', depth: 450, aliases: ['Nadya', 'Tolokonnikova'] },
      { text: 'Jacknife Lee', depth: 500, aliases: ['Jacknife', 'Lee'] },
      { text: 'Dan Wilson', depth: 500, aliases: ['Dan', 'Wilson'] },
      { text: 'Suzy Shinn', depth: 500, aliases: ['Suzy', 'Shinn'] },
      { text: 'Amrita Sen', depth: 550, aliases: ['Amrita', 'Sen'] },
      { text: 'Money Mark', depth: 550 },
      { text: 'Jake Sinclair', depth: 600, aliases: ['Jake', 'Sinclair'] },
      {
        text: 'Rachel Haden',
        depth: 700,
        aliases: ['Rachel'],
        note: "Lead vocal on 'I Just Threw Out the Love of My Dreams'.",
      },
      { text: 'Rob Mathes', depth: 700, aliases: ['Mathes'] },
      { text: 'Johnny Knoxville', depth: 700, aliases: ['Knoxville'] },
      { text: 'Patrick Stickles', depth: 700, aliases: ['Stickles'] },
      { text: 'Blake Mills', depth: 700, aliases: ['Blake', 'Mills'] },
      { text: 'Steve-O', depth: 750 },
      {
        text: 'Petra Haden',
        depth: 800,
        aliases: ['Petra'],
        note: "Violin on 'Worry Rock'.",
      },
      { text: 'Chris Pontius', depth: 800, aliases: ['Pontius'] },
      { text: 'Daniel Brummel', depth: 800, aliases: ['Daniel', 'Brummel'] },
      { text: 'Stephanie Eitzel', depth: 800, aliases: ['Stephanie', 'Eitzel'] },
      { text: 'Jimmy Harry', depth: 800, aliases: ['Jimmy'] },
      { text: 'Ryan Dunn', depth: 850, aliases: ['Dunn'] },
      { text: 'Tony Berg', depth: 900, aliases: ['Tony', 'Berg'] },
      { text: 'Jason Freese', depth: 900, aliases: ['Jason'] },
      { text: 'Nishat Khan', depth: 900, aliases: ['Nishat', 'Khan'] },
      { text: 'Coast Modern', depth: 900 },
      { text: 'Wee Man', depth: 900 },
      { text: 'Mykel Allan', depth: 900, aliases: ['Mykel', 'Allan'] },
      { text: 'Stevie Blacke', depth: 900, aliases: ['Stevie', 'Blacke'] },
      { text: 'Jonathan Dreyfus', depth: 900, aliases: ['Jonathan', 'Dreyfus'] },
      { text: 'Dave England', depth: 950, aliases: ['Dave', 'England'] },
      { text: 'Karl Koch', depth: 1000, aliases: ['Karl', 'Koch'] },
      { text: 'Tanya Haden', depth: 1000, aliases: ['Tanya'] },
      { text: 'Zac Carper', depth: 1000, aliases: ['Zac', 'Carper'] },
      { text: 'Scott Chesak', depth: 1000, aliases: ['Scott', 'Chesak'] },
      { text: 'Jonny Coffer', depth: 1000, aliases: ['Jonny', 'Coffer'] },
      { text: 'Charlie Brand', depth: 1000, aliases: ['Charlie', 'Brand'] },
      { text: 'Jean-Louise Parker', depth: 1000, aliases: ['Parker'] },
      { text: 'Preston Lacy', depth: 1000, aliases: ['Preston', 'Lacy'] },
      { text: 'Akiko Tarumoto', depth: 1000, aliases: ['Akiko', 'Tarumoto'] },
      { text: 'Ehren McGhehey', depth: 1050, aliases: ['Ehren', 'McGhehey'] },
      { text: 'Ryan Spraker', depth: 1050, aliases: ['Spraker'] },
      { text: 'Alex Goose', depth: 1050, aliases: ['Alex', 'Goose'] },
      { text: 'Eric J', depth: 1100 },
      { text: 'Geralyn Fennelly', depth: 1100, aliases: ['Fennelly'] },
      { text: 'Aaron Suplizio', depth: 1100, aliases: ['Suplizio'] },
      { text: 'Sim Grewall', depth: 1100, aliases: ['Grewall'] },
      { text: 'April Margera', depth: 1100, aliases: ['April', 'Margera'] },
      { text: 'Avram Sills', depth: 1100, aliases: ['Avram', 'Sills'] },
      { text: 'Greg Vail', depth: 1100, aliases: ['Greg', 'Vail'] },
      { text: 'Taylor Morden', depth: 1100, aliases: ['Taylor', 'Morden'] },
      { text: 'Christopher Wray', depth: 1100, aliases: ['Christopher', 'Wray'] },
      { text: 'Sam Robles', depth: 1100, aliases: ['Sam', 'Robles'] },
      { text: 'Todd Simon', depth: 1100, aliases: ['Todd', 'Simon'] },
      { text: 'Ihui Wu', depth: 1100, aliases: ['Ihui', 'Wu'] },
      { text: 'Allison Allport', depth: 1100, aliases: ['Allison', 'Allport'] },
      { text: 'Ryan Baxley', depth: 1100, aliases: ['Baxley'] },
      { text: 'Alice Baxley', depth: 1100, aliases: ['Alice'] },
      { text: 'RJ Word', depth: 1100 },
      { text: 'Aaron Shaw', depth: 1100, aliases: ['Shaw'] },
      { text: 'Ivan Wayman', depth: 1100, aliases: ['Ivan', 'Wayman'] },
      { text: 'Amy Andersen', depth: 1100, aliases: ['Amy', 'Andersen'] },
      { text: 'Harry Cooper', depth: 1100, aliases: ['Cooper'] },
      { text: "Kelly O'Donohue", depth: 1100, aliases: ['Kelly'] },
      { text: 'Efe Cakar', depth: 1100, aliases: ['Efe', 'Cakar'] },
      { text: 'Rod Cervera', depth: 1100, aliases: ['Rod', 'Cervera'] },
      {
        text: 'Dr. Luke',
        depth: 0,
        trapNote: 'He wrote with Rivers — he never played on a Weezer record.',
      },
      {
        text: 'Tyson Ritter',
        depth: 0,
        trapNote: 'A co-writer who never performed on a Weezer record.',
      },
      {
        text: 'Nick Wheeler',
        depth: 0,
        trapNote: 'A co-writer who never performed on a Weezer record.',
      },
      {
        text: 'Mac Davis',
        depth: 0,
        trapNote: 'A co-writer who never performed on a Weezer record.',
      },
      {
        text: 'Linda Perry',
        depth: 0,
        trapNote: 'A co-writer who never performed on a Weezer record.',
      },
      {
        text: 'Rick Nowels',
        depth: 0,
        trapNote: 'A co-writer who never performed on a Weezer record.',
      },
      {
        text: 'Jermaine Dupri',
        depth: 0,
        trapNote: 'A co-writer who never performed on a Weezer record.',
      },
      {
        text: 'Laura Jane Grace',
        depth: 0,
        trapNote: 'A co-writer who never performed on a Weezer record.',
      },
      {
        text: 'Kenny G',
        depth: 0,
        trapNote: 'A live promo moment — not on a Weezer record.',
      },
      {
        text: '"Weird Al" Yankovic',
        depth: 0,
        trapNote: "He acted in the 'Africa' video — he didn't perform on the record.",
      },
      {
        text: 'Jason Cropper',
        depth: 0,
        trapNote: 'His parts were re-recorded over — a writing credit only.',
      },
    ],
  },
  {
    id: 'P12',
    prompt: 'Name a song Rivers wrote about a real person.',
    songs: true,
    loreLine:
      'Rivers writes about real people — two of them ran his fan club.',
    answers: [
      { text: 'Buddy Holly', depth: 20 },
      { text: "Say It Ain't So", depth: 35 },
      { text: 'My Name Is Jonas', depth: 50 },
      { text: 'El Scorcho', depth: 80 },
      { text: 'The Good Life', depth: 95 },
      { text: 'King of the World', depth: 99 },
      { text: 'Across the Sea', depth: 146 },
      { text: 'Pink Triangle', depth: 173 },
      { text: 'Falling for You', depth: 182 },
      { text: 'The Other Way', depth: 280 },
      { text: 'Tragic Girl', depth: 620 },
      { text: 'Jamie', depth: 700 },
      { text: 'Susanne', depth: 800 },
      { text: 'The Prettiest Girl in the Whole Wide World', depth: 860 },
      { text: 'Mykel and Carli', depth: 900 },
      {
        text: 'Heart Songs',
        depth: 0,
        trapNote: 'Namechecks are not subjects — that one is a list, not a portrait.',
      },
      {
        text: 'In the Garage',
        depth: 0,
        trapNote: 'Posters on a wall — the song is not about them.',
      },
      {
        text: 'Hash Pipe',
        depth: 0,
        trapNote: "Rivers' first song written from a fictional point of view.",
      },
      {
        text: 'Miss Sweeney',
        depth: 0,
        trapNote: 'A fictional character.',
      },
      {
        text: 'Summer Elaine and Drunk Dori',
        depth: 0,
        trapNote: 'Borrowed titles and assembled lyrics — not about a real person.',
      },
    ],
  },
  {
    id: 'P13',
    prompt:
      'Name a Weezer song that appeared in a movie, or on a movie soundtrack.',
    songs: true,
    loreLine:
      'A mid-90s movie soundtrack carried one of these years before most fans ever found it.',
    answers: [
      { text: 'Island in the Sun', depth: 25 },
      { text: 'Hash Pipe', depth: 30 },
      { text: 'Beverly Hills', depth: 30 },
      { text: 'Memories', depth: 60 },
      { text: 'Troublemaker', depth: 60 },
      { text: '(If You\'re Wondering If I Want You To) I Want You To', depth: 60 },
      { text: 'Happy Hour', depth: 100 },
      { text: 'Photograph', depth: 139 },
      { text: 'Holiday', depth: 154 },
      { text: 'Everybody Get Dangerous', depth: 300 },
      { text: 'My Best Friend', depth: 300 },
      { text: 'Beginning of the End', depth: 414 },
      { text: 'California Snow', depth: 449 },
      { text: 'A Little Bit of Love', depth: 454 },
      { text: 'Susanne', depth: 520 },
      { text: 'You Gave Your Love to Me Softly', depth: 520 },
      // † beyond the 206.
      { text: 'Lost in the Woods', depth: 150 },
      { text: 'You Might Think', depth: 180 },
      { text: "I'm a Believer", depth: 200 },
      { text: 'Take On Me', depth: 200 },
      { text: 'Happy Together', depth: 350 },
      { text: 'Enter Sandman', depth: 400 },
      { text: "Santa Claus Is Comin' to Town", depth: 450 },
      { text: 'We Wish You a Merry Christmas', depth: 500 },
      { text: "It's Always Summer in Bikini Bottom", depth: 700 },
      {
        text: 'Buddy Holly',
        depth: 0,
        trapNote: 'A TV video moment — it was never in a movie.',
      },
      {
        text: 'Starlight',
        depth: 0,
        trapNote: "The Hot Chick soundtrack uses Zed's cover, not Weezer's recording.",
      },
      {
        text: 'Wanda',
        depth: 0,
        trapNote: 'Written for Angus, but it was rejected.',
      },
      {
        text: "Say It Ain't So",
        depth: 0,
        trapNote: 'A TV life only — never a movie.',
      },
      {
        text: 'The Good Life',
        depth: 0,
        trapNote: 'A TV life only — never a movie.',
      },
      {
        text: 'Africa',
        depth: 0,
        trapNote: 'TV only — never on a movie soundtrack.',
      },
    ],
  },
  {
    id: 'P14',
    prompt: 'Name a band or artist Weezer has covered.',
    loreLine:
      'The covers run from Toto to Black Sabbath — one teal-colored album spans most of this list.',
    answers: [
      { text: 'Toto', depth: 40 },
      { text: 'a-ha', depth: 90 },
      { text: 'The Monkees', depth: 150 },
      { text: 'ELO', depth: 180, aliases: ['Electric Light Orchestra'] },
      { text: 'The Cars', depth: 180 },
      { text: 'Metallica', depth: 200 },
      { text: 'Coldplay', depth: 200 },
      { text: 'TLC', depth: 240 },
      { text: 'Tears for Fears', depth: 300 },
      { text: 'The Clash', depth: 300 },
      { text: 'MGMT', depth: 300 },
      { text: 'Lady Gaga', depth: 300 },
      { text: 'Eurythmics', depth: 320 },
      { text: 'The Turtles', depth: 350 },
      { text: 'Toni Braxton', depth: 350 },
      { text: 'Jonathan Groff', depth: 350 },
      { text: 'Michael Jackson', depth: 380 },
      { text: 'Green Day', depth: 400 },
      {
        text: 'Kermit the Frog',
        depth: 400,
        aliases: ['Jim Henson', 'Kermit'],
      },
      { text: 'Radiohead', depth: 420 },
      { text: 'Pixies', depth: 450 },
      { text: 'Ben E. King', depth: 460 },
      { text: 'Black Sabbath', depth: 500 },
      { text: 'The Band', depth: 550 },
      { text: 'Tubeway Army', depth: 700 },
      { text: 'Talk Talk', depth: 700 },
      {
        text: 'The Psychedelic Furs',
        depth: 750,
        aliases: ['Psychedelic Furs'],
      },
      { text: 'R.E.M.', depth: 800, aliases: ['REM'] },
      { text: 'Van Halen', depth: 800 },
      {
        text: 'Tommy James and the Shondells',
        depth: 850,
        aliases: ['Tommy James'],
      },
      { text: 'The Partridge Family', depth: 900 },
      { text: 'BoA', depth: 1200 },
      {
        text: 'Buddy Holly',
        depth: 0,
        trapNote: 'Named in a song title — Weezer never covered him.',
      },
      {
        text: 'The Velvet Underground',
        depth: 0,
        trapNote: 'Members-only film work — never a Weezer cover.',
      },
      {
        text: 'Mel Tormé',
        depth: 0,
        trapNote: 'A title collision — Weezer never covered him.',
      },
    ],
  },
  {
    id: 'P15',
    prompt: 'Name a Weezer song whose title asks a question.',
    songs: true,
    loreLine:
      'Not many titles in this catalog actually ask you anything — and the ones that do span every era.',
    answers: [
      { text: 'Do You Wanna Get High?', depth: 62 },
      { text: 'Why Bother?', depth: 137 },
      { text: "Where's My Sex?", depth: 280 },
      { text: 'What Happens After You?', depth: 454 },
      { text: "What's the Good of Being Good", depth: 478 },
      {
        // The bank carries the corrected title; the ranking
        // catalog still spells it the other way (flagged in
        // REPORT.md). catalogTitle keeps the catalog song
        // resolved for covers and duplicate tracking.
        text: 'Should She Stay or Should She Go',
        depth: 478,
        catalogTitle: 'Should I Stay or Should I Go',
      },
      // † beyond the 206, with no depths printed anywhere in the
      // bank — editorial assignments, flagged in REPORT.md.
      { text: 'How Long?', depth: 850 },
      { text: 'What Is This I Find?', depth: 900 },
      { text: "Why Can't You Shut Your Mouth?", depth: 950 },
      { text: "Who You Callin' Bitch?", depth: 1000 },
      {
        text: 'Should I Stay or Should I Go',
        depth: 0,
        trapNote:
          "That's the Clash song — Weezer's is 'Should She Stay or Should She Go'.",
      },
      {
        text: "Say It Ain't So",
        depth: 0,
        trapNote: 'A plea, not a question.',
      },
      {
        text: 'Love Is the Answer',
        depth: 0,
        trapNote: 'A statement, not a question.',
      },
      {
        text: 'This Is Such a Pity',
        depth: 0,
        trapNote: 'A statement, not a question.',
      },
      {
        text: '(If You\'re Wondering If I Want You To) I Want You To',
        depth: 0,
        trapNote: 'A conditional, not a question.',
      },
    ],
  },
  {
    id: 'N1',
    prompt: "Name an artist Rivers Cuomo has sung or played on — on THEIR record.",
    loreLine:
      'Rivers has sung hooks for rappers, EDM DJs and a country singer — and, deepest cut of all, for a CBeebies pigeon named Feathers.',
    answers: [
      { text: 'B.o.B', depth: 40 },
      { text: 'AJR', depth: 60 },
      { text: 'Simple Plan', depth: 60 },
      { text: 'Steve Aoki', depth: 120, aliases: ['Aoki'] },
      { text: 'Cold', depth: 150 },
      { text: 'Zeds Dead', depth: 150 },
      { text: 'Big Data', depth: 180 },
      { text: 'The Avalanches', depth: 180, aliases: ['Avalanches'] },
      { text: 'Snakehips', depth: 200 },
      { text: 'Mark Ronson', depth: 300, aliases: ['Ronson'] },
      { text: 'RAC', depth: 300 },
      { text: 'AWOLNATION', depth: 300 },
      { text: 'Kevin Rudolf', depth: 350, aliases: ['Rudolf'] },
      { text: 'Miranda Cosgrove', depth: 350, aliases: ['Miranda', 'Cosgrove'] },
      { text: 'New Politics', depth: 350 },
      { text: 'Hitomi', depth: 400 },
      { text: 'Lindsey Stirling', depth: 400, aliases: ['Lindsey', 'Stirling'] },
      { text: 'Dominic Fike', depth: 400, aliases: ['Dominic', 'Fike'] },
      { text: 'San Holo', depth: 400 },
      { text: 'Billy Talent', depth: 450 },
      { text: 'Todd Rundgren', depth: 450, aliases: ['Rundgren'] },
      { text: 'The Knocks', depth: 450, aliases: ['Knocks'] },
      { text: 'Vic Mensa', depth: 450, aliases: ['Vic', 'Mensa'] },
      { text: 'Morgan Evans', depth: 500, aliases: ['Morgan', 'Evans'] },
      { text: 'Crazy Town', depth: 700 },
      { text: 'Sugar Ray', depth: 800 },
      { text: 'AM Radio', depth: 1000 },
      { text: 'Yukee', depth: 1200 },
      {
        text: 'Limp Bizkit',
        depth: 0,
        trapNote: 'Recorded with Rivers, but left off the album.',
      },
      {
        text: 'Hayley Williams',
        depth: 0,
        trapNote: 'Wrong direction — she guested with Weezer.',
      },
      {
        text: 'Paramore',
        depth: 0,
        trapNote: 'Wrong direction — Hayley Williams guested with Weezer.',
      },
      {
        text: 'Becky G',
        depth: 0,
        trapNote: "She co-wrote her 'Magic' rework — she doesn't perform on a Rivers record.",
      },
      {
        text: 'Mark Hoppus',
        depth: 0,
        trapNote: 'Same McBusted album, different songs.',
      },
    ],
  },
  {
    id: 'N2',
    prompt: 'Name a Weezer song with a color in the title.',
    songs: true,
    loreLine:
      'Just three color titles in the whole 206-song catalog — and two of them are blue.',
    answers: [
      { text: 'Pink Triangle', depth: 173 },
      { text: 'Blue Dream', depth: 425 },
      { text: 'Blue Like Jazz', depth: 454 },
      // † beyond the 206.
      { text: 'Mr. Blue Sky', depth: 120 },
      {
        text: 'Buddy Holly',
        depth: 0,
        trapNote: "The color is in the album's name, not the title.",
      },
      {
        text: 'Island in the Sun',
        depth: 0,
        trapNote: 'No color in that title.',
      },
    ],
  },
  {
    id: 'N3',
    prompt: 'Name a Weezer song with "love" in the title.',
    songs: true,
    loreLine:
      'Six titles say the word out loud — and the two deepest are both Pinkerton-era B-sides.',
    answers: [
      { text: 'Love Explosion', depth: 231 },
      { text: 'Love Is the Answer', depth: 290 },
      { text: 'A Little Bit of Love', depth: 454 },
      { text: 'All This Love', depth: 490 },
      { text: 'I Just Threw Out the Love of My Dreams', depth: 635 },
      { text: 'You Gave Your Love to Me Softly', depth: 650 },
      // † beyond the 206.
      { text: 'I Woke Up in Love This Morning', depth: 900 },
      // † with no depth printed anywhere in the bank — editorial
      // assignment, flagged in REPORT.md.
      { text: "Wanda (You're My Only Love)", depth: 900, aliases: ['Wanda'] },
      {
        text: 'Falling for You',
        depth: 0,
        trapNote: "A love song — but the word isn't in the title.",
      },
      {
        text: 'Heart Songs',
        depth: 0,
        trapNote: "The word 'love' isn't in the title.",
      },
    ],
  },
  {
    id: 'N4',
    prompt: 'Name a one-word Weezer song title.',
    songs: true,
    loreLine:
      "Thirty-five one-word titles — Weezer can say it in one word, from 'Crab' all the way down to 'Nowhere.'",
    answers: [
      { text: 'Troublemaker', depth: 60 },
      { text: 'Memories', depth: 70 },
      { text: 'Hero', depth: 95 },
      { text: 'Cleopatra', depth: 98 },
      { text: 'Records', depth: 110 },
      { text: 'Getchoo', depth: 119 },
      { text: 'Photograph', depth: 139 },
      { text: 'Holiday', depth: 154 },
      { text: 'Crab', depth: 166 },
      { text: 'Smile', depth: 184 },
      { text: 'Butterfly', depth: 191 },
      { text: 'Slob', depth: 195 },
      { text: 'Possibilities', depth: 222 },
      { text: 'Peace', depth: 230 },
      { text: 'December', depth: 249 },
      { text: "Dreamin'", depth: 250 },
      { text: 'Slave', depth: 258 },
      { text: 'Trainwrecks', depth: 260 },
      { text: 'Unspoken', depth: 270 },
      { text: 'Automatic', depth: 280 },
      { text: 'Numbers', depth: 393 },
      { text: 'Screens', depth: 426 },
      { text: 'Byzantine', depth: 438 },
      { text: 'Basketball', depth: 454 },
      { text: 'Francesca', depth: 466 },
      { text: 'Cuomoville', depth: 490 },
      { text: 'Susanne', depth: 680 },
      { text: 'Devotion', depth: 740 },
      { text: 'Pig', depth: 755 },
      { text: 'Jamie', depth: 785 },
      { text: 'Paperface', depth: 800 },
      { text: 'King', depth: 815 },
      { text: 'C.E.O.', depth: 1024 },
      { text: 'Hoops', depth: 1050 },
      { text: 'Nowhere', depth: 1076 },
      // † beyond the 206.
      { text: 'Africa', depth: 30 },
      { text: 'Paranoid', depth: 500 },
      {
        text: 'The Spider',
        depth: 0,
        trapNote: "'The' counts as a word.",
      },
      { text: 'Hash Pipe', depth: 0, trapNote: 'Two words.' },
    ],
  },
  {
    id: 'N5',
    prompt: 'Name a Weezer song named after a person.',
    songs: true,
    loreLine:
      'From a rock-and-roll saint to the fan-club presidents the band lost too soon — Weezer titles double as a roll call.',
    answers: [
      { text: 'Buddy Holly', depth: 20 },
      { text: 'Cleopatra', depth: 98 },
      { text: 'Da Vinci', depth: 340 },
      { text: 'Francesca', depth: 466 },
      { text: 'Mykel and Carli', depth: 665 },
      { text: 'Susanne', depth: 680 },
      { text: 'Miss Sweeney', depth: 710 },
      { text: 'Jamie', depth: 785 },
      // † beyond the 206.
      { text: 'Billie Jean', depth: 380 },
      {
        text: 'Beverly Hills',
        depth: 0,
        trapNote: 'A place, not a person.',
      },
      {
        text: 'Cuomoville',
        depth: 0,
        trapNote: 'The town, not the man.',
      },
    ],
  },
  {
    id: 'N6',
    prompt: 'Name a Weezer Christmas or holiday song.',
    songs: true,
    loreLine:
      "All of Weezer's Christmas music lives off the main albums — two originals on a 2000 fan-club EP, and six carols recorded for a phone game in 2008.",
    answers: [
      // The whole set is † — no Christmas song is in the 206. The
      // six carols carry the depths the bank prints in the covers
      // table (prompt 7).
      { text: 'We Wish You a Merry Christmas', depth: 300 },
      { text: 'Silent Night', depth: 300 },
      { text: 'O Come All Ye Faithful', depth: 350 },
      { text: 'O Holy Night', depth: 350 },
      { text: 'The First Noel', depth: 700 },
      { text: 'Hark! The Herald Angels Sing', depth: 700 },
      // The two fan-club EP originals — depths ASSIGNED for this
      // build (750 / 850), flagged DRAFT in REPORT.md.
      { text: 'The Christmas Song', depth: 750 },
      { text: 'Christmas Celebration', depth: 850 },
      {
        text: 'Holiday',
        depth: 0,
        trapNote: 'A road trip, not Christmas.',
      },
      {
        text: 'December',
        depth: 0,
        trapNote: 'A love song in a winter coat.',
      },
    ],
  },
  {
    id: 'N7',
    prompt: 'Name a Weezer song that names another band or singer in its lyrics.',
    songs: true,
    loreLine:
      "One song does almost all the name-dropping: 'Heart Songs' is Rivers' childhood record collection, sung out loud.",
    answers: [
      { text: 'Buddy Holly', depth: 20 },
      { text: 'Pork and Beans', depth: 45 },
      { text: 'El Scorcho', depth: 80 },
      { text: 'Records', depth: 110 },
      { text: 'In the Garage', depth: 146 },
      { text: 'Heart Songs', depth: 230 },
      { text: 'Beach Boys', depth: 351 },
      { text: 'Say Yes', depth: 920 },
      { text: 'We Might As Well Be Strangers', depth: 998 },
      { text: 'Hoops', depth: 1050 },
      {
        text: 'Surf Wax America',
        depth: 0,
        trapNote: 'A tribute in feel — the Beach Boys are never named.',
      },
      {
        text: 'Eulogy for a Rock Band',
        depth: 0,
        trapNote: 'It names nobody.',
      },
    ],
  },
  {
    // SPARE — ships as data, unassigned to any game (composition v1).
    id: 'N8',
    prompt:
      "Name a Weezer song that was written in the '90s but not released on an album until years later.",
    songs: true,
    loreLine:
      "One of these sat in a drawer so completely that it was left off the paperwork — the band had forgotten 'Tragic Girl' existed.",
    answers: [
      { text: 'Tragic Girl', depth: 620 },
      { text: 'Long Time Sunshine', depth: 725 },
      { text: 'Paperface', depth: 800 },
      { text: 'Lullabye for Wayne', depth: 830 },
      { text: "I Swear It's True", depth: 845 },
      { text: 'The Prettiest Girl in the Whole Wide World', depth: 860 },
      {
        text: 'Pork and Beans',
        depth: 0,
        trapNote: 'Only the riff is from 1998.',
      },
      {
        text: 'Susanne',
        depth: 0,
        trapNote: "A '90s song that came out in the '90s.",
      },
    ],
  },
  {
    // SPARE — ships as data, unassigned to any game (composition v1).
    id: 'N9',
    prompt: 'Name a Weezer song whose title is a complete sentence.',
    songs: true,
    loreLine:
      'Some Weezer titles are whole diary entries — and the longest confessions hide down on the B-sides and the Gold Album.',
    answers: [
      { text: "Say It Ain't So", depth: 35 },
      { text: 'My Name Is Jonas', depth: 50 },
      { text: '(If You\'re Wondering If I Want You To) I Want You To', depth: 60 },
      { text: 'I Need Some of That', depth: 62 },
      { text: 'Do You Wanna Get High?', depth: 62 },
      { text: 'We Are All on Drugs', depth: 73 },
      { text: "I'm Your Daddy", depth: 83 },
      { text: 'The World Has Turned and Left Me Here', depth: 106 },
      { text: 'This Is Such a Pity', depth: 210 },
      { text: 'The Girl Got Hot', depth: 250 },
      { text: "Where's My Sex?", depth: 280 },
      { text: 'Love Is the Answer', depth: 290 },
      { text: "I Don't Want to Let You Go", depth: 320 },
      { text: "I've Had It Up to Here", depth: 320 },
      { text: 'The British Are Coming', depth: 330 },
      { text: 'Time Flies', depth: 330 },
      { text: "I'm Just Being Honest", depth: 405 },
      { text: 'I Want a Dog', depth: 430 },
      { text: 'Sheila Can Do It', depth: 447 },
      { text: 'What Happens After You?', depth: 454 },
      { text: 'She Needs Me', depth: 458 },
      { text: 'Everything Happens for a Reason', depth: 459 },
      { text: 'Should She Stay or Should She Go', depth: 478, catalogTitle: 'Should I Stay or Should I Go' },
      { text: "What's the Good of Being Good", depth: 478 },
      { text: 'I Just Threw Out the Love of My Dreams', depth: 635 },
      { text: 'You Gave Your Love to Me Softly', depth: 650 },
      { text: "I Swear It's True", depth: 845 },
      { text: 'We Might As Well Be Strangers', depth: 998 },
      { text: 'The Show Must Go On', depth: 1102 },
      {
        text: 'The One That Got Away',
        depth: 0,
        trapNote: 'No main action — not a complete sentence.',
      },
      {
        text: 'Why Bother?',
        depth: 0,
        trapNote: 'No verb doing the work of a sentence.',
      },
    ],
  },
  {
    id: 'N10',
    prompt: 'Name a Weezer song with an animal in the title.',
    songs: true,
    loreLine:
      "A whole little zoo in the titles — a crab, a butterfly, a pig, a spider — and one very good boy Rivers finally got to ask for in 'I Want a Dog.'",
    answers: [
      // Keep Fishin' counts — Mark's ruling, Oct 27 (the floor).
      { text: "Keep Fishin'", depth: 50 },
      { text: 'Crab', depth: 166 },
      { text: 'Butterfly', depth: 191 },
      { text: 'I Want a Dog', depth: 430 },
      { text: 'Bird with a Broken Wing', depth: 437 },
      { text: 'Run, Raven, Run', depth: 502 },
      { text: 'Pig', depth: 755 },
      { text: 'The Spider', depth: 770 },
    ],
  },
  {
    id: 'N11',
    prompt: 'Name a Weezer song whose title mentions the weather or seasons.',
    songs: true,
    loreLine:
      "Rivers writes sunshine like it's a place you can move back to.",
    answers: [
      { text: 'Island in the Sun', depth: 25 },
      { text: 'Feels Like Summer', depth: 95 },
      { text: 'Cold Dark World', depth: 270 },
      { text: 'Wind in Our Sail', depth: 310 },
      { text: 'California Snow', depth: 449 },
      { text: 'Here Comes the Rain', depth: 470 },
      { text: 'Long Time Sunshine', depth: 725 },
      { text: 'Up In The Clouds', depth: 1128 },
      {
        text: 'Summer Elaine and Drunk Dori',
        depth: 0,
        trapNote: "'Summer' there is a person, not a season.",
      },
      {
        text: 'Fall Together',
        depth: 0,
        trapNote: 'Falling, not autumn.',
      },
    ],
  },
  {
    id: 'N12',
    prompt: 'Name a Weezer song with a food or drink in the title.',
    songs: true,
    loreLine:
      'A short menu — four titles — and the most famous plate on it eats its candy with the pork and beans.',
    answers: [
      { text: 'Pork and Beans', depth: 45 },
      // Borderline in the bank (the title is spelled J-A-M-B, a
      // door frame) — included as a scoring answer; flagged in
      // REPORT.md.
      { text: 'Burndt Jamb', depth: 204 },
      { text: 'Aloo Gobi', depth: 371 },
      { text: 'Grapes of Wrath', depth: 382 },
      { text: 'Piece of Cake', depth: 394 },
      // † beyond the 206 — depth assigned in the B-side table (P6).
      { text: 'Sugar Booger', depth: 900 },
      {
        text: 'Hash Pipe',
        depth: 0,
        trapNote: 'Hashish, not hash browns.',
      },
      {
        text: 'Happy Hour',
        depth: 0,
        trapNote: 'An occasion — no food or drink is named.',
      },
    ],
  },
  {
    id: 'N13',
    prompt:
      'Name someone who has played live with Weezer as a touring member — never an official member.',
    loreLine:
      "Weezer's live band has quietly had a fifth chair for decades — Freese even freed Patrick up to play guitar for whole tours.",
    answers: [
      { text: 'Josh Freese', depth: 45, aliases: ['Josh', 'Freese'] },
      { text: 'Bobby Schneck', depth: 320, aliases: ['Bobby', 'Schneck'] },
      { text: 'Daniel Brummel', depth: 480, aliases: ['Daniel', 'Brummel'] },
      { text: 'Dave Elitch', depth: 950, aliases: ['Dave', 'Elitch'] },
      {
        text: 'Atom Willard',
        depth: 0,
        trapNote:
          "Patrick's drum tech in 2001–02 — he played maracas on stage once and guested on drums in 2008, but he was never a billed touring member.",
      },
      {
        text: 'Karl Koch',
        depth: 0,
        trapNote: 'Crew and archivist — not a touring player.',
      },
      {
        text: 'Matt Sharp',
        depth: 0,
        trapNote: 'A full member — that is a different prompt.',
      },
      {
        text: 'Mikey Welsh',
        depth: 0,
        trapNote: 'A full member — that is a different prompt.',
      },
      {
        text: 'Jason Cropper',
        depth: 0,
        trapNote: 'A full member — that is a different prompt.',
      },
    ],
  },
  {
    id: 'N14',
    prompt: 'Name a band Weezer has toured with.',
    loreLine:
      'From opening for Lush and Live in 1994 to the Hella Mega stadium run, Weezer has shared a bill with half of rock-radio history.',
    answers: [
      { text: 'Green Day', depth: 25 },
      { text: 'Foo Fighters', depth: 30 },
      { text: 'Blink-182', depth: 35, aliases: ['Blink 182'] },
      { text: 'Panic! at the Disco', depth: 40, aliases: ['Panic at the Disco'] },
      { text: 'Fall Out Boy', depth: 45 },
      { text: 'Pixies', depth: 50 },
      { text: 'No Doubt', depth: 120 },
      { text: 'Jimmy Eat World', depth: 150 },
      { text: 'Angels & Airwaves', depth: 160, aliases: ['Angels and Airwaves'] },
      { text: 'Live', depth: 180 },
      { text: 'Dashboard Confessional', depth: 200 },
      { text: 'Kaiser Chiefs', depth: 300 },
      { text: 'Ash', depth: 320 },
      { text: 'Placebo', depth: 340 },
      { text: 'Lush', depth: 350 },
      { text: 'The Get Up Kids', depth: 380 },
      { text: 'Ozma', depth: 450 },
      { text: 'Nerf Herder', depth: 480 },
      { text: 'Archers of Loaf', depth: 520 },
      // One shared show each — flagged one-offs in the bank; they
      // score (flagged in REPORT.md).
      { text: 'Red Hot Chili Peppers', depth: 750, aliases: ['RHCP'] },
      { text: "Guns N' Roses", depth: 900, aliases: ['Guns and Roses'] },
      {
        text: 'The Rentals',
        depth: 0,
        trapNote: 'A side project, not a tour bill.',
      },
      {
        text: 'Third Eye Blind',
        depth: 0,
        trapNote: "Announced for a 2027 tour — it hasn't happened yet.",
      },
      {
        text: 'Fountains of Wayne',
        depth: 0,
        trapNote: "Announced for a 2027 tour — it hasn't happened yet.",
      },
    ],
  },
  {
    id: 'N15',
    prompt: 'Name someone who has directed a Weezer music video.',
    loreLine:
      'Spike Jonze launched them, but the director\'s chair also went to the Jackass guy, the (500) Days of Summer guy — and Karl.',
    answers: [
      { text: 'Spike Jonze', depth: 25, aliases: ['Spike', 'Jonze'] },
      { text: 'Marcos Siega', depth: 40, aliases: ['Marcos', 'Siega'] },
      { text: 'Marc Webb', depth: 90, aliases: ['Marc', 'Webb'] },
      { text: 'Sophie Muller', depth: 150, aliases: ['Sophie', 'Muller'] },
      { text: 'Mark Romanek', depth: 220, aliases: ['Mark', 'Romanek'] },
      { text: 'Mathew Cullen', depth: 240, aliases: ['Mathew', 'Cullen'] },
      {
        text: 'Jonathan Dayton & Valerie Faris',
        depth: 280,
        aliases: ['Jonathan Dayton', 'Valerie Faris', 'Dayton and Faris'],
      },
      { text: 'Karl Koch', depth: 380, aliases: ['Karl', 'Koch'] },
      { text: 'Jeff Tremaine', depth: 480, aliases: ['Jeff', 'Tremaine'] },
      { text: 'Justin Francis', depth: 520, aliases: ['Justin', 'Francis'] },
      { text: 'The Malloys', depth: 560, aliases: ['Malloys'] },
      { text: 'Warren Fu', depth: 620, aliases: ['Warren', 'Fu'] },
      { text: 'Brendan Walter', depth: 700, aliases: ['Brendan', 'Walter'] },
      { text: 'SCANTRON', depth: 850 },
      { text: 'Johannes Gamble', depth: 950, aliases: ['Johannes', 'Gamble'] },
      { text: 'Tim Wilkerson', depth: 1050, aliases: ['Tim', 'Wilkerson'] },
      {
        text: 'Jesse Peretz',
        depth: 0,
        trapNote: "No Weezer video credit — 'Keep Fishin'' was Marcos Siega.",
      },
      {
        text: 'Rivers Cuomo',
        depth: 0,
        trapNote: 'No credited official music video.',
      },
    ],
  },
  {
    id: 'N16',
    prompt: 'Name a Weezer EP or live album.',
    loreLine:
      "Between the big colour albums hides a whole shelf of EPs — Christmas ones, a live one, and four seasons' worth from 2022.",
    answers: [
      { text: 'Christmas with Weezer', depth: 55 },
      { text: 'SZNZ: Spring', depth: 90 },
      { text: 'SZNZ: Summer', depth: 110 },
      { text: 'The Lion and the Witch', depth: 130 },
      { text: 'SZNZ: Autumn', depth: 170 },
      { text: 'SZNZ: Winter', depth: 190 },
      { text: 'The Good Life', depth: 420 },
      { text: 'Winter Weezerland', depth: 480 },
      { text: 'Six Hits', depth: 650 },
      {
        text: '…Happy Record Store Day!',
        depth: 800,
        aliases: ['Happy Record Store Day'],
      },
      { text: 'Spotify Sessions', depth: 900 },
      {
        text: 'Death to False Metal',
        depth: 0,
        trapNote: 'A full compilation album, not an EP.',
      },
      {
        text: 'SZNZ',
        depth: 0,
        trapNote: "Four separate EPs — name a season.",
      },
    ],
  },
  {
    id: 'N17',
    prompt: 'Name someone who has written a Weezer song with Rivers.',
    loreLine:
      'For two albums Rivers basically opened the phone book — a hip-hop mogul, a country legend and Dr. Luke all ended up in the credits.',
    answers: [
      { text: 'Dr. Luke', depth: 35, aliases: ['Luke'] },
      { text: 'Jermaine Dupri', depth: 60, aliases: ['Jermaine', 'Dupri'] },
      { text: 'Dan Wilson', depth: 70, aliases: ['Dan', 'Wilson'] },
      { text: 'Ryan Adams', depth: 80, aliases: ['Adams'] },
      { text: 'Linda Perry', depth: 110, aliases: ['Linda', 'Perry'] },
      { text: 'Butch Walker', depth: 120, aliases: ['Butch', 'Walker'] },
      { text: 'Mac Davis', depth: 200, aliases: ['Mac', 'Davis'] },
      { text: 'Desmond Child', depth: 210, aliases: ['Desmond', 'Child'] },
      { text: 'Tony Kanal', depth: 230, aliases: ['Tony', 'Kanal'] },
      { text: 'Tyson Ritter', depth: 260, aliases: ['Tyson', 'Ritter'] },
      { text: 'Rick Nowels', depth: 300, aliases: ['Rick', 'Nowels'] },
      { text: 'Laura Jane Grace', depth: 320, aliases: ['Laura', 'Grace'] },
      { text: 'Nick Wheeler', depth: 340, aliases: ['Nick', 'Wheeler'] },
      { text: 'Jacknife Lee', depth: 380, aliases: ['Jacknife', 'Lee'] },
      { text: 'Ammar Malik', depth: 450, aliases: ['Ammar', 'Malik'] },
      { text: 'David Hodges', depth: 480, aliases: ['David', 'Hodges'] },
      { text: 'Rami Yacoub', depth: 520, aliases: ['Rami', 'Yacoub'] },
      { text: 'Greg Wells', depth: 560, aliases: ['Greg', 'Wells'] },
      { text: 'Josh Alexander', depth: 700, aliases: ['Josh', 'Alexander'] },
      { text: 'Jonny Coffer', depth: 780, aliases: ['Jonny', 'Coffer'] },
      { text: 'Kazuhiro Hara', depth: 1100, aliases: ['Kazuhiro', 'Hara'] },
      {
        text: 'Toby Gad',
        depth: 0,
        trapNote: "Production isn't writing — no track listing gives him a Weezer writing credit.",
      },
      {
        text: 'Lil Wayne',
        depth: 0,
        trapNote: 'He performs the bridge — the writers are Cuomo and Dupri.',
      },
    ],
  },
  {
    id: 'N18',
    prompt: 'Name a band that has released a cover of a Weezer song.',
    loreLine:
      "A whole emo generation paid rent in 2002 — one tribute album, thirteen bands, and Dashboard doing 'Jamie'.",
    answers: [
      { text: 'Dashboard Confessional', depth: 45 },
      { text: 'The Ataris', depth: 110, aliases: ['Ataris'] },
      { text: 'Ash', depth: 260 },
      { text: 'Further Seems Forever', depth: 300 },
      { text: 'Piebald', depth: 340 },
      { text: 'Midtown', depth: 380 },
      { text: 'You Blew It!', depth: 420 },
      { text: 'Mock Orange', depth: 520 },
      { text: 'The Impossibles', depth: 560, aliases: ['Impossibles'] },
      { text: 'Elliott', depth: 600 },
      { text: 'The Stereo', depth: 640, aliases: ['Stereo'] },
      { text: 'Glasseater', depth: 700 },
      { text: 'Grade', depth: 720 },
      { text: 'Flipper', depth: 850 },
      { text: 'Affinity', depth: 900 },
      { text: 'Mycomplex', depth: 950 },
      {
        text: 'Toto',
        depth: 0,
        trapNote: 'Live only in 2018 — never a released cover.',
      },
      {
        text: '"Weird Al" Yankovic',
        depth: 0,
        trapNote: "He parodies the 'Africa' video — he never released a Weezer cover.",
      },
    ],
  },
  {
    id: 'N19',
    prompt: 'Name a Weezer song that hit No. 1 on alternative radio.',
    songs: true,
    loreLine:
      "It took them eleven years to get the first one — then 'Pork and Beans' sat on top for eleven weeks.",
    answers: [
      { text: 'Beverly Hills', depth: 25 },
      { text: 'Pork and Beans', depth: 30 },
      { text: 'Africa', depth: 45 },
      { text: 'Perfect Situation', depth: 55 },
      { text: 'All My Favorite Songs', depth: 110 },
      { text: 'Hero', depth: 130 },
      { text: 'A Little Bit of Love', depth: 260 },
      { text: 'Records', depth: 380 },
      {
        text: 'Hash Pipe',
        depth: 0,
        trapNote: 'Peaked at No. 2.',
      },
      {
        text: 'Buddy Holly',
        depth: 0,
        trapNote: 'No. 2 in its day — never No. 1.',
      },
      {
        text: '(If You\'re Wondering If I Want You To) I Want You To',
        depth: 0,
        trapNote: 'Peaked at No. 2.',
      },
      {
        text: 'Troublemaker',
        depth: 0,
        trapNote: 'Peaked at No. 2.',
      },
    ],
  },
  {
    id: 'N20',
    prompt: 'Name a record label Weezer has released music on.',
    loreLine:
      'Seven-album Geffen deal, one indie detour to Epitaph, one to Republic — then home to the Warner family for good.',
    answers: [
      { text: 'Geffen', depth: 25 },
      { text: 'Atlantic', depth: 60 },
      { text: 'DGC', depth: 90 },
      { text: 'Interscope', depth: 140 },
      { text: 'Epitaph', depth: 180 },
      { text: 'Crush Music', depth: 220, aliases: ['Crush'] },
      { text: 'Republic', depth: 300 },
      { text: 'Reprise', depth: 800 },
      {
        text: 'Warner',
        depth: 950,
        aliases: ['Warner Records', 'Warner Bros', 'Warner Bros Records'],
      },
      { text: 'XL', depth: 0, trapNote: 'Never a Weezer label.' },
      {
        text: 'Fueled by Ramen',
        depth: 0,
        trapNote: 'Never a Weezer label.',
      },
    ],
  },
  {
    id: 'N21',
    prompt:
      'Name a Weezer song whose video parodies or recreates a famous TV show, movie, or video.',
    songs: true,
    loreLine:
      "Happy Days, the Muppets, Mister Rogers and early YouTube — Weezer's videos are a TV-history museum with guitars.",
    answers: [
      { text: 'Buddy Holly', depth: 20 },
      { text: 'Pork and Beans', depth: 35 },
      { text: "Keep Fishin'", depth: 120 },
      { text: 'Take On Me', depth: 150 },
      { text: 'Africa', depth: 240 },
      { text: 'High as a Kite', depth: 480 },
      {
        text: 'Beverly Hills',
        depth: 0,
        trapNote: 'Shot at the Playboy Mansion — a location, not a parody.',
      },
      {
        text: 'Island in the Sun',
        depth: 0,
        trapNote: 'The animal version recreates no property.',
      },
      {
        text: 'Undone – The Sweater Song',
        depth: 0,
        trapNote: "It's the original — 'Africa' parodied it.",
      },
    ],
  },
  {
    id: 'N23',
    prompt:
      'Name an instrument besides guitar, bass, or drums that stars on a Weezer record.',
    loreLine:
      'A guitar band, sure — but the Hurley credits alone hide a flute, a mandolin and a hurdy-gurdy.',
    answers: [
      { text: 'Piano', depth: 30 },
      { text: 'Harmonica', depth: 45 },
      { text: 'Orchestra', depth: 140, aliases: ['Strings'] },
      {
        text: 'Violin',
        depth: 240,
        aliases: ['Violins'],
        note: "Part of the 38-piece orchestra credited on OK Human — the same credit the Orchestra row stands on.",
      },
      {
        text: 'Cello',
        depth: 280,
        aliases: ['Violoncello'],
        note: "Part of the 38-piece orchestra credited on OK Human — the same credit the Orchestra row stands on.",
      },
      {
        text: 'Viola',
        depth: 330,
        note: "Part of the 38-piece orchestra credited on OK Human — the same credit the Orchestra row stands on.",
      },
      {
        text: 'Double bass',
        depth: 370,
        aliases: ['Contrabass'],
        note: "Part of the 38-piece orchestra credited on OK Human — the same credit the Orchestra row stands on. (The upright kind — a bare 'bass' never scores here; the prompt excludes it.)",
      },
      { text: 'Flute', depth: 420 },
      { text: 'Horns', depth: 480 },
      { text: 'Mandolin', depth: 520 },
      {
        text: 'Melodica',
        depth: 560,
        note: "GSG Media's review of 'A Little Bit of Love' describes a melodica arrangement, and Ramapo News heard the occasional bit of melodica across SZNZ: Spring — review-documented, like the xylophone.",
      },
      { text: 'Xylophone', depth: 800 },
      { text: 'Hurdy-gurdy', depth: 950, aliases: ['Hurdy gurdy'] },
      {
        text: 'Saxophone',
        depth: 0,
        trapNote: "Kenny G's famous sax moment was a 2009 live session, not a Weezer record.",
      },
    ],
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

/* ------------------------------------------------------------------ */
/* The five games (composition v1, Oct 27, 2026)                       */
/* ------------------------------------------------------------------ */

/**
 * The single random-draw game is gone: in its place, five themed
 * games of seven fixed prompts each, composed in
 * weezer-games-composition-v1.md from the v2 bank above. Slot order
 * runs friendly → deep inside each game; producers sits late in
 * The Business (Mark's markup), and the two 300+-floor prompts
 * (Christmas, B-sides) close out The Vault. Two bank prompts ship
 * as spares, unassigned: N8 and N9.
 */
export type LoreGameId = 'game1' | 'game2' | 'game3' | 'game4' | 'game5';

export interface LoreGame {
  id: LoreGameId;
  name: string;
  /** The one-line promise the picker shows under the name. */
  promise: string;
  /** The game's seven prompt ids, in play order. */
  promptIds: string[];
}

export const LORE_GAMES: LoreGame[] = [
  {
    id: 'game1',
    name: 'The Sampler',
    promise:
      'A little of everything — the obvious, the obscure, and a few in between.',
    promptIds: ['P4', 'P1', 'P10', 'P7', 'N23', 'N10', 'N1'],
  },
  {
    id: 'game2',
    name: 'Just the Titles',
    promise:
      "Don't overthink it. Everything you need is right there in the open.",
    promptIds: ['N11', 'N12', 'N4', 'P15', 'P5', 'N2', 'N3'],
  },
  {
    id: 'game3',
    name: 'The Credits',
    promise:
      'The stuff most fans never notice. The ones who do, remember it.',
    promptIds: ['N5', 'N21', 'N15', 'N17', 'N13', 'P3', 'P11'],
  },
  {
    id: 'game4',
    name: 'The Vault',
    promise:
      'The far corners — where the songs most fans never find are waiting.',
    promptIds: ['P12', 'N7', 'P13', 'P14', 'N18', 'N6', 'P6'],
  },
  {
    id: 'game5',
    name: 'The Business',
    promise:
      'How a garage band got from there to here — and everything it took along the way.',
    promptIds: ['N14', 'N19', 'N20', 'P8', 'N16', 'P9', 'P2'],
  },
];

export function loreGameById(id: LoreGameId): LoreGame {
  const game = LORE_GAMES.find((g) => g.id === id);
  if (!game) throw new Error(`Unknown lore game: ${id}`);
  return game;
}

export function promptById(id: string): OpenPrompt {
  const prompt = OPEN_PROMPTS.find((p) => p.id === id);
  if (!prompt) throw new Error(`Unknown open prompt: ${id}`);
  return prompt;
}

/** A game's fixed run: its seven prompts in slot order. No draw —
    every player faces the same seven, in the same order. */
export function buildGameRun(gameId: LoreGameId): RunItem[] {
  return loreGameById(gameId).promptIds.map((promptId) => ({
    kind: 'open' as const,
    prompt: promptById(promptId),
  }));
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
