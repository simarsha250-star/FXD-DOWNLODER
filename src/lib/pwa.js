// Install-prompt and service-worker plumbing.
//
// `beforeinstallprompt` can fire before React has mounted, so it is captured here at start-up
// and exposed as a tiny store. The install button only exists while the browser has actually
// handed us a prompt, so there is never a button that does nothing.

const listeners = new Set();
let deferredPrompt = null;
let state = { canPrompt: false, installed: false, outcome: null };
let started = false;

function set(patch) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getSnapshot = () => state;

/** True when the page is running as an installed app (all major browsers, including iOS). */
export function isStandalone(win = globalThis.window) {
  try {
    if (!win) return false;
    if (win.navigator && win.navigator.standalone === true) return true;
    if (typeof win.matchMedia !== 'function') return false;
    return ['standalone', 'fullscreen', 'minimal-ui'].some((m) => win.matchMedia(`(display-mode: ${m})`).matches);
  } catch {
    return false;
  }
}

export function initPwa(win = window) {
  if (started) return;
  started = true;
  set({ installed: isStandalone(win) });

  win.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    set({ canPrompt: true });
  });
  win.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    set({ canPrompt: false, installed: true, outcome: 'accepted' });
  });

  if (typeof win.matchMedia === 'function') {
    const mq = win.matchMedia('(display-mode: standalone)');
    if (mq && typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', () => set({ installed: isStandalone(win) }));
    }
  }
}

/** Show the browser's own install dialog. Resolves 'accepted', 'dismissed', 'unavailable' or 'error'. */
export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable';
  const event = deferredPrompt;
  deferredPrompt = null; // a prompt event can only be used once
  set({ canPrompt: false });
  try {
    await event.prompt();
    const choice = await event.userChoice;
    set({ outcome: choice.outcome });
    return choice.outcome;
  } catch {
    return 'error';
  }
}

/** Register the service worker. Production builds only, so dev never serves stale files. */
export function registerServiceWorker() {
  const isProd = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD;
  if (!isProd || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      /* The app works without a service worker; it just will not run offline. */
    });
  });
}
