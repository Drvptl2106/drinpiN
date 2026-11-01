// Things that happen once, as the app opens:
// - a link shared from another app is saved straight away ("one-tap save"),
// - saves from the first version of drinpiN are brought over,
// - brand-new visitors see the welcome screen.
import { outfitStore } from '../lib/store';
import { autoTitle, findLink, normaliseUrl, sameLinkKey, usefulTitle, youtubeThumb } from '../lib/links';
import { takeOldOutfits } from '../lib/legacy';

export const WELCOMED_KEY = 'drinpin.welcomed';
export const startupMessages: string[] = [];

function go(hash: string) {
  // Replace the address (dropping the ?url=… part) so a reload doesn't save again.
  history.replaceState(null, '', location.pathname + hash);
}

// Returns true if the app was opened from the Share menu.
function saveSharedLink(): boolean {
  const params = new URLSearchParams(location.search);
  if (!params.has('url') && !params.has('text') && !params.has('title')) return false;

  const sharedTitle = params.get('title') ?? '';
  const sharedText = params.get('text') ?? '';
  const raw = findLink([params.get('url'), sharedText, sharedTitle].filter(Boolean).join(' '));
  const url = normaliseUrl(raw);
  if (!url) {
    startupMessages.push('No link found in what you shared. Paste it below.');
    go('#/new');
    return true;
  }

  const existing = outfitStore.getAll().find((o) => sameLinkKey(o.url) === sameLinkKey(url));
  if (existing) {
    go(`#/o/${existing.id}?saved=already`);
    return true;
  }

  const title = sharedTitle && !/https?:\/\//i.test(sharedTitle) && usefulTitle(sharedTitle, url) ? sharedTitle : autoTitle(url);
  const outfit = outfitStore.add({
    url,
    title: title.slice(0, 300),
    note: sharedText.replace(raw, '').trim().slice(0, 1000),
    image: youtubeThumb(url)
  });
  go(`#/o/${outfit.id}?saved=new`);
  return true;
}

export function runStartup() {
  const old = takeOldOutfits();
  if (old.length) {
    const n = outfitStore.importMany(old);
    if (n) startupMessages.push(`Welcome to the new drinpiN. Your ${n} ${n === 1 ? 'outfit is' : 'outfits are'} here.`);
  }

  const shared = saveSharedLink();
  let welcomed = false;
  try {
    welcomed = Boolean(localStorage.getItem(WELCOMED_KEY));
    if (shared || old.length || outfitStore.getAll().length) localStorage.setItem(WELCOMED_KEY, '1');
  } catch {
    welcomed = true;
  }
  if (!shared && !welcomed && !outfitStore.getAll().length) go('#/welcome');
}
