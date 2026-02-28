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
                <button
                    onClick={() => setLanguage(language === 'en' ? 'th' : 'en')}
                    style={{ background: 'none', border: '1px solid #e2e8f0', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    {language === 'en' ? 'TH' : 'EN'}
                </button>
                <button className="btn-premium">{t.nav.premium}</button>
            </div>
        </header>
    );
}

export default Header;
