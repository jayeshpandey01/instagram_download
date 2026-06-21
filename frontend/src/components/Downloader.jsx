import React, { useState } from 'react';
import axios from 'axios';
import './Downloader.css';
import MediaDisplay from './MediaDisplay';
import ErrorAlert from './ErrorAlert';
import LoadingSpinner from './LoadingSpinner';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function Downloader({ onDownloadSuccess }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState('');

  const validateUrl = (inputUrl) => {
    const instagramRegex = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|tv|reel)\/[\w-]+\/?/i;
    return instagramRegex.test(inputUrl);
  };

  const handleDownload = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!url.trim()) {
      setError('Please enter an Instagram URL');
      return;
    }

    if (!validateUrl(url)) {
      setError('Invalid Instagram URL. Please enter a valid post, reel, or TV link.');
      return;
    }

    setLoading(true);
    setProgress('Connecting to API...');

    try {
      setProgress('Downloading media...');

      const response = await axios.post(`${API_BASE_URL}/api/download`, {
        url: url.trim()
      }, {
        timeout: 30000
      });

      if (response.data.success) {
        setProgress('Processing...');
        setResult(response.data);

        onDownloadSuccess({
          url: url.trim(),
          data: response.data
        });

        setUrl('');
        setProgress(response.data.cached ? 'Done! Loaded from cache.' : 'Done!');
        setTimeout(() => setProgress(''), 2000);
      }
    } catch (err) {
      console.error('Download error:', err);

      let errorMessage = 'Failed to download. Please try again.';

      if (err.response?.status === 400) {
        errorMessage = err.response.data.error || 'Invalid URL provided.';
      } else if (err.response?.status === 429) {
        errorMessage = err.response.data?.provider === 'rapidapi'
          ? 'RapidAPI is rate-limiting this request. Please wait and try the same URL again later.'
          : 'Too many requests. Please wait a moment and try again.';
      } else if (err.response?.status === 504) {
        errorMessage = 'Server timeout. The media file is too large or connection is slow.';
      } else if (err.response?.status === 403) {
        errorMessage = err.response.data?.error || 'Instagram requires login for this content.';
      } else if (err.response?.status === 404) {
        errorMessage = err.response.data?.error || 'Instagram post not found.';
      } else if (err.response?.status === 500 || err.response?.status === 502) {
        const backendMessage = err.response.data?.error || err.response.data?.details || '';
        if (/blocked|rejected|metadata/i.test(backendMessage)) {
          errorMessage = 'Instagram blocked the metadata request. Try again later or use a different public post.';
        } else if (/login|private/i.test(backendMessage)) {
          errorMessage = 'Instagram requires login for this content.';
        } else {
          errorMessage = backendMessage || 'Server error while fetching media.';
        }
      } else if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout. Please try again with a different link.';
      } else if (err.message === 'Network Error') {
        errorMessage = 'Network error. Check your connection or try the backend URL.';
      }

      setError(errorMessage);
      setProgress('');
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
      setError(null);
    } catch (err) {
      setError('Failed to read clipboard. Please paste manually.');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!');
    });
  };

  return (
    <div className="downloader-container">
      <div className="downloader-card">
        <h1 className="title">Instagram Downloader</h1>
        <p className="subtitle">Download Instagram photos, reels, and videos instantly</p>

        <form onSubmit={handleDownload} className="download-form">
          <div className="input-group">
            <input
              type="text"
              placeholder="Paste Instagram URL (post, reel, or TV link)..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="url-input"
              disabled={loading}
            />
            <button
              type="button"
              className="paste-button"
              onClick={handlePaste}
              disabled={loading}
              title="Paste from clipboard"
            >
              Paste
            </button>
          </div>

          <button
            type="submit"
            className="download-button"
            disabled={loading || !url.trim()}
          >
            {loading ? (
              <>
                <span className="spinner" />
                {progress || 'Downloading...'}
              </>
            ) : (
              'Download'
            )}
          </button>
        </form>

        {error && <ErrorAlert message={error} />}
        {loading && <LoadingSpinner message={progress} />}

        {result && (
          <div className="result-container">
            <div className="success-message">
              Downloaded successfully!
            </div>
            <MediaDisplay
              data={result}
              onCopy={copyToClipboard}
              apiBaseUrl={API_BASE_URL}
            />
          </div>
        )}

        <div className="info-box">
          <h3>How to use</h3>
          <ol>
            <li>Copy the URL of an Instagram post, reel, or TV video</li>
            <li>Paste it in the input field above</li>
            <li>Click Download and wait for the content to load</li>
            <li>Download or view the media content</li>
          </ol>
        </div>

        <div className="note-box">
          <p>
            <strong>Note:</strong> Only download content that you have permission to download.
            Respect copyright and Instagram's terms of service.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Downloader;
