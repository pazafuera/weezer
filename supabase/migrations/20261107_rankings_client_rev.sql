-- Rankings durability overhaul (Nov 7, 2026): a client revision
-- counter on weezer_rankings.
--
-- Why: boot recovery used to decide whether the device's local
-- snapshot (the unsent-edits buffer) outranked the account row by
-- comparing CLOCK stamps written by different code paths — the
-- snapshot's save time (edit time) against the row's updated_at
-- (send/heal time). In the field that gate failed to promote a
-- buffer the session had provably written, and nothing recorded
-- the inputs. The client now stamps a monotonically increasing
-- revision on every snapshot and records the revision it carried
-- in this column on every write; when both sides carry a
-- revision, the revision alone decides promotion and clocks are
-- never consulted.
--
-- Safe to run before OR after the code ships:
-- - The code feature-detects this column (a select('*') key
--   check, then a one-time probe per page load). Until the
--   column exists, writes omit it and boot falls back to the
--   timestamp predicate — behavior identical to before.
-- - Existing rows keep client_rev NULL, which the code reads as
--   "no recorded revision": the timestamp fallback governs the
--   one transition boot, and the first revision-aware write
--   stamps the row from then on.
-- Column only: no grants change (the table's existing Data API
-- grants cover its columns), no backfill, no constraint.
alter table public.weezer_rankings
  add column if not exists client_rev bigint;

-- Make PostgREST pick the new column up immediately.
notify pgrst, 'reload schema';
