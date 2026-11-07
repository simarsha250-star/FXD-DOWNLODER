// The "what works" table. Each row's state is computed, not hard-coded, wherever the app
// can check it, so the screen never claims more than this deployment can do.

export const STATE_LABELS = {
  works: 'Works',
  restricted: 'Restricted',
  setup: 'Needs setup',
  not_built: 'Not built',
  unknown: 'Unchecked',
};

/** @param status the /api/status response, or null when the API is not reachable */
export function buildCapabilities(status) {
  const previews = status && status.previews;
  const ytReady = previews && previews.youtube.state === 'ready' && previews.tiktok.state === 'ready';
  const metaReady = previews && previews.instagram.state === 'ready' && previews.facebook.state === 'ready';

  return [
    {
      id: 'direct',
      title: 'Direct file links',
      state: 'works',
      detail:
        'mp4, mp3, jpg, pdf and more. FXD fetches the file in your browser, so the file’s server has to allow that. When it does not, FXD says so and offers a manual fallback.',
    },
    {
      id: 'platform-downloads',
      title: 'Downloading videos from YouTube, TikTok, Instagram and Facebook',
      state: 'restricted',
      detail:
        'Not offered. The platforms restrict it and FXD does not bypass those controls. You get each platform’s own authorized options instead.',
    },
    {
      id: 'preview-open',
      title: 'Link previews for YouTube and TikTok',
      state: ytReady ? 'works' : 'unknown',
      detail: ytReady
        ? 'Title, author and thumbnail from each platform’s public oEmbed service. No credentials needed.'
        : 'Needs the /api functions that ship with this project. They are not reachable from here, so previews are off.',
    },
    {
      id: 'preview-meta',
      title: 'Link previews for Instagram and Facebook',
      state: metaReady ? 'works' : 'setup',
      detail: metaReady
        ? 'Switched on with a Meta oEmbed token on the server.'
        : 'Needs a Meta developer app approved for Meta oEmbed Read, and the META_OEMBED_TOKEN setting on the server.',
    },
    {
      id: 'owner-media',
      title: 'Downloading your own videos through platform APIs',
      state: 'not_built',
      detail:
        'Not built. It needs the account owner to sign in with OAuth, plus approval from each platform: the YouTube Data API, TikTok developer apps, and Meta’s Graph API for Instagram and Facebook.',
    },
  ];
}
