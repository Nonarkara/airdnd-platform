import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { LanguageProvider } from './context/LanguageContext'
import './index.css'
import App from './App.jsx'

// Chunk-load retry: when Vite's preload helper fails to fetch a lazy
// chunk (CDN blip, transient 5xx, hard refresh race), it dispatches a
// `vite:preloadError` event before throwing. The default behaviour is
// to let the throw propagate to the top-level ErrorBoundary, which
// then surfaces the bare "A critical error prevented the application
// from loading" message and forces a manual page refresh. That's a
// terrible user experience for what is almost always a transient
// network blip — reload once automatically and the next chunk fetch
// usually succeeds.
let reloadingForChunkFailure = false;
window.addEventListener('vite:preloadError', (event) => {
  if (reloadingForChunkFailure) return;
  reloadingForChunkFailure = true;
  // Use a microtask delay so the current render can finish cleanly
  // before the reload tears the page down.
  setTimeout(() => {
    try {
      window.location.reload();
    } catch {
      reloadingForChunkFailure = false;
    }
  }, 50);
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary fallback={
      <div style={{ padding: '2rem', fontFamily: 'sans-serif', color: 'white', background: '#141017', minHeight: '100vh' }}>
        <h1>System Error</h1>
        <p>A critical error prevented the application from loading. Please refresh the page.</p>
        <button onClick={() => window.location.reload()} style={{ padding: '8px 16px', background: '#FF3D8B', color: 'white', border: 'none', cursor: 'pointer' }}>Refresh</button>
      </div>
    }>
      <BrowserRouter>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
