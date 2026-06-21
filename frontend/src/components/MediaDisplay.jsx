import React from 'react';
import './MediaDisplay.css';

function MediaDisplay({ data, onCopy, apiBaseUrl }) {
  if (!data) return null;

  const items = Array.isArray(data)
    ? data
    : Array.isArray(data.items)
      ? data.items
      : Array.isArray(data.media)
        ? data.media
        : Array.isArray(data.raw?.items)
          ? data.raw.items
          : [];

  const buildDownloadUrl = (mediaUrl, filename) => {
    const params = new URLSearchParams({
      url: mediaUrl,
      filename: filename || 'instagram-media'
    });

    return `${apiBaseUrl}/api/download-file?${params.toString()}`;
  };

  const triggerDownload = (mediaUrl, filename) => {
    const link = document.createElement('a');
    link.href = buildDownloadUrl(mediaUrl, filename);
    link.download = filename || 'instagram-media';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderMedia = () => {
    if (typeof data === 'string') {
      if (data.startsWith('http')) {
        return (
          <div className="media-item">
            <button
              className="download-media-btn"
              onClick={() => triggerDownload(data, 'instagram-media')}
              type="button"
            >
              Download Media
            </button>
            <button
              className="copy-btn"
              onClick={() => onCopy(data)}
              title="Copy URL"
            >
              Copy Link
            </button>
          </div>
        );
      }
    }

    if (items.length > 0) {
      return items.map((item, idx) => {
        const url = typeof item === 'string' ? item : item.url || item.downloadUrl || '';
        const type = item.type || 'media';
        const filename = item.filename || `instagram-media-${idx + 1}`;

        if (!url) {
          return null;
        }

        return (
          <div key={idx} className="media-item carousel-item">
            <p className="item-label">Media {idx + 1}</p>
            {type === 'image' || url.includes('.jpg') || url.includes('.png') || url.includes('.webp') ? (
              <img src={url} alt={`Media ${idx + 1}`} className="media-preview" />
            ) : (
              <video controls className="media-preview">
                <source src={url} />
                Your browser does not support the video tag.
              </video>
            )}
            <div className="media-actions">
              <button
                className="download-media-btn"
                onClick={() => triggerDownload(item.downloadUrl || url, filename)}
                type="button"
              >
                Download
              </button>
              <button
                className="copy-btn"
                onClick={() => onCopy(url)}
                title="Copy URL"
              >
                Copy
              </button>
            </div>
          </div>
        );
      });
    }

    if (data.url) {
      return (
        <div className="media-item">
          <button
            className="download-media-btn"
            onClick={() => triggerDownload(data.url, 'instagram-media')}
            type="button"
          >
            Download Media
          </button>
          <button
            className="copy-btn"
            onClick={() => onCopy(data.url)}
            title="Copy URL"
          >
            Copy Link
          </button>
        </div>
      );
    }

    if (data.media && Array.isArray(data.media)) {
      return data.media.map((item, idx) => (
        <div key={idx} className="media-item">
          {item.url && (
            <>
              {item.url.includes('video') || item.type === 'video' ? (
                <video controls className="media-preview">
                  <source src={item.url} />
                </video>
              ) : (
                <img src={item.url} alt={`Media ${idx + 1}`} className="media-preview" />
              )}
              <div className="media-actions">
                <button
                  className="download-media-btn"
                  onClick={() => triggerDownload(item.downloadUrl || item.url, item.filename || `instagram-media-${idx + 1}`)}
                  type="button"
                >
                  Download
                </button>
                <button
                  className="copy-btn"
                  onClick={() => onCopy(item.url)}
                  title="Copy URL"
                >
                  Copy
                </button>
              </div>
            </>
          )}
        </div>
      ));
    }

    return (
      <div className="media-item">
        <pre className="raw-data">{JSON.stringify(data, null, 2)}</pre>
        <button
          className="copy-btn"
          onClick={() => onCopy(JSON.stringify(data))}
        >
          Copy JSON
        </button>
      </div>
    );
  };

  return (
    <div className="media-display">
      <h2 className="media-title">Downloaded Content</h2>
      <div className="media-container">
        {renderMedia()}
      </div>
    </div>
  );
}

export default MediaDisplay;
