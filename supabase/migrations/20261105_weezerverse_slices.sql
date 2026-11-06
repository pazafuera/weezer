-- ============================================================================
-- Weezerverse filters + world map — Phase 1 (spec:
-- files/weezerverse-filters-map-spec-2026-11-05.md, decisions settled
-- Nov 5, 2026: generational birth-year bands, 5-fan suppression floor
-- with complementary suppression, presence-only map dots).
--
-- PREPARED FOR THE OWNER TO RUN in the Supabase dashboard SQL editor
-- (project qjzusagaxuwpleybxqzg): paste this whole file and Run it.
-- It only creates functions — no tables, no data changes — so the
-- Oct 30 Data API grant rule (explicit GRANTs for new tables) does
-- not apply. Safe to run before or after the client ships: until it
-- runs, the client treats the missing RPCs as "feature unavailable"
-- and the Weezerverse page renders exactly as it does today.
--
-- Posture matches the existing community functions (get_community_
-- rankings, the PREP aggregates draft): SECURITY DEFINER, fixed
-- search_path, execute granted to anon + authenticated on the two
-- client doors (the page is readable signed out). Profiles and
-- rankings are read ONLY inside these functions; no new direct
-- client access, RLS untouched. The two internal helpers have their
-- execute grants revoked, like refresh_community_stats() in PREP.
--
-- Methodology parity with app/lib/fanStatsMethodology.ts (v1.0):
--   * A submission qualifies with >= 10 explicit ratings whose song
--     id is in the catalog below AND whose bucket is one of
--     banger/slaps/mid/skip/trash. Missing songs never counted.
--   * The catalog CTE is GENERATED from FULL_SONG_POOL in
--     app/data/constants.ts (206 songs: id, album name, year) — the
--     server has no song-catalog table, and album/era membership is
--     needed for the per-fan summaries. Regenerate it if the
--     catalog ever changes.
--   * Percentages stay a CLIENT display decision (MIN_DISPLAY_
--     SAMPLE = 50); a passing slice returns honest counts.
--
-- Privacy (spec section 4): a slice under 5 qualifying fans returns
-- a suppressed stub — no songs, no pairs, no fan summaries, and the
-- cohort-size fields are ABSENT (an exact count under 5 never
-- leaves the database, not even in an error-shaped response).
-- Complementary suppression: a slice is also suppressed when
-- removing one filter axis leaves a visible parent whose
-- complement is 1-4 fans. get_fan_presence returns place codes
-- only — no counts, no names, no timestamps. Raw birth years
-- never leave the database; only the fixed band key does.
-- ============================================================================

-- Presence: which places have at least one fan who actually ranked.
-- Feeds the world map dots and the filter menus, so the menus can
-- only ever offer places that exist.
create or replace function public.get_fan_presence()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'countries',
      coalesce((
        select jsonb_agg(c order by c)
        from (
          select distinct p.country_code as c
          from public.profiles p
          join public.weezer_rankings r on r.user_id = p.id
          where p.country_code is not null
            and p.country_code <> ''
            and (r.triage_map is not null or r.master_list is not null)
        ) d
      ), '[]'::jsonb),
    'states',
      coalesce((
        select jsonb_agg(c order by c)
        from (
          select distinct p.state_code as c
          from public.profiles p
          join public.weezer_rankings r on r.user_id = p.id
          where p.country_code = 'US'
            and p.state_code is not null
            and p.state_code <> ''
            and (r.triage_map is not null or r.master_list is not null)
        ) d
      ), '[]'::jsonb)
  );
$$;

grant execute on function public.get_fan_presence() to anon, authenticated;

-- The suppressed stub: the ONLY shape a sub-floor or unrecognized
-- slice ever returns. No aggregates, and no cohort-size fields at
-- all. Internal helper — not a client door.
create or replace function public.weezer_slice_stub(
  p_country text,
  p_state text,
  p_band text,
  p_reason text
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'suppressed', true,
    'reason', p_reason,
    'slice', jsonb_build_object(
      'country', p_country, 'state', p_state, 'band', p_band),
    'methodologyVersion', '1.0',
    'refreshedAt', null,
    'songs', '[]'::jsonb,
    'pairs', '[]'::jsonb,
    'fanSummaries', '[]'::jsonb
  );
