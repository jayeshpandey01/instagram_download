# Deployment Guide

This repo is ready to deploy as two services:

- A Python backend in `backend/`
- A static React frontend in `frontend/`

## Recommended deployment layout

Use Render with the included `render.yaml`.

### 1. Backend service

- Type: Python web service
- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `python instaloader_server.py`

Environment variables:

```env
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://your-frontend-domain
```

### 2. Frontend service

- Type: static site
- Root directory: `frontend`
- Build command: `npm install && npm run build`
- Publish directory: `build`

Environment variables:

```env
REACT_APP_API_URL=https://your-backend-domain
```

## Using the included Render config

The repo includes `render.yaml`, which defines both services.

If your hosting provider supports Render blueprints, you can import the repo and fill in the environment variables above.

## Local development

### Backend

```powershell
cd backend
pip install -r requirements.txt
npm start
```

### Frontend

```powershell
cd frontend
npm install
npm start
```

## Verification

After deployment, test these URLs:

### Backend health

`GET https://your-backend-domain/api/health`

### Download request

`POST https://your-backend-domain/api/download`

Body:

```json
{
  "url": "https://www.instagram.com/reel/SHORTCODE/"
}
```

### File download

Open the `downloadUrl` returned by the backend through:

`GET https://your-backend-domain/api/download-file?url=...&filename=...`

## Important notes

- The old RapidAPI flow is no longer used.
- There is no API key to manage for the current version.
- Set `FRONTEND_URL` correctly or CORS will block the browser.
- The backend rate limit is 1000 requests per second per IP.

## Suggested deployment order

1. Deploy the backend.
2. Copy the backend URL into the frontend environment variable.
3. Deploy the frontend.
4. Test download, download-file, and history behavior in the browser.

