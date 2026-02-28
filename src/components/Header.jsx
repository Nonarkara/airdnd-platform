import React from 'react';

function Header({ language, setLanguage, t }) {
    return (
        <header className="header">
            <div className="logo">
                <span className="logo-icon">✨</span>
                AirDnD
            </div>
            <nav className="nav-links">
                <a href="#" className="nav-link active">{t.nav.discover}</a>
                <a href="#" className="nav-link">{t.nav.bookings}</a>
                <a href="#" className="nav-link">{t.nav.messages}</a>
                <a href="#" className="nav-link">{t.nav.profile}</a>
            </nav>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    style={{ background: 'none', border: '1px solid #e2e8f0', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', outline: 'none' }}
                >
                    <option value="en">EN</option>
                    <option value="th">TH</option>
                    <option value="zh">ZH</option>
                    <option value="ko">KO</option>
                </select>
                <button className="btn-premium">{t.nav.premium}</button>
            </div>
        </header>
    );
}

export default Header;
