// The "Where to buy" shops. "{q}" is replaced with the piece name, e.g. "white linen kurti".
// To add, remove, or fix a shop, edit this list; nothing else needs to change.
// Checked Oct 2026: Myntra, Ajio and Nykaa Fashion open real search results.
// (Nykaa Fashion's /search/result/ address gives an error, so /catalogsearch/result/ is used.)
export const STORES = [
  { name: 'Myntra', searchUrl: 'https://www.myntra.com/search?rawQuery={q}' },
  { name: 'Ajio', searchUrl: 'https://www.ajio.com/search/?text={q}' },
  { name: 'Amazon', searchUrl: 'https://www.amazon.in/s?k={q}' },
  { name: 'Nykaa Fashion', searchUrl: 'https://www.nykaafashion.com/catalogsearch/result/?q={q}' },
  { name: 'Google Shopping', searchUrl: 'https://www.google.com/search?tbm=shop&q={q}' }
];

export function storeSearchLink(store: { searchUrl: string }, pieceName: string): string {
  return store.searchUrl.replace('{q}', encodeURIComponent(pieceName.trim()));
}
