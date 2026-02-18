# Voice Agent Railway Deployment Guide

## Prerequisites

1. Railway account (sign up at https://railway.app)
2. Railway CLI installed (optional): `npm install -g @railway/cli`
3. LiveKit Cloud account with API credentials
4. Groq API key
5. Deepgram API key

## Deployment Steps

### Option 1: Deploy via Railway Dashboard (Recommended)

1. **Create New Project**
   - Go to https://railway.app/new
   - Click "Deploy from GitHub repo"
   - Connect your GitHub account and select your repository
   - Select the `backend/voice-agent` directory as the root path

2. **Configure Environment Variables**
   
   Go to your project settings and add these environment variables:
   
   ```
   LIVEKIT_URL=wss://your-livekit-url.livekit.cloud
   LIVEKIT_API_KEY=your-livekit-api-key
   LIVEKIT_API_SECRET=your-livekit-api-secret
   GROQ_API_KEY=your-groq-api-key
   DEEPGRAM_API_KEY=your-deepgram-api-key
   ```

3. **Deploy**
   - Railway will automatically detect the Dockerfile and build
   - Wait for deployment to complete
   - Your voice agent will be running!

### Option 2: Deploy via Railway CLI

1. **Login to Railway**
   ```bash
   railway login
   ```

2. **Initialize Project**
   ```bash
   cd backend/voice-agent
   railway init
   ```

3. **Set Environment Variables**
   ```bash
   railway variables set LIVEKIT_URL=wss://your-livekit-url.livekit.cloud
   railway variables set LIVEKIT_API_KEY=your-livekit-api-key
   railway variables set LIVEKIT_API_SECRET=your-livekit-api-secret
   railway variables set GROQ_API_KEY=your-groq-api-key
   railway variables set DEEPGRAM_API_KEY=your-deepgram-api-key
   ```

4. **Deploy**
   ```bash
   railway up
   ```

## Environment Variables Explained

- `LIVEKIT_URL`: Your LiveKit Cloud WebSocket URL (get from LiveKit dashboard)
- `LIVEKIT_API_KEY`: LiveKit API key for authentication
- `LIVEKIT_API_SECRET`: LiveKit API secret for authentication
- `GROQ_API_KEY`: Groq API key for LLM (llama-3.1-8b-instant model)
- `DEEPGRAM_API_KEY`: Deepgram API key for STT/TTS

## Getting API Keys

### LiveKit Cloud
1. Go to https://cloud.livekit.io
2. Create a new project or use existing
3. Go to Settings → Keys
4. Copy your URL, API Key, and API Secret

### Groq
1. Go to https://console.groq.com
2. Sign up/login
3. Go to API Keys
4. Create new API key

### Deepgram
1. Go to https://console.deepgram.com
2. Sign up/login (free tier available)
3. Go to API Keys
4. Create new API key

## Verify Deployment

1. Check Railway logs:
   ```bash
   railway logs
   ```

2. You should see:
   ```
   Starting voice agent...
   Using Groq LLM with llama-3.1-8b-instant model
   Agent ready and listening...
   ```

## Connecting Frontend to Deployed Agent

The voice agent runs as a LiveKit worker that connects to your LiveKit Cloud instance. Your frontend doesn't need to know the Railway URL - it connects directly to LiveKit Cloud, which routes to your deployed agent.

Make sure your frontend has the correct LiveKit credentials:

```env
NEXT_PUBLIC_LIVEKIT_URL=wss://your-livekit-url.livekit.cloud
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret
```

## Troubleshooting

### Agent not connecting to LiveKit
- Verify LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET are correct
- Check Railway logs for connection errors
- Ensure LiveKit Cloud project is active

### LLM errors (rate limits)
- Groq free tier has rate limits
- Consider upgrading to paid tier or using a different model
- Check GROQ_API_KEY is valid

### STT/TTS errors
- Verify DEEPGRAM_API_KEY is valid
- Check Deepgram account has credits
- Free tier should be sufficient for testing

### Build failures
- Check Dockerfile syntax
- Verify all dependencies in requirements.txt
- Check Railway build logs

## Scaling

Railway automatically handles:
- Container restarts on failure
- Resource allocation
- HTTPS/WSS termination

For production:
- Consider upgrading Railway plan for better resources
- Monitor usage in Railway dashboard
- Set up alerts for failures

## Cost Estimates

- Railway: ~$5-10/month (Hobby plan)
- LiveKit Cloud: Free tier available, then usage-based
- Groq: Free tier available, then usage-based
- Deepgram: Free tier available, then usage-based

Total estimated cost for low-medium usage: $5-20/month
