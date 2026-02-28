import React from 'react';
import './Footer.css';

function Footer() {
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
                    <h4>Legal & Ethical Disclaimer</h4>
                    <p>
                        AirDnD is strictly a platform for arranging dinners, dates, and professional companionship services. We have a zero-tolerance policy for illegal activities. We operate in strict adherence to local laws and respect human rights as outlined by the UN Charter on Human Rights.
                    </p>
                    <p>
                        Our mission is to empower our companions. We ensure a safe, respectful environment and guarantee that the majority of benefits and profits go directly back to the individuals providing these professional services.
                    </p>
                </div>
            </div>
            <div className="footer-bottom">
                <p>&copy; {new Date().getFullYear()} AirDnD Platform. All rights reserved.</p>
                <div className="footer-links">
                    <a href="#">Privacy Policy</a>
                    <a href="#">Terms of Service</a>
                    <a href="#">Safety Guidelines</a>
                </div>
            </div>
        </footer>
    );
}

export default Footer;
