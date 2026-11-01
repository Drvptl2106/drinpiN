// Fills in a picture and title for saved links, using the "link-preview"
// function on Supabase (see supabase/functions/link-preview).
import { supabase } from './supabase';
import { usefulTitle, youtubeThumb } from './links';

export interface Preview {
  title: string;
  image: string | null;
}

// Returns null if it couldn't look (not signed in, offline, or the function isn't set up).
export async function fetchPreview(url: string): Promise<Preview | null> {
  const yt = youtubeThumb(url);
  if (!supabase) return yt ? { title: '', image: yt } : null;
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return yt ? { title: '', image: yt } : null;
  try {
    const { data, error } = await supabase.functions.invoke('link-preview', { body: { url } });
    if (error || !data) return yt ? { title: '', image: yt } : null;
    const title = typeof data.title === 'string' && usefulTitle(data.title, url) ? data.title : '';
    const image = typeof data.image === 'string' && data.image.startsWith('https://') ? data.image : yt;
    return { title, image };
  } catch {
    return yt ? { title: '', image: yt } : null;
  }
}
