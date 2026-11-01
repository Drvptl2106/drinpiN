// Every tagged piece across your outfits, grouped by category.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useOutfits } from '../lib/store';
import { CATEGORIES, CATEGORY_LABELS, STATUS_LABELS, type Category, type Status } from '../lib/types';
import { AppBar, BottomNav } from '../components/Chrome';
import { Thumb } from '../components/Thumb';

type StatusFilter = Status | 'all';

export function Wardrobe() {
  const outfits = useOutfits();
  const [status, setStatus] = useState<StatusFilter>('owned');
  const [category, setCategory] = useState<Category | 'all'>('all');

  const rows = outfits.flatMap((outfit) =>
    outfit.pieces
      .filter((p) => (status === 'all' || outfit.status === status) && (category === 'all' || p.category === category))
      .map((piece, i) => ({ piece, outfit, key: outfit.id + i }))
  );

  return (
    <>
      <div className="page">
        <AppBar />
        <h1 style={{ margin: '4px 0 14px' }}>Wardrobe</h1>
        <div className="chip-row" role="group" aria-label="Status">
          {(['owned', 'wishlist', 'bought', 'all'] as const).map((s) => (
            <button key={s} type="button" className="chip" aria-pressed={status === s} onClick={() => setStatus(s)}>
              {s === 'all' ? 'Everything' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <div className="chip-row" role="group" aria-label="Category">
          {(['all', ...CATEGORIES] as const).map((c) => (
            <button key={c} type="button" className="chip small" aria-pressed={category === c} onClick={() => setCategory(c)}>
              {c === 'all' ? 'All pieces' : CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="empty">
            <h2>No pieces here yet</h2>
            <p>
              {status === 'owned'
                ? 'Mark an outfit as Owned and its pieces will show up here.'
                : 'Pieces you tag on your saved outfits show up here.'}
            </p>
          </div>
        ) : (
          CATEGORIES.map((cat) => {
            const inCat = rows.filter((r) => r.piece.category === cat);
            if (!inCat.length) return null;
            return (
              <section className="ward-group" key={cat}>
                <h2>{CATEGORY_LABELS[cat]} <small>{inCat.length}</small></h2>
                {inCat.map(({ piece, outfit, key }) => (
                  <Link className="ward-item" key={key} to={`/o/${outfit.id}`}>
                    <div className="pin-media"><Thumb outfit={outfit} /></div>
                    <div>
                      <b>{piece.name}</b>
                      <span><span className={'dot ' + outfit.status} style={{ display: 'inline-block', marginRight: 6 }} />{outfit.title}</span>
                    </div>
                  </Link>
                ))}
              </section>
            );
          })
        )}
      </div>
      <BottomNav />
    </>
  );
}
