// The connection to the Supabase database and login service.
import { createClient } from '@supabase/supabase-js';
import { config } from './config';

export const supabase = config.cloudEnabled
  ? createClient(config.supabaseUrl, config.supabaseKey, {
      auth: {
        // "pkce" puts the sign-in code in ?code=… rather than in the #… part,
        // which this app uses for its pages.
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;
