const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.FRONTEND_URL || ''
  ],
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const requestCounts = {};
const RATE_LIMIT = 1000;
const RATE_LIMIT_WINDOW = 1000;
const CLEANUP_INTERVAL = 60 * 1000;
const DOWNLOAD_CACHE_TTL = 30 * 60 * 1000;
const downloadCache = new Map();
const PYTHON_BIN = process.env.PYTHON_BIN || 'C:\\Users\\jayes\\AppData\\Local\\Programs\\Python\\Python311\\python.exe';
const INSTALOADER_BRIDGE = path.join(__dirname, 'instaloader_bridge.py');

const checkRateLimit = (req, res, next) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  if (!requestCounts[ip]) {
    requestCounts[ip] = { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
  }

  if (now > requestCounts[ip].resetTime) {
    requestCounts[ip] = { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
  }

  requestCounts[ip].count++;

  if (requestCounts[ip].count > RATE_LIMIT) {
    const retryAfterMs = Math.max(1, requestCounts[ip].resetTime - now);
    res.set('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
    return res.status(429).json({
      error: 'Rate limit exceeded. Try again in a moment.',
      remaining: 0,
      limit: RATE_LIMIT,
      windowMs: RATE_LIMIT_WINDOW
    });
  }

  res.set('X-RateLimit-Remaining', RATE_LIMIT - requestCounts[ip].count);
  res.set('X-RateLimit-Limit', RATE_LIMIT);
  res.set('X-RateLimit-Reset', String(requestCounts[ip].resetTime));
  next();
};

app.use(checkRateLimit);

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of Object.entries(requestCounts)) {
    if (!entry || now > entry.resetTime + CLEANUP_INTERVAL) {
      delete requestCounts[ip];
    }
  }
}, CLEANUP_INTERVAL).unref();

const validateInstagramUrl = (url) => {
  const instagramRegex = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|tv|reel)\/[\w-]+\/?/i;
  return instagramRegex.test(url);
};

const isHttpUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value);

const isLikelyMediaUrl = (value) => {
  if (!isHttpUrl(value)) return false;

  const lower = value.toLowerCase();
  const looksLikeInstagramPage = /instagram\.com\/(?:p|tv|reel)\/[\w-]+\/?/i.test(lower);
  const hasMediaExtension = /\.(mp4|mov|m4v|jpg|jpeg|png|gif|webp|webm|mp3)(\?|#|$)/i.test(lower);
  const hasCdnHint = /(fbcdn\.net|scontent|cdninstagram|instagramcdn)/i.test(lower);

  return !looksLikeInstagramPage && (hasMediaExtension || hasCdnHint);
};

const normalizeFilename = (input, fallback = 'instagram-media') => {
  const safeFallback = fallback.replace(/[^a-z0-9._-]+/gi, '_');

  if (!isHttpUrl(input)) {
    return safeFallback;
  }

  try {
    const parsed = new URL(input);
    const pathname = parsed.pathname.split('/').filter(Boolean).pop();

    if (pathname) {
      const cleaned = pathname.replace(/[^a-z0-9._-]+/gi, '_');
      return cleaned.length > 0 ? cleaned : safeFallback;
    }
  } catch (error) {
    // Ignore parse failures and fall back to the default name.
  }

  return safeFallback;
};

const safeJsonParse = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
};

