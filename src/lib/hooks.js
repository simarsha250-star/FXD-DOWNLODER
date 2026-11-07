import { useEffect, useState, useSyncExternalStore } from 'react';
import { getSnapshot, subscribe } from './pwa.js';

export function usePwa() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
