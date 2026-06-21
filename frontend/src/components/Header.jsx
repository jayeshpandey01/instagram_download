import React from 'react';
import './Header.css';

function Header({ isDarkMode, setIsDarkMode }) {
  return (
    <header className="header">
      <div className="header-content">
        <h1 className="logo">InstaDown</h1>
        <button
          className="theme-toggle"
          onClick={() => setIsDarkMode(!isDarkMode)}
          title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDarkMode ? 'Light' : 'Dark'}
        </button>
      </div>
    </header>
  );
}

export default Header;
