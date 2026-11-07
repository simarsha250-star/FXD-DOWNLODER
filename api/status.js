// GET /api/status
//
// Tells the app which optional integrations are configured on this deployment, so the
// interface never claims a feature that is not actually switched on.
// It reports booleans and states only. It never echoes a secret.

export function buildStatus(env = process.env) {
  const meta = Boolean(env.META_OEMBED_TOKEN);
  return {
    ok: true,
    previews: {
      youtube: { state: 'ready', credentials: 'none' },
      tiktok: { state: 'ready', credentials: 'none' },
      instagram: { state: meta ? 'ready' : 'needs_setup', credentials: 'META_OEMBED_TOKEN' },
      facebook: { state: meta ? 'ready' : 'needs_setup', credentials: 'META_OEMBED_TOKEN' },
    },
    // Downloading media through platform APIs (OAuth plus platform app review) is not built.
    ownerMediaDownloads: { state: 'not_built' },
  };
}

export function createHandler({ env = process.env } = {}) {
  return function handler(req, res) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(JSON.stringify(buildStatus(env)));
  };
}

export default createHandler();
