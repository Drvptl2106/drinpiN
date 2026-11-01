// link-preview: given a link, returns the page's title and preview picture.
//
// Runs on Supabase (an "Edge Function"), because a phone's browser isn't
// allowed to read other websites directly. Only signed-in drinpiN users can
// call it (Supabase checks their login before this code runs).
//
// Request:  POST { "url": "https://..." }
// Response: { "title": "...", "image": "https://..." | null, "site": "myntra.com" }

const MAX_BYTES = 600_000; // only read the top of the page, where the preview tags live
const TIMEOUT_MS = 7000;
const MAX_REDIRECTS = 4;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=3600' }
  });
}

// --- Safety: never let this function be used to reach private/internal addresses ---

function isPrivateIPv4(ip: string) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
  const [a, b] = p;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19));
}

function isPrivateIPv6(ip: string) {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (v === '::' || v === '::1') return true;
  if (v.startsWith('::ffff:')) return isPrivateIPv4(v.slice(7));
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v);
}

async function assertPublicHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (!host.includes('.') && !host.includes(':')) throw new Error('blocked host');
  if (/^localhost$|\.local$|\.internal$/i.test(host)) throw new Error('blocked host');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    if (isPrivateIPv4(host)) throw new Error('blocked host');
    return;
  }
  if (host.includes(':')) {
    if (isPrivateIPv6(host)) throw new Error('blocked host');
    return;
  }
  const [v4, v6] = await Promise.all([
    Deno.resolveDns(host, 'A').catch(() => [] as string[]),
    Deno.resolveDns(host, 'AAAA').catch(() => [] as string[])
  ]);
  if (!v4.length && !v6.length) throw new Error('unknown host');
  if (v4.some(isPrivateIPv4) || v6.some(isPrivateIPv6)) throw new Error('blocked host');
}

// Follow redirects ourselves, re-checking every hop.
async function safeFetch(start: URL): Promise<Response> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('bad protocol');
    await assertPublicHost(url.hostname);
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; drinpiN-link-preview/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-IN,en;q=0.9'
      }
    });
    const next = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && next) {
      await res.body?.cancel();
      url = new URL(next, url);
      continue;
    }
    return res;
  }
  throw new Error('too many redirects');
}

async function readHead(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let html = '';
  let bytes = 0;
  while (bytes < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    html += decoder.decode(value, { stream: true });
    if (/<\/head>/i.test(html)) break;
  }
  await reader.cancel().catch(() => {});
  return html;
}

// --- Reading the preview tags out of the page ---

function decodeEntities(text: string) {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

function metaTags(html: string) {
  const found: Record<string, string> = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs: Record<string, string> = {};
    for (const m of tag.matchAll(/([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
      attrs[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? '';
    }
    const key = (attrs.property || attrs.name || attrs.itemprop || '').toLowerCase();
    if (key && attrs.content && !(key in found)) found[key] = decodeEntities(attrs.content.trim());
  }
  return found;
}

function cleanTitle(title: string) {
  return title.replace(/\s+/g, ' ').trim().slice(0, 200);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let target: URL;
  try {
    const body = await req.json();
    target = new URL(String(body?.url ?? ''));
  } catch {
    return json({ error: 'Send { "url": "https://..." }' }, 400);
  }
  const site = target.hostname.replace(/^www\./, '');

  try {
    const res = await safeFetch(target);
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !type.includes('html')) {
      await res.body?.cancel();
      return json({ title: '', image: null, site });
    }
    const html = await readHead(res);
    const meta = metaTags(html);
    const pageTitle = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '';
    const title = cleanTitle(meta['og:title'] || meta['twitter:title'] || decodeEntities(pageTitle));
    const rawImage = meta['og:image:secure_url'] || meta['og:image'] || meta['twitter:image'] || meta['twitter:image:src'] || '';
    let image: string | null = null;
    if (rawImage) {
      try {
        const u = new URL(rawImage, res.url || target);
        if (u.protocol === 'https:') image = u.href.slice(0, 2048);
      } catch { /* ignore bad image links */ }
    }
    return json({ title, image, site });
  } catch {
    // Blocked, slow, or unreachable sites just get no preview.
    return json({ title: '', image: null, site });
  }
});
