// The main screen: your saved outfits as a grid, with search and filters.
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useOutfits } from '../lib/store';
import { siteName } from '../lib/links';
import type { Outfit } from '../lib/types';
import { AppBar, BottomNav } from '../components/Chrome';
import { PinCard } from '../components/PinCard';
import { Thumb } from '../components/Thumb';
import { IconClose, IconSearch } from '../components/icons';
import { useAuth } from '../app/auth';
import { config } from '../lib/config';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unsorted', label: 'To sort' },
  { key: 'wishlist', label: 'Wishlist' },
  { key: 'owned', label: 'Owned' },
  { key: 'bought', label: 'Bought' }
] as const;
type Filter = (typeof FILTERS)[number]['key'];

const DAY = 86_400_000;
const NUDGE_KEY = 'drinpin.nudgeHidden';
const REDISCOVER_KEY = 'drinpin.rediscoverHiddenDay';

function matches(o: Outfit, filter: Filter) {
  if (filter === 'all') return true;
  if (filter === 'unsorted') return o.pieces.length === 0;
  return o.status === filter;
}

function matchesSearch(o: Outfit, words: string[]) {
  const text = [o.title, o.note, siteName(o.url), ...o.pieces.map((p) => p.name)].join(' ').toLowerCase();
  return words.every((w) => text.includes(w));
}

function readPref(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writePref(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* not important */ }
}

export function Home() {
  const outfits = useOutfits();
  const [params, setParams] = useSearchParams();
  const filter = (FILTERS.some((f) => f.key === params.get('filter')) ? params.get('filter') : 'all') as Filter;
  const [query, setQuery] = useState('');

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: outfits.length, unsorted: 0, wishlist: 0, owned: 0, bought: 0 };
    for (const o of outfits) {
      if (!o.pieces.length) c.unsorted++;
      c[o.status]++;
    }
    return c;
  }, [outfits]);

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = outfits.filter((o) => matches(o, filter) && matchesSearch(o, words));
  const browsing = filter === 'all' && !words.length;

  return (
    <>
      <div className="page">
        <AppBar />
        {outfits.length > 0 && (
          <>
            <label className="search">
              <IconSearch />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your saves" enterKeyHint="search" />
            </label>
            <div className="chip-row" role="group" aria-label="Show">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className="chip"
                  aria-pressed={filter === f.key}
                  onClick={() => setParams(f.key === 'all' ? {} : { filter: f.key }, { replace: true })}
                >
                  {f.label}
                  {f.key !== 'all' && counts[f.key] > 0 && <span className="count">{counts[f.key]}</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {browsing && <SignInNudge count={outfits.length} />}
        {browsing && <Rediscover outfits={outfits} />}

        {outfits.length === 0 ? (
          <div className="empty">
            <img src="icons/icon.svg" alt="" />
            <h2>Save your first look</h2>
            <p>Share any Instagram post to drinpiN, or paste a link. Then tag the pieces to find them in shops.</p>
            <Link className="btn primary" to="/new">Save a link</Link>
          </div>
        ) : shown.length === 0 ? (
          <div className="empty">
            <h2>{words.length ? 'No matches' : 'Nothing here yet'}</h2>
            <p>{words.length ? `Nothing you've saved matches “${query}”.` : filter === 'unsorted' ? 'Everything is tagged. Nice.' : 'Outfits you mark this way show up here.'}</p>
          </div>
        ) : (
          <div className="grid">
            {shown.map((o) => <PinCard key={o.id} outfit={o} />)}
          </div>
        )}
      </div>
      <BottomNav />
    </>
  );
}

// Suggests signing in, so saves are backed up and shared across devices.
function SignInNudge({ count }: { count: number }) {
  const { user, ready } = useAuth();
  const [hidden, setHidden] = useState(() => Boolean(readPref(NUDGE_KEY)));
  if (!config.cloudEnabled || !ready || user || hidden || count === 0) return null;
  return (
    <div className="notice">
      <div className="grow">
        <p><b>Keep your saves safe.</b> Sign in to back them up and see them on any device.</p>
        <div className="notice-actions">
          <Link className="btn primary small" to="/me">Sign in</Link>
        </div>
      </div>
      <button className="icon-btn" type="button" aria-label="Hide this" onClick={() => { writePref(NUDGE_KEY, '1'); setHidden(true); }}>
        <IconClose />
      </button>
    </div>
  );
}

// Brings back a wishlist outfit saved a while ago, so saved looks don't get forgotten.
// The same one shows all day; a different one tomorrow.
function Rediscover({ outfits }: { outfits: Outfit[] }) {
  const today = Math.floor(Date.now() / DAY);
  const [hiddenDay, setHiddenDay] = useState(() => readPref(REDISCOVER_KEY));
  if (hiddenDay === String(today)) return null;
  const older = outfits.filter((o) => o.status === 'wishlist' && Date.now() - Date.parse(o.created_at) >= 3 * DAY);
  if (!older.length) return null;
  const pick = older[today % older.length];
  const days = Math.floor((Date.now() - Date.parse(pick.created_at)) / DAY);
  return (
    <div className="rediscover">
      <Link to={`/o/${pick.id}`} className="pin-media" aria-hidden="true" tabIndex={-1}>
        <Thumb outfit={pick} />
      </Link>
      <div>
        <div className="eyebrow">Still want it? · saved {days} days ago</div>
        <Link to={`/o/${pick.id}`} style={{ textDecoration: 'none' }}>
          <p className="pin-title" style={{ fontSize: '1rem', margin: '4px 0 8px' }}>{pick.title}</p>
        </Link>
        <div className="btn-row">
          <Link className="btn dark small" to={`/o/${pick.id}`}>Take a look</Link>
          <button className="btn outline small" type="button" onClick={() => { writePref(REDISCOVER_KEY, String(today)); setHiddenDay(String(today)); }}>
            Not today
          </button>
        </div>
      </div>
    </div>
  );
}
