// Download / restore a backup file of your outfits.
import { cleanOutfit } from './outfitStore';
import { convertOldItems } from './legacy';
import { isUuid, newId } from './links';
import type { Outfit } from './types';

export function downloadBackup(outfits: Outfit[]) {
  const data = { app: 'drinpiN', version: 2, exportedAt: new Date().toISOString(), outfits };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `drinpin-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// Reads a backup file from this version or the first version. Throws if it isn't one.
export function parseBackup(text: string): Outfit[] {
  const data = JSON.parse(text);
  if (Array.isArray(data?.outfits)) {
    return data.outfits
      .filter((o: Partial<Outfit>) => o && typeof o.url === 'string')
      .map((o: Outfit) => cleanOutfit({ ...o, id: isUuid(o.id) ? o.id : newId(), deleted_at: null }));
  }
  const old = Array.isArray(data) ? data : data?.items;
  if (Array.isArray(old)) return convertOldItems(old);
  throw new Error('Not a drinpiN backup');
}
