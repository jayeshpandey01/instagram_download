import React from 'react';

function LoadingSpinner({ message }) {
  return (
    <div className="loading-spinner-container">
      <div className="loading-spinner">
        <div className="spinner-dot" />
        <div className="spinner-dot" />
        <div className="spinner-dot" />
      </div>
      <p className="loading-text">{message || 'Loading...'}</p>
    </div>
  );
}

export default LoadingSpinner;