const extractMediaCandidates = (value, seen = new Set()) => {
  const candidates = [];
  const current = safeJsonParse(value);

  if (!current) {
    return candidates;
  }

  if (typeof current === 'string') {
    if (isLikelyMediaUrl(current) && !seen.has(current)) {
      seen.add(current);
      candidates.push({
        url: current,
        downloadUrl: current,
        type: /\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(current) ? 'video' : 'image',
        filename: normalizeFilename(current)
      });
    }
    return candidates;
  }

  if (Array.isArray(current)) {
    current.forEach((item) => {
      candidates.push(...extractMediaCandidates(item, seen));
    });
    return candidates;
  }

  if (typeof current === 'object') {
    const directKeys = ['download_url', 'downloadUrl', 'video_url', 'videoUrl', 'image_url', 'imageUrl', 'url', 'src', 'link'];

    for (const key of directKeys) {
      if (current[key]) {
        candidates.push(...extractMediaCandidates(current[key], seen));
      }
    }

    const nestedKeys = ['media', 'items', 'carousel', 'carousel_media', 'images', 'videos', 'data', 'result'];
    for (const key of nestedKeys) {
      if (current[key]) {
        candidates.push(...extractMediaCandidates(current[key], seen));
      }
    }

    return candidates;
  }

  return candidates;
};

const runInstaloaderBridge = (url) => new Promise((resolve, reject) => {
  const pythonArgs = [INSTALOADER_BRIDGE, url];
  const child = spawn(PYTHON_BIN, pythonArgs, {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  child.on('error', (error) => {
    reject(new Error(`Failed to start Instaloader bridge: ${error.message}`));
  });

  child.on('close', (code) => {
    if (code !== 0) {
      return reject(new Error(stderr.trim() || `Instaloader bridge exited with code ${code}`));
    }

    try {
      const parsed = JSON.parse(stdout);
      resolve(parsed);
    } catch (error) {
      reject(new Error(`Invalid Instaloader bridge output: ${error.message}`));
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.post('/api/download', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!validateInstagramUrl(url)) {
      return res.status(400).json({ error: 'Invalid Instagram URL format' });
    }

    const cacheKey = url.trim();
    const cachedEntry = downloadCache.get(cacheKey);
    if (cachedEntry && Date.now() < cachedEntry.expiresAt) {
      return res.json({
        success: true,
        sourceUrl: url,
        items: cachedEntry.items,
        raw: cachedEntry.raw,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }

    const bridgeResult = await runInstaloaderBridge(url.trim());
    const mediaItems = Array.isArray(bridgeResult.items) ? bridgeResult.items : extractMediaCandidates(bridgeResult.items);
    downloadCache.set(cacheKey, {
      items: mediaItems,
      raw: bridgeResult.raw || bridgeResult,
      expiresAt: Date.now() + DOWNLOAD_CACHE_TTL
    });

    res.json({
      success: true,
      sourceUrl: url,
      items: mediaItems,
      raw: bridgeResult.raw || bridgeResult,
      provider: 'instaloader',
      cached: false,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('API Error:', error.message);

    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        error: 'Request timeout. The server took too long to respond.'
      });
    }

    res.status(500).json({
      error: 'Failed to download content. Please check the URL and try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      provider: 'instaloader'
    });
  }
});

app.get('/api/download-file', async (req, res) => {
  try {
    const { url, filename } = req.query;

    if (!isHttpUrl(url)) {
      return res.status(400).json({ error: 'A valid media URL is required' });
    }

    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    const contentType = response.headers['content-type'] || 'application/octet-stream';
    const safeName = normalizeFilename(filename || url);
    const extension = contentType.includes('video')
      ? '.mp4'
      : contentType.includes('image/png')
        ? '.png'
        : contentType.includes('image/webp')
          ? '.webp'
          : contentType.includes('image/gif')
            ? '.gif'
            : contentType.includes('image/jpeg')
              ? '.jpg'
              : '';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}${extension && !safeName.toLowerCase().endsWith(extension) ? extension : ''}"`);
    response.data.pipe(res);
  } catch (error) {
    console.error('File proxy error:', error.message);

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to download file',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    } else {
      res.end();
    }
  }
});

app.get('/api/cache-stats', (req, res) => {
  res.json({
    entries: downloadCache.size,
    rateLimitRemaining: undefined
  });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`CORS enabled for: ${process.env.FRONTEND_URL || 'localhost:3000'}`);
});

module.exports = app;
