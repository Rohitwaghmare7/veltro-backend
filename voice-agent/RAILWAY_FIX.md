# Railway Deployment Fix

## Issue Fixed

**Error:** `ModuleNotFoundError: No module named 'edge_tts'`

**Cause:** Agent was importing unused `edge_tts_plugin` module

**Solution:** Removed the import since we're using Deepgram TTS

## Changes Made

1. Removed `from edge_tts_plugin import EdgeTTS` from `agent.py`
2. Agent now uses only Deepgram TTS (already configured)

## Redeploy Steps

### Option 1: Auto-deploy (if enabled)

Just push the changes:
```bash
git add backend/voice-agent/agent.py
git commit -m "Fix: Remove unused edge_tts import"
git push
```

Railway will auto-deploy.

### Option 2: Manual deploy

1. Go to Railway dashboard
2. Select your voice-agent service
3. Click "Deployments" tab
4. Click "Deploy" button
5. Wait for build to complete

## Verify Deployment

Check logs for:
```
Starting voice agent...
Using Groq LLM with llama-3.1-8b-instant model
Agent ready and listening...
```

## What TTS Are We Using?

We're using **Deepgram TTS** (not EdgeTTS):
- Model: `aura-asteria-en`
- Already included in `livekit-plugins-deepgram`
- No additional dependencies needed
- Works great for voice conversations

## If You Still See Errors

1. **Check environment variables are set:**
   - LIVEKIT_URL
   - LIVEKIT_API_KEY
   - LIVEKIT_API_SECRET
   - GROQ_API_KEY
   - DEEPGRAM_API_KEY

2. **Check Railway logs:**
   ```bash
   railway logs
   ```

3. **Restart service:**
   - Go to Railway dashboard
   - Click "Restart" button

## Success!

Your voice agent should now deploy successfully on Railway! 🚀
