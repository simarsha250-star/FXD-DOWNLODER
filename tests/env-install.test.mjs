import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectEnv, envLabel } from '../src/lib/env.js';
import { getInstallGuide } from '../src/lib/install.js';

const UA = {
  iphone7plusSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6.1 Mobile/15E148 Safari/604.1',
  iphoneChrome18:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1',
  iphoneChrome15:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/118.0.5993.69 Mobile/15E148 Safari/604.1',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  samsung:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
  fbAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-A536B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0.0.38.108;]',
  igIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21E219 Instagram 330.0.0.20.114 (iPhone14,5; iOS 17_4; en_US)',
  winChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  winEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  winFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  ipadDesktopMode:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
};

test('iPhone 7 Plus (iOS 15.8, Safari) gets the Safari Add to Home Screen steps', () => {
  const env = detectEnv({ ua: UA.iphone7plusSafari });
  assert.deepEqual([env.os, env.browser, env.ios], ['ios', 'safari', true]);
  assert.deepEqual(env.iosVersion, { major: 15, minor: 8 });
  const guide = getInstallGuide(env);
  assert.equal(guide.id, 'ios-safari');
  assert.ok(guide.steps.some((s) => s.includes('Add to Home Screen')));
});

test('Chrome on iOS: only iOS 16.4+ can add from a non-Safari browser', () => {
  assert.equal(getInstallGuide(detectEnv({ ua: UA.iphoneChrome18 })).id, 'ios-other');
  const old = getInstallGuide(detectEnv({ ua: UA.iphoneChrome15 }));
  assert.equal(old.id, 'ios-open-safari');
  assert.ok(old.steps[0].includes('Safari'));
});

test('Android browsers', () => {
  assert.equal(getInstallGuide(detectEnv({ ua: UA.androidChrome })).id, 'android-chrome');
  assert.equal(getInstallGuide(detectEnv({ ua: UA.samsung })).id, 'android-samsung');
  assert.equal(getInstallGuide(detectEnv({ ua: UA.androidFirefox })).id, 'android-firefox');
  assert.equal(detectEnv({ ua: UA.samsung }).browser, 'samsung');
});

test('in-app browsers are told to open a real browser first', () => {
  const fb = detectEnv({ ua: UA.fbAndroid });
  assert.equal(fb.inApp, 'Facebook');
  assert.equal(getInstallGuide(fb).id, 'in-app');
  const ig = detectEnv({ ua: UA.igIos });
  assert.equal(ig.inApp, 'Instagram');
  assert.ok(getInstallGuide(ig).steps.join(' ').includes('Safari'));
});

test('desktop browsers', () => {
  assert.equal(getInstallGuide(detectEnv({ ua: UA.winChrome })).id, 'desktop-chromium');
  assert.equal(getInstallGuide(detectEnv({ ua: UA.winEdge })).id, 'desktop-chromium');
  assert.equal(getInstallGuide(detectEnv({ ua: UA.macSafari, platform: 'MacIntel' })).id, 'desktop-safari');
  const ff = getInstallGuide(detectEnv({ ua: UA.winFirefox }));
  assert.equal(ff.id, 'desktop-firefox');
  assert.ok(ff.steps.join(' ').toLowerCase().includes('no install option'));
});

test('iPadOS in desktop mode is recognised as iOS via touch points', () => {
  const env = detectEnv({ ua: UA.ipadDesktopMode, platform: 'MacIntel', maxTouchPoints: 5 });
  assert.equal(env.os, 'ios');
  assert.equal(getInstallGuide(env).id, 'ios-safari');
});

test('labels read naturally', () => {
  assert.equal(envLabel(detectEnv({ ua: UA.androidChrome })), 'Chrome on Android');
  assert.equal(envLabel(detectEnv({ ua: UA.samsung })), 'Samsung Internet on Android');
});
