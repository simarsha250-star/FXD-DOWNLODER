// Shared by the browser app (src/) and the serverless function (api/).
// Pure JavaScript, no dependencies, no DOM or Node-only APIs.

export const MAX_URL_LENGTH = 2048;

const PLATFORM_HOSTS = {
  youtube: ['youtube.com', 'youtu.be', 'youtube-nocookie.com'],
  tiktok: ['tiktok.com'],
  instagram: ['instagram.com', 'instagr.am'],
  facebook: ['facebook.com', 'fb.com', 'fb.watch'],
};

export const PLATFORM_NAMES = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  facebook: 'Facebook',
  direct: 'Direct file',
};

// Signed, expiring media links that belong to the platforms. FXD does not accept these:
// they are not public download links and are controlled by the platform.
const PLATFORM_CDN_HOSTS = [
  'googlevideo.com',
  'tiktokcdn.com',
  'tiktokcdn-us.com',
  'tiktokv.com',
  'muscdn.com',
  'fbcdn.net',
  'cdninstagram.com',
];

export const MEDIA_EXTENSIONS = {
  video: ['mp4', 'webm', 'mov', 'm4v', 'mkv', 'ogv'],
  audio: ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'flac'],
  image: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
  document: ['pdf', 'zip', 'txt', 'csv', 'json'],
};

const EXT_TO_TYPE = Object.fromEntries(
  Object.entries(MEDIA_EXTENSIONS).flatMap(([type, list]) => list.map((e) => [e, type])),
);

const hostIs = (host, domain) => host === domain || host.endsWith('.' + domain);

/** Pull the first URL out of pasted or shared text ("Look at this https://… !"). */
export function extractUrl(text) {
  const raw = String(text ?? '').trim();
  const m = raw.match(/https?:\/\/[^\s<>"']+/i);
  if (m) return m[0].replace(/[.,;:!?)\]}]+$/, '');
  return raw;
}

