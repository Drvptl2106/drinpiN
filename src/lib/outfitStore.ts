// The outfit store: where the app keeps your saves, and how they sync.
//
// How saving works ("offline-first"):
// 1. Every change is written to the phone's own storage immediately, so saving is
//    instant and works with no internet.
// 2. The change is marked "waiting to upload".
// 3. When signed in and online, sync() uploads waiting changes, then downloads
//    anything changed on your other devices since last time.
// If two devices edit the same outfit, the most recent edit wins.

import { CATEGORIES, STATUSES, type Outfit, type OutfitInput, type Piece } from './types';
import { newId } from './links';

// The cloud side of syncing. The real one talks to Supabase (see supabaseRemote.ts);
// tests use a pretend one.
export interface Remote {
  push(rows: Outfit[], userId: string): Promise<void>;
  // Changes stored after `since` (oldest first), at most `limit` of them.
  pull(userId: string, since: string | null, limit: number): Promise<RemoteOutfit[]>;
}
export type RemoteOutfit = Outfit & { synced_at: string };

export type SyncStatus = 'local' | 'idle' | 'syncing' | 'offline' | 'error';
export interface SyncState {
  status: SyncStatus;
  pending: number;
  lastSyncedAt: string | null;
  error: string | null;
}

// Minimal storage interface (localStorage in the app, a plain object in tests).
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const PAGE = 500;
const time = (iso: string | null | undefined) => (iso ? Date.parse(iso) || 0 : 0);
const newestFirst = (a: Outfit, b: Outfit) => time(b.created_at) - time(a.created_at);

// Make sure an outfit (from storage, a backup file, or the cloud) has exactly the right fields.
export function cleanOutfit(raw: Partial<Outfit> & { url: string; id: string }): Outfit {
  const now = new Date().toISOString();
  const pieces: Piece[] = Array.isArray(raw.pieces)
    ? raw.pieces
        .map((p) => ({
          category: (CATEGORIES as readonly string[]).includes(p?.category) ? p.category : 'other',
          name: String(p?.name ?? '').trim().slice(0, 120)
        }))
        .filter((p) => p.name)
        .slice(0, 40)
    : [];
  return {
    id: String(raw.id),
    url: String(raw.url).slice(0, 2048),
    title: String(raw.title ?? '').slice(0, 300),
    note: String(raw.note ?? '').slice(0, 5000),
    status: (STATUSES as readonly string[]).includes(raw.status as string) ? (raw.status as Outfit['status']) : 'wishlist',
    pieces,
    budget: String(raw.budget ?? '').slice(0, 100),
    image: raw.image === null || raw.image === undefined ? null : String(raw.image).slice(0, 2048),
    created_at: raw.created_at ? new Date(raw.created_at).toISOString() : now,
    updated_at: raw.updated_at ? new Date(raw.updated_at).toISOString() : now,
    deleted_at: raw.deleted_at ? new Date(raw.deleted_at).toISOString() : null
  };
}

export class OutfitStore {
  private items = new Map<string, Outfit>();
  private dirty = new Set<string>(); // ids with changes waiting to upload
  private cursor: string | null = null; // cloud timestamp we've downloaded up to
  private owner: string | null = null; // the account this device's data belongs to (null = not signed in)
  private remote: Remote | null = null;
  private listeners = new Set<() => void>();
  private visible: Outfit[] = [];
  private state: SyncState = { status: 'local', pending: 0, lastSyncedAt: null, error: null };
  private running: Promise<void> | null = null;
  private runAgain = false;

  constructor(private storage: KeyValueStorage, private prefix = 'drinpin.v2.') {
    this.load();
  }

  /* ---------- Reading ---------- */

  // For React: subscribe to changes, and get the current list (newest first, without deleted ones).
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getAll = () => this.visible;
  getSyncState = () => this.state;
  get(id: string): Outfit | null {
    const o = this.items.get(id);
    return o && !o.deleted_at ? o : null;
  }
  get userId() {
    return this.owner;
  }