$$;

revoke execute on function public.weezer_slice_stub(text, text, text, text)
  from public, anon, authenticated;

-- Internal helper: one row per catalog-valid rating from every
-- QUALIFIED fan (>= 10 valid ratings), carrying the fan's filter
-- fields (country / state / derived band — never the raw birth
-- year). Everything the slice function reports is computed from
-- these rows. Internal — not a client door: execute is revoked
-- below; get_community_slice_stats() calls it as the owner.
create or replace function public.weezer_slice_entries()
returns table (
  user_id text,
  country_code text,
  state_code text,
  band text,
  song_id text,
  bucket text,
  points integer,
  album text,
  yr integer
)
language sql
security definer
set search_path = public
as $$
  with catalog(song_id, album, yr) as (
    values
        ('bs_1', 'B-Sides & Rarities', 1996),
        ('bs_2', 'B-Sides & Rarities', 1996),
        ('bs_3', 'B-Sides & Rarities', 1996),
        ('bs_4', 'B-Sides & Rarities', 1994),
        ('bs_5', 'B-Sides & Rarities', 1994),
        ('bs_6', 'B-Sides & Rarities', 1996),
        ('bs_7', 'B-Sides & Rarities', 2008),
        ('bs_8', 'B-Sides & Rarities', 1996),
        ('bs_9', 'B-Sides & Rarities', 1996),
        ('bs_10', 'B-Sides & Rarities', 2008),
        ('bs_11', 'B-Sides & Rarities', 2008),
        ('bs_12', 'B-Sides & Rarities', 1994),
        ('bs_13', 'B-Sides & Rarities', 1992),
        ('bs_14', 'B-Sides & Rarities', 2008),
        ('bs_15', 'B-Sides & Rarities', 1994),
        ('bs_16', 'B-Sides & Rarities', 1996),
        ('bs_17', 'B-Sides & Rarities', 2009),
        ('bs_18', 'B-Sides & Rarities', 2016),
        ('blue_1', 'The Blue Album', 1994),
        ('blue_2', 'The Blue Album', 1994),
        ('blue_3', 'The Blue Album', 1994),
        ('blue_4', 'The Blue Album', 1994),
        ('blue_5', 'The Blue Album', 1994),
        ('blue_6', 'The Blue Album', 1994),
        ('blue_7', 'The Blue Album', 1994),
        ('blue_8', 'The Blue Album', 1994),
        ('blue_9', 'The Blue Album', 1994),
        ('blue_10', 'The Blue Album', 1994),
        ('pink_1', 'Pinkerton', 1996),
        ('pink_2', 'Pinkerton', 1996),
        ('pink_3', 'Pinkerton', 1996),
        ('pink_4', 'Pinkerton', 1996),
        ('pink_5', 'Pinkerton', 1996),
        ('pink_6', 'Pinkerton', 1996),
        ('pink_7', 'Pinkerton', 1996),
        ('pink_8', 'Pinkerton', 1996),
        ('pink_9', 'Pinkerton', 1996),
        ('pink_10', 'Pinkerton', 1996),
        ('green_1', 'Green Album', 2001),
        ('green_2', 'Green Album', 2001),
        ('green_3', 'Green Album', 2001),
        ('green_4', 'Green Album', 2001),
        ('green_5', 'Green Album', 2001),
        ('green_6', 'Green Album', 2001),
        ('green_7', 'Green Album', 2001),
        ('green_8', 'Green Album', 2001),
        ('green_9', 'Green Album', 2001),
        ('green_10', 'Green Album', 2001),
        ('mal_1', 'Maladroit', 2002),
        ('mal_2', 'Maladroit', 2002),
        ('mal_3', 'Maladroit', 2002),
        ('mal_4', 'Maladroit', 2002),
        ('mal_5', 'Maladroit', 2002),
        ('mal_6', 'Maladroit', 2002),
        ('mal_7', 'Maladroit', 2002),
        ('mal_8', 'Maladroit', 2002),
        ('mal_9', 'Maladroit', 2002),
        ('mal_10', 'Maladroit', 2002),
        ('mal_11', 'Maladroit', 2002),
        ('mal_12', 'Maladroit', 2002),
        ('mal_13', 'Maladroit', 2002),
        ('mb_1', 'Make Believe', 2005),
        ('mb_2', 'Make Believe', 2005),
        ('mb_3', 'Make Believe', 2005),
        ('mb_4', 'Make Believe', 2005),
        ('mb_5', 'Make Believe', 2005),
        ('mb_6', 'Make Believe', 2005),
        ('mb_7', 'Make Believe', 2005),
        ('mb_8', 'Make Believe', 2005),
        ('mb_9', 'Make Believe', 2005),
        ('mb_10', 'Make Believe', 2005),
        ('mb_11', 'Make Believe', 2005),
        ('mb_12', 'Make Believe', 2005),
        ('red_1', 'Red Album', 2008),
        ('red_2', 'Red Album', 2008),
        ('red_3', 'Red Album', 2008),
        ('red_4', 'Red Album', 2008),
        ('red_5', 'Red Album', 2008),
        ('red_6', 'Red Album', 2008),
        ('red_7', 'Red Album', 2008),
        ('red_8', 'Red Album', 2008),
        ('red_9', 'Red Album', 2008),
        ('red_10', 'Red Album', 2008),
        ('rad_1', 'Raditude', 2009),
        ('rad_2', 'Raditude', 2009),
        ('rad_3', 'Raditude', 2009),
        ('rad_4', 'Raditude', 2009),
        ('rad_5', 'Raditude', 2009),
        ('rad_6', 'Raditude', 2009),
        ('rad_7', 'Raditude', 2009),
        ('rad_8', 'Raditude', 2009),
        ('rad_9', 'Raditude', 2009),
        ('rad_10', 'Raditude', 2009),
        ('hur_1', 'Hurley', 2010),
        ('hur_2', 'Hurley', 2010),
        ('hur_3', 'Hurley', 2010),
        ('hur_4', 'Hurley', 2010),
        ('hur_5', 'Hurley', 2010),
        ('hur_6', 'Hurley', 2010),
        ('hur_7', 'Hurley', 2010),
        ('hur_8', 'Hurley', 2010),
        ('hur_9', 'Hurley', 2010),
        ('hur_10', 'Hurley', 2010),
        ('ew_1', 'EWBAITE', 2014),
        ('ew_2', 'EWBAITE', 2014),
        ('ew_3', 'EWBAITE', 2014),
        ('ew_4', 'EWBAITE', 2014),
        ('ew_5', 'EWBAITE', 2014),
        ('ew_6', 'EWBAITE', 2014),
        ('ew_7', 'EWBAITE', 2014),
        ('ew_8', 'EWBAITE', 2014),
        ('ew_9', 'EWBAITE', 2014),
        ('ew_10', 'EWBAITE', 2014),
        ('ew_11', 'EWBAITE', 2014),
        ('ew_12', 'EWBAITE', 2014),
        ('ew_13', 'EWBAITE', 2014),
        ('wh_1', 'White Album', 2016),
        ('wh_2', 'White Album', 2016),
        ('wh_3', 'White Album', 2016),
        ('wh_4', 'White Album', 2016),
        ('wh_5', 'White Album', 2016),
        ('wh_6', 'White Album', 2016),
        ('wh_7', 'White Album', 2016),
        ('wh_8', 'White Album', 2016),
        ('wh_9', 'White Album', 2016),
        ('wh_10', 'White Album', 2016),
        ('pd_1', 'Pacific Daydream', 2017),
        ('pd_2', 'Pacific Daydream', 2017),
        ('pd_3', 'Pacific Daydream', 2017),
        ('pd_4', 'Pacific Daydream', 2017),
        ('pd_5', 'Pacific Daydream', 2017),
        ('pd_6', 'Pacific Daydream', 2017),
        ('pd_7', 'Pacific Daydream', 2017),
        ('pd_8', 'Pacific Daydream', 2017),
        ('pd_9', 'Pacific Daydream', 2017),
        ('pd_10', 'Pacific Daydream', 2017),
        ('blk_1', 'Black Album', 2019),
        ('blk_2', 'Black Album', 2019),
        ('blk_3', 'Black Album', 2019),
        ('blk_4', 'Black Album', 2019),
        ('blk_5', 'Black Album', 2019),
        ('blk_6', 'Black Album', 2019),
        ('blk_7', 'Black Album', 2019),
        ('blk_8', 'Black Album', 2019),
        ('blk_9', 'Black Album', 2019),
        ('blk_10', 'Black Album', 2019),
        ('okh_1', 'OK Human', 2021),
        ('okh_2', 'OK Human', 2021),
        ('okh_3', 'OK Human', 2021),
        ('okh_4', 'OK Human', 2021),
        ('okh_5', 'OK Human', 2021),
        ('okh_6', 'OK Human', 2021),
        ('okh_7', 'OK Human', 2021),
        ('okh_8', 'OK Human', 2021),
        ('okh_9', 'OK Human', 2021),
        ('okh_10', 'OK Human', 2021),
        ('okh_11', 'OK Human', 2021),
        ('okh_12', 'OK Human', 2021),
        ('vw_1', 'Van Weezer', 2021),
        ('vw_2', 'Van Weezer', 2021),
        ('vw_3', 'Van Weezer', 2021),
        ('vw_4', 'Van Weezer', 2021),
        ('vw_5', 'Van Weezer', 2021),
        ('vw_6', 'Van Weezer', 2021),
        ('vw_7', 'Van Weezer', 2021),
        ('vw_8', 'Van Weezer', 2021),
        ('vw_9', 'Van Weezer', 2021),
        ('vw_10', 'Van Weezer', 2021),
        ('sz_sp1', 'SZNZ: Spring', 2022),
        ('sz_sp2', 'SZNZ: Spring', 2022),
        ('sz_sp3', 'SZNZ: Spring', 2022),
        ('sz_sp4', 'SZNZ: Spring', 2022),
        ('sz_sp5', 'SZNZ: Spring', 2022),
        ('sz_sp6', 'SZNZ: Spring', 2022),
        ('sz_sp7', 'SZNZ: Spring', 2022),
        ('sz_su1', 'SZNZ: Summer', 2022),
        ('sz_su2', 'SZNZ: Summer', 2022),
        ('sz_su3', 'SZNZ: Summer', 2022),
        ('sz_su4', 'SZNZ: Summer', 2022),
        ('sz_su5', 'SZNZ: Summer', 2022),
        ('sz_su6', 'SZNZ: Summer', 2022),
        ('sz_su7', 'SZNZ: Summer', 2022),
        ('sz_au1', 'SZNZ: Autumn', 2022),
        ('sz_au2', 'SZNZ: Autumn', 2022),
        ('sz_au3', 'SZNZ: Autumn', 2022),
        ('sz_au4', 'SZNZ: Autumn', 2022),
        ('sz_au5', 'SZNZ: Autumn', 2022),
        ('sz_au6', 'SZNZ: Autumn', 2022),
        ('sz_au7', 'SZNZ: Autumn', 2022),
        ('sz_wi1', 'SZNZ: Winter', 2022),
        ('sz_wi2', 'SZNZ: Winter', 2022),
        ('sz_wi3', 'SZNZ: Winter', 2022),
        ('sz_wi4', 'SZNZ: Winter', 2022),
        ('sz_wi5', 'SZNZ: Winter', 2022),
        ('sz_wi6', 'SZNZ: Winter', 2022),
        ('sz_wi7', 'SZNZ: Winter', 2022),
        ('gold_1', 'Gold Album', 2026),
        ('gold_2', 'Gold Album', 2026),
        ('gold_3', 'Gold Album', 2026),
        ('gold_4', 'Gold Album', 2026),
        ('gold_5', 'Gold Album', 2026),
        ('gold_6', 'Gold Album', 2026),
        ('gold_7', 'Gold Album', 2026),
        ('gold_8', 'Gold Album', 2026),
        ('gold_9', 'Gold Album', 2026),
        ('gold_10', 'Gold Album', 2026)
  ),
  entries as (
    select
      p.id::text as user_id,
      p.country_code,
      p.state_code,
      case
        when p.birth_year is null then null
        when p.birth_year < 1965 then 'boomer'
        when p.birth_year <= 1980 then 'genx'
        when p.birth_year <= 1996 then 'millennial'
        when p.birth_year <= 2012 then 'genz'
        else 'genalpha'
      end as band,
      e.key as song_id,
      e.value as bucket,
      case e.value
        when 'banger' then 5 when 'slaps' then 4 when 'mid' then 3
        when 'skip' then 2 when 'trash' then 1 else 0 end as points,
      c.album,
      c.yr
    from public.profiles p
    join public.weezer_rankings r on r.user_id = p.id
    cross join lateral jsonb_each_text(r.triage_map) e
    join catalog c on c.song_id = e.key
    where r.triage_map is not null
      and e.value in ('banger', 'slaps', 'mid', 'skip', 'trash')
  ),
  qualified as (
    select user_id
    from entries
    group by user_id
    having count(*) >= 10
  )
  select e.*
  from entries e
  join qualified q on q.user_id = e.user_id;
