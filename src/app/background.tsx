// Jobs that run quietly in the background while the app is open.
import { useEffect, useRef, useState } from 'react';
import { outfitStore, useOutfits } from '../lib/store';
import { fetchPreview } from '../lib/preview';
import { autoTitle } from '../lib/links';
import { useAuth } from './auth';

// Uploads changes shortly after you make them, and checks for changes from your
// other devices when the app is opened, comes back online, or every minute.
export function useBackgroundSync() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    let debounce: number | undefined;
    const syncSoon = () => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => void outfitStore.sync(), 800);
    };
    const unsubscribe = outfitStore.subscribe(() => {
      const s = outfitStore.getSyncState();
      if (s.pending > 0 && s.status !== 'syncing' && s.status !== 'error') syncSoon();
    });
    const syncNow = () => void outfitStore.sync();
    const onVisible = () => document.visibilityState === 'visible' && syncNow();
    window.addEventListener('online', syncNow);
    document.addEventListener('visibilitychange', onVisible);
    const every = window.setInterval(() => document.visibilityState === 'visible' && syncNow(), 60_000);
    return () => {
      unsubscribe();
      window.clearTimeout(debounce);
      window.clearInterval(every);
      window.removeEventListener('online', syncNow);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user]);
}

// Looks up a picture and title for saves that don't have one yet, one at a time.
export function usePreviewFiller() {
  const { user } = useAuth();
  const outfits = useOutfits();
  const tried = useRef(new Set<string>());
  const busy = useRef(false);
  const [round, setRound] = useState(0); // bumps after each lookup so the next one starts

  useEffect(() => {
    if (busy.current) return;
    const next = outfits.find((o) => o.image === null && !tried.current.has(o.id + (user?.id ?? '')));
    if (!next) return;
    busy.current = true;
    tried.current.add(next.id + (user?.id ?? ''));
    fetchPreview(next.url)
      .then((preview) => {
        if (!preview) return; // couldn't look right now; try again later (e.g. after signing in)
        const current = outfitStore.get(next.id);
        if (!current || current.image !== null) return;
        const keepTitle = current.title && current.title !== autoTitle(current.url);
        outfitStore.update(next.id, {
          image: preview.image ?? '',
          title: keepTitle || !preview.title ? current.title : preview.title
        });
      })
      .finally(() => {
        busy.current = false;
        setRound((r) => r + 1);
      });
  }, [outfits, user, round]);
}
