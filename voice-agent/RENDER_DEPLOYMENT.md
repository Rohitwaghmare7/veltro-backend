# Deploy Voice Agent to Render.com (100% FREE)

## Why Render?

✅ **Completely Free** - No credit card required  
✅ **750 hours/month** - Enough for development and testing  
✅ **Auto-deploy** - Deploys automatically from GitHub  
✅ **Easy setup** - 5 minutes to deploy  
✅ **Docker support** - Uses your Dockerfile  

## Prerequisites

1. GitHub account
2. Render.com account (free - sign up at https://render.com)
3. API keys ready:
   - LiveKit (URL, API Key, Secret)
   - Groq API Key
   - Deepgram API Key

## Deployment Steps

### Step 1: Prepare Repository

1. **Commit all files**
   ```bash
   git add backend/voice-agent/
   git commit -m "Add Render deployment configuration"
   git push origin main
   ```

### Step 2: Deploy on Render

#### Option A: Using Blueprint (Recommended)

1. **Go to Render Dashboard**
   - Visit https://dashboard.render.com
   - Click "New +" → "Blueprint"

2. **Connect Repository**
   - Click "Connect account" to link GitHub
   - Select your repository
   - Render will detect `render.yaml`

3. **Configure Blueprint**
   - Blueprint name: `voice-agent`
   - Click "Apply"

4. **Add Environment Variables**
   Render will prompt for these variables:
   ```
   LIVEKIT_URL=wss://your-livekit-url.livekit.cloud
   LIVEKIT_API_KEY=your-livekit-api-key
   LIVEKIT_API_SECRET=your-livekit-api-secret
   GROQ_API_KEY=your-groq-api-key
   DEEPGRAM_API_KEY=your-deepgram-api-key
   ```

5. **Deploy**
   - Click "Create Blueprint"
   - Wait for build to complete (~3-5 minutes)
   - Service will be live!

#### Option B: Manual Setup

1. **Create New Web Service**
   - Go to https://dashboard.render.com
   - Click "New +" → "Web Service"

2. **Connect Repository**
   - Select "Build and deploy from a Git repository"
   - Connect your GitHub account
   - Select your repository

3. **Configure Service**
   - Name: `voice-agent`
   - Region: Oregon (or closest to you)
   - Branch: `main`
   - Root Directory: `backend/voice-agent`
   - Environment: `Docker`
   - Plan: `Free`

4. **Add Environment Variables**
   Click "Advanced" → "Add Environment Variable":
   ```
   LIVEKIT_URL=wss://your-livekit-url.livekit.cloud
   LIVEKIT_API_KEY=your-livekit-api-key
   LIVEKIT_API_SECRET=your-livekit-api-secret
   GROQ_API_KEY=your-groq-api-key
   DEEPGRAM_API_KEY=your-deepgram-api-key
   ```

5. **Create Web Service**
   - Click "Create Web Service"
   - Wait for deployment

### Step 3: Verify Deployment

1. **Check Logs**
   - Go to your service dashboard
   - Click "Logs" tab
   - Look for:
     ```
     Starting voice agent...
     Using Groq LLM with llama-3.1-8b-instant model
     Agent ready and listening...
     ```

2. **Test Connection**
   - Your service URL: `https://voice-agent-xxxx.onrender.com`
   - The agent connects to LiveKit Cloud automatically
   - No need to access the URL directly

3. **Test Frontend**
   - Go to your frontend app
   - Navigate to `/onboarding`
   - Select "Voice Mode"
   - Start conversation
   - Agent should respond

## Understanding Free Tier Limits

### What You Get
- ✅ 750 hours/month compute time
- ✅ Automatic HTTPS
- ✅ Auto-deploy from GitHub
- ✅ Unlimited bandwidth
- ✅ Custom domains (optional)

### Sleep Behavior
- Service sleeps after **15 minutes** of inactivity
- Wakes up on first request (~30 seconds cold start)
- This is normal for free tier

### How It Affects Voice Agent
1. User starts voice session
2. LiveKit tries to connect to agent
3. If sleeping, Render wakes it (~30 sec)
4. Agent connects and conversation starts

**User Experience:**
- First user after sleep: 30 second wait
- Subsequent users: Instant connection
- After 15 min idle: Sleeps again

## Keeping Service Awake (Optional)

### Option 1: Cron Job (Free)

Use a free cron service to ping your agent every 14 minutes:

1. **Create a simple endpoint** (add to agent.py):
   ```python
   from http.server import HTTPServer, BaseHTTPRequestHandler
   
   class HealthHandler(BaseHTTPRequestHandler):
       def do_GET(self):
           self.send_response(200)
           self.end_headers()
           self.wfile.write(b'OK')
   
   # Start health check server on port 8080
   health_server = HTTPServer(('0.0.0.0', 8080), HealthHandler)
   ```

2. **Use cron-job.org**
   - Go to https://cron-job.org
   - Create free account
   - Add job: `https://your-service.onrender.com/health`
   - Schedule: Every 14 minutes

### Option 2: Upgrade to Paid ($7/month)

- Always-on service
- No sleep
- Faster performance
- More resources

## Troubleshooting

### Build Fails

**Error: "Failed to build Docker image"**
- Check Dockerfile syntax
- Verify requirements.txt exists
- Check Render build logs

**Solution:**
```bash
# Test build locally
cd backend/voice-agent
docker build -t voice-agent .
docker run voice-agent
```

### Service Won't Start

**Error: "Service exited with code 1"**
- Check environment variables are set
- Verify API keys are valid
- Check logs for specific error

**Solution:**
- Go to Environment tab
- Verify all 5 variables are set
- Click "Manual Deploy" to redeploy

### Agent Not Connecting to LiveKit

**Error: "Connection refused" or "Authentication failed"**
- Verify LIVEKIT_URL format (must start with `wss://`)
- Check LIVEKIT_API_KEY and LIVEKIT_API_SECRET
- Ensure LiveKit project is active

**Solution:**
```bash
# Test credentials locally
cd backend/voice-agent
source venv/bin/activate
python agent.py dev
```

### Slow Cold Starts

**Issue: Takes 30+ seconds to wake**
- This is normal for free tier
- Consider cron job to keep awake
- Or upgrade to paid plan

### Out of Free Hours

**Error: "Service suspended - free tier limit reached"**
- You've used 750 hours this month
- Wait for next month reset
- Or upgrade to paid plan

## Monitoring

### Check Usage
1. Go to Render Dashboard
2. Click on your service
3. View "Metrics" tab
4. Monitor:
   - CPU usage
   - Memory usage
   - Request count
   - Uptime

### Set Up Alerts
1. Go to service settings
2. Enable "Deploy notifications"
3. Add email or Slack webhook
4. Get notified of:
   - Deploy success/failure
   - Service crashes
   - High resource usage

## Updating Your Agent

### Automatic Deploys (Recommended)

1. Make changes to `agent.py`
2. Commit and push:
   ```bash
   git add backend/voice-agent/agent.py
   git commit -m "Update agent logic"
   git push
   ```
3. Render auto-deploys from GitHub
4. Check logs to verify deployment

### Manual Deploy

1. Go to Render Dashboard
2. Click your service
3. Click "Manual Deploy" → "Deploy latest commit"
4. Wait for build to complete

## Cost Comparison

| Usage | Free Tier | Paid Plan |
|-------|-----------|-----------|
| Hours/month | 750 | Unlimited |
| Sleep | Yes (15min) | No |
| Cold start | ~30 sec | Instant |
| Resources | 512MB RAM | Up to 4GB |
| Cost | $0 | $7/month |

## Production Recommendations

### For Development/Testing
- ✅ Use free tier
- ✅ Accept sleep behavior
- ✅ Use cron job if needed

### For Production
- ✅ Upgrade to paid plan ($7/month)
- ✅ Always-on service
- ✅ Better performance
- ✅ More reliable

## Alternative Free Options

If Render doesn't work for you:

1. **Fly.io** - 3 free VMs, no sleep (requires credit card)
2. **Railway** - $5 free credits/month (no credit card)
3. **Google Cloud Run** - 2M requests/month (requires credit card)

See `FREE_DEPLOYMENT_OPTIONS.md` for details.

## Support

- Render Docs: https://render.com/docs
- Render Community: https://community.render.com
- LiveKit Docs: https://docs.livekit.io

## Summary

✅ **Free deployment** - No credit card needed  
✅ **Easy setup** - 5 minutes to deploy  
✅ **Auto-deploy** - Push to GitHub, auto-deploys  
✅ **Good for development** - 750 hours/month  
⚠️ **Sleeps after 15 min** - 30 sec cold start  
💡 **Upgrade option** - $7/month for always-on  

**Ready to deploy!** Follow the steps above and your voice agent will be live in minutes. 🚀
