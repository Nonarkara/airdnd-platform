import React from 'react';
import './Footer.css';

function Footer({ t }) {
    return (
        <footer className="airdnd-footer">
            <div className="footer-content">
                <div className="footer-brand">
                    <div className="footer-logo">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2L21 5.92a2.12 2.12 0 0 0-3-3L4.5 16.5z" />
                            <path d="m15 5 4 4" />
                        </svg>
                        AirDnD
                    </div>
                    <p className="footer-tagline">Premium companionship for unforgettable evenings.</p>
                </div>

                <div className="footer-disclaimer">
                    <h4>{t.footer.disclaimerTitle}</h4>
                    <p>{t.footer.disclaimerText}</p>
                </div>
            </div>
            <div className="footer-bottom">
                <p>{t.footer.rights}</p>
                <div className="footer-links">
                    <a href="#">{t.footer.privacy}</a>
                    <a href="#">{t.footer.terms}</a>
                    <a href="#">{t.footer.safety}</a>
                </div>
            </div>
        </footer>
    );
}

export default Footer;
