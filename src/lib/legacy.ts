// Moves saves from the first version of drinpiN (stored under "saver.items")
// into this version. Reels are no longer part of the app, so only outfits move.
// The old data is left untouched, just in case.
import { cleanOutfit } from './outfitStore';
import { isUuid, newId } from './links';
import type { Outfit } from './types';

const OLD_KEY = 'saver.items';
const DONE_KEY = 'drinpin.v2.migrated';

interface OldItem {
  id?: string;
  type?: string;
  url?: string;
  title?: string;
  note?: string;
  status?: string;
  pieces?: { category: string; name: string }[];
  budget?: string;
  createdAt?: string;
}

// Turns old-format items (also found in old backup files) into outfits.
export function convertOldItems(list: OldItem[]): Outfit[] {
  return list
    .filter((i) => i && i.type !== 'reel' && typeof i.url === 'string' && i.url)
    .map((i) =>
      cleanOutfit({
        id: i.id && isUuid(i.id) ? i.id : newId(),
        url: i.url!,
        title: i.title ?? '',
        note: i.note ?? '',
        status: i.status as Outfit['status'],
        pieces: (i.pieces ?? []) as Outfit['pieces'],
        budget: i.budget ?? '',
        image: null,
        created_at: i.createdAt,
        updated_at: i.createdAt,
        deleted_at: null
      })
    );
}

// Returns the outfits to bring over (only the first time this runs on a device).
export function takeOldOutfits(): Outfit[] {
  try {
    if (localStorage.getItem(DONE_KEY)) return [];
    localStorage.setItem(DONE_KEY, new Date().toISOString());
    const list = JSON.parse(localStorage.getItem(OLD_KEY) ?? '[]');
    return Array.isArray(list) ? convertOldItems(list) : [];
  } catch {
    return [];
  }
}
