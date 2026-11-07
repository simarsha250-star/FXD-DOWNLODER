// Platform-specific "how to install" steps, shown only when the browser has not offered
// its own install prompt. Pure, so it can be unit tested.

export const INSTALL_FOOTNOTE =
  'Whether you can install depends on your browser, device and version. FXD also works as a normal website without installing.';

const SAFARI_IOS_STEPS = [
  'Tap the Share button, the square with an arrow pointing up.',
  'Scroll down and tap Add to Home Screen.',
  'Tap Add. FXD Downloader now opens from your Home Screen like an app.',
];

export function getInstallGuide(env) {
  if (env.inApp) {
    const where = env.ios ? 'Safari' : 'Chrome or your default browser';
    return {
      id: 'in-app',
      title: 'Open FXD in your browser first',
      steps: [
        `You are inside ${env.inApp}, which cannot install apps.`,
        `Open this page's menu, then choose Open in browser or Open in ${where}.`,
        'Then follow the install steps for that browser.',
      ],
    };
  }

  if (env.ios) {
    if (env.browser === 'safari') {
      return { id: 'ios-safari', title: 'Install on iPhone or iPad with Safari', steps: SAFARI_IOS_STEPS };
    }
    const v = env.iosVersion;
    const canAddFromOtherBrowsers = v && (v.major > 16 || (v.major === 16 && v.minor >= 4));
    if (canAddFromOtherBrowsers) {
      return {
        id: 'ios-other',
        title: 'Install on iPhone or iPad',
        steps: [
          'Tap the Share button in your browser.',
          'Tap Add to Home Screen, then Add.',
          'If you do not see Add to Home Screen, open this page in Safari and use the steps there.',
        ],
      };
    }
    return {
      id: 'ios-open-safari',
      title: 'Install on iPhone or iPad with Safari',
      steps: ['On this version of iOS, only Safari can add web apps. Open this page in Safari.', ...SAFARI_IOS_STEPS],
    };
  }

  if (env.android) {
    switch (env.browser) {
      case 'samsung':
        return {
          id: 'android-samsung',
          title: 'Install with Samsung Internet',
          steps: [
            'If an install icon appears in the address bar, tap it and confirm.',
            'Otherwise tap the menu, then Add page to, then Home screen.',
            'Confirm the name and tap Add.',
          ],
        };
      case 'chrome':
        return {
          id: 'android-chrome',
          title: 'Install with Chrome on Android',
          steps: [
            'Tap the three-dot menu at the top right.',
            'Tap Install app. If you only see Add to Home screen, use that.',
            'Confirm. FXD Downloader appears in your app drawer and Home screen.',
          ],
        };
      case 'firefox':
        return {
          id: 'android-firefox',
          title: 'Install with Firefox on Android',
          steps: ['Tap the three-dot menu.', 'Tap Install.', 'Confirm.'],
        };
      default:
        return {
          id: 'android-other',
          title: 'Install on Android',
          steps: [
            'Open your browser menu.',
            'Look for Install app or Add to Home screen.',
            'If you cannot find either, open this page in Chrome.',
          ],
        };
    }
  }

  if (env.browser === 'chrome' || env.browser === 'edge') {
    return {
      id: 'desktop-chromium',
      title: `Install with ${env.browser === 'edge' ? 'Edge' : 'Chrome'}`,
      steps: [
        'Click the install icon at the right end of the address bar.',
        'Or open the browser menu and choose Install FXD Downloader.',
        'Confirm. The app opens in its own window.',
      ],
    };
  }
  if (env.browser === 'safari' && env.os === 'mac') {
    return {
      id: 'desktop-safari',
      title: 'Install with Safari on Mac',
      steps: ['Open the File menu.', 'Choose Add to Dock.', 'Confirm the name and click Add.'],
      note: 'Needs macOS Sonoma (14) or later.',
    };
  }
  if (env.browser === 'firefox') {
    return {
      id: 'desktop-firefox',
      title: 'Firefox on desktop',
      steps: [
        'Firefox on desktop has no install option for web apps, so keep using FXD in a tab.',
        'To install it, open this page in Chrome or Edge.',
      ],
    };
  }
  return {
    id: 'generic',
    title: 'Install this app',
    steps: [
      'Open your browser menu and look for Install, Install app or Add to Home screen.',
      'If you cannot find it, try Chrome, Edge or Safari.',
    ],
  };
}
