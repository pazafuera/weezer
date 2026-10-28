/**
 * Weezer Lore answer matcher — pure functions, no app imports, so the
 * node harness (harness/lore-game-harness.cjs) can exercise the exact
 * code the game ships.
 *
 * Mark's requirement (Oct 26): spelling must never gate the game.
 * "MIKY" has to count as Mikey Welsh; "Matt" must never count as
 * Mikey. The rules that fall out of that:
 *
 * - Everything is compared in normalized form (case, punctuation,
 *   leading "the", whitespace collapsed). Apostrophes vanish
 *   ("Ain't" → "aint"); "=" survives (the "=w=" answer needs it).
 * - An answer spec carries an alias list: alternate spellings, short
 *   forms, and — for people — first name or surname alone. The bank's
 *   parenthetical alias lists are the authority; a partial name only
 *   counts because it's listed, never by token-guessing, so a partial
 *   that belongs to two plausible people simply isn't listed.
 * - Fuzzy matching is Levenshtein with tolerance scaled by the
 *   TARGET's length: ≤5 chars → 1 edit, longer → up to 2. Pure-digit
 *   targets ("1994") are exact-only — a year one digit off is a
 *   different year, not a typo.
 * - Confusables guard: matching is judged against a UNIVERSE of
 *   plausible answers (every bank answer + alias, every catalog
 *   title). If the input is an exact hit on a different universe
 *   entry, it's a miss — the player named a real, wrong thing. If
 *   it's within tolerance of both the target and a different entry,
 *   it's also a miss: close to two answers is owned by neither.
 */

export interface LoreAnswerSpec {
  /** The canonical answer, as displayed on the reveal. */
  answer: string;
  /** Accepted alternates, in display spelling. */
  aliases: string[];
}

export type LoreMatchStatus = 'match' | 'miss';

export interface LoreMatchResult {
  status: LoreMatchStatus;
  /** The spec form the input matched (for display), when it matched. */
  matchedForm?: string;
}

/** Minimal song shape the song matcher needs (the catalog's Song fits). */
export interface MatchableSong {
  id: string;
  title: string;
}

/**
 * What a typed song must satisfy to score on a name-a-song prompt.
 * The data module (app/data/loreGame.ts) owns the checker that
 * interprets these against the real catalog; the shapes live here so
 * the harness-compiled pair shares one definition.
 */
export type SongConstraint =
  | { kind: 'album-except'; album: string; excludeTitle: string }
  | { kind: 'album-non-single'; album: string }
  | { kind: 'b-side' }
  | { kind: 'never-on-studio-album' }
  | { kind: 'demo-or-unreleased' }
  | { kind: 'girl-name-in-title' }
  | { kind: 'opener' }
  | { kind: 'closer' };

/**
 * Normalizes an answer (typed or canonical) for comparison:
 * lowercase, curly apostrophes straightened then all apostrophes
 * dropped, punctuation dropped EXCEPT "=", digit/letter/space/"="
 * kept, runs of whitespace collapsed, one leading "the " removed.
 */
