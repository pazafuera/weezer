/**
 * Weezerverse world map (Phase 1, display-only — no tap-to-filter).
 *
 * A plain SVG dotted world: dim dots for land (committed dataset
 * app/data/worldDots.json, generated once from Natural Earth data
 * by scripts/generate-world-dots.mjs) and bright fixed-size dots
 * where fans have ranked, fed by get_fan_presence() codes only.
 * Presence is binary by design — no counts, no names (spec §2).
 *
 * Dot size is FIXED at every scale of the community (spec decision:
 * a dot means "presence", never a quantity). The US gets one dot
 * per state with fans, from the built-in centroid table below —
 * never a country dot stacked on top of them.
 */

import worldDots from '../data/worldDots.json';
import type { FanPresence } from '../lib/communitySlice';

const { width: MAP_W, height: MAP_H, dots: LAND_DOTS, countryDots } = worldDots as unknown as {
  width: number;
  height: number;
  dots: number[];
  countryDots: Record<string, [number, number]>;
};

/** State centroids [lat, lon] — standard published state centroid
 *  coordinates, used only to place a presence dot. */
const STATE_CENTROIDS: Record<string, [number, number]> = {
  AL: [32.78, -86.83], AK: [64.8, -152.4], AZ: [34.29, -111.66],
  AR: [34.9, -92.44], CA: [37.2, -119.61], CO: [39.0, -105.55],
  CT: [41.62, -72.66], DE: [39.0, -75.5], FL: [28.63, -82.45],
  GA: [32.68, -83.44], HI: [20.24, -157.31], ID: [44.39, -114.66],
  IL: [40.04, -89.2], IN: [39.9, -86.28], IA: [42.08, -93.5],
  KS: [38.49, -98.38], KY: [37.53, -84.9], LA: [31.05, -91.99],
  ME: [45.37, -69.24], MD: [38.97, -76.79], MA: [42.26, -71.81],
  MI: [44.35, -85.41], MN: [46.39, -93.75], MS: [32.74, -89.67],
  MO: [38.36, -92.46], MT: [47.05, -110.04], NE: [41.54, -99.8],
  NV: [39.33, -116.63], NH: [43.68, -71.58], NJ: [40.19, -74.67],
  NM: [34.43, -106.13], NY: [42.95, -75.53], NC: [35.54, -79.39],
  ND: [47.47, -100.47], OH: [40.29, -82.79], OK: [35.59, -97.51],
  OR: [43.94, -120.56], PA: [40.88, -77.8], RI: [41.68, -71.52],
  SC: [33.92, -80.9], SD: [44.44, -100.23], TN: [35.86, -86.35],
  TX: [31.48, -99.33], UT: [39.31, -111.68], VT: [44.07, -72.67],
  VA: [38.0, -78.66], WA: [47.39, -120.45], WV: [38.64, -80.62],
  WI: [44.63, -89.99], WY: [42.99, -107.55],
};

const LAT_TOP = 84;
const LAT_SPAN = 84 - -58; // matches the dataset's projection window

function projectState(lat: number, lon: number): [number, number] {
  return [
    Math.round((((lon + 180) / 360) * MAP_W) * 10) / 10,
    Math.round((((LAT_TOP - lat) / LAT_SPAN) * MAP_H) * 10) / 10,
  ];
}

/**
 * Count of places with fans, for the map's caption line: non-US
 * countries with fans + US states with fans (the US itself is not
 * a "place" here — its states are). Places with no presence data
 * are simply absent; the count never implies anything about how
 * many fans a place has.
 */
export function presencePlaceCount(presence: FanPresence): number {
  const nonUs = presence.countries.filter((c) => c !== 'US').length;
  return nonUs + presence.states.length;
}

export default function WeezerverseMap({
  presence,
}: {
  presence: FanPresence;
}) {
  const bright: { key: string; x: number; y: number }[] = [];

  for (const code of presence.countries) {
    if (code === 'US') continue; // states carry US presence
    const pt = countryDots[code];
    if (pt) bright.push({ key: `c-${code}`, x: pt[0], y: pt[1] });
  }
  for (const code of presence.states) {
    const c = STATE_CENTROIDS[code];
    if (c) {
      const [x, y] = projectState(c[0], c[1]);
      bright.push({ key: `s-${code}`, x, y });
    }
  }

  const landCircles: React.ReactNode[] = [];
  for (let i = 0; i < LAND_DOTS.length; i += 2) {
    landCircles.push(
      <circle
        key={i}
        cx={LAND_DOTS[i]}
        cy={LAND_DOTS[i + 1]}
        r={2.1}
        fill="#0C1220"
        opacity={0.16}
      />,
    );
  }

  return (
    <svg
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      className="block h-auto w-full"
      role="img"
      aria-label="World map showing where fans have ranked"
    >
      {landCircles}
      {bright.map((d) => (
        <g key={d.key}>
          <circle cx={d.x} cy={d.y} r={10} fill="#FFD23F" opacity={0.35} />
          <circle
            cx={d.x}
            cy={d.y}
            r={5}
            fill="#FFD23F"
            stroke="#0C1220"
            strokeWidth={1.6}
          />
        </g>
      ))}
    </svg>
  );
}
