// The starting point: load fonts and styles, handle shared links, then draw the app.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/dm-sans';
import './styles/global.css';
import { runStartup } from './app/startup';
import { App } from './App';

runStartup();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
