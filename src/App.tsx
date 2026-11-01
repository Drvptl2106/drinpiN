// Puts the app together: screens (by address), sign-in, background jobs, update notices.
import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { ToastProvider, useToast } from './components/Toast';
import { AuthProvider } from './app/auth';
import { useBackgroundSync, usePreviewFiller } from './app/background';
import { startupMessages } from './app/startup';
import { Home } from './screens/Home';
import { Detail } from './screens/Detail';
import { Editor } from './screens/Editor';
import { Wardrobe } from './screens/Wardrobe';
import { Profile } from './screens/Profile';
import { Welcome } from './screens/Welcome';

// Addresses from the first version of drinpiN (bookmarks, home-screen shortcuts) still work.
function OldItemLink() {
  const { id } = useParams();
  return <Navigate to={`/o/${id}`} replace />;
}

function Background() {
  const toast = useToast();
  useBackgroundSync();
  usePreviewFiller();

  useEffect(() => {
    const message = startupMessages.shift();
    if (message) toast(message, { duration: 5000 });
  }, [toast]);

  // When a new version has been downloaded, offer to switch to it.
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
  useEffect(() => {
    if (needRefresh) {
      toast('A new version of drinpiN is ready', { action: { label: 'Update', onClick: () => void updateServiceWorker(true) }, duration: 60_000 });
    }
  }, [needRefresh, toast, updateServiceWorker]);
  return null;
}

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <HashRouter>
          <Background />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/new" element={<Editor />} />
            <Route path="/o/:id" element={<Detail />} />
            <Route path="/o/:id/edit" element={<Editor key="edit" />} />
            <Route path="/wardrobe" element={<Wardrobe />} />
            <Route path="/me" element={<Profile />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/item/:id" element={<OldItemLink />} />
            <Route path="/add/*" element={<Navigate to="/new" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
