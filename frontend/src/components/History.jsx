import React from 'react';
import './History.css';

function History({ downloads, onDelete, onClearAll }) {
  if (downloads.length === 0) {
    return (
      <div className="history-container">
        <div className="empty-state">
          <p className="empty-icon">No history</p>
          <p className="empty-message">No downloads yet</p>
          <p className="empty-hint">Start downloading Instagram content to see it here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="history-container">
      <div className="history-header">
        <h2>Download History</h2>
        <button
          className="clear-button"
          onClick={onClearAll}
        >
          Clear All
        </button>
      </div>

      <div className="history-list">
        {downloads.map((download) => (
          <div key={download.id} className="history-item">
            <div className="item-content">
              <div className="item-url">
                <a href={download.url} target="_blank" rel="noopener noreferrer" className="url-link">
                  {download.url.slice(0, 60)}...
                </a>
              </div>
              <div className="item-time">
                {download.timestamp}
              </div>
            </div>
            <button
              className="delete-button"
              onClick={() => onDelete(download.id)}
              title="Delete this download"
            >
              X
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default History;
