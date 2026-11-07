// Browser and device detection from the user agent. Pure, so it can be unit tested.
// Used only to choose the right install and save instructions, never to block anything.

export function detectEnv({ ua = '', platform = '', maxTouchPoints = 0 } = {}) {
  // iPadOS 13+ reports a desktop Mac user agent; touch points give it away.
  const iPadDesktopMode = platform === 'MacIntel' && maxTouchPoints > 1;
  const ios = /iPhone|iPad|iPod/.test(ua) || iPadDesktopMode;
  const android = /Android/i.test(ua);

  let os = 'other';
  if (ios) os = 'ios';
  else if (android) os = 'android';
  else if (/Windows/i.test(ua)) os = 'windows';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'mac';
  else if (/CrOS/.test(ua)) os = 'chromeos';
  else if (/Linux/i.test(ua)) os = 'linux';

  // In-app browsers (links opened inside another app) cannot install web apps.
  let inApp = null;
  if (/FBAN|FBAV|FB_IAB/.test(ua)) inApp = 'Facebook';
  else if (/Instagram/i.test(ua)) inApp = 'Instagram';
  else if (/musical_ly|BytedanceWebview|TikTok/i.test(ua)) inApp = 'TikTok';
  else if (android && /; wv\)/.test(ua)) inApp = 'this app';

  let browser = 'other';
  if (/SamsungBrowser/i.test(ua)) browser = 'samsung';
  else if (/EdgA|EdgiOS|Edg\//.test(ua)) browser = 'edge';
  else if (/OPR\/|OPiOS|OPT\//.test(ua)) browser = 'opera';
  else if (/FxiOS|Firefox\//.test(ua)) browser = 'firefox';
  else if (/CriOS|Chrome\//.test(ua)) browser = 'chrome';
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = 'safari';

  let iosVersion = null;
  if (ios) {
    const m = iPadDesktopMode ? ua.match(/Version\/(\d+)\.(\d+)/) : ua.match(/OS (\d+)[_.](\d+)/);
    if (m) iosVersion = { major: Number(m[1]), minor: Number(m[2]) };
  }

  return { os, browser, inApp, ios, android, iosVersion };
}

export function getEnv() {
  if (typeof navigator === 'undefined') return detectEnv();
  return detectEnv({
    ua: navigator.userAgent || '',
    platform: navigator.platform || '',
    maxTouchPoints: navigator.maxTouchPoints || 0,
  });
}

const BROWSER_NAMES = {
  chrome: 'Chrome',
  samsung: 'Samsung Internet',
  safari: 'Safari',
  firefox: 'Firefox',
  edge: 'Edge',
  opera: 'Opera',
  other: 'your browser',
};
const OS_NAMES = {
  ios: 'iPhone or iPad',
  android: 'Android',
  windows: 'Windows',
  mac: 'Mac',
  linux: 'Linux',
  chromeos: 'ChromeOS',
  other: 'this device',
};

/** "Chrome on Android" */
export function envLabel(env) {
  if (env.inApp) return `the ${env.inApp} in-app browser`;
  return `${BROWSER_NAMES[env.browser]} on ${OS_NAMES[env.os]}`;
}
