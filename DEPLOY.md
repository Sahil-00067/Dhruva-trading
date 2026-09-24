# Deploy Dhruva to Production

## Option 1: Render.com (Recommended - Free Tier)

### Step 1: Create GitHub Repo
```bash
# On GitHub, create a new public repo called "dhruva-trading"
# Then push your code:
git remote add origin https://github.com/YOUR_USERNAME/dhruva-trading.git
git push -u origin main
```

### Step 2: Deploy Backend
1. Go to https://render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repo
4. Settings:
   - Name: `dhruva-backend`
   - Root Directory: `backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Add Environment Variable:
     - `PYTHON_VERSION` = `3.11.0`
5. Click "Create Web Service"

### Step 3: Deploy Frontend
1. Click "New +" → "Static Site"
2. Connect your GitHub repo
3. Settings:
   - Name: `dhruva-frontend`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`
4. Click "Create Static Site"

### Step 4: Update Frontend API URL
Edit `vite.config.ts` and change:
```ts
proxy: {
  '/api': { target: 'https://dhruva-backend.onrender.com', changeOrigin: true },
},
```

### Step 5: Set Environment Variables
In Render dashboard for backend:
- `DHRUVA_JWT_SECRET` = your-secret-key
- `TWILIO_ACCOUNT_SID` = ACxxxxxxxx
- `TWILIO_AUTH_TOKEN` = your_token
- `TWILIO_WHATSAPP_FROM` = whatsapp:+14155238886

---

## Option 2: Railway.app (Easier)

1. Go to https://railway.app
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repo
4. Railway will auto-detect and deploy both services
5. Add environment variables in Railway dashboard

---

## Option 3: Vercel + Render

### Frontend on Vercel
```bash
npm i -g vercel
vercel --prod
```

### Backend on Render
Same as Option 1 above.

---

## Option 4: Docker (Self-Hosted)

```bash
# Build and run
docker-compose up -d

# Or with production env
cp backend/.env.example backend/.env
# Edit .env with your credentials
docker-compose up -d
```

---

## Quick Deploy Commands

```bash
# 1. Create GitHub repo and push
gh repo create dhruva-trading --public
git remote add origin https://github.com/YOUR_USERNAME/dhruva-trading.git
git push -u origin main

# 2. Deploy to Render
# Visit https://render.com and connect your repo
```

---

## Post-Deployment Checklist

- [ ] Test login with demo account
- [ ] Verify WhatsApp notifications work
- [ ] Test backtest engine
- [ ] Check mobile responsiveness
- [ ] Set up SSL (automatic on Render/Vercel)
- [ ] Configure custom domain (optional)

---

## Costs

| Service | Free Tier | Paid |
|---------|-----------|------|
| Render | 750 hrs/month | $7/mo per service |
| Railway | $5 free credits | Pay as you go |
| Vercel | Unlimited | Pro $20/mo |
| Twilio | $15.50 trial | $1/mo + usage |

**Total monthly cost: ~$15-20** (mostly Twilio WhatsApp)
