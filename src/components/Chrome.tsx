// The top bar (logo + your account) and the bottom tab bar.
import { Link, NavLink } from 'react-router-dom';
import { IconGrid, IconHanger, IconPlus } from './icons';
import { useAuth } from '../app/auth';
import { useSyncState } from '../lib/store';
import { config } from '../lib/config';

export function Wordmark() {
  return (
    <span className="wordmark">
      drinpi<b>N</b>
    </span>
  );
}

export function AppBar() {
  const { user } = useAuth();
  const sync = useSyncState();
  const initial = user?.email?.charAt(0).toUpperCase();
  return (
    <header className="appbar">
      <Link className="brand" to="/" aria-label="drinpiN home">
        <img src="icons/icon.svg" alt="" width={30} height={30} />
        <Wordmark />
      </Link>
      <Link className="avatar" to="/me" aria-label={user ? 'Your account' : config.cloudEnabled ? 'Sign in' : 'Settings'}>
        {initial ?? <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9" r="3.5" /><path d="M5 19.5c1.5-3 4-4.5 7-4.5s5.5 1.5 7 4.5" /></svg>}
        {user && <span className={'sync-dot ' + sync.status} />}
      </Link>
    </header>
  );
}

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main">
      <NavLink to="/" end>
        <IconGrid />
        Saves
      </NavLink>
      <Link className="add-tab" to="/new" aria-label="Save a new outfit">
        <span className="add-circle"><IconPlus /></span>
      </Link>
      <NavLink to="/wardrobe">
        <IconHanger />
        Wardrobe
      </NavLink>
    </nav>
  );
}
