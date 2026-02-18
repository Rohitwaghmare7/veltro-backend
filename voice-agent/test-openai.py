#!/usr/bin/env python3
"""Test OpenAI API key and check quota"""

import os
from dotenv import load_dotenv
from openai import OpenAI

# Load environment variables
load_dotenv()

# Get API key
api_key = os.getenv('OPENAI_API_KEY')

if not api_key:
    print("❌ No OPENAI_API_KEY found in .env file")
    exit(1)

print(f"✓ API Key found: {api_key[:20]}...")

# Test the API
try:
    client = OpenAI(api_key=api_key)
    
    # Try a simple completion
    print("\n🧪 Testing OpenAI API with a simple request...")
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": "Say 'Hello'"}],
        max_tokens=10
    )
    
    print("✅ API Key is VALID!")
    print(f"Response: {response.choices[0].message.content}")
    
    # Try TTS
    print("\n🔊 Testing Text-to-Speech...")
    tts_response = client.audio.speech.create(
        model="tts-1",
        voice="alloy",
        input="Hello, this is a test."
    )
    
    print("✅ TTS is working!")
    print("Your OpenAI account has credits available.")
    
except Exception as e:
    error_str = str(e)
    print(f"\n❌ Error: {error_str}")
    
    if "429" in error_str or "quota" in error_str.lower():
        print("\n🚨 QUOTA EXCEEDED!")
        print("\nYour OpenAI account has run out of credits.")
        print("\nTo fix this:")
        print("1. Go to: https://platform.openai.com/account/billing")
        print("2. Add a payment method")
        print("3. Add credits (minimum $5)")
        print("\nCost for voice onboarding: ~$0.015 per minute of audio")
    elif "401" in error_str or "invalid" in error_str.lower():
        print("\n🚨 INVALID API KEY!")
        print("\nYour API key is not valid.")
        print("1. Go to: https://platform.openai.com/api-keys")
        print("2. Create a new API key")
        print("3. Update backend/voice-agent/.env with the new key")
    else:
        print(f"\nUnexpected error: {e}")
