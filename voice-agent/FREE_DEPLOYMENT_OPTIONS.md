# Free Deployment Options for Voice Agent

## Option 1: Render.com (Recommended - Easiest)

### Free Tier
- 750 hours/month free
- Automatic deploys from GitHub
- Sleeps after 15 min inactivity (wakes on request)
- Perfect for development/testing

### Deploy Steps

1. **Create `render.yaml`** (already created below)

2. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Add Render deployment"
   git push
   ```

3. **Deploy on Render**
   - Go to https://dashboard.render.com
   - Click "New +" → "Blueprint"
   - Connect your GitHub repo
   - Select `backend/voice-agent/render.yaml`
   - Add environment variables
   - Click "Apply"

### Pros
- True free tier (no credit card required)
- Easy setup
- Auto-deploy from GitHub
- Good for development

### Cons
- Sleeps after 15 min inactivity
- Cold start ~30 seconds
- Limited to 750 hours/month

---

## Option 2: Fly.io

### Free Tier
- 3 shared-cpu VMs
- 3GB persistent storage
- 160GB outbound data transfer

### Deploy Steps

1. **Install Fly CLI**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login**
   ```bash
   fly auth login
   ```

3. **Launch App**
   ```bash
   cd backend/voice-agent
   fly launch
   ```

4. **Set Secrets**
   ```bash
   fly secrets set LIVEKIT_URL=wss://...
   fly secrets set LIVEKIT_API_KEY=...
   fly secrets set LIVEKIT_API_SECRET=...
   fly secrets set GROQ_API_KEY=...
   fly secrets set DEEPGRAM_API_KEY=...
   ```

5. **Deploy**
   ```bash
   fly deploy
   ```

### Pros
- Always on (no sleep)
- Fast cold starts
- Good free tier
- Global edge network

### Cons
- Requires credit card (for verification)
- More complex setup

---

## Option 3: Google Cloud Run

### Free Tier
- 2 million requests/month
- 360,000 GB-seconds memory
- 180,000 vCPU-seconds

### Deploy Steps

1. **Install gcloud CLI**
   ```bash
   # macOS
   brew install google-cloud-sdk
   ```

2. **Login**
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

3. **Deploy**
   ```bash
   cd backend/voice-agent
   gcloud run deploy voice-agent \
     --source . \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars LIVEKIT_URL=wss://...,LIVEKIT_API_KEY=...,LIVEKIT_API_SECRET=...,GROQ_API_KEY=...,DEEPGRAM_API_KEY=...
   ```

### Pros
- Generous free tier
- Scales to zero (no cost when idle)
- Fast cold starts
- Google infrastructure

### Cons
- Requires credit card
- More complex setup
- GCP learning curve

---

## Option 4: Koyeb

### Free Tier
- 1 web service
- 512MB RAM
- Sleeps after inactivity

### Deploy Steps

1. **Go to Koyeb Dashboard**
   - https://app.koyeb.com

2. **Create New App**
   - Click "Create App"
   - Select "GitHub"
   - Choose your repo
   - Set root directory: `backend/voice-agent`

3. **Configure**
   - Build: Docker
   - Port: 8080
   - Add environment variables

4. **Deploy**

### Pros
- No credit card required
- Easy GitHub integration
- Auto-deploy

### Cons
- Sleeps after inactivity
- Limited resources
- Smaller community

---

## Option 5: Railway (Free Tier)

### Free Tier
- $5 free credits/month
- ~500 hours of usage
- No credit card required initially

### Deploy Steps
(See RAILWAY_DEPLOYMENT.md)

### Pros
- Easy to use
- Good developer experience
- No sleep (within free hours)

### Cons
- Limited free hours
- May need paid plan for production

---

## Option 6: Heroku (Limited Free)

### Note
Heroku removed free tier in November 2022, but offers:
- $5/month Eco plan (sleeps after 30 min)
- Student credits available

### Deploy Steps

1. **Install Heroku CLI**
   ```bash
   brew tap heroku/brew && brew install heroku
   ```

2. **Login**
   ```bash
   heroku login
   ```

3. **Create App**
   ```bash
   cd backend/voice-agent
   heroku create your-voice-agent
   ```

4. **Set Config**
   ```bash
   heroku config:set LIVEKIT_URL=wss://...
   heroku config:set LIVEKIT_API_KEY=...
   heroku config:set LIVEKIT_API_SECRET=...
   heroku config:set GROQ_API_KEY=...
   heroku config:set DEEPGRAM_API_KEY=...
   ```

5. **Deploy**
   ```bash
   git push heroku main
   ```

### Pros
- Mature platform
- Easy deployment
- Good documentation

### Cons
- No longer free
- $5/month minimum

---

## Comparison Table

| Platform | Free Tier | Sleep? | Credit Card? | Ease | Best For |
|----------|-----------|--------|--------------|------|----------|
| **Render** | ✅ 750hrs | Yes (15min) | No | ⭐⭐⭐⭐⭐ | Development |
| **Fly.io** | ✅ 3 VMs | No | Yes | ⭐⭐⭐⭐ | Production |
| **Cloud Run** | ✅ 2M req | Yes | Yes | ⭐⭐⭐ | Scale to zero |
| **Koyeb** | ✅ 1 service | Yes | No | ⭐⭐⭐⭐ | Simple apps |
| **Railway** | ✅ $5 credit | No | No | ⭐⭐⭐⭐⭐ | Development |
| **Heroku** | ❌ $5/mo | Yes | Yes | ⭐⭐⭐⭐⭐ | Legacy apps |

---

## Recommended: Render.com

For completely free deployment without credit card, **Render.com** is the best option.

### Why Render?
1. ✅ No credit card required
2. ✅ 750 hours/month free (enough for development)
3. ✅ Auto-deploy from GitHub
4. ✅ Easy setup
5. ✅ Good for voice agent (wakes quickly)

### Handling Sleep Mode

The voice agent will sleep after 15 minutes of inactivity. When a user starts a voice session:
1. LiveKit tries to connect to agent
2. Render wakes the service (~30 seconds)
3. Agent connects and conversation starts

**Workaround for instant availability:**
- Use a cron job to ping the service every 14 minutes
- Or upgrade to paid plan ($7/month for always-on)

---

## Next Steps

1. Choose a platform (Render recommended for free)
2. Follow deployment steps
3. Test voice agent
4. Monitor usage
5. Upgrade if needed for production

See platform-specific guides below for detailed instructions.
