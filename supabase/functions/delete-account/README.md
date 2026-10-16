# delete-account Edge Function — PREP ONLY, NOT DEPLOYED

Status: code written 2026-10-15 (overnight prep). **Not deployed.**
The Account drawer's delete button must stay disabled until every step
below is done and verified with a throwaway account.

## Before deploying — verify against the live schema
1. `friendships` columns are `user_id` / `friend_id` (confirmed in
   WeezerContext's queries) — the delete filter uses both. If columns
   are ever renamed, update the `.or()` filter in `index.ts`.
2. `weezer_rankings` is keyed by `user_id` and `profiles` by `id`
   (both confirmed in the client code).
3. Any other user-owned tables added since must be added to the delete
   steps in `index.ts`.

## Deploy (when Mark approves)
1. `supabase functions deploy delete-account` (project ref
   `qjzusagaxuwpleybxqzg`). `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY` are provided to functions automatically;
   the service-role key must never reach the browser.
2. Create a throwaway account, rank songs, add a friendship, then call
   the function with that account's JWT and confirm: auth user gone,
   profile/rankings/friendships rows gone, the friend's view no longer
   shows the account.
3. Only then wire the drawer: replace the disabled button's handler
   with `supabase.functions.invoke('delete-account')`, sign the user
   out on success, and show the error message verbatim on failure.

## Notes
- JWT verification: the function calls `auth.getUser()` with the
  caller's Authorization header, so a user can only ever delete
  themselves.
- Deletes are ordered owned-data-first, auth-user-last so a partial
  failure leaves a retryable state.
