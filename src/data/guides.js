// What FXD tells people about each link. Everything here is guidance toward the platform's
// own authorized features. FXD never builds or guesses a video download URL: the only links
// produced are the user's own pasted link and a few official platform pages.

import { PLATFORM_NAMES } from '../../shared/platforms.js';

const KIND_LABELS = {
  video: 'video',
  short: 'Short',
  reel: 'reel',
  post: 'post',
  igtv: 'video',
  photo: 'photo',
  'short-link': 'short link',
  file: 'file',
};

/** Hosts FXD is allowed to link to besides the user's own pasted link. */
export const OFFICIAL_LINK_HOSTS = ['studio.youtube.com', 'takeout.google.com'];

export function describeResult(check) {
  if (check.platform === 'direct') {
    return { title: `${check.ext.toUpperCase()} file`, source: check.host };
  }
  const name = PLATFORM_NAMES[check.platform];
  return {
    title: `${name} ${KIND_LABELS[check.kind] || 'link'}`,
    source: check.id ? `${check.host}, ${shortId(check.id)}` : check.host,
  };
}

const shortId = (id) => (id.length > 14 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id);

/** tone: 'go' (can download here), 'hold' (restricted), 'info' (needs one more step) */
export function getVerdict(check) {
  if (check.platform === 'direct') {
    return {
      tone: 'go',
      stamp: 'Direct file',
      title: 'You can download this here',
      body: 'FXD fetches the file in your browser, then hands it to your device. Only save files you own or have permission to use.',
    };
  }
  const name = PLATFORM_NAMES[check.platform];
  if (check.kind === 'short-link') {
    return {
      tone: 'info',
      stamp: 'Short link',
      title: 'Open it once to get the full address',
      body: `${name} short links hide the real address. Open it, copy the full link from the address bar, and paste that here.`,
    };
  }
  return {
    tone: 'hold',
    stamp: 'Restricted',
    title: `FXD does not download from ${name}`,
    body: `${name} restricts copying its videos, and FXD does not bypass those controls. These are the authorized ways to get this one.`,
  };
}

const PLATFORM_GUIDE = {
  youtube: {
    inApp: {
      title: 'Download inside the YouTube app',
      body: 'With YouTube Premium, the YouTube app can save videos for offline viewing where the creator and your region allow it. These downloads play inside the app only.',
    },
    own: {
      title: 'If it is your own video',
      body: 'Sign in to YouTube Studio, open Content, choose the video and use its menu to download the original. Google Takeout exports everything you have uploaded.',
      links: [
        { label: 'Open YouTube Studio', href: 'https://studio.youtube.com' },
        { label: 'Open Google Takeout', href: 'https://takeout.google.com' },
      ],
    },
    api: 'The YouTube Data API can read video details, but it has no endpoint that downloads someone else’s video.',
  },
  tiktok: {
    inApp: {
      title: 'Use Save video in the TikTok app',
      body: 'Open the video in the TikTok app, tap Share, then Save video. The option only appears when the creator allows downloads.',
    },
    own: {
      title: 'If it is your own video',
      body: 'Save your own videos from the same Share menu, or request an export of your account data under Settings and privacy in the app. Menu names vary by app version.',
    },
    api: 'TikTok’s developer APIs need an approved app, and the creator must sign in and grant permission before your app can touch their videos.',
  },
  instagram: {
    inApp: {
      title: 'Use the download option in Instagram',
      body: 'For some public reels, the Instagram app offers a download option in the Share menu when the creator allows it. It depends on your app version and region.',
    },
    own: {
      title: 'If it is your own post or reel',
      body: 'Open your profile, choose the post and use its menu to save it to your device, or request a copy of your data from Accounts Center under Your information and permissions.',
    },
    api: 'Meta’s Graph API can return media for accounts that sign in to your app and grant permission. It needs a Meta developer app and app review.',
  },
  facebook: {
    inApp: {
      title: 'Use Save video in Facebook',
      body: 'Facebook’s Save option keeps the video in your Saved items inside Facebook. It does not put a file on your device.',
    },
    own: {
      title: 'If it is your own video',
      body: 'Open your video from your profile or Page and check its menu for a download option, or request a copy of your information from Accounts Center under Your information and permissions.',
    },
    api: 'Meta’s Graph API can return videos for Pages and accounts that sign in to your app and grant permission. It needs a Meta developer app and app review.',
  },
};

/** The authorized options for a platform link. Empty for direct files. */
export function getOptions(check) {
  if (check.platform === 'direct') return [];
  const name = PLATFORM_NAMES[check.platform];
  const guide = PLATFORM_GUIDE[check.platform];

  const options = [
    {
      id: 'open',
      title: `Watch it on ${name}`,
      body: `Open the original post on ${name}, where the creator’s settings and your account decide what you can do.`,
      links: [{ label: `Open on ${name}`, href: check.url }],
    },
  ];
  if (check.kind === 'short-link') return options;

  options.push(
    { id: 'in-app', ...guide.inApp },
    { id: 'own', ...guide.own },
    {
      id: 'permission',
      title: 'If it belongs to someone else',
      body: 'Ask the creator to send you the original file, or for written permission to use their video. That is the reliable way to get a clean copy.',
    },
    {
      id: 'api',
      title: 'For developers: authorized API access',
      body: `${guide.api} FXD does not include this integration. The README explains what it would need.`,
    },
  );
  return options;
}
