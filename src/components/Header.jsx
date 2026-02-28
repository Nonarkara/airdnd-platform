import React from 'react';

function Header() {
    return (
        <header className="header">
            <div className="logo">
                <span className="logo-icon">✨</span>
                AirDnD
            </div>
            <nav className="nav-links">
                <a href="#" className="nav-link active">Discover</a>
                <a href="#" className="nav-link">Bookings</a>
                <a href="#" className="nav-link">Messages</a>
                <a href="#" className="nav-link">Profile</a>
            </nav>
            <button className="btn-premium">Premium</button>
        </header>
    );
}

export default Header;
