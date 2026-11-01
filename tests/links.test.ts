import { describe, expect, it } from 'vitest';
import { autoTitle, findLink, normaliseUrl, sameLinkKey, siteName, usefulTitle, youtubeThumb } from '../src/lib/links';
import { STORES, storeSearchLink } from '../src/lib/stores';
import { parseBackup } from '../src/lib/backup';

describe('links', () => {
  it('cleans pasted links', () => {
    expect(normaliseUrl('instagram.com/p/abc')).toBe('https://instagram.com/p/abc');
    expect(normaliseUrl('https://www.instagram.com/reel/X/?igsh=abc&utm_source=ig')).toBe('https://www.instagram.com/reel/X/');
    expect(normaliseUrl('https://youtube.com/watch?v=abc123&si=zz')).toBe('https://youtube.com/watch?v=abc123');
    expect(normaliseUrl('javascript:alert(1)')).toBe('');
    expect(normaliseUrl('hello')).toBe('');
  });
  it('spots the same link written differently', () => {
    expect(sameLinkKey('https://www.instagram.com/p/abc/')).toBe(sameLinkKey('https://instagram.com/p/abc?igsh=1'));
    expect(sameLinkKey('https://youtube.com/watch?v=1')).not.toBe(sameLinkKey('https://youtube.com/watch?v=2'));
  });
  it('finds a link inside shared text', () => {
    expect(findLink('omg look https://instagram.com/p/x/?igsh=1, so cute')).toBe('https://instagram.com/p/x/?igsh=1');
    expect(findLink('no link here')).toBe('');
  });
  it('names sites and titles', () => {
    expect(siteName('https://www.myntra.com/x')).toBe('Myntra');
    expect(autoTitle('https://m.instagram.com/p/1')).toBe('Look from Instagram');
    expect(usefulTitle('Instagram', 'https://instagram.com/p/1')).toBe(false);
    expect(usefulTitle('Login • Instagram', 'https://instagram.com/p/1')).toBe(false);
    expect(usefulTitle('White Linen Kurti - Buy Online', 'https://myntra.com/1')).toBe(true);
  });
  it('builds YouTube thumbnails', () => {
    expect(youtubeThumb('https://youtu.be/dQw4w9WgXcQ')).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    expect(youtubeThumb('https://www.youtube.com/shorts/abcDEF12345')).toBe('https://i.ytimg.com/vi/abcDEF12345/hqdefault.jpg');
    expect(youtubeThumb('https://instagram.com/p/1')).toBeNull();
  });
  it('builds shop search links', () => {
    expect(STORES.map((s) => storeSearchLink(s, 'white linen kurti'))).toEqual([
      'https://www.myntra.com/search?rawQuery=white%20linen%20kurti',
      'https://www.ajio.com/search/?text=white%20linen%20kurti',
      'https://www.amazon.in/s?k=white%20linen%20kurti',
      'https://www.nykaafashion.com/catalogsearch/result/?q=white%20linen%20kurti',
      'https://www.google.com/search?tbm=shop&q=white%20linen%20kurti'
    ]);
  });
});

describe('backups', () => {
  it('reads first-version backups and skips reels', () => {
    const old = { app: 'drinpiN', items: [
      { id: 'lx2k9', type: 'outfit', url: 'https://instagram.com/p/1', title: 'Old look', status: 'owned', pieces: [{ category: 'top', name: 'shirt' }], createdAt: '2026-10-01T10:00:00.000Z' },
      { id: 'r1', type: 'reel', url: 'https://instagram.com/reel/1', title: 'A reel', watched: false }
    ] };
    const out = parseBackup(JSON.stringify(old));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ title: 'Old look', status: 'owned', created_at: '2026-10-01T10:00:00.000Z' });
    expect(out[0].id).toMatch(/^[0-9a-f-]{36}$/); // old short ids are replaced with proper ones
  });
  it('rejects files that are not backups', () => {
    expect(() => parseBackup('{"hello":1}')).toThrow();
    expect(() => parseBackup('nope')).toThrow();
  });
});
