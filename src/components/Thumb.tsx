// An outfit's picture. If there isn't one (or it no longer loads), draws a
// coloured tile with the title instead, so the grid never shows empty boxes.
import { useState } from 'react';
import type { Outfit } from '../lib/types';
import { siteName } from '../lib/links';

const TILE_COLOURS = ['#f1d9cc', '#dce6d5', '#e5dcef', '#f4e7c6', '#d3e2e8', '#efd6dc', '#e6e0d4'];
const TILE_SHAPES = ['4 / 5', '3 / 4', '1 / 1', '4 / 5', '5 / 6'];

function hash(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Thumb({ outfit, big = false }: { outfit: Outfit; big?: boolean }) {
  const [broken, setBroken] = useState(false);
  if (outfit.image && !broken) {
    return (
      <img
        src={outfit.image}
        alt=""
        loading={big ? 'eager' : 'lazy'}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    );
  }
  const h = hash(outfit.id);
  return (
    <div
      className={'tile' + (big ? ' big' : '')}
      style={{ background: TILE_COLOURS[h % TILE_COLOURS.length], aspectRatio: big ? undefined : TILE_SHAPES[h % TILE_SHAPES.length] }}
    >
      <span className="tile-site">{siteName(outfit.url)}</span>
      <span className="tile-title">{outfit.title}</span>
      {outfit.pieces.length > 0 && <span className="tile-pieces">{outfit.pieces.map((p) => p.name).join(' · ')}</span>}
    </div>
  );
}
