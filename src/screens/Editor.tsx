// Save a new outfit, or edit one. Only the link is required; everything else is optional.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { outfitStore, useOutfits } from '../lib/store';
import { autoTitle, findLink, normaliseUrl, sameLinkKey } from '../lib/links';
import { fetchPreview } from '../lib/preview';
import type { Category, Piece, Status } from '../lib/types';
import { PieceTagger, guessCategory } from '../components/PieceTagger';
import { StatusPicker } from '../components/StatusPicker';
import { useToast } from '../components/Toast';
import { IconBack, IconChevron, IconClipboard } from '../components/icons';
import { goBack } from './Detail';

type Lookup = { state: 'idle' } | { state: 'loading' } | { state: 'done'; image: string | null; title: string } | { state: 'none' };

export function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const outfits = useOutfits();
  const editing = id ? outfitStore.get(id) : null;

  const [url, setUrl] = useState(editing?.url ?? '');
  const [title, setTitle] = useState(editing?.title ?? '');
  const [titleTouched, setTitleTouched] = useState(Boolean(editing));
  const [pieces, setPieces] = useState<Piece[]>(editing?.pieces ?? []);
  const [status, setStatus] = useState<Status>(editing?.status ?? 'wishlist');
  const [budget, setBudget] = useState(editing?.budget ?? '');
  const [note, setNote] = useState(editing?.note ?? '');
  const [draft, setDraft] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [lookup, setLookup] = useState<Lookup>({ state: 'idle' });
  const [error, setError] = useState('');
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const urlInput = useRef<HTMLInputElement>(null);

  const clean = normaliseUrl(url);
  const urlChanged = !editing || sameLinkKey(clean) !== sameLinkKey(editing.url);

  // Your own past tags, offered as quick suggestions.
  const recent = useMemo(() => outfits.filter((o) => o.id !== id).flatMap((o) => o.pieces), [outfits, id]);

  const duplicate = clean && urlChanged ? outfits.find((o) => o.id !== id && sameLinkKey(o.url) === sameLinkKey(clean)) : undefined;

  // Look up the link's picture and title as soon as a valid link is pasted.
  useEffect(() => {
    if (!clean || !urlChanged) {
      setLookup({ state: 'idle' });
      return;
    }
    let cancelled = false;
    setLookup({ state: 'loading' });
    const timer = window.setTimeout(async () => {
      const preview = await fetchPreview(clean);
      if (cancelled) return;
      if (!preview) return setLookup({ state: 'none' });
      setLookup({ state: 'done', image: preview.image, title: preview.title });
      if (preview.title) setTitle((t) => (titleTouched && t ? t : preview.title));
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Re-run only when the link changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clean, urlChanged]);

  useEffect(() => {
    if (!editing && !url) urlInput.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (id && !editing) return <Navigate to="/" replace />;

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      const link = findLink(text) || text.trim();
      if (!link) return toast('Nothing to paste. Copy a link first.');
      setUrl(link);
      setError('');
    } catch {
      toast('Press and hold the link box, then tap Paste.');
    }
  }

  function save() {
    if (!clean) {
      setError('Paste a link to save, like https://instagram.com/p/…');
      urlInput.current?.focus();
      return;
    }
    if (duplicate && !allowDuplicate) {
      document.getElementById('duplicate-warning')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    // A piece typed but not yet added still counts.
    const finalPieces = draft.trim()
      ? [...pieces, { category: category ?? guessCategory(draft) ?? 'other', name: draft.trim().replace(/\s+/g, ' ') }]
      : pieces;
    const image = urlChanged ? (lookup.state === 'done' ? lookup.image ?? '' : null) : editing!.image;
    const data = {
      url: clean,
      title: title.trim() || autoTitle(clean),
      pieces: finalPieces,
      status,
      budget: budget.trim(),
      note: note.trim(),
      image
    };

    if (editing) {
      outfitStore.update(editing.id, data);
      toast('Changes saved');
      navigate(`/o/${editing.id}`, { replace: true });
    } else {
      const saved = outfitStore.add(data);
      toast(finalPieces.length ? 'Saved' : 'Saved to To sort');
      navigate(`/o/${saved.id}`, { replace: true });
    }
  }

  const canPaste = typeof navigator.clipboard?.readText === 'function';

  return (
    <>
      <div className="page no-nav">
        <div className="detail-top" style={{ alignItems: 'center', justifyContent: 'flex-start', gap: 8 }}>
          <button className="icon-btn" type="button" aria-label="Back" onClick={() => goBack(navigate, editing ? `/o/${editing.id}` : '/')}>
            <IconBack />
          </button>
          <h1 style={{ fontSize: '1.4rem' }}>{editing ? 'Edit save' : 'Save a look'}</h1>
        </div>

        <form className="form" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
          <div className="field">
            <label className="field-label" htmlFor="url">Link</label>
            <div className="input-group">
              <input
                id="url"
                ref={urlInput}
                className="input"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setError(''); setAllowDuplicate(false); }}
                placeholder="Paste an Instagram or shop link"
                inputMode="url"
                autoComplete="off"
                autoCapitalize="none"
                enterKeyHint="next"
              />
              {canPaste && (
                <button type="button" className="btn" onClick={paste}><IconClipboard /> Paste</button>
              )}
            </div>
            {error && <p className="error-text" role="alert">{error}</p>}
            {lookup.state === 'loading' && (
              <div className="preview-strip"><span className="ph" /><div><b>Looking up the link…</b>You can keep going.</div></div>
            )}
            {lookup.state === 'done' && (lookup.image || lookup.title) && (
              <div className="preview-strip">
                {lookup.image ? <img src={lookup.image} alt="" referrerPolicy="no-referrer" /> : <span className="ph" />}
                <div><b>{lookup.title || 'Found a picture'}</b>Preview added</div>
              </div>
            )}
          </div>

          {duplicate && !allowDuplicate && (
            <div className="warn" id="duplicate-warning" role="alert">
              You already saved this as <b>{duplicate.title}</b>.
              <div className="btn-row">
                <button type="button" className="btn dark small" onClick={() => navigate(`/o/${duplicate.id}`)}>Open it</button>
                <button type="button" className="btn outline small" onClick={() => setAllowDuplicate(true)}>Save again anyway</button>
              </div>
            </div>
          )}

          <div className="field">
            <label className="field-label" htmlFor="title">Title</label>
            <input
              id="title"
              className="input"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); }}
              placeholder={clean ? autoTitle(clean) : 'e.g. Sunday brunch look'}
              maxLength={300}
            />
          </div>

          <PieceTagger
            pieces={pieces}
            onChange={setPieces}
            draft={draft}
            onDraft={setDraft}
            category={category}
            onCategory={setCategory}
            recent={recent}
          />

          <div className="field">
            <span className="field-label">Status</span>
            <StatusPicker value={status} onChange={setStatus} />
          </div>

          <details className="more" open={Boolean(editing && (editing.budget || editing.note))}>
            <summary><IconChevron /> Budget &amp; note</summary>
            <div className="form">
              <div className="field">
                <label className="field-label" htmlFor="budget">Budget</label>
                <input id="budget" className="input" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. ₹1,500" maxLength={100} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="note">Note</label>
                <textarea id="note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything to remember" maxLength={5000} />
              </div>
            </div>
          </details>
        </form>
      </div>

      <div className="sticky-actions">
        <div>
          <button className="btn primary" type="button" onClick={save}>
            {editing ? 'Save changes' : pieces.length || draft.trim() ? 'Save' : 'Save · tag later'}
          </button>
        </div>
      </div>
    </>
  );
}
