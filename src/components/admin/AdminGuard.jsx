import { useState } from 'react';
import Login from '../Login';

export default function AdminGuard({ session, children }) {
  const [localSession, setLocalSession] = useState(session);
  const [language, setLanguage] = useState('en');

  const activeSession = session || localSession;

  if (!activeSession) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8faf9' }}>
        <Login setSession={setLocalSession} language={language} setLanguage={setLanguage} />
      </div>
    );
  }
  return children;
}
