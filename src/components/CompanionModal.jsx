import React from 'react';
import './CompanionModal.css';

function CompanionModal({ companion, onClose }) {
    if (!companion) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="btn-close" onClick={onClose}>×</button>

                <div className="modal-body">
                    <div className="modal-image-section">
                        <img src={companion.imageUrl} alt={companion.name} className="modal-main-image" />
                    </div>

                    <div className="modal-info-section">
                        <h2 className="modal-name">{companion.name} <span className="modal-age">({companion.age})</span></h2>
                        <div className="modal-location">
                            <span className="icon-pin">📍</span> {companion.location} • ⭐ {companion.rating} ({companion.reviews})
                        </div>

                        <div className="metrics-grid">
                            <div className="metric-box">
                                <span className="metric-value">{companion.metrics.height}</span>
                                <span className="metric-label">Height</span>
                            </div>
                            <div className="metric-box">
                                <span className="metric-value">{companion.metrics.weight}</span>
                                <span className="metric-label">Weight</span>
                            </div>
                            <div className="metric-box">
                                <span className="metric-value">{companion.age}</span>
                                <span className="metric-label">Age</span>
                            </div>
                        </div>

                        <div className="modal-description">
                            <p>{companion.description}</p>
                        </div>

                        <div className="modal-tags">
                            {companion.tags.map(tag => (
                                <span key={tag} className="pill-tag">{tag}</span>
                            ))}
                        </div>

                        <div className="modal-footer">
                            <div className="modal-price-range">
                                <span className="price-label">Price</span>
                                <span className="price-value">{companion.price}/hr</span>
                            </div>
                            <button className="btn-book">Book Now</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CompanionModal;
