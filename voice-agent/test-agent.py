import asyncio
import logging
import os
import numpy as np
from dotenv import load_dotenv
from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli
from livekit import rtc

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def generate_test_audio(duration_seconds=3, sample_rate=48000):
    """Generate a simple test tone (440Hz beep)"""
    frequency = 440  # A4 note
    t = np.linspace(0, duration_seconds, int(sample_rate * duration_seconds))
    
    # Generate sine wave
    audio_data = np.sin(2 * np.pi * frequency * t)
    
    # Apply envelope to avoid clicks
    envelope = np.ones_like(audio_data)
    fade_samples = int(0.01 * sample_rate)  # 10ms fade
    envelope[:fade_samples] = np.linspace(0, 1, fade_samples)
    envelope[-fade_samples:] = np.linspace(1, 0, fade_samples)
    audio_data *= envelope
    
    # Convert to int16
    audio_data = (audio_data * 32767 * 0.3).astype(np.int16)
    
    return audio_data.tobytes()

async def entrypoint(ctx: JobContext):
    """Test agent that plays a beep sound"""
    logger.info(f"🧪 TEST AGENT starting for room: {ctx.room.name}")
    
    # Connect to the room
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    
    logger.info("✅ Connected to room")
    
    # Wait a moment for everything to settle
    await asyncio.sleep(2)
    
    logger.info("🔊 Generating test audio (3-second beep at 440Hz)...")
    
    # Generate test audio
    sample_rate = 48000
    audio_data = generate_test_audio(duration_seconds=3, sample_rate=sample_rate)
    
    logger.info(f"📤 Publishing audio track ({len(audio_data)} bytes)...")
    
    # Create audio source
    audio_source = rtc.AudioSource(sample_rate, 1)  # 48kHz, mono
    
    # Create track
    track = rtc.LocalAudioTrack.create_audio_track("test-audio", audio_source)
    
    # Publish track
    options = rtc.TrackPublishOptions()
    options.source = rtc.TrackSource.SOURCE_MICROPHONE
    
    publication = await ctx.room.local_participant.publish_track(track, options)
    logger.info(f"✅ Track published: {publication.sid}")
    
    # Send audio in chunks
    chunk_size = sample_rate // 10  # 100ms chunks
    num_samples = len(audio_data) // 2  # int16 = 2 bytes per sample
    
    logger.info("🎵 Playing audio...")
    
    for i in range(0, num_samples, chunk_size):
        end = min(i + chunk_size, num_samples)
        chunk = audio_data[i*2:end*2]
        
        # Convert bytes to numpy array
        samples = np.frombuffer(chunk, dtype=np.int16)
        
        # Create audio frame
        frame = rtc.AudioFrame.create(sample_rate, 1, len(samples))
        frame_data = np.frombuffer(frame.data, dtype=np.int16)
        np.copyto(frame_data, samples)
        
        # Capture frame to source
        await audio_source.capture_frame(frame)
        
        # Wait for real-time playback
        await asyncio.sleep(len(samples) / sample_rate)
    
    logger.info("✅ Audio playback complete!")
    logger.info("💡 If you heard a 3-second beep, LiveKit audio is working!")
    logger.info("💡 If you didn't hear anything, check your browser's audio settings")
    
    # Keep agent alive for a bit
    await asyncio.sleep(5)
    
    logger.info("👋 Test complete, disconnecting...")

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