$$;

revoke execute on function public.weezer_slice_entries()
  from public, anon, authenticated;

-- Slice stats: one filtered cohort's aggregates, computed on the
-- fly. Payload mirrors get_community_stats() (qualifiedSubmissions,
-- methodologyVersion, songs, pairs) plus the slice header (slice,
-- suppressed, cohortSize — cohortSize present only when the slice
-- is visible) and fanSummaries: per-fan album/era point summaries
-- (8 numbers, no identity, no songs) that let the client run the
-- methodology module's own debate-weight and tribe rules instead
-- of duplicating editorial constants in SQL. Strictly less data
-- than get_community_rankings() already ships unfiltered.
create or replace function public.get_community_slice_stats(
  p_country text,
  p_state text,
  p_band text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_country text := nullif(btrim(coalesce(p_country, '')), '');
  v_state text := nullif(btrim(coalesce(p_state, '')), '');
  v_band text := nullif(btrim(coalesce(p_band, '')), '');
  v_cohort integer;
  v_parent integer;
begin
  -- State is meaningful only for US fans (the collection rule); a
  -- state filter under any other country — or no country — is
  -- ignored, exactly as the client treats it.
  if v_country is distinct from 'US' then
    v_state := null;
  end if;

  -- Fixed menu inputs only. Anything unrecognized returns the
  -- suppressed stub: never an error, never unfiltered data.
  if v_country is not null and v_country not in (
        'AD',
        'AE',
        'AF',
        'AG',
        'AL',
        'AM',
        'AO',
        'AR',
        'AT',
        'AU',
        'AZ',
        'BA',
        'BB',
        'BD',
        'BE',
        'BF',
        'BG',
        'BH',
        'BI',
        'BJ',
        'BN',
        'BO',
        'BR',
        'BS',
        'BT',
        'BW',
        'BY',
        'BZ',
        'CA',
        'CF',
        'CG',
        'CH',
        'CL',
        'CM',
        'CN',
        'CO',
        'CR',
        'CU',
        'CV',
        'CY',
        'CZ',
        'DE',
        'DJ',
        'DK',
        'DM',
        'DO',
        'DZ',
        'EC',
        'EE',
        'EG',
        'ER',
        'ES',
        'ET',
        'FI',
        'FJ',
        'FR',
        'GA',
        'GB',
        'GD',
        'GE',
        'GH',
        'GM',
        'GN',
        'GQ',
        'GR',
        'GT',
        'GY',
        'HN',
        'HR',
        'HT',
        'HU',
        'ID',
        'IE',
        'IL',
        'IN',
        'IQ',
        'IR',
        'IS',
        'IT',
        'JM',
        'JO',
        'JP',
        'KE',
        'KG',
        'KH',
        'KM',
        'KR',
        'KW',
        'KZ',
        'LA',
        'LB',
        'LI',
        'LK',
        'LR',
        'LS',
        'LT',
        'LU',
        'LV',
        'LY',
        'MA',
        'MC',
        'MD',
        'ME',
        'MG',
        'MK',
        'ML',
        'MM',
        'MN',
        'MT',
        'MV',
        'MW',
        'MX',
        'MY',
        'MZ',
        'NA',
        'NE',
        'NG',
        'NI',
        'NL',
        'NO',
        'NP',
        'NZ',
        'OM',
        'PA',
        'PE',
        'PG',
        'PH',
        'PK',
        'PL',
        'PT',
        'PY',
        'QA',
        'RO',
        'RS',
        'RU',
        'RW',
        'SA',
        'SD',
        'SE',
        'SG',
        'SI',
        'SK',
        'SN',
        'SV',
        'SZ',
        'TD',
        'TH',
        'TN',
        'TR',
        'TW',
        'TZ',
        'UA',
        'UG',
        'US',
        'UY',
        'UZ',
        'VE',
        'VN',
        'YE',
        'ZA',
        'ZM',
        'ZW'
  ) then
    return public.weezer_slice_stub(v_country, v_state, v_band, 'below_floor');
  end if;
  if v_state is not null and v_state not in (
        'AL',
        'AK',
        'AZ',
        'AR',
        'CA',
        'CO',
        'CT',
        'DE',
        'FL',
        'GA',
        'HI',
        'ID',
        'IL',
        'IN',
        'IA',
        'KS',
        'KY',
        'LA',
        'ME',
        'MD',
        'MA',
        'MI',
        'MN',
        'MS',
        'MO',
        'MT',
        'NE',
        'NV',
        'NH',
        'NJ',
        'NM',
        'NY',
        'NC',
        'ND',
        'OH',
        'OK',
        'OR',
        'PA',
        'RI',
        'SC',
        'SD',
        'TN',
        'TX',
        'UT',
        'VT',
        'VA',
        'WA',
        'WV',
        'WI',
        'WY'
  ) then
    return public.weezer_slice_stub(v_country, v_state, v_band, 'below_floor');
  end if;
  if v_band is not null and v_band not in (
    'boomer', 'genx', 'millennial', 'genz', 'genalpha'
  ) then
    return public.weezer_slice_stub(v_country, v_state, v_band, 'below_floor');
  end if;

  -- The slice's cohort (qualified fans matching all three axes).
  select count(distinct user_id) into v_cohort
  from public.weezer_slice_entries() e
  where (v_country is null or e.country_code = v_country)
    and (v_state is null or e.state_code = v_state)
    and (v_band is null or e.band = v_band);

  if v_cohort = 0 then
    return public.weezer_slice_stub(v_country, v_state, v_band, 'none_qualified');
  end if;
  if v_cohort < 5 then
    return public.weezer_slice_stub(v_country, v_state, v_band, 'below_floor');
  end if;

  -- Complementary suppression: for each axis in play, the parent
  -- slice (that axis removed) minus this slice is the complement.
  -- When the parent is itself visible (>= 5) and the complement
  -- is 1-4 fans, showing this slice would let anyone difference
  -- the two and isolate a sub-floor group — suppress instead.
  if v_band is not null then
    select count(distinct user_id) into v_parent
    from public.weezer_slice_entries() e
    where (v_country is null or e.country_code = v_country)
      and (v_state is null or e.state_code = v_state);
    if v_parent >= 5 and (v_parent - v_cohort) between 1 and 4 then
      return public.weezer_slice_stub(v_country, v_state, v_band, 'below_floor');
    end if;
  end if;
  if v_state is not null then
    select count(distinct user_id) into v_parent
    from public.weezer_slice_entries() e
    where (v_country is null or e.country_code = v_country)
      and (v_band is null or e.band = v_band);
    if v_parent >= 5 and (v_parent - v_cohort) between 1 and 4 then
      return public.weezer_slice_stub(v_country, v_state, v_band, 'below_floor');
    end if;
  end if;
  if v_country is not null then
    select count(distinct user_id) into v_parent
    from public.weezer_slice_entries() e
    where (v_band is null or e.band = v_band);
    if v_parent >= 5 and (v_parent - v_cohort) between 1 and 4 then
      return public.weezer_slice_stub(v_country, v_state, v_band, 'below_floor');
    end if;
  end if;

  return (
    with slice_entries as (
      select e.*
      from public.weezer_slice_entries() e
      where (v_country is null or e.country_code = v_country)
        and (v_state is null or e.state_code = v_state)
        and (v_band is null or e.band = v_band)
    )
    select jsonb_build_object(
      'suppressed', false,
      'slice', jsonb_build_object(
        'country', v_country, 'state', v_state, 'band', v_band),
      'cohortSize', v_cohort,
      'qualifiedSubmissions', v_cohort,
      'methodologyVersion', '1.0',
      'refreshedAt', null,
      'songs',
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'songId', song_id,
            'ratings', ratings,
            'sum', score_sum,
            'buckets', jsonb_build_object(
              'banger', banger, 'slaps', slaps, 'mid', mid,
              'skip', skip, 'trash', trash)
          ))
          from (
            select
              song_id,
              count(*) as ratings,
              sum(points) as score_sum,
              count(*) filter (where bucket = 'banger') as banger,
              count(*) filter (where bucket = 'slaps') as slaps,
              count(*) filter (where bucket = 'mid') as mid,
              count(*) filter (where bucket = 'skip') as skip,
              count(*) filter (where bucket = 'trash') as trash
            from slice_entries
            group by song_id
          ) s
        ), '[]'::jsonb),
      'pairs',
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'a', song_a, 'b', song_b, 'coLoved', co_loved))
          from (
            select a.song_id as song_a, b.song_id as song_b,
              count(*) as co_loved
            from slice_entries a
            join slice_entries b
              on b.user_id = a.user_id and a.song_id < b.song_id
            where a.bucket in ('banger', 'slaps')
              and b.bucket in ('banger', 'slaps')
            group by a.song_id, b.song_id
          ) pr
        ), '[]'::jsonb),
      'fanSummaries',
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'blueSum', blue_sum, 'blueCount', blue_count,
            'pinkSum', pink_sum, 'pinkCount', pink_count,
            'modernSum', modern_sum, 'modernCount', modern_count,
            'totalSum', total_sum, 'totalCount', total_count
          ))
          from (
            select
              coalesce(sum(points) filter (
                where album = 'The Blue Album'), 0) as blue_sum,
              count(*) filter (
                where album = 'The Blue Album') as blue_count,
              coalesce(sum(points) filter (
                where album = 'Pinkerton'), 0) as pink_sum,
              count(*) filter (
                where album = 'Pinkerton') as pink_count,
              coalesce(sum(points) filter (
                where yr >= 2010), 0) as modern_sum,
              count(*) filter (where yr >= 2010) as modern_count,
              sum(points) as total_sum,
              count(*) as total_count
            from slice_entries
            group by user_id
          ) f
        ), '[]'::jsonb)
    )
  );
end;
$$;

grant execute on function public.get_community_slice_stats(text, text, text)
  to anon, authenticated;
