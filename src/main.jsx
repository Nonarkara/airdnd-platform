import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'
import App from './App.jsx'

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
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
