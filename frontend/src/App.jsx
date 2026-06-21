import React, { useEffect, useState } from 'react';
import './App.css';
import Downloader from './components/Downloader';
import History from './components/History';
import Header from './components/Header';

function App() {
  const [activeTab, setActiveTab] = useState('downloader');
  const [downloads, setDownloads] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('instagramDownloads');
    if (saved) {
      try {
        setDownloads(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to load history:', error);
      }
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(prefersDark);
  }, []);

  useEffect(() => {
    localStorage.setItem('instagramDownloads', JSON.stringify(downloads));
  }, [downloads]);

  const handleNewDownload = (downloadData) => {
    const newDownload = {
      id: Date.now(),
      url: downloadData.url,
      timestamp: new Date().toLocaleString(),
      data: downloadData.data
    };
    setDownloads([newDownload, ...downloads]);
  };

  const handleDeleteDownload = (id) => {
    setDownloads(downloads.filter((download) => download.id !== id));
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear all history?')) {
      setDownloads([]);
    }
  };

  return (
    <div className={`app ${isDarkMode ? 'dark' : 'light'}`}>
      <Header isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />

      <nav className="nav-tabs">
        <button
          className={`tab-button ${activeTab === 'downloader' ? 'active' : ''}`}
          onClick={() => setActiveTab('downloader')}
        >
          Download
        </button>
        <button
          className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          History ({downloads.length})
        </button>
      </nav>

      <main className="main-content">
        {activeTab === 'downloader' && (
          <Downloader onDownloadSuccess={handleNewDownload} />
        )}
        {activeTab === 'history' && (
          <History
            downloads={downloads}
            onDelete={handleDeleteDownload}
            onClearAll={handleClearHistory}
          />
        )}
      </main>

      <footer className="footer">
        <p>Instagram Downloader | Built with React</p>
        <p style={{ fontSize: '12px', opacity: 0.7 }}>
          API powered by RapidAPI | Secure proxy backend
        </p>
      </footer>
    </div>
  );
}

export default App;