  /* ---------- Changing ---------- */

  add(input: OutfitInput): Outfit {
    const now = new Date().toISOString();
    const outfit = cleanOutfit({ image: null, ...input, id: newId(), created_at: now, updated_at: now, deleted_at: null });
    this.items.set(outfit.id, outfit);
    this.changed(outfit.id);
    return outfit;
  }

  update(id: string, changes: Partial<Omit<Outfit, 'id' | 'created_at'>>): Outfit | null {
    const old = this.get(id);
    if (!old) return null;
    // Always move the "last changed" time forward, even if the clock is odd.
    const stamp = new Date(Math.max(Date.now(), time(old.updated_at) + 1)).toISOString();
    const outfit = cleanOutfit({ ...old, ...changes, id, created_at: old.created_at, updated_at: stamp });
    this.items.set(id, outfit);
    this.changed(id);
    return outfit;
  }

  // Returns the deleted outfit so it can be put back with restore() ("Undo").
  remove(id: string): Outfit | null {
    const old = this.get(id);
    if (!old) return null;
    if (this.owner) {
      // Keep a "deleted" marker until the cloud knows about it.
      const marker = this.update(id, { deleted_at: new Date().toISOString() })!;
      // The returned copy carries the delete's time, so an Undo is always newer than the delete.
      return { ...old, updated_at: marker.updated_at };
    }
    this.items.delete(id);
    this.dirty.delete(id);
    this.emit();
    return old;
  }

  restore(outfit: Outfit) {
    const current = this.items.get(outfit.id);
    const stamp = new Date(Math.max(Date.now(), time(current?.updated_at) + 1, time(outfit.updated_at) + 1)).toISOString();
    this.items.set(outfit.id, cleanOutfit({ ...outfit, deleted_at: null, updated_at: stamp }));
    this.changed(outfit.id);
  }

  // Add many outfits at once (backup files, old-app data). Same id → the newer copy wins.
  importMany(list: Outfit[]): number {
    let count = 0;
    for (const raw of list) {
      const o = cleanOutfit(raw);
      const existing = this.items.get(o.id);
      if (existing && time(existing.updated_at) > time(o.updated_at)) continue;
      this.items.set(o.id, o);
      if (this.owner) this.dirty.add(o.id);
      count++;
    }
    this.persist();
    this.emit();
    return count;
  }

  // Delete every outfit (on this device, and in the cloud on the next sync).
  removeAll() {
    for (const o of this.getAll()) this.remove(o.id);
  }

  /* ---------- Accounts & syncing ---------- */

  // Called whenever someone signs in or out. Returns how many outfits saved
  // while signed out were moved into the account.
  setUser(userId: string | null, remote: Remote | null): number {
    this.remote = userId ? remote : null;
    let adopted = 0;
    if (userId !== this.owner) {
      if (userId && this.owner === null) {
        // Saves made before signing in move into the account.
        for (const o of this.items.values()) this.dirty.add(o.id);
        adopted = this.items.size;
      } else {
        // Signed out, or a different account: this device starts fresh
        // (the old account's saves stay safe in the cloud).
        this.items.clear();
        this.dirty.clear();
      }
      this.owner = userId;
      this.cursor = null;
      this.state = { ...this.state, lastSyncedAt: null, error: null };
      this.persist();
    }
    this.setState({ status: this.remote ? 'idle' : 'local' });
    this.emit();
    return adopted;
  }

  // Upload waiting changes, then download changes from other devices.
  // Safe to call often: overlapping calls are merged into one.
  sync(): Promise<void> {
    if (!this.remote || !this.owner) return Promise.resolve();
    if (this.running) {
      this.runAgain = true;
      return this.running;
    }
    this.running = this.runSync().finally(() => {
      this.running = null;
      if (this.runAgain) {
        this.runAgain = false;
        void this.sync();
      }
    });
    return this.running;
  }

