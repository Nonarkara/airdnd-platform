import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { translations } from '../translations';

export default function Login({ setSession, language, setLanguage }) {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const t = translations[language];

    // For this private hub, we only allow Logins of pre-approved emails.
    // Signups are disabled in the UI (managed via Supabase dashboard by the owner).
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setErrorMsg(error.message);
        } else {
            setSession(data.session);
        }
        setLoading(false);
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <span className="logo-icon">✨</span>
                    <h2>AirDnD Private Hub</h2>
                    <p>Exclusive access required.</p>
                </div>

                {errorMsg && <div className="error-banner">{errorMsg}</div>}

                <form onSubmit={handleLogin} className="login-form">
                    <div className="input-group">
                        <label>Email ID</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your registered email"
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label>Access Key (Password)</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your key"
                            required
                        />
                    </div>
                    <button type="submit" className="btn-primary login-btn" disabled={loading}>
                        {loading ? 'Authenticating...' : 'Enter Hub'}
                    </button>
                </form>

                <div className="login-footer">
                    <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="language-select"
                    >
                        <option value="en">English</option>
                        <option value="th">ภาษาไทย</option>
                        <option value="zh">中文</option>
                        <option value="ko">한국어</option>
                    </select>
                    <p className="invite-notice">Invitations are strictly managed by the administrator.</p>
                </div>
            </div>
        </div>
    );
}
