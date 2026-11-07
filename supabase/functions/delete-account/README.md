# delete-account Edge Function — PREP ONLY, NOT DEPLOYED

Status: function written 2026-10-15 (overnight prep); client wiring
completed 2026-11-07 (Build 6). **Not deployed.** The Account drawer's
delete button stays disabled — behind `DELETE_ACCOUNT_BACKEND_LIVE`
in `app/components/WeezerAccountDrawer.tsx` — until every step below
is done and verified with a throwaway account.

## Schema audit (verified in the client code, Nov 7, 2026)
User-owned tables and how the function deletes them:
- `friendships` — rows where the user is `user_id` OR `friend_id`.
- `weezer_rankings` — keyed by `user_id`.
- `fanhood` — keyed by `user_id` (added Oct 27, 2026; the delete step
  was added to `index.ts` in Build 6 — the original prep predated it).
- `profiles` — keyed by `id`.
- `app_events` (analytics, Nov 7) needs NO step: its `user_id` is
  `ON DELETE SET NULL`, so deleting the auth user anonymizes those
  rows. The community aggregate tables hold no per-user rows.
If a new user-owned table is ever added, add its delete step to
`index.ts` in the same change.

## Deploy + verify (owner-gated — do not run without Mark's go)
1. Deploy: `supabase functions deploy delete-account` (project ref
   `qjzusagaxuwpleybxqzg`). `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY` are provided to functions
   automatically; the service-role key must never reach the browser.
2. Throwaway test: create a throwaway account; rank some songs;
   play the lore game once (creates its `fanhood` row); add a
   friendship with a real account. Sign in as the throwaway and call
   the function (the drawer's flow, or
   `supabase.functions.invoke('delete-account')` from a session).
   Confirm afterwards, in the dashboard/SQL:
   - the auth user is gone;
   - the `profiles`, `weezer_rankings`, and `fanhood` rows are gone;
   - no `friendships` rows reference the user in either column;
   - the friend's view no longer shows the account;
   - any `app_events` rows for the user now carry `user_id = null`.
3. Also test the failure face: call the function with no/invalid
   JWT and confirm a 401 with `{ "error": "Not signed in" }`, and
   confirm a signed-in caller can never delete anyone but
   themselves (the function derives the id from the JWT only).
4. Only after all of that passes: set `DELETE_ACCOUNT_BACKEND_LIVE`
   to `true` in `app/components/WeezerAccountDrawer.tsx` and ship
   the client. The drawer is already wired — invoke on confirm,
   the function's error message shown verbatim on failure, local
   state cleared + sign-out on success — the flag is the only
   change.

## Notes
- JWT verification: the function calls `auth.getUser()` with the
  caller's Authorization header, so a user can only ever delete
  themselves.
- Deletes are ordered owned-data-first, auth-user-last so a partial
  failure leaves a retryable state.
