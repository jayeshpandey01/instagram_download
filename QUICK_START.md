# 🚀 QUICK START GUIDE

## ⚠️ CRITICAL FIRST STEP

### 1. Regenerate Your API Key IMMEDIATELY

Your API key was exposed in the original curl command. **DO NOT USE IT ANYMORE**

**Steps:**
1. Go to https://rapidapi.com/dashboard
2. Sign in to your account
3. Find "Instagram Downloader API" in your subscriptions
4. Go to Settings/Security
5. Regenerate/Revoke the old key
6. Copy the NEW key
7. Use the NEW key in `.env` files

---

## 📦 Setup Instructions

### Option A: Use This Complete Project

All files are provided in the cloud storage:
- `backend-server.js` - Express backend
- `backend-package.json` - Backend dependencies
- `.env-backend-template` - Backend config template
- `src-App.jsx` through `src-components.css` - React components
- `frontend-package.json` - Frontend dependencies
- `.env-frontend-template` - Frontend config template

### Option B: Step-by-Step Manual Setup

```bash
# 1. Create project directory
mkdir instagram-downloader
cd instagram-downloader

# 2. Setup backend
mkdir backend
cd backend

# 3. Copy backend-server.js here
# 4. Copy backend-package.json and rename to package.json
npm install

# 5. Create .env file
cat > .env << EOF
RAPIDAPI_KEY=your_new_api_key_here
FRONTEND_URL=http://localhost:3000
PORT=5000
NODE_ENV=development
EOF

# 6. Start backend
npm start

# Backend now runs on http://localhost:5000
```

```bash
# In another terminal:

# 7. Setup frontend
cd frontend
npx create-react-app .

# 8. Install axios
npm install axios

# 9. Copy all .jsx files from src-* to src/components/
# 10. Copy App.jsx and App.css to src/
# 11. Copy index.html to public/

# 12. Create .env file
cat > .env << EOF
REACT_APP_API_URL=http://localhost:5000
REACT_APP_ENV=development
EOF

# 13. Start frontend
npm start

# Frontend now runs on http://localhost:3000
```

---

## ✅ Testing Locally

1. Open http://localhost:3000 in browser
2. Paste Instagram URL (e.g., https://www.instagram.com/p/XXX/)
3. Click "Download"
4. Should show media!

---

## 🌐 Deploy to Production

### Backend Deployment (Choose One)

**Option 1: Railway.app (Recommended)**
```bash
npm install -g @railway/cli
railway login
railway init
# Push code to Railway
# Add RAPIDAPI_KEY to Railway environment
```

Get backend URL: `https://xxxx.railway.app`

**Option 2: Render.com**
- Connect GitHub repo
- New Web Service
- Build: `npm install`
- Start: `node backend-server.js`
- Add environment variables

### Frontend Deployment (Choose One)

**Option 1: Vercel (Recommended)**
```bash
npm install -g vercel
vercel login
vercel
```

During setup:
- Select project directory: `./frontend`
- Add `REACT_APP_API_URL` = your backend URL

**Option 2: Netlify**
- Connect GitHub
- Build command: `npm run build`
- Publish: `build`
- Add environment variables

---

## 📝 What Each File Does

### Backend Files
- **backend-server.js** - Main Express server
  - Handles `/api/download` endpoint
  - Keeps API key secure
  - Validates Instagram URLs
  - Rate limits requests

- **package.json** - Lists dependencies
  - express, axios, cors, dotenv

- **.env** - Configuration (NOT in GitHub!)
  - RAPIDAPI_KEY=your-key
  - FRONTEND_URL=http://localhost:3000

### Frontend Files
- **App.jsx** - Root React component
  - Manages tabs and dark mode
  - Stores download history

- **Downloader.jsx** - Main download component
  - URL input form
  - Calls backend API
  - Shows loading/error states

- **MediaDisplay.jsx** - Shows downloaded content
  - Displays images/videos
  - Download buttons
  - Copy to clipboard

- **Header.jsx** - Top navigation
  - Logo and theme toggle

- **History.jsx** - Download history
  - Shows past downloads
  - Delete/clear options

- **App.css + Component CSS** - Styling
  - Responsive design
  - Light/dark modes
  - Nice animations

---

## 🔒 Security Checklist

Before deploying to production:

- [ ] Regenerated API key (old one exposed)
- [ ] `.env` file added to `.gitignore`
- [ ] No hardcoded API keys in frontend
- [ ] Backend validates all inputs
- [ ] CORS configured for your domain
- [ ] Rate limiting enabled
- [ ] HTTPS enabled in production
- [ ] Error messages don't leak info

---

## 🧪 Test Endpoints

### Backend Health
```bash
curl http://localhost:5000/api/health
# Should return: { "status": "OK", ... }
```

### Download Endpoint
```bash
curl -X POST http://localhost:5000/api/download \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.instagram.com/p/ABC123XYZ/"}'
```

---

## 📊 Performance Targets

- ✅ Frontend loads in <2 seconds
- ✅ Download completes in <30 seconds
- ✅ Supports 2-10MB files
- ✅ 100 requests/hour rate limit
- ✅ Works on 4G and WiFi

---

## 🆘 If Something Goes Wrong

### Backend won't start?
```bash
# Check Node version
node -v  # Should be 16+

# Reinstall dependencies
rm -rf node_modules
npm install

# Check .env file
cat .env  # Should have RAPIDAPI_KEY
```

### Frontend shows errors?
1. Open browser DevTools (F12)
2. Check Console tab for errors
3. Check Network tab to see API calls
4. Verify REACT_APP_API_URL is correct

### "Network Error" when downloading?
- Is backend running? (`http://localhost:5000`)
- Is frontend API_URL correct?
- Check firewall settings
- Try backend directly with curl

---

## 📚 File Checklist

Required files:
- ✅ backend-server.js
- ✅ backend/package.json
- ✅ backend/.env
- ✅ frontend/src/App.jsx
- ✅ frontend/src/App.css
- ✅ frontend/src/components/*.jsx
- ✅ frontend/src/components/*.css
- ✅ frontend/package.json
- ✅ frontend/.env
- ✅ frontend/public/index.html

Optional:
- README.md (documentation)
- DEPLOYMENT_GUIDE.md (detailed setup)
- .gitignore (git configuration)

---

## 🎉 Success Indicators

✅ You know you're done when:
- [ ] Backend starts without errors
- [ ] Frontend loads at localhost:3000
- [ ] Can paste Instagram URL
- [ ] Can click Download
- [ ] Media appears on screen
- [ ] Can copy URLs and download
- [ ] Dark mode toggle works
- [ ] History tab shows downloads
- [ ] Works on both desktop and mobile

---

## 🚀 Next Steps

1. **Develop locally** - Test all features
2. **Deploy backend** - Railway or Render
3. **Update frontend URL** - Point to deployed backend
4. **Deploy frontend** - Vercel or Netlify
5. **Test production** - Visit deployed URL
6. **Share with friends!** - Enjoy!

---

## 📞 Need Help?

1. Check DEPLOYMENT_GUIDE.md for detailed steps
2. Check README.md for architecture
3. Review browser console (F12) for errors
4. Check backend logs for server errors
5. Verify all .env files are set correctly

---

## ⭐ Pro Tips

- Use `npm install -g nodemon` for auto-restart backend during development
- Use React DevTools browser extension for debugging
- Test with URLs from different Instagram accounts
- Monitor RapidAPI dashboard for rate limits
- Keep API key safe - rotate it regularly

---

Good luck! 🎬✨
