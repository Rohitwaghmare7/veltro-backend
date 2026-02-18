#!/bin/bash

# Voice Agent Setup Script

echo "🚀 Setting up Voice Agent..."

# Check if Python 3.11+ is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.11 or higher."
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
echo "✓ Found Python $PYTHON_VERSION"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Creating template..."
    cat > .env << EOF
# LiveKit Configuration
LIVEKIT_URL=wss://your-livekit-url.livekit.cloud
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret

# Groq Configuration (LLM)
GROQ_API_KEY=your-groq-api-key

# Deepgram Configuration (STT/TTS)
DEEPGRAM_API_KEY=your-deepgram-api-key
EOF
    echo "📝 Please edit .env file with your API keys"
    exit 0
fi

echo "✅ Setup complete!"
echo ""
echo "To start the agent locally:"
echo "  source venv/bin/activate"
echo "  python agent.py dev"
echo ""
echo "To deploy to Railway:"
echo "  1. Install Railway CLI: npm install -g @railway/cli"
echo "  2. Login: railway login"
echo "  3. Deploy: railway up"
echo ""
echo "See RAILWAY_DEPLOYMENT.md for detailed deployment instructions."