  private async runSync() {
    const remote = this.remote!;
    const owner = this.owner!;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.setState({ status: 'offline' });
      return;
    }
    this.setState({ status: 'syncing', error: null });
    try {
      // 1. Upload.
      const waiting = Array.from(this.dirty)
        .map((id) => this.items.get(id))
        .filter((o): o is Outfit => Boolean(o));
      for (let i = 0; i < waiting.length; i += PAGE) {
        const chunk = waiting.slice(i, i + PAGE);
        await remote.push(chunk, owner);
        if (this.owner !== owner) return; // signed out meanwhile
        for (const sent of chunk) {
          const now = this.items.get(sent.id);
          // Only clear it if it wasn't changed again while uploading.
          if (now && now.updated_at === sent.updated_at) {
            this.dirty.delete(sent.id);
            if (now.deleted_at) this.items.delete(sent.id);
          }
        }
        this.persist();
      }
      // 2. Download.
      for (;;) {
        const batch = await remote.pull(owner, this.cursor, PAGE);
        if (this.owner !== owner) return;
        for (const row of batch) this.merge(row);
        if (batch.length) this.cursor = batch[batch.length - 1].synced_at;
        this.persist();
        this.emit();
        if (batch.length < PAGE) break;
      }
      this.setState({ status: 'idle', lastSyncedAt: new Date().toISOString() });
    } catch (err) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      this.setState({ status: offline ? 'offline' : 'error', error: offline ? null : messageOf(err) });
    }
  }

  private merge(row: RemoteOutfit) {
    const local = this.items.get(row.id);
    // Our own newer edit is still waiting to upload: keep it.
    if (local && this.dirty.has(row.id) && time(local.updated_at) > time(row.updated_at)) return;
    this.dirty.delete(row.id);
    if (row.deleted_at) {
      this.items.delete(row.id);
      return;
    }
    const { synced_at: _ignored, ...outfit } = row;
    this.items.set(row.id, cleanOutfit(outfit));
  }

  /* ---------- Internals ---------- */

  private changed(id: string) {
    if (this.owner) this.dirty.add(id);
    this.persist();
    this.emit();
  }

  private setState(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch, pending: this.dirty.size };
    this.listeners.forEach((fn) => fn());
  }

  private emit() {
    this.visible = Array.from(this.items.values())
      .filter((o) => !o.deleted_at)
      .sort(newestFirst);
    this.state = { ...this.state, pending: this.dirty.size };
    this.listeners.forEach((fn) => fn());
  }

  private load() {
    try {
      const list = JSON.parse(this.storage.getItem(this.prefix + 'outfits') ?? '[]');
      if (Array.isArray(list)) {
        for (const raw of list) if (raw?.id && raw?.url) this.items.set(raw.id, cleanOutfit(raw));
      }
      const dirty = JSON.parse(this.storage.getItem(this.prefix + 'dirty') ?? '[]');
      if (Array.isArray(dirty)) dirty.forEach((id) => this.items.has(id) && this.dirty.add(id));
      this.cursor = this.storage.getItem(this.prefix + 'cursor');
      this.owner = this.storage.getItem(this.prefix + 'owner');
    } catch {
      // Damaged storage: start empty rather than crash.
    }
    this.emit();
  }

  private persist() {
    try {
      this.storage.setItem(this.prefix + 'outfits', JSON.stringify(Array.from(this.items.values())));
      this.storage.setItem(this.prefix + 'dirty', JSON.stringify(Array.from(this.dirty)));
      if (this.cursor) this.storage.setItem(this.prefix + 'cursor', this.cursor);
      else this.storage.removeItem(this.prefix + 'cursor');
      if (this.owner) this.storage.setItem(this.prefix + 'owner', this.owner);
      else this.storage.removeItem(this.prefix + 'owner');
    } catch (err) {
      this.setState({ status: this.state.status, error: 'This device is out of storage space.' });
      console.warn('Could not save to device storage', err);
    }
  }
}

function messageOf(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return String(err);
}
