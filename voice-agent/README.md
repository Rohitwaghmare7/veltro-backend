# Voice Onboarding Agent

AI-powered voice assistant for onboarding businesses to Veltro platform using LiveKit, Groq LLM, and Deepgram.

## Features

- Real-time voice conversation with natural language processing
- Collects business profile, services, and operating hours
- Integrates with Veltro backend API
- Automatic data extraction from conversation
- Step-by-step confirmation workflow

## Tech Stack

- **LiveKit**: Real-time voice infrastructure
- **Groq**: Fast LLM inference (llama-3.1-8b-instant)
- **Deepgram**: Speech-to-text and text-to-speech
- **Python 3.11+**: Backend runtime

## Quick Start

### Local Development

1. **Setup**
   ```bash
   ./setup.sh
   ```

2. **Configure environment variables**
   Edit `.env` with your API keys (see `.env.example`)

3. **Run agent**
   ```bash
   source venv/bin/activate
   python agent.py dev
   ```

### Deploy to Railway

See [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md) for detailed deployment instructions.

Quick deploy:
```bash
railway login
railway init
railway up
```

## Environment Variables

Required environment variables:

```env
LIVEKIT_URL=wss://your-livekit-url.livekit.cloud
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret
GROQ_API_KEY=your-groq-api-key
DEEPGRAM_API_KEY=your-deepgram-api-key
```

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Frontend  │ ◄─────► │ LiveKit Cloud│ ◄─────► │ Voice Agent │
│  (Next.js)  │         │   (WebRTC)   │         │  (Railway)  │
└─────────────┘         └──────────────┘         └─────────────┘
                                                         │
                                                         ▼
                                                  ┌─────────────┐
                                                  │  Groq LLM   │
                                                  │  Deepgram   │
                                                  └─────────────┘
```

## Conversation Flow

1. **Step 1: Business Profile**
   - Business name
   - Industry/category
   - Description
   - Contact info (phone, email, website)

2. **Step 2: Services**
   - Service name
   - Duration (minutes)
   - Price ($)

3. **Step 3: Operating Hours**
   - Days of operation
   - Opening/closing times

## Data Extraction

The agent uses regex patterns to extract structured data from natural language confirmations:

- Business info: Extracted from "Let me confirm..." messages
- Services: Pattern matching for "Service: 30 minutes, $50"
- Hours: Pattern matching for "Monday: 9am - 5pm"

## API Integration

Extracted data is sent to Veltro backend via:
- `PUT /onboarding/step/1` - Business profile
- `PUT /onboarding/step/4` - Services
- `PUT /onboarding/step/5` - Operating hours

## Troubleshooting

### Agent not connecting
- Check LiveKit credentials
- Verify network connectivity
- Check Railway logs

### LLM errors
- Verify Groq API key
- Check rate limits (free tier: 100k tokens/day)
- Consider upgrading to paid tier

### STT/TTS issues
- Verify Deepgram API key
- Check account credits
- Test with different audio input

## Development

### Project Structure

```
backend/voice-agent/
├── agent.py              # Main agent code
├── requirements.txt      # Python dependencies
├── Dockerfile           # Container configuration
├── railway.json         # Railway deployment config
├── .env                 # Environment variables (local)
└── README.md           # This file
```

### Testing Locally

1. Start the agent: `python agent.py dev`
2. Open frontend: `http://localhost:3000/onboarding`
3. Select "Voice Mode"
4. Start conversation

### Logs

Check logs for debugging:
- Local: Terminal output
- Railway: `railway logs` or dashboard

## Contributing

1. Make changes to `agent.py`
2. Test locally
3. Deploy to Railway
4. Verify in production

## License

Proprietary - Veltro Platform
