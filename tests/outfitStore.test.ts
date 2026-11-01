import { describe, expect, it, beforeEach } from 'vitest';
import { OutfitStore, type KeyValueStorage, type Remote, type RemoteOutfit } from '../src/lib/outfitStore';
import type { Outfit } from '../src/lib/types';

// A pretend cloud database that behaves like supabase/schema.sql:
// older edits never overwrite newer ones, and every stored change gets a new synced_at.
class FakeCloud {
  rows = new Map<string, RemoteOutfit & { user_id: string }>();
  clock = 0;
  failNext = false;
  stamp() {
    return new Date(Date.UTC(2026, 0, 1) + ++this.clock).toISOString();
  }
  remote(): Remote {
    return {
      push: async (rows: Outfit[], userId: string) => {
        if (this.failNext) { this.failNext = false; throw new Error('network down'); }
        for (const r of rows) {
          const old = this.rows.get(r.id);
          if (old && old.user_id !== userId) throw new Error('row-level security');
          if (old && Date.parse(r.updated_at) < Date.parse(old.updated_at)) continue;
          this.rows.set(r.id, { ...r, user_id: userId, created_at: old?.created_at ?? r.created_at, synced_at: this.stamp() });
        }
      },
      pull: async (userId, since, limit) =>
        [...this.rows.values()]
          .filter((r) => r.user_id === userId && (!since || r.synced_at > since))
          .sort((a, b) => a.synced_at.localeCompare(b.synced_at))
          .slice(0, limit)
          .map(({ user_id: _u, ...r }) => r)
    };
  }
}

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

const titles = (s: OutfitStore) => s.getAll().map((o) => o.title).sort();

describe('OutfitStore (on the device)', () => {
  it('saves, edits, deletes, undoes, and survives a reload', () => {
    const storage = memoryStorage();
    const s = new OutfitStore(storage);
    const a = s.add({ url: 'https://instagram.com/p/a', title: 'A', pieces: [{ category: 'top', name: 'kurti' }, { category: 'shoes', name: ' ' }] });
    expect(a.pieces).toEqual([{ category: 'top', name: 'kurti' }]);
    s.update(a.id, { title: 'A2', status: 'owned' });
    const removed = s.remove(a.id)!;
    expect(s.getAll()).toHaveLength(0);
    s.restore(removed);
    const again = new OutfitStore(storage);
    expect(again.getAll().map((o) => [o.title, o.status])).toEqual([['A2', 'owned']]);
  });

  it('ignores damaged storage instead of crashing', () => {
    const storage = memoryStorage();
    storage.setItem('drinpin.v2.outfits', '{not json');
    expect(new OutfitStore(storage).getAll()).toEqual([]);
  });
});

