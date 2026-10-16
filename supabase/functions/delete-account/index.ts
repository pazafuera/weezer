// PREP ONLY — NOT DEPLOYED. Do not deploy without Mark's approval.
//
// delete-account: permanently deletes the CALLER's account and data.
// The Account drawer's delete button stays disabled until this function
// is deployed and verified (see README.md in this folder).
//
// Flow:
//   1. Verify the caller's JWT (the function requires a signed-in user).
//   2. With the service-role key (server-only secret), delete the user's
//      friendships (both directions), rankings row, and profile row.
//   3. Delete the auth user itself via the Admin API.
// Any failure mid-way returns an error and is logged server-side; the
// client keeps the account intact and tells the user to try again.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';

  // Identify the caller from their own JWT — never trust a posted user id.
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Not signed in' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userId = user.id;

  // Owned data first, auth user last (if this fails the account still
  // exists and the user can retry; the deletes above are idempotent).
  const steps: Array<[string, { error: unknown }]> = [];
  steps.push([
    'friendships',
    await admin
      .from('friendships')
      .delete()
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`),
  ]);
  steps.push([
    'rankings',
    await admin.from('weezer_rankings').delete().eq('user_id', userId),
  ]);
  steps.push([
    'profile',
    await admin.from('profiles').delete().eq('id', userId),
  ]);

  for (const [name, { error }] of steps) {
    if (error) {
      console.error(`delete-account: ${name} delete failed for ${userId}`, error);
      return new Response(
        JSON.stringify({ error: `Could not delete your ${name}. Try again.` }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error('delete-account: auth delete failed', deleteError);
    return new Response(
      JSON.stringify({ error: 'Could not delete your account. Try again.' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
