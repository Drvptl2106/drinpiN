// Remembers Android's "install this app" offer so the Profile page can show an Install button.
import { useSyncExternalStore } from 'react';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let offer: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  offer = e as InstallPromptEvent;
  emit();
});
window.addEventListener('appinstalled', () => {
  offer = null;
  emit();
});

export function useInstallOffer() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => offer
  );
}

export async function install() {
  if (!offer) return;
  await offer.prompt();
  await offer.userChoice.catch(() => undefined);
  offer = null;
  emit();
}

export const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

export const isIPhone = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
