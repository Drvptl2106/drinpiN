// Settings that come from the build (see .env.example and SETUP.md).

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

export const config = {
  supabaseUrl: url,
  supabaseKey: key,
  // Without Supabase settings, drinpiN still works, saving only on the device.
  cloudEnabled: Boolean(url && key && !url.includes('your-project')),
  googleEnabled: import.meta.env.VITE_ENABLE_GOOGLE === 'true'
};
