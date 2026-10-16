/**
 * Fan-statistics methodology — version 1.0.
 *
 * Every product-chosen cutoff, exponent, minimum, and weighting factor
 * used by Fan Stats lives in this module. These are EDITORIAL heuristics
 * chosen for a fun fan experience. They are NOT validated psychological
 * or scientific categories, and the UI must label tribes and archetypes
 * "for fun" wherever they appear.
 *
 * Changing a value here changes product behavior — bump
 * METHODOLOGY_VERSION and note the change instead of silently retuning.
 */

import { FULL_SONG_POOL } from '../data/constants';

export const METHODOLOGY_VERSION = '1.0';

/**
 * Community-statistics eligibility (statistical honesty rules):
 * a submission counts toward community stats only if it carries at
 * least MIN_QUALIFYING_RATINGS explicit, valid ratings — a known song
 * id from FULL_SONG_POOL with a real bucket value. Missing songs are
 * never counted, and never treated as Trash.
 */
export const MIN_QUALIFYING_RATINGS = 10;

/** Below this many qualified submissions, population percentages
 *  (tribe shares, Blue/Pinkerton splits, demographic shares) are
 *  hidden — counts show instead, with an "not enough data" note.
 *  Never substitute a fake 0% or 50% fallback. */
export const MIN_DISPLAY_SAMPLE = 50;

const VALID_SONG_IDS = new Set(FULL_SONG_POOL.map((s) => s.id));
const VALID_BUCKETS = new Set(['banger', 'slaps', 'mid', 'skip', 'trash']);

/** How many explicit, valid ratings one triage map carries. */
export function countQualifiedRatings(
  triageMap: Record<string, string | undefined>,
): number {
  let n = 0;
  for (const [id, bucket] of Object.entries(triageMap)) {
    if (bucket && VALID_SONG_IDS.has(id) && VALID_BUCKETS.has(bucket)) n++;
  }
  return n;
}

/** True when a submission qualifies for community statistics. */
export function isQualifiedSubmission(
  triageMap: Record<string, string | undefined>,
): boolean {
  return countQualifiedRatings(triageMap) >= MIN_QUALIFYING_RATINGS;
}

/** A fan whose average bucket score falls below this is a "Harsh Critic".
 *  Bucket scores run 1 (Trash) to 5 (Banger). */
export const HARSH_CRITIC_MEAN = 2.2;

/** A fan whose post-2010 average clears this — while staying roughly
 *  neutral in the Blue/Pinkerton debate — is a "Modern Defender". */
export const MODERN_DEFENDER_MEAN = 3.8;

/** Half-width of the neutral band for the Blue-vs-Pinkerton mean delta
 *  in the Modern Defender rule. */
export const MODERN_DEFENDER_DELTA_BAND = 1.0;

/** Blue-vs-Pinkerton mean delta beyond ±this makes a fan a Blue Album
 *  Purist (+) or Pinkerton Cult (−). */
export const BLUE_PINKERTON_DELTA = 0.3;

/** Classic-era (pre-2000) mean must beat the modern-era mean by more
 *  than this margin for the classicist lean. */
export const CLASSICIST_MARGIN = 1.0;

/** The Blue/Pinkerton debate weights each fan by |delta| raised to this
 *  exponent, so strong opinions count more than mild ones. */
export const DEBATE_WEIGHT_EXPONENT = 1.5;

/** Album leaderboard scores shrink toward the global mean with this
 *  prior strength, so a barely-rated album can't top the board. */
export const ALBUM_SHRINKAGE_K = 5;

/** Controversy = standard deviation scaled by polarization, where
 *  polarization = POLARIZATION_FACTOR × (share Banger) × (share Trash). */
export const POLARIZATION_FACTOR = 4;
export const CONTROVERSY_POLARIZATION_WEIGHT = 0.5;

