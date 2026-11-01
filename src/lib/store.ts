// The one outfit store the whole app shares, plus React hooks to read it.
import { useSyncExternalStore } from 'react';
import { OutfitStore, type KeyValueStorage } from './outfitStore';

// If the browser blocks storage (rare private modes), keep data in memory for this visit.
function deviceStorage(): KeyValueStorage {
  try {
    const probe = '__drinpin_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    const memory = new Map<string, string>();
    return {
      getItem: (k) => memory.get(k) ?? null,
      setItem: (k, v) => void memory.set(k, v),
      removeItem: (k) => void memory.delete(k)
    };
  }
}

export const outfitStore = new OutfitStore(deviceStorage());

export function useOutfits() {
  return useSyncExternalStore(outfitStore.subscribe, outfitStore.getAll);
}

export function useOutfit(id: string | undefined) {
  useOutfits(); // re-render on changes
  return id ? outfitStore.get(id) : null;
}

export function useSyncState() {
  return useSyncExternalStore(outfitStore.subscribe, outfitStore.getSyncState);
}