describe('OutfitStore syncing', () => {
  let cloud: FakeCloud;
  beforeEach(() => { cloud = new FakeCloud(); });

  it('moves saves made before signing in into the account', async () => {
    const phone = new OutfitStore(memoryStorage());
    phone.add({ url: 'https://a.com/1', title: 'Before login' });
    expect(phone.setUser('u1', cloud.remote())).toBe(1);
    await phone.sync();
    expect(cloud.rows.size).toBe(1);
    expect(phone.getSyncState()).toMatchObject({ status: 'idle', pending: 0 });
  });

  it('syncs adds, edits and deletes between two devices', async () => {
    const phone = new OutfitStore(memoryStorage());
    const laptop = new OutfitStore(memoryStorage());
    phone.setUser('u1', cloud.remote());
    laptop.setUser('u1', cloud.remote());

    const o = phone.add({ url: 'https://a.com/1', title: 'Brunch' });
    await phone.sync();
    await laptop.sync();
    expect(titles(laptop)).toEqual(['Brunch']);

    laptop.update(o.id, { title: 'Brunch v2' });
    await laptop.sync();
    await phone.sync();
    expect(titles(phone)).toEqual(['Brunch v2']);

    phone.remove(o.id);
    await phone.sync();
    await laptop.sync();
    expect(laptop.getAll()).toEqual([]);
    expect(cloud.rows.get(o.id)!.deleted_at).not.toBeNull();
  });

  it('keeps the newest edit when both devices change the same outfit', async () => {
    const phone = new OutfitStore(memoryStorage());
    const laptop = new OutfitStore(memoryStorage());
    phone.setUser('u1', cloud.remote());
    laptop.setUser('u1', cloud.remote());
    const o = phone.add({ url: 'https://a.com/1', title: 'v1' });
    await phone.sync();
    await laptop.sync();

    laptop.update(o.id, { title: 'older edit' });
    await new Promise((r) => setTimeout(r, 5));
    phone.update(o.id, { title: 'newer edit' });
    await phone.sync(); // newer arrives first
    await laptop.sync(); // older arrives late and must not win
    await phone.sync();
    expect(titles(phone)).toEqual(['newer edit']);
    expect(titles(laptop)).toEqual(['newer edit']);
    expect(cloud.rows.get(o.id)!.title).toBe('newer edit');
  });

  it('keeps changes waiting when offline or failing, and uploads them later', async () => {
    const phone = new OutfitStore(memoryStorage());
    phone.setUser('u1', cloud.remote());
    phone.add({ url: 'https://a.com/1', title: 'Offline save' });
    cloud.failNext = true;
    await phone.sync();
    expect(phone.getSyncState()).toMatchObject({ status: 'error', pending: 1 });
    await phone.sync();
    expect(phone.getSyncState()).toMatchObject({ status: 'idle', pending: 0 });
    expect(cloud.rows.size).toBe(1);
  });

  it('remembers waiting changes across an app restart', async () => {
    const storage = memoryStorage();
    const first = new OutfitStore(storage);
    first.setUser('u1', cloud.remote());
    first.add({ url: 'https://a.com/1', title: 'Saved then app closed' });
    const reopened = new OutfitStore(storage);
    expect(reopened.getSyncState().pending).toBe(1);
    reopened.setUser('u1', cloud.remote());
    await reopened.sync();
    expect(cloud.rows.size).toBe(1);
  });

  it('downloads in pages when there are many outfits', async () => {
    const big = new OutfitStore(memoryStorage());
    big.setUser('u1', cloud.remote());
    for (let i = 0; i < 1203; i++) big.add({ url: `https://a.com/${i}`, title: `#${i}` });
    await big.sync();
    const fresh = new OutfitStore(memoryStorage());
    fresh.setUser('u1', cloud.remote());
    await fresh.sync();
    expect(fresh.getAll()).toHaveLength(1203);
  });

  it('signing out clears the device; another account never sees the first one\'s saves', async () => {
    const phone = new OutfitStore(memoryStorage());
    phone.setUser('u1', cloud.remote());
    phone.add({ url: 'https://a.com/1', title: 'Mine' });
    await phone.sync();
    phone.setUser(null, null);
    expect(phone.getAll()).toEqual([]);
    expect(phone.setUser('u2', cloud.remote())).toBe(0);
    await phone.sync();
    expect(phone.getAll()).toEqual([]);
    phone.setUser(null, null);
    phone.setUser('u1', cloud.remote());
    await phone.sync();
    expect(titles(phone)).toEqual(['Mine']);
  });

  it('undo after delete brings the outfit back everywhere', async () => {
    const phone = new OutfitStore(memoryStorage());
    phone.setUser('u1', cloud.remote());
    const o = phone.add({ url: 'https://a.com/1', title: 'Oops' });
    await phone.sync();
    const removed = phone.remove(o.id)!;
    await phone.sync();
    phone.restore(removed);
    await phone.sync();
    expect(cloud.rows.get(o.id)!.deleted_at).toBeNull();
    const laptop = new OutfitStore(memoryStorage());
    laptop.setUser('u1', cloud.remote());
    await laptop.sync();
    expect(titles(laptop)).toEqual(['Oops']);
  });
});
