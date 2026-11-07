/**
 * Weezerverse filter bar (Phase 1) — lives in the ink band that
 * FanStats renders beneath the world map's card, so the controls
 * read as filters for the stats below and never as map controls
 * (owner direction, Nov 6, 2026: the band is separate from the map
 * card and says so). Menus only ever offer what get_fan_presence()
 * reported: a country with no ranked fans cannot be picked, and
 * the state menu exists only once the United States is chosen.
 * Place and age are both dropdowns — the age bands were a pill row
 * until Nov 6, 2026, when the owner replaced them with a select
 * mirroring the country control. One tap on "All fans" clears
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

// Band treatment for the selects: transparent over the ink band,
// white border and text, native chrome asked to render dark so
// the closed face and its chevron stay legible on ink. The
// max-content minimum width is the one-line rule for dropdown
// faces: a select never shrinks below its widest option and
// clips a name — in the wrapping flex row it drops to the next
// line instead (in practice only the state control ever wraps).
const selectClass =
  'basis-0 min-w-[max-content] flex-1 rounded-full border-2 border-white bg-transparent px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white outline-none [color-scheme:dark]';

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

        <select
          aria-label="Filter by age group"
          className={selectClass}
          value={selection.band ?? ''}
          onChange={(e) =>
            onChange({
              ...selection,
              band: (e.target.value || null) as AgeBandKey | null,
            })
          }
        >
          <option value="">All ages</option>
          {AGE_BANDS.map((b) => (
            <option key={b.key} value={b.key}>
              {b.label}
            </option>
          ))}
        </select>
      </div>

      {(selection.country === 'US' || anyActive) && (
        <div className="flex flex-wrap items-center gap-2">
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
              className="rounded-full border-2 border-[#FFD23F] bg-[#FFD23F] px-3 py-1.5 text-xs font-black uppercase tracking-wide text-[#0C1220] transition hover:border-[#FFE066] hover:bg-[#FFE066]"
            >
              All fans
            </button>
          )}
        </div>
      )}
    </div>
  );
}
