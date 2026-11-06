/**
 * Weezerverse filter bar (Phase 1) — attached directly under the
 * world map. Menus only ever offer what get_fan_presence() reported:
 * a country with no ranked fans cannot be picked, and the state
 * menu exists only once the United States is chosen. Age bands are
 * the five fixed generational bands. One tap on "All fans" clears
 * every axis. Selections live in FanStats component state only —
 * no URL params, nothing shareable (spec decision 10).
 */

import {
  AGE_BANDS,
  type AgeBandKey,
  type FanPresence,
  type SliceSelection,
} from '../lib/communitySlice';
import { COUNTRY_OPTIONS, US_STATES } from './WeezerOnboardingModal';

const COUNTRY_NAME = new Map(
  COUNTRY_OPTIONS.filter((o) => o.code !== 'DIVIDER').map((o) => [
    o.code,
    o.name,
  ]),
);
// US_STATES in the onboarding modal is codes only; the full names
// live here for the filter menu and the slice line.
const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas',
  CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
  KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
  WI: 'Wisconsin', WY: 'Wyoming',
};
const STATE_NAME = new Map(
  US_STATES.map((code) => [code, STATE_NAMES[code] ?? code]),
);

export function countryName(code: string): string {
  return COUNTRY_NAME.get(code) ?? code;
}

export function stateName(code: string): string {
  return STATE_NAME.get(code) ?? code;
}

const selectClass =
  'rounded-full border-2 border-[#0C1220] bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wide text-[#0C1220] shadow-[2px_2px_0_#0C1220] outline-none';

export default function WeezerverseFilterBar({
  presence,
  selection,
  onChange,
}: {
  presence: FanPresence;
  selection: SliceSelection;
  onChange: (next: SliceSelection) => void;
}) {
  const anyActive =
    selection.country !== null ||
    selection.state !== null ||
    selection.band !== null;

  const chipClass = (active: boolean) =>
    `rounded-full border-2 px-3 py-1.5 text-xs font-black uppercase tracking-wide transition ${
      active
        ? 'border-[#0C1220] bg-[#0C1220] text-white shadow-[2px_2px_0_rgba(12,18,32,0.35)]'
        : 'border-[#0C1220] bg-white text-[#0C1220] shadow-[2px_2px_0_#0C1220] hover:bg-[#FFE066]'
    }`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Filter by country"
          className={selectClass}
          value={selection.country ?? ''}
          onChange={(e) => {
            const country = e.target.value || null;
            onChange({
              country,
              // State only survives while the US is selected.
              state: country === 'US' ? selection.state : null,
              band: selection.band,
            });
          }}
        >
          <option value="">All countries</option>
          {presence.countries.map((code) => (
            <option key={code} value={code}>
              {countryName(code)}
            </option>
          ))}
        </select>

        {selection.country === 'US' && (
          <select
            aria-label="Filter by state"
            className={selectClass}
            value={selection.state ?? ''}
            onChange={(e) =>
              onChange({ ...selection, state: e.target.value || null })
            }
          >
            <option value="">All states</option>
            {presence.states.map((code) => (
              <option key={code} value={code}>
                {stateName(code)}
              </option>
            ))}
          </select>
        )}

        {anyActive && (
          <button
            type="button"
            onClick={() =>
              onChange({ country: null, state: null, band: null })
            }
            className="rounded-full border-2 border-[#0C1220] bg-[#FFD23F] px-3 py-1.5 text-xs font-black uppercase tracking-wide text-[#0C1220] shadow-[2px_2px_0_#0C1220] transition hover:bg-[#FFE066]"
          >
            All fans
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className={chipClass(selection.band === null)}
          onClick={() => onChange({ ...selection, band: null })}
        >
          All ages
        </button>
        {AGE_BANDS.map((b) => (
          <button
            key={b.key}
            type="button"
            className={chipClass(selection.band === b.key)}
            onClick={() =>
              onChange({
                ...selection,
                band: selection.band === b.key ? null : (b.key as AgeBandKey),
              })
            }
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
