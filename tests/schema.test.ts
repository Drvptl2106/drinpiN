// Runs supabase/schema.sql on a real (in-memory) Postgres and checks the security rules.
import { describe, expect, it, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const O1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

// The bits of Supabase that schema.sql relies on.
const SUPABASE_STUB = `
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  insert into auth.users values ('${U1}'), ('${U2}');
`;

let db: PGlite;
async function as(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user ?? ''}', false);`);
  await db.exec(user ? 'set role authenticated' : 'set role anon');
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
  }
}

describe('supabase/schema.sql', () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(SUPABASE_STUB);
    const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
    await db.exec(schema);
    await db.exec(schema); // running it twice must be safe
  });

  it('lets people add and read only their own outfits', async () => {
    await as(U1, `insert into public.outfits (id, url, title, updated_at) values ($1, 'https://a.com', 'mine', '2026-01-01T00:00:01Z')`, [O1]);
    expect((await as(U1, 'select title from public.outfits')).rows).toEqual([{ title: 'mine' }]);
    expect((await as(U2, 'select title from public.outfits')).rows).toEqual([]);
    await expect(as(null, 'select * from public.outfits')).rejects.toThrow(/permission denied/);
  });

  it('blocks writing into someone else\'s account', async () => {
    await expect(as(U2, `insert into public.outfits (id, user_id, url) values (gen_random_uuid(), $1, 'https://x.com')`, [U1])).rejects.toThrow(/row-level security/);
    await as(U2, `update public.outfits set title = 'hacked'`);
    // Upserting with someone else's outfit id must not take it over.
    await as(U2, `insert into public.outfits (id, url, title) values ($1, 'https://x', 'stolen')
      on conflict (id) do update set title = excluded.title`, [O1]).catch(() => {});
    expect((await as(U1, 'select title, user_id from public.outfits')).rows).toEqual([{ title: 'mine', user_id: U1 }]);
  });

  it('keeps the newest edit and stamps synced_at', async () => {
    const before = (await as(U1, 'select synced_at from public.outfits')).rows[0] as { synced_at: Date };
    const upsert = `insert into public.outfits (id, url, title, updated_at) values ($1, 'https://a.com', $2, $3)
      on conflict (id) do update set title = excluded.title, updated_at = excluded.updated_at`;
    await as(U1, upsert, [O1, 'newer', '2026-01-01T00:00:05Z']);
    await as(U1, upsert, [O1, 'older, arrived late', '2026-01-01T00:00:03Z']);
    const after = (await as(U1, 'select title, synced_at from public.outfits')).rows[0] as { title: string; synced_at: Date };
    expect(after.title).toBe('newer');
    expect(after.synced_at.getTime()).toBeGreaterThanOrEqual(before.synced_at.getTime());
  });

  it('rejects bad data', async () => {
    await expect(as(U1, `insert into public.outfits (id, url, status) values (gen_random_uuid(), 'https://a', 'stolen')`)).rejects.toThrow(/check constraint/);
    await expect(as(U1, `insert into public.outfits (id, url, pieces) values (gen_random_uuid(), 'https://a', '{"a":1}')`)).rejects.toThrow(/check constraint/);
  });
});
