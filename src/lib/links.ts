// Helpers for working with saved links.

// Bits that social apps and shops add to links to track clicks. Removed when saving.
const TRACKING_PARAMS = /^(utm_.*|igsh|igshid|si|fbclid|gclid|feature|ref_src|ref)$/i;

// Turn whatever was pasted into a clean web address, or '' if it isn't one.
// "instagram.com/p/abc?igsh=x" → "https://instagram.com/p/abc"
export function normaliseUrl(raw: string): string {
  let text = String(raw ?? '').trim();
  if (!text) return '';
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = 'https://' + text;
  try {
    const u = new URL(text);
    if ((u.protocol !== 'http:' && u.protocol !== 'https:') || u.hostname.indexOf('.') < 1) return '';
    for (const key of Array.from(u.searchParams.keys())) {
      if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
    }
    return u.href;
  } catch {
    return '';
  }
}

// Two links are "the same" if they point at the same page, ignoring "www.",
// a trailing "/", and anything after "?" (except YouTube's video id).
export function sameLinkKey(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^(www|m)\./, '') + u.pathname.replace(/\/+$/, '') + (u.searchParams.get('v') ?? '');
  } catch {
    return url;
  }
}

// Find the first web link inside some text (shared messages often include other words).
export function findLink(text: string): string {
  const match = String(text ?? '').match(/https?:\/\/[^\s<>"]+/i);
  return match ? match[0].replace(/[).,!?]+$/, '') : '';
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^(www|m)\./, '');
  } catch {
    return '';
  }
}

const SITE_NAMES: Record<string, string> = {
  instagram: 'Instagram', youtube: 'YouTube', youtu: 'YouTube', tiktok: 'TikTok',
  pinterest: 'Pinterest', pin: 'Pinterest', facebook: 'Facebook', fb: 'Facebook',
  myntra: 'Myntra', ajio: 'Ajio', amazon: 'Amazon', amzn: 'Amazon', nykaafashion: 'Nykaa Fashion',
  nykaa: 'Nykaa', flipkart: 'Flipkart', meesho: 'Meesho', zara: 'Zara', hm: 'H&M', snapchat: 'Snapchat', x: 'X', twitter: 'X'
};

// "www.instagram.com" → "Instagram"
export function siteName(url: string): string {
  const first = hostOf(url).split('.')[0] ?? '';
  if (!first) return 'Link';
  return SITE_NAMES[first] ?? first.charAt(0).toUpperCase() + first.slice(1);
}

// A default title when none is typed, e.g. "Look from Instagram".
export function autoTitle(url: string): string {
  return 'Look from ' + siteName(url);
}

// YouTube gives a thumbnail for every video without needing to look anything up.
export function youtubeThumb(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www|m)\./, '');
    let id = '';
    if (host === 'youtu.be') id = u.pathname.slice(1);
    else if (host === 'youtube.com') id = u.searchParams.get('v') ?? u.pathname.match(/^\/(shorts|embed|live)\/([^/]+)/)?.[2] ?? '';
    return /^[\w-]{6,20}$/.test(id) ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
  } catch {
    return null;
  }
}

// Titles that sites give to every page (or to their login wall) aren't useful.
export function usefulTitle(title: string, url: string): boolean {
  const t = title.trim().toLowerCase();
  if (!t || t.length < 3) return false;
  if (t === siteName(url).toLowerCase()) return false;
  return !/^(log ?in|sign ?in|instagram|youtube|access denied|just a moment|attention required|page not found|404)\b/.test(t);
}

export function newId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
