/*
  stores.js — the "Where to buy" shops.

  Each shop has a name and a search address. "{q}" in the address is
  replaced with the piece name (for example "white linen kurti"), safely
  encoded for a web address.

  To add, remove, or fix a shop, just edit this list. Nothing else needs
  to change. Checked on 30 Oct 2026:
    - Myntra, Ajio, Nykaa Fashion: opened the address and saw matching results.
    - Nykaa Fashion: the address in the original plan (/search/result/)
      gave a "503 Service Unavailable" error, so it now uses
      /catalogsearch/result/, which works.
    - Amazon.in and Google Shopping: standard, long-standing search
      addresses (could not be opened from the build machine to double-check).
*/
var STORES = [
  { name: 'Myntra',          searchUrl: 'https://www.myntra.com/search?rawQuery={q}' },
  { name: 'Ajio',            searchUrl: 'https://www.ajio.com/search/?text={q}' },
  { name: 'Amazon.in',       searchUrl: 'https://www.amazon.in/s?k={q}' },
  { name: 'Google Shopping', searchUrl: 'https://www.google.com/search?tbm=shop&q={q}' },
  { name: 'Nykaa Fashion',   searchUrl: 'https://www.nykaafashion.com/catalogsearch/result/?q={q}' }
];

// Builds the full search address for one shop and one piece name.
function storeSearchLink(store, pieceName) {
  return store.searchUrl.replace('{q}', encodeURIComponent(pieceName.trim()));
}
