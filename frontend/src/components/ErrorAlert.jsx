import React from 'react';

function ErrorAlert({ message }) {
  return (
    <div className="error-alert">
      <span className="error-icon">X</span>
      <span className="error-message">{message}</span>
    </div>
  );
}

export default ErrorAlert;
