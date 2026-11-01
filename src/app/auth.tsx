// Keeps track of who is signed in, and connects the outfit store to their account.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { outfitStore } from '../lib/store';
import { supabaseRemote } from '../lib/supabaseRemote';
import { useToast } from '../components/Toast';

interface AuthState {
  user: User | null;
  ready: boolean; // false until we know whether someone is signed in
}

const AuthContext = createContext<AuthState>({ user: null, ready: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [state, setState] = useState<AuthState>({ user: null, ready: !supabase });

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const remote = supabaseRemote(client);

    const apply = (user: User | null) => {
      const adopted = outfitStore.setUser(user?.id ?? null, user ? remote : null);
      if (adopted > 0) toast(`${adopted} ${adopted === 1 ? 'save' : 'saves'} from this device added to your account`);
      setState({ user, ready: true });
      if (user) void outfitStore.sync();
    };

    const { data } = client.auth.onAuthStateChange((event, session) => {
      // Run outside Supabase's callback, as its docs recommend.
      setTimeout(() => {
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
          apply(session?.user ?? null);
        }
        // Tidy the sign-in code out of the address bar after an email-link sign-in.
        if (event === 'SIGNED_IN' && /[?&]code=/.test(location.search)) {
          history.replaceState(null, '', location.pathname + location.hash);
        }
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [toast]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
