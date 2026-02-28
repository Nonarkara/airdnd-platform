import React from 'react';
import './HowItWorks.css';

function HowItWorks() {
    return (
        <section className="how-it-works">
            <div className="hiw-header">
                <h2>How Air DnD Works</h2>
                <p>Book a premium companion for dinner, a date, or massage in 3 simple steps.</p>
            </div>
            <div className="hiw-steps">
                <div className="hiw-step">
                    <div className="step-icon">🔍</div>
                    <h3>1. Discover</h3>
                    <p>Browse our curated selection of verified companions. View their photos, rates, and availability in real-time.</p>
                </div>
                <div className="hiw-step">
                    <div className="step-icon">💬</div>
                    <h3>2. Connect</h3>
                    <p>Select your favorite and our intelligent bot will handle the matchmaking and introduction instantly.</p>
                </div>
                <div className="hiw-step">
                    <div className="step-icon">🥂</div>
                    <h3>3. Enjoy</h3>
                    <p>Meet up for a professional massage, a sophisticated dinner, or a memorable date.</p>
                </div>
            </div>
        </section>
    );
}

export default HowItWorks;
