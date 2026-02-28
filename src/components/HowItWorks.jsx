import React from 'react';
import './HowItWorks.css';

function HowItWorks({ t }) {
    return (
        <section className="how-it-works">
            <div className="hiw-header">
                <h2>{t.howItWorks.title}</h2>
            </div>
            <div className="hiw-steps">
                <div className="hiw-step">
                    <div className="step-icon">🔍</div>
                    <h3>{t.howItWorks.step1Title}</h3>
                    <p>{t.howItWorks.step1Desc}</p>
                </div>
                <div className="hiw-step">
                    <div className="step-icon">💬</div>
                    <h3>{t.howItWorks.step2Title}</h3>
                    <p>{t.howItWorks.step2Desc}</p>
                </div>
                <div className="hiw-step">
                    <div className="step-icon">🥂</div>
                    <h3>{t.howItWorks.step3Title}</h3>
                    <p>{t.howItWorks.step3Desc}</p>
                </div>
            </div>
        </section>
    );
}

export default HowItWorks;
