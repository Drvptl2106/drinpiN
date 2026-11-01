// Connects the outfit store's syncing to the Supabase "outfits" table.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Remote, RemoteOutfit } from './outfitStore';

const COLUMNS = 'id,url,title,note,status,pieces,budget,image,created_at,updated_at,deleted_at,synced_at';

export function supabaseRemote(client: SupabaseClient): Remote {
  return {
    async push(rows, userId) {
      const { error } = await client
        .from('outfits')
        .upsert(rows.map((o) => ({ ...o, user_id: userId })), { onConflict: 'id' });
      if (error) throw error;
    },
    async pull(userId, since, limit) {
      let query = client.from('outfits').select(COLUMNS).eq('user_id', userId).order('synced_at', { ascending: true }).limit(limit);
      if (since) query = query.gt('synced_at', since);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as RemoteOutfit[];
    }
  };
}
