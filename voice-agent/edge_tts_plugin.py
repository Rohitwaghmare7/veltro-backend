"""Edge TTS plugin for LiveKit Agents - Free Microsoft TTS"""

import asyncio
import edge_tts
from livekit.agents import tts
from livekit import rtc
import numpy as np
import tempfile
import os
import uuid

class EdgeTTS(tts.TTS):
    def __init__(
        self,
        *,
        voice: str = "en-US-AriaNeural",  # Female voice
        # Other good voices: en-US-GuyNeural (male), en-GB-SoniaNeural (British female)
    ):
        super().__init__(
            capabilities=tts.TTSCapabilities(streaming=False),
            sample_rate=24000,
            num_channels=1,
        )
        self._voice = voice

    def synthesize(self, text: str, *, conn_options=None) -> "ChunkedStream":
        """Synthesize text to speech. conn_options is ignored but required by interface."""
        return ChunkedStream(
            tts=self,
            input_text=text,
            conn_options=conn_options,
            voice=self._voice,
            sample_rate=self._sample_rate
        )


class ChunkedStream(tts.ChunkedStream):
    def __init__(self, *, tts: "EdgeTTS", input_text: str, conn_options, voice: str, sample_rate: int):
        super().__init__(tts=tts, input_text=input_text, conn_options=conn_options)
        self._text = input_text
        self._voice = voice
        self._sample_rate = sample_rate

    async def _run(self, output_emitter=None) -> None:
        try:
            print(f"[EdgeTTS] Starting synthesis for text: {self._text[:50]}...")
            
            # Create temporary files
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as mp3_file:
                mp3_path = mp3_file.name
            
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as wav_file:
                wav_path = wav_file.name
            
            try:
                # Generate speech using Edge TTS
                print(f"[EdgeTTS] Generating speech with voice: {self._voice}")
                communicate = edge_tts.Communicate(self._text, self._voice)
                await communicate.save(mp3_path)
                print(f"[EdgeTTS] MP3 saved to: {mp3_path}")
                
                # Convert MP3 to WAV using ffmpeg with full path
                print(f"[EdgeTTS] Converting MP3 to WAV...")
                process = await asyncio.create_subprocess_exec(
                    '/opt/homebrew/bin/ffmpeg',
                    '-y',  # Overwrite output file
                    '-i', mp3_path,
                    '-ar', str(self._sample_rate),
                    '-ac', '1',
                    '-f', 's16le',
                    wav_path,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                stdout, stderr = await process.communicate()
                
                if process.returncode != 0:
                    print(f"[EdgeTTS] ffmpeg error: {stderr.decode() if stderr else 'unknown'}")
                    raise Exception(f"ffmpeg failed with code {process.returncode}")
                
                print(f"[EdgeTTS] WAV conversion complete")
                
                # Read WAV file
                with open(wav_path, 'rb') as f:
                    pcm_data = np.frombuffer(f.read(), dtype=np.int16)
                
                print(f"[EdgeTTS] Read {len(pcm_data)} samples of PCM data")
                
                if len(pcm_data) == 0:
                    print("[EdgeTTS] WARNING: No PCM data generated!")
                    return
                
                # Create audio frame and push it
                frame = rtc.AudioFrame.create(self._sample_rate, 1, len(pcm_data))
                frame_data = np.frombuffer(frame.data, dtype=np.int16)
                np.copyto(frame_data, pcm_data)
                
                print(f"[EdgeTTS] Pushing audio frame with {len(pcm_data)} samples")
                
                # Push the synthesized audio event
                self._event_ch.send_nowait(
                    tts.SynthesizedAudio(
                        request_id=str(uuid.uuid4()),
                        frame=frame,
                    )
                )
                
                print(f"[EdgeTTS] Successfully pushed audio frame")
                
            finally:
                # Clean up temp files
                if os.path.exists(mp3_path):
                    os.unlink(mp3_path)
                if os.path.exists(wav_path):
                    os.unlink(wav_path)
            
        except Exception as e:
            print(f"[EdgeTTS] ERROR: {e}")
            import traceback
            traceback.print_exc()
            raise
