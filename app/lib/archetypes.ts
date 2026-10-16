/**
 * Fandom archetype model — FROZEN at version 1.0.
 *
 * A user's rankings are reduced to a five-dimension vector
 * (classic / modern / deepCut / positivity / chaos, each 0–1), and the
 * user is matched to the nearest of seven fixed archetype centroids by
 * Euclidean distance. Match % = exp(−1.5 × distance) × 100.
 *
 * This model is FROZEN so a returning user's archetype stays stable.
 * Do not retune centroids, normalization, or the decay in place: any
 * change ships as a new ARCHETYPE_MODEL_VERSION with a migration note,
 * so stored or shared results remain interpretable.
 *
 * Archetypes are for fun — an editorial personality game, not a
 * validated psychological category. The UI must say so.
 */

export const ARCHETYPE_MODEL_VERSION = '1.0';

/** Exponential decay applied to the centroid distance for match %. */
export const MATCH_DECAY = 1.5;

export type ArchetypeVector = {
  classic: number;
  modern: number;
  deepCut: number;
  positivity: number;
  chaos: number;
};

export type ArchetypeCentroid = {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  color: string;
  vector: ArchetypeVector;
};

export const ARCHETYPE_CENTROIDS: ArchetypeCentroid[] = [
  {
    id: 'scientist',
    name: 'Weezer Scientist',
    emoji: '🧪',
    desc: 'You have a meticulously balanced, logic-driven appreciation across all eras.',
    color: 'text-emerald-600',
    vector: { classic: 0.5, modern: 0.5, deepCut: 0.5, positivity: 0.8, chaos: 0.2 },
  },
  {
    id: '90s',
    name: '1990s Elitist',
    emoji: '📼',
    desc: "If Matt Sharp didn't play bass on it, you barely consider it Weezer.",
    color: 'text-[#0072CE]',
    vector: { classic: 0.9, modern: 0.0, deepCut: 0.4, positivity: 0.3, chaos: 0.6 },
  },
  {
    id: 'vault',
    name: 'Cuomo Vault Scholar',
    emoji: '🧠',
    desc: 'You ignore radio hits to excavate unreleased synth demos and emotional B-sides.',
    color: 'text-[#8C6239]',
    vector: { classic: 0.6, modern: 0.3, deepCut: 0.9, positivity: 0.6, chaos: 0.8 },
  },
  {
    id: 'critic',
    name: 'Ruthless Critic',
    emoji: '💀',
    desc: 'You love Weezer so fiercely that you hate 75% of everything Rivers Cuomo has ever recorded.',
    color: 'text-red-600',
    vector: { classic: 0.4, modern: 0.1, deepCut: 0.3, positivity: 0.0, chaos: 0.9 },
  },
  {
    id: 'revisionist',
    name: 'Post-Classic Revisionist',
    emoji: '🚀',
    desc: 'You boldly recognize that White, OK Human, and SZNZ contain absolute modern masterpieces.',
    color: 'text-amber-500',
    vector: { classic: 0.2, modern: 0.9, deepCut: 0.4, positivity: 0.8, chaos: 0.7 },
  },
  {
    id: 'blueblood',
    name: 'Blue Blood Classicist',
    emoji: '🔵',
    desc: 'Infectious hooks, mainstream perfection, and clean 1994 nostalgia drive your rankings.',
    color: 'text-[#0072CE]',
    vector: { classic: 0.8, modern: 0.2, deepCut: 0.1, positivity: 0.9, chaos: 0.3 },
  },
  {
    id: 'chaos',
    name: 'Chaos Agent',
    emoji: '🎲',
    desc: 'Your rankings defy all conventional Weezer logic. You operate entirely on your own terms.',
    color: 'text-purple-600',
    vector: { classic: 0.5, modern: 0.5, deepCut: 0.5, positivity: 0.5, chaos: 1.0 },
  },
];

/** Vibe image per archetype id (presentation layer of the same model). */
export const ARCHETYPE_VIBES: Record<string, string> = {
  '90s': '/img/vibes/grownassman.gif',
  blueblood: '/img/vibes/rivers-buddyholly.webp',
  vault: '/img/vibes/snuggie.gif',
  critic: '/img/vibes/sayitaintso.gif',
  revisionist: '/img/vibes/snl-beverlyhills.gif',
  scientist: '/img/vibes/rivers-sweater.gif',
  chaos: '/img/vibes/canoli.gif',
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Reduce a user's stats to the model vector. Bucket averages run 1–5,
 * so (avg − 1) / 4 maps them onto 0–1; ratios are already 0–1;
 * hotTakeScore runs 0–100.
 */
export function normalizeUserVector(input: {
  classicAverage: number;
  modernAverage: number;
  deepCutRatio: number;
  globalPositivity: number;
  hotTakeScore: number;
}): ArchetypeVector {
  return {
    classic: clamp01((input.classicAverage - 1) / 4),
    modern: clamp01((input.modernAverage - 1) / 4),
    deepCut: clamp01(input.deepCutRatio),
    positivity: clamp01(input.globalPositivity),
    chaos: clamp01(input.hotTakeScore / 100),
  };
}

export type ScoredArchetype = ArchetypeCentroid & { score: number };

/** Score every centroid against the user vector, best match first. */
export function scoreArchetypes(userVector: ArchetypeVector): ScoredArchetype[] {
  return ARCHETYPE_CENTROIDS.map((arc) => {
    const dist = Math.sqrt(
      Math.pow(userVector.classic - arc.vector.classic, 2) +
        Math.pow(userVector.modern - arc.vector.modern, 2) +
        Math.pow(userVector.deepCut - arc.vector.deepCut, 2) +
        Math.pow(userVector.positivity - arc.vector.positivity, 2) +
        Math.pow(userVector.chaos - arc.vector.chaos, 2)
    );
    const score = Math.max(0, Math.round(Math.exp(-MATCH_DECAY * dist) * 100));
    return { ...arc, score };
  }).sort((a, b) => b.score - a.score);
}
