import React from 'react';
import './HeroSection.css';

function HeroSection({ t }) {
    return (
        <section className="hero-section">
            <div className="hero-overlay"></div>
            <div className="hero-content">
                <h1>{t.hero.title}</h1>
                <p>{t.hero.subtitle}</p>

                <div className="hero-search-bar">
                    <div className="search-field">
                        <label>{t.hero.searchLocation}</label>
                        <input type="text" placeholder={t.hero.searchLocationPlaceholder} />
                    </div>
                    <div className="search-field">
                        <label>{t.hero.searchDate}</label>
                        <input type="text" placeholder={t.hero.searchDatePlaceholder} />
                    </div>
                    <div className="search-field">
                        <label>{t.hero.searchExperience}</label>
                        <input type="text" placeholder={t.hero.searchExperiencePlaceholder} />
                    </div>
                    <button className="btn-search">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
                        </svg>
                        {t.hero.searchButton}
                    </button>
                </div>
            </div>
        </section>
    );
}

export default HeroSection;
