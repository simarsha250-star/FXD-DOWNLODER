// GET /api/oembed?url=<post link>
//
// Looks up a title, author and thumbnail through each platform's OFFICIAL oEmbed service.
// It never returns a video file or a download link, and it only ever calls fixed hosts
// (youtube.com, tiktok.com, graph.facebook.com), so it cannot be used to fetch arbitrary URLs.
//
//  - YouTube and TikTok: public oEmbed, no credentials.
//  - Instagram and Facebook: Meta oEmbed Read. Needs META_OEMBED_TOKEN, and a Meta app that
//    Meta has approved for that feature. Without it this answers 501 "not_configured".
//
// Written against plain Node req/res so it runs on Vercel and in `npm run dev` alike.

import { validateUrl, canonicalUrl, PLATFORM_NAMES } from '../shared/platforms.js';

const TIMEOUT_MS = 6000;
const MAX_BODY_CHARS = 200_000;

function send(res, status, body, cache = 'no-store') {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

const fail = (res, status, code, message) => send(res, status, { ok: false, code, message });

function stripQuery(raw) {
  const u = new URL(raw);
  u.search = '';
  u.hash = '';
  return u.toString();
}

/** Decide which official endpoint to call. Returns { endpoint } or { error: [status, code, message] }. */
export function buildProviderRequest(check, env) {
  const { platform, kind } = check;

  if (platform === 'youtube') {
    const u = new URL('https://www.youtube.com/oembed');
    u.searchParams.set('url', canonicalUrl(check));
    u.searchParams.set('format', 'json');
    return { endpoint: u };
  }

  if (platform === 'tiktok') {
    const u = new URL('https://www.tiktok.com/oembed');
    u.searchParams.set('url', stripQuery(check.url));
    return { endpoint: u };
  }

  if (platform === 'instagram' || platform === 'facebook') {
    const token = env.META_OEMBED_TOKEN;
    if (!token) {
      return {
        error: [
          501,
          'not_configured',
          `${PLATFORM_NAMES[platform]} previews need Meta oEmbed credentials on the server. See the README section "Integrations that need credentials".`,
        ],
      };
    }
    const version = env.META_GRAPH_VERSION ? `${env.META_GRAPH_VERSION.replace(/\/+$/, '')}/` : '';
    let path;
    if (platform === 'instagram') path = 'instagram_oembed';
    else if (kind === 'video' || kind === 'reel') path = 'oembed_video';
    else return { error: [422, 'unsupported_kind', 'Previews are only available for Facebook videos and reels.'] };

    const u = new URL(`https://graph.facebook.com/${version}${path}`);
    u.searchParams.set('url', platform === 'instagram' ? stripQuery(check.url) : check.url);
    u.searchParams.set('access_token', token);
    u.searchParams.set('omitscript', 'true');
    return { endpoint: u };
  }

  return { error: [400, 'not_a_platform_link', 'Previews are only available for platform links.'] };
}

const text = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

function safeHttpsUrl(v) {
  if (typeof v !== 'string' || v.length > 2048) return null;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function createHandler({ fetchImpl = globalThis.fetch, env = process.env } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      return fail(res, 405, 'method_not_allowed', 'Use GET.');
    }

    let input;
    try {
      input = new URL(req.url || '', 'http://localhost').searchParams.get('url');
    } catch {
      return fail(res, 400, 'invalid_url', 'The request could not be read.');
    }

    const check = validateUrl(input);
    if (!check.ok) return fail(res, 400, check.code, check.message);
    if (check.platform === 'direct') {
      return fail(res, 400, 'not_a_platform_link', 'Previews are only available for platform links.');
    }
    if (check.kind === 'short-link') {
      return fail(res, 422, 'short_link', 'Open the short link first, then paste the full address.');
    }

    const built = buildProviderRequest(check, env);
    if (built.error) return fail(res, ...built.error);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let upstream;
    let body;
    try {
      upstream = await fetchImpl(built.endpoint, {
        headers: { Accept: 'application/json', 'User-Agent': 'FXD-Downloader/1.0 (oEmbed preview)' },
        signal: controller.signal,
      });
      body = await upstream.text();
    } catch (err) {
      if (err && err.name === 'AbortError') {
        return fail(res, 504, 'timeout', 'The platform took too long to answer.');
      }
      return fail(res, 502, 'upstream_error', 'The platform could not be reached.');
    } finally {
      clearTimeout(timer);
    }

    if (upstream.status === 401 || upstream.status === 403 || upstream.status === 404) {
      return fail(
        res,
        404,
        'unavailable',
        'The platform did not return a preview. The post may be private, removed or age-restricted.',
      );
    }
    if (!upstream.ok) return fail(res, 502, 'upstream_error', `The platform answered ${upstream.status}.`);
    if (body.length > MAX_BODY_CHARS) return fail(res, 502, 'upstream_error', 'The platform answer was too large.');

    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return fail(res, 502, 'upstream_error', 'The platform answer could not be read.');
    }

    // Return a small, sanitised subset. The embed HTML and any tokens are never passed on.
    return send(
      res,
      200,
      {
        ok: true,
        provider: PLATFORM_NAMES[check.platform],
        title: text(data.title, 300),
        author: text(data.author_name, 120),
        thumbnail: safeHttpsUrl(data.thumbnail_url),
      },
      'public, s-maxage=600, stale-while-revalidate=3600',
    );
  };
}

export default createHandler();
