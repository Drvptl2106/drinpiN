// Your account, your data (backup / restore / delete), and installing the app.
import { useRef } from 'react';
import { outfitStore, useOutfits, useSyncState } from '../lib/store';
import { supabase } from '../lib/supabase';
import { config } from '../lib/config';
import { downloadBackup, parseBackup } from '../lib/backup';
import { AppBar, BottomNav } from '../components/Chrome';
import { useToast } from '../components/Toast';
import { useAuth } from '../app/auth';
import { install, isInstalled, isIPhone, useInstallOffer } from '../app/install';
import { SignIn } from './SignIn';

const VERSION = '2.0';

function syncText(status: string, pending: number, last: string | null) {
  if (status === 'syncing') return 'Syncing…';
  if (status === 'offline') return pending ? `Offline · ${pending} ${pending === 1 ? 'change' : 'changes'} will upload when you're back online` : 'Offline';
  if (status === 'error') return `Couldn't sync${pending ? ` · ${pending} waiting` : ''}. Will retry.`;
  if (pending) return `${pending} ${pending === 1 ? 'change' : 'changes'} uploading…`;
  if (last) return 'All saves backed up';
  return 'Connected';
}

export function Profile() {
  const { user } = useAuth();
  const outfits = useOutfits();
  const sync = useSyncState();
  const toast = useToast();
  const offer = useInstallOffer();
  const fileInput = useRef<HTMLInputElement>(null);

  const pieces = outfits.reduce((n, o) => n + o.pieces.length, 0);
  const toSort = outfits.filter((o) => !o.pieces.length).length;

  async function signOut() {
    await outfitStore.sync();
    const waiting = outfitStore.getSyncState().pending;
    if (waiting && !confirm(`${waiting} ${waiting === 1 ? 'change hasn\'t' : "changes haven't"} uploaded yet and will be lost if you sign out now. Sign out anyway?`)) return;
    await supabase?.auth.signOut();
    toast('Signed out');
  }

  async function restore(file: File) {
    try {
      const list = parseBackup(await file.text());
      if (!confirm(`Add ${list.length} outfits from this backup? Outfits you already have are kept.`)) return;
      const n = outfitStore.importMany(list);
      toast(`Restored ${n} ${n === 1 ? 'outfit' : 'outfits'}`);
    } catch {
      toast("That file isn't a drinpiN backup.");
    }
  }

  function deleteEverything() {
    if (!confirm(`Delete all ${outfits.length} saves${user ? ' from every device' : ''}? Download a backup first if you might want them back.`)) return;
    outfitStore.removeAll();
    toast('Everything deleted');
  }

  return (
    <>
      <div className="page">
        <AppBar />
        <h1 style={{ margin: '4px 0 14px' }}>{user ? 'Your account' : 'Settings'}</h1>

        <section className="card">
          {!config.cloudEnabled ? (
            <>
              <h2>Saved on this device</h2>
              <p className="muted small" style={{ margin: 0 }}>Your saves are stored on this phone. Download a backup now and then to keep them safe.</p>
            </>
          ) : user ? (
            <>
              <div className="account-row">
                <span className="avatar">{user.email?.charAt(0).toUpperCase()}</span>
                <div className="grow">
                  <b>{user.email}</b>
                  <span className="status-line"><span className={'sync-dot ' + sync.status} />{syncText(sync.status, sync.pending, sync.lastSyncedAt)}</span>
                </div>
              </div>
              {sync.status === 'error' && sync.error && <p className="error-text small" style={{ marginTop: 8 }}>{sync.error}</p>}
              <div className="stack">
                <button className="btn outline block" type="button" onClick={() => void outfitStore.sync()} disabled={sync.status === 'syncing'}>Sync now</button>
                <button className="btn block" type="button" onClick={() => void signOut()}>Sign out</button>
              </div>
            </>
          ) : (
            <>
              <h2>Sign in</h2>
              <SignIn />
            </>
          )}
        </section>

        <section className="card">
          <h2>Your saves</h2>
          <div className="stats">
            <div className="stat"><b>{outfits.length}</b><span>outfits</span></div>
            <div className="stat"><b>{pieces}</b><span>pieces</span></div>
            <div className="stat"><b>{toSort}</b><span>to sort</span></div>
          </div>
          <div className="stack">
            <button className="btn outline block" type="button" onClick={() => { downloadBackup(outfits); toast('Backup downloaded'); }} disabled={!outfits.length}>Download a backup</button>
            <button className="btn outline block" type="button" onClick={() => fileInput.current?.click()}>Restore from a backup</button>
            <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void restore(f); e.target.value = ''; }} />
            <button className="btn danger block" type="button" onClick={deleteEverything} disabled={!outfits.length}>Delete all saves</button>
          </div>
        </section>

        <section className="card">
          <h2>Get the app</h2>
          {isInstalled() ? (
            <p className="muted small" style={{ margin: 0 }}>drinpiN is installed on this device.</p>
          ) : offer ? (
            <>
              <p className="muted small">Install drinpiN to open it from your home screen and save straight from Instagram's Share button.</p>
              <button className="btn primary block" type="button" onClick={() => void install()}>Install drinpiN</button>
            </>
          ) : isIPhone() ? (
            <p className="muted small" style={{ margin: 0 }}>In Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>.</p>
          ) : (
            <p className="muted small" style={{ margin: 0 }}>In Chrome, open the <b>⋮</b> menu and tap <b>Install app</b>.</p>
          )}
          <h2 style={{ marginTop: 18 }}>Saving from Instagram</h2>
          {isIPhone() ? (
            <ol className="steps small">
              <li>In Instagram, tap <b>Share</b>, then <b>Copy link</b>.</li>
              <li>Open drinpiN, tap <b>+</b>, then <b>Paste</b>.</li>
            </ol>
          ) : (
            <ol className="steps small">
              <li>Install drinpiN (above).</li>
              <li>In Instagram, tap <b>Share</b>, then <b>drinpiN</b>.</li>
              <li>That's it. It's saved. Tag the pieces now or later.</li>
            </ol>
          )}
        </section>

        <p className="muted small" style={{ textAlign: 'center', margin: '24px 0 0' }}>
          drinpiN {VERSION} · No ads, no tracking. Shop buttons open each store's own search.
        </p>
      </div>
      <BottomNav />
    </>
  );
}
