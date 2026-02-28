import React from 'react';
import './CompanionCard.css';

function CompanionCard({ companion, onClick }) {
    return (
        <div className="companion-card" onClick={() => onClick(companion)}>
            <div className="card-image-wrapper">
                <img src={companion.imageUrl} alt={companion.name} className="card-image" />
                <button className="btn-favorite">♡</button>
            </div>

            <div className="card-content">
                <div className="card-header">
                    <h3 className="card-name">{companion.name} <span className="card-age">({companion.age})</span></h3>
                    <span className="card-price">{companion.price}/hr</span>
                </div>

                <div className="card-tags">
                    {companion.tags.map(tag => (
                        <span key={tag} className="pill-tag">{tag}</span>
                    ))}
                </div>

                <div className="card-footer">
                    <div className="card-provider">
                        <div className="provider-avatar"></div>
                        <span className="provider-price">{companion.price}/hr</span>
                    </div>
                    <button className="btn-favorite-bottom">♡</button>
                </div>
            </div>
        </div>
    );
}

export default CompanionCard;