function fail(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

function youtube(url) {
  const host = url.hostname;
  const idRe = /^[A-Za-z0-9_-]{11}$/;
  const parts = url.pathname.split('/').filter(Boolean);
  if (host === 'youtu.be') {
    return idRe.test(parts[0] || '') ? { kind: 'video', id: parts[0] } : null;
  }
  if (parts[0] === 'watch') {
    const v = url.searchParams.get('v') || '';
    return idRe.test(v) ? { kind: 'video', id: v } : null;
  }
  if (['shorts', 'live', 'embed', 'v'].includes(parts[0])) {
    return idRe.test(parts[1] || '') ? { kind: parts[0] === 'shorts' ? 'short' : 'video', id: parts[1] } : null;
  }
  return null;
}

function tiktok(url) {
  const host = url.hostname;
  const path = url.pathname;
  if (host === 'vm.tiktok.com' || host === 'vt.tiktok.com') {
    const code = path.split('/').filter(Boolean)[0];
    return code ? { kind: 'short-link', id: code } : null;
  }
  let m = path.match(/^\/@[^/]+\/(video|photo)\/(\d+)/);
  if (m) return { kind: m[1], id: m[2] };
  m = path.match(/^\/t\/([A-Za-z0-9]+)/);
  if (m) return { kind: 'short-link', id: m[1] };
  m = path.match(/^\/v\/(\d+)/);
  if (m) return { kind: 'video', id: m[1] };
  return null;
}

function instagram(url) {
  const m = url.pathname.match(/(?:^|\/)(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  if (!m) return null;
  return { kind: m[1] === 'p' ? 'post' : m[1] === 'tv' ? 'igtv' : 'reel', id: m[2] };
}

function facebook(url) {
  const host = url.hostname;
  const path = url.pathname;
  if (host === 'fb.watch') {
    const code = path.split('/').filter(Boolean)[0];
    return code ? { kind: 'short-link', id: code } : null;
  }
  if (/^\/watch\/?$/.test(path)) {
    const v = url.searchParams.get('v');
    return v && /^\d+$/.test(v) ? { kind: 'video', id: v } : null;
  }
  if (/^\/video\.php/.test(path)) {
    const v = url.searchParams.get('v');
    return v && /^\d+$/.test(v) ? { kind: 'video', id: v } : null;
  }
  let m = path.match(/^\/reel\/(\d+)/);
  if (m) return { kind: 'reel', id: m[1] };
  m = path.match(/^\/share\/(v|r)\/([A-Za-z0-9_-]+)/);
  if (m) return { kind: 'short-link', id: m[2] };
  m = path.match(/\/videos\/(?:[^/]+\/)?(\d+)/);
  if (m) return { kind: 'video', id: m[1] };
  return null;
}

const MATCHERS = { youtube, tiktok, instagram, facebook };

const NOT_CONTENT_HINT = {
  youtube: 'That is a YouTube address, but not a single video link. Paste a link such as youtube.com/watch?v=… or youtu.be/….',
  tiktok: 'That is a TikTok address, but not a single video link. Paste a link such as tiktok.com/@name/video/….',
  instagram: 'That is an Instagram address, but not a post or reel link. Paste a link such as instagram.com/reel/….',
  facebook: 'That is a Facebook address, but not a video link. Paste a link to a Facebook video, reel or watch page.',
};

/**
 * Validate and classify a pasted link.
 * Returns { ok:true, url, platform, kind, id, ... } or { ok:false, code, message }.
 */
export function validateUrl(input) {
  let text = extractUrl(input);
  if (!text) return fail('empty', 'Paste a link first.');
  if (text.length > MAX_URL_LENGTH) return fail('too_long', 'That link is too long to be valid.');
  if (/\s/.test(text)) return fail('invalid_url', 'That does not look like a single web address.');

  // Allow "youtube.com/watch?v=…" without a scheme.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) {
    if (/^[^/\s]+\.[a-z]{2,}(?::\d+)?(?:[/?#]|$)/i.test(text)) text = 'https://' + text;
    else return fail('invalid_url', 'That does not look like a web address.');
  }

  let url;
  try {
    url = new URL(text);
  } catch {
    return fail('invalid_url', 'That does not look like a valid web address.');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return fail('unsupported_protocol', 'Only http and https links are supported.');
  }
  if (url.username || url.password) {
    return fail('credentials_in_url', 'Links that contain a username or password are not accepted.');
  }

  const host = url.hostname.toLowerCase();
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':');
  if (!host.includes('.') || isIp || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) {
    return fail('private_host', 'Local, internal and IP-address links are not accepted.');
  }

  if (PLATFORM_CDN_HOSTS.some((d) => hostIs(host, d))) {
    return fail(
      'platform_cdn',
      'This is a platform media-server link (signed and temporary). FXD does not accept these. Use the original post link, or the platform’s own authorized download option.',
    );
  }

  for (const [platform, domains] of Object.entries(PLATFORM_HOSTS)) {
    if (!domains.some((d) => hostIs(host, d))) continue;
    const hit = MATCHERS[platform](url);
    if (!hit) return fail('not_content', NOT_CONTENT_HINT[platform], { platform });
    return { ok: true, url: url.toString(), host, platform, kind: hit.kind, id: hit.id };
  }

  const ext = (url.pathname.split('/').pop() || '').split('.').pop().toLowerCase();
  if (EXT_TO_TYPE[ext] && url.pathname.includes('.')) {
    return { ok: true, url: url.toString(), host, platform: 'direct', kind: 'file', fileType: EXT_TO_TYPE[ext], ext };
  }

  return fail(
    'unsupported_site',
    'FXD recognises YouTube, TikTok, Instagram and Facebook links, and direct links to files (for example .mp4, .mp3, .jpg, .pdf).',
  );
}

/** Canonical URL used when asking an official oEmbed endpoint. */
export function canonicalUrl(result) {
  if (result.platform === 'youtube' && result.id) return `https://www.youtube.com/watch?v=${result.id}`;
  return result.url;
}

export function isPlatform(name) {
  return Object.prototype.hasOwnProperty.call(PLATFORM_HOSTS, name);
}