export function normalizeAnswer(raw: string): string {
  let s = raw.toLowerCase();
  s = s.replace(/[‘’ʼ]/g, "'");
  s = s.replace(/'/g, '');
  s = s.replace(/[^a-z0-9=\s]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  if (s.startsWith('the ')) s = s.slice(4);
  return s;
}

/** Classic Levenshtein edit distance (iterative, two rows). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev: number[] = [];
  let curr: number[] = [];
  for (let j = 0; j <= b.length; j++) prev.push(j);
  for (let i = 1; i <= a.length; i++) {
    curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr.push(Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost));
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[b.length];
}

/**
 * Edit tolerance for a normalized target. Digits-only targets are
 * exact-only (0): fuzzy years are wrong years.
 */
export function toleranceFor(normalizedTarget: string): number {
  if (/^[0-9]+$/.test(normalizedTarget)) return 0;
  if (normalizedTarget.length <= 5) return 1;
  return 2;
}

/** True when the input is within tolerance of the target (both normalized). */
export function withinTolerance(inputNorm: string, targetNorm: string): boolean {
  if (inputNorm === targetNorm) return true;
  const tol = toleranceFor(targetNorm);
  if (tol === 0) return false;
  if (Math.abs(inputNorm.length - targetNorm.length) > tol) return false;
  return levenshtein(inputNorm, targetNorm) <= tol;
}

/** The normalized form set for one answer spec (answer + aliases). */
function specForms(spec: LoreAnswerSpec): string[] {
  const forms = [spec.answer, ...spec.aliases].map(normalizeAnswer);
  return Array.from(new Set(forms));
}

/**
 * Judges a typed answer against a lore question's spec, guarded by
 * the plausible-answer universe (normalized forms of every OTHER
 * plausible answer — bank answers and catalog titles).
 */
export function matchLoreAnswer(
  rawInput: string,
  spec: LoreAnswerSpec,
  universe: readonly string[]
): LoreMatchResult {
  const input = normalizeAnswer(rawInput);
  if (input === '') return { status: 'miss' };
  const forms = specForms(spec);
  const formSet = new Set(forms);

  // Exact hit on the target — always a match.
  if (formSet.has(input)) {
    return { status: 'match', matchedForm: input };
  }

  // Exact hit on a DIFFERENT plausible answer — a real, wrong answer.
  const others = universe.filter((u) => !formSet.has(u));
  if (others.indexOf(input) !== -1) return { status: 'miss' };

  // Fuzzy: within tolerance of the target and of nothing else.
  const targetHit = forms.find((f) => withinTolerance(input, f));
  if (!targetHit) return { status: 'miss' };
  const rivalHit = others.find((u) => withinTolerance(input, u));
  if (rivalHit) return { status: 'miss' };
  return { status: 'match', matchedForm: targetHit };
}

/**
 * Curated short forms fans naturally type for a handful of catalog
 * songs — the name a song is actually called, where the mechanical
 * variants below can't find it. Keyed by song id, values are raw
 * (normalized on use). Deliberately tiny and hand-picked: NO global
 * first-word rule (half the catalog would collide). (Oct 27, 2026 —
 * Mark, from tester-style play: "Sheila" and "Drunk Dori" missed.)
 */
export const CURATED_SONG_ALIASES: Readonly<Record<string, readonly string[]>> = {
  // "Sheila Can Do It" (Van Weezer) — fans just say "Sheila".
  vw_8: ['sheila'],
  // "Summer Elaine and Drunk Dori" (White Album) — either girl's
  // name is how fans name it.
  wh_7: ['drunk dori', 'summer elaine'],
};

/**
 * The normalized title variants a fan might type for one catalog
 * song: the full title; the part before an en/em dash ("Undone" from
 * "Undone – The Sweater Song"); the part after it ("Sweater Song");
 * the title with parentheticals removed ("I Want You To" from
 * "(If You're Wondering If I Want You To) I Want You To" — the
 * parenthetical IS the lead there, so also the trailing text after a
 * leading parenthetical); plus the curated short forms above when
 * the song's id is passed.
 */
export function songTitleVariants(title: string, songId?: string): string[] {
  const variants = new Set<string>();
  const add = (v: string) => {
    const n = normalizeAnswer(v);
    if (n) variants.add(n);
  };
  add(title);
  if (songId) {
    const curated = CURATED_SONG_ALIASES[songId];
    if (curated) curated.forEach(add);
  }
  const dashParts = title.split(/\s+[–—-]\s+/);
  if (dashParts.length > 1) {
    add(dashParts[0]);
    add(dashParts.slice(1).join(' '));
  }
  const noParens = title.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (noParens) add(noParens);
  const leadingParen = title.match(/^\([^)]*\)\s+(.+)$/);
  if (leadingParen) add(leadingParen[1]);
  return Array.from(variants);
}

/* ------------------------------------------------------------------ */
/* Open-prompt table matching (v2 — the Krillion pivot)                */
/* ------------------------------------------------------------------ */

/**
 * One row of an open prompt's rarity table, in matchable form. A row
 * flagged `trap` is a plausible-but-invalid answer: naming it is a
 * miss with its own specific correction, never a score.
 */
export interface TableAnswerEntry {
  spec: LoreAnswerSpec;
  trap?: boolean;
}

export type TableMatchResult =
  | { status: 'match'; index: number }
  | { status: 'trap'; index: number }
  | { status: 'miss' };

/**
 * Judges a typed answer against one open prompt's whole table. The
 * plausible-answer universe is the table itself, so the confusables
 * guard works the same way it does for fixed questions: an exact hit
 * on any row (real or trap) wins outright; a fuzzy input must be
 * within tolerance of exactly one row, or it belongs to neither.
 */
export function matchTableAnswer(
  rawInput: string,
  entries: readonly TableAnswerEntry[]
): TableMatchResult {
  const input = normalizeAnswer(rawInput);
  if (input === '') return { status: 'miss' };
  const formsList = entries.map((e) => specForms(e.spec));

  for (let i = 0; i < entries.length; i++) {
    if (formsList[i].indexOf(input) !== -1) {
      return entries[i].trap
        ? { status: 'trap', index: i }
        : { status: 'match', index: i };
    }
  }

  const hits: number[] = [];
  formsList.forEach((forms, i) => {
    if (forms.some((f) => withinTolerance(input, f))) hits.push(i);
  });
  if (hits.length === 1) {
    const i = hits[0];
    return entries[i].trap
      ? { status: 'trap', index: i }
      : { status: 'match', index: i };
  }
  return { status: 'miss' };
}

export type SongMatchStatus = 'match' | 'duplicate' | 'miss';

export interface SongMatchResult<T extends MatchableSong> {
  status: SongMatchStatus;
  song?: T;
}

/**
 * Resolves a typed song answer against the catalog pool. Exact title
 * (or title variant) wins; otherwise the single closest fuzzy title
 * within tolerance wins — a tie between two different songs is a
 * miss, never a guess. A resolved song that's already in usedIds is
 * a 'duplicate' (the run's no-repeat rule), distinct from a miss so
 * the UI can say so kindly.
 */
export function resolveSongAnswer<T extends MatchableSong>(
  rawInput: string,
  pool: readonly T[],
  usedIds: ReadonlySet<string>
): SongMatchResult<T> {
  const input = normalizeAnswer(rawInput);
  if (input === '') return { status: 'miss' };

  const variantsBySong = pool.map((song) => ({
    song,
    variants: songTitleVariants(song.title, song.id),
  }));

  let resolved: T | undefined;
  const exact = variantsBySong.filter((v) => v.variants.indexOf(input) !== -1);
  if (exact.length === 1) {
    resolved = exact[0].song;
  } else if (exact.length > 1) {
    // Two songs share this exact variant (a title and its own short
    // form, say) — ambiguous typed input owns neither.
    return { status: 'miss' };
  } else {
    // Fuzzy pass: nearest variant per song, then the nearest song.
    let bestDist = Infinity;
    let bestSongs: T[] = [];
    for (const { song, variants } of variantsBySong) {
      let songBest = Infinity;
      for (const v of variants) {
        if (!withinTolerance(input, v)) continue;
        const d = levenshtein(input, v);
        if (d < songBest) songBest = d;
      }
      if (songBest === Infinity) continue;
      if (songBest < bestDist) {
        bestDist = songBest;
        bestSongs = [song];
      } else if (songBest === bestDist) {
        bestSongs.push(song);
      }
    }
    if (bestSongs.length === 1) resolved = bestSongs[0];
  }

  if (!resolved) return { status: 'miss' };
  if (usedIds.has(resolved.id)) return { status: 'duplicate', song: resolved };
  return { status: 'match', song: resolved };
}
