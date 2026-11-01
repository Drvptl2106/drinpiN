// One saved outfit: its picture, the original link, status, and shop links for every piece.
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { outfitStore, useOutfit } from '../lib/store';
import { siteName } from '../lib/links';
import { STORES, storeSearchLink } from '../lib/stores';
import { CATEGORY_LABELS } from '../lib/types';
import { Thumb } from '../components/Thumb';
import { StatusPicker } from '../components/StatusPicker';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { IconBack, IconCheck, IconEdit, IconExternal, IconShare, IconTrash } from '../components/icons';

export function goBack(navigate: ReturnType<typeof useNavigate>, fallback = '/') {
  if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
  else navigate(fallback, { replace: true });
}

function savedAgo(iso: string) {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function Detail() {
  const { id } = useParams();
  const outfit = useOutfit(id);
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const justSaved = params.get('saved');

  if (!outfit) {
    return (
      <div className="page no-nav">
        <div className="detail-top"><Link className="icon-btn filled" to="/" aria-label="Home"><IconBack /></Link></div>
        <div className="empty">
          <h2>This save isn't here anymore</h2>
          <p>It may have been deleted on another device.</p>
          <Link className="btn primary" to="/">Back to your saves</Link>
        </div>
      </div>
    );
  }

  const site = siteName(outfit.url);
  const closeSheet = () => setParams({}, { replace: true });

  const remove = () => {
    const removed = outfitStore.remove(outfit.id);
    navigate('/', { replace: true });
    if (removed) {
      toast('Deleted', { action: { label: 'Undo', onClick: () => outfitStore.restore(removed) }, duration: 6000 });
    }
  };

  const share = () => navigator.share?.({ title: outfit.title, url: outfit.url }).catch(() => {});

  return (
    <div className="page no-nav">
      <div className="detail-top">
        <button className="icon-btn filled" type="button" aria-label="Back" onClick={() => goBack(navigate)}><IconBack /></button>
        <div className="btn-row">
          {typeof navigator.share === 'function' && (
            <button className="icon-btn filled" type="button" aria-label="Share" onClick={share}><IconShare /></button>
          )}
          <Link className="icon-btn filled" to={`/o/${outfit.id}/edit`} aria-label="Edit"><IconEdit /></Link>
        </div>
      </div>

      <div className="detail-hero"><Thumb outfit={outfit} big /></div>

      <div className="detail-head">
        <h1>{outfit.title}</h1>
        <p className="meta">{site} · saved {savedAgo(outfit.created_at)}{outfit.budget && <> · budget {outfit.budget}</>}</p>
      </div>

      <a className="btn dark block" href={outfit.url} target="_blank" rel="noopener noreferrer">
        Open on {site} <IconExternal />
      </a>

      {outfit.pieces.length === 0 && (
        <div className="notice" style={{ marginTop: 16 }}>
          <div className="grow">
            <p><b>Which pieces did you like?</b> Tag them to search Myntra, Ajio, Amazon and more in one tap.</p>
            <div className="notice-actions"><Link className="btn primary small" to={`/o/${outfit.id}/edit`}>Tag pieces</Link></div>
          </div>
        </div>
      )}

      <section className="section">
        <h2>Status</h2>
        <StatusPicker value={outfit.status} onChange={(status) => outfitStore.update(outfit.id, { status })} />
      </section>

      {outfit.pieces.length > 0 && (
        <section className="section">
          <h2>Find the pieces</h2>
          {outfit.pieces.map((p, i) => (
            <div className="piece-card" key={i}>
              <div className="piece-label">{CATEGORY_LABELS[p.category]}</div>
              <div className="piece-name">{p.name}</div>
              <div className="shop-row">
                {STORES.map((s) => (
                  <a key={s.name} className="shop" href={storeSearchLink(s, p.name)} target="_blank" rel="noopener noreferrer">
                    {s.name} <IconExternal />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {outfit.note && (
        <section className="section">
          <h2>Note</h2>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{outfit.note}</p>
        </section>
      )}

      <section className="section">
        <button className="btn danger" type="button" onClick={remove}><IconTrash /> Delete</button>
      </section>

      {justSaved === 'new' && (
        <Sheet label="Saved" onClose={closeSheet}>
          <h2><span className="tick"><IconCheck /></span>Saved to drinpiN</h2>
          <p>Tag the pieces now, or find it later under <b>To sort</b>.</p>
          <div className="stack">
            <button className="btn primary block" type="button" onClick={() => navigate(`/o/${outfit.id}/edit`, { replace: true })}>Tag pieces</button>
            <button className="btn block" type="button" onClick={closeSheet}>Done</button>
          </div>
        </Sheet>
      )}
      {justSaved === 'already' && (
        <Sheet label="Already saved" onClose={closeSheet}>
          <h2>You already saved this</h2>
          <p>It's been in your saves since {savedAgo(outfit.created_at)}.</p>
          <div className="stack"><button className="btn primary block" type="button" onClick={closeSheet}>View it</button></div>
        </Sheet>
      )}
    </div>
  );
}
