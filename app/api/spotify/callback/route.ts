/**
 * Spotify OAuth landing (PKCE). Spotify redirects the fan
 * here with ?code=&state=. This route returns a tiny page
 * whose script finishes the token exchange in the browser
 * (verifier + state live in localStorage from the connect
 * click), parks the tokens under 'weezer-spotify-pending'
 * for the app to adopt into the fan's account row, and
 * bounces home. On any failure it bounces home with
 * ?spotify=error.
 */
export async function GET() {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Connecting Spotify…</title>
<style>
  body { font-family: system-ui, sans-serif; background: #039AD1; color: #0C1220;
         display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  p { font-weight: 800; font-size: 16px; }
</style>
</head>
<body>
<p>Connecting Spotify…</p>
<script>
(async function () {
  function fail() { window.location.replace('/?spotify=error'); }
  try {
    var params = new URLSearchParams(window.location.search);
    var code = params.get('code');
    var state = params.get('state');
    var savedState = null, verifier = null;
    try {
      savedState = localStorage.getItem('weezer-spotify-state');
      verifier = localStorage.getItem('weezer-spotify-verifier');
    } catch (e) {}
    if (!code || !verifier || !state || state !== savedState) { fail(); return; }

    var cfgRes = await fetch('/api/spotify/config');
    var cfg = await cfgRes.json();
    if (!cfg.clientId) { fail(); return; }

    var redirectUri = window.location.origin + '/api/spotify/callback';
    var body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: cfg.clientId,
      code_verifier: verifier
    });
    var res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
    if (!res.ok) { fail(); return; }
    var tokens = await res.json();
    try {
      localStorage.setItem('weezer-spotify-pending', JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in
      }));
      localStorage.removeItem('weezer-spotify-verifier');
      localStorage.removeItem('weezer-spotify-state');
    } catch (e) {}
    window.location.replace('/?spotify=connected');
  } catch (e) {
    fail();
  }
})();
</script>
</body>
</html>`;
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