/** Song-type editorial thresholds (shares of a song's ratings). */
export const SONG_TYPE = {
  /** Universally Loved: at least this share Banger+Slaps… */
  lovedPositiveShare: 0.65,
  /** …and less than this share Trash. */
  lovedMaxTrashShare: 0.1,
  /** Deeply Divided: more than this share Banger AND this share Trash… */
  dividedMinBangerShare: 0.2,
  dividedMinTrashShare: 0.2,
  /** …and less than this share Mid. */
  dividedMaxMidShare: 0.25,
  /** Safe Bets: less than this share Banger, at least this share
   *  Slaps+Mid, and less than this share Trash. */
  safeMaxBangerShare: 0.2,
  safePositiveShare: 0.55,
  safeMaxTrashShare: 0.15,
  /** Hidden Gems: Banger share between these bounds… */
  gemMinBangerShare: 0.05,
  gemMaxBangerShare: 0.25,
  /** …and at least this share Skip+Trash. */
  gemMinNegativeShare: 0.4,
} as const;

/** "Lone banger" callouts require a song rated by more than this share
 *  of all fans before its lift over its album can be highlighted. */
export const LONE_BANGER_MIN_FAN_SHARE = 0.1;

export type FanTribeKey = 'haters' | 'modernists' | 'purists' | 'cult' | 'chaos';

/**
 * Assign one fan (one triage map) to a tribe. The FIRST matching rule
 * wins — the order below is the behavior, preserved from the original
 * inline logic in FanStats:
 *   1. Harsh Critics   — very low overall mean
 *   2. Modern Defenders — high modern mean, near-neutral Blue/Pink delta
 *   3. Blue Album Purists — delta above +0.3
 *   4. Pinkerton Cult  — delta below −0.3
 *   5. Chaos Agents    — everyone else
 */
export function classifyFanTribe(input: {
  userMean: number;
  modernMean: number;
  bluePinkertonDelta: number;
}): FanTribeKey {
  if (input.userMean < HARSH_CRITIC_MEAN) return 'haters';
  if (
    input.modernMean > MODERN_DEFENDER_MEAN &&
    input.bluePinkertonDelta < MODERN_DEFENDER_DELTA_BAND &&
    input.bluePinkertonDelta > -MODERN_DEFENDER_DELTA_BAND
  ) {
    return 'modernists';
  }
  if (input.bluePinkertonDelta > BLUE_PINKERTON_DELTA) return 'purists';
  if (input.bluePinkertonDelta < -BLUE_PINKERTON_DELTA) return 'cult';
  return 'chaos';
}

/** Debate weight for one fan's Blue-vs-Pinkerton opinion. */
export function debateWeight(bluePinkertonDelta: number): number {
  return Math.pow(Math.abs(bluePinkertonDelta), DEBATE_WEIGHT_EXPONENT);
}

/** Classicist lean used for the classicist/modernist map splits. */
export function leansClassicist(classicMean: number, modernMean: number): boolean {
  return classicMean > modernMean + CLASSICIST_MARGIN;
}

/** Plain-language version of the rules for the in-product
 *  "How this is calculated" disclosure. Keep in sync with the code. */
export const METHODOLOGY_PLAIN_RULES: string[] = [
  'Every song you bucket earns points: Banger 5, Slaps 4, Mid 3, Skip 2, Trash 1. Songs you never bucketed are never counted — and never treated as Trash.',
  'Fan tribes are for fun. Averages of those points sort fans into Harsh Critics (very low average), Modern Defenders (love the post-2010 albums), Blue Album Purists or Pinkerton Cult (which 90s classic they rate higher), and Chaos Agents (everyone else). First matching label wins.',
  'The Blue vs. Pinkerton debate weights strong opinions more than mild ones.',
  'Album rankings shrink small samples toward the overall average, so an album with two ratings can\'t beat one with two hundred.',
  'A song is "divisive" when its ratings spread out — especially when lots of fans pick both Banger and Trash.',
  'These cutoffs are editorial choices for a fan game (methodology v' +
    METHODOLOGY_VERSION +
    '), not science. Tribes describe the fans who chose to rank songs on this site — not all Weezer fans.',
];
