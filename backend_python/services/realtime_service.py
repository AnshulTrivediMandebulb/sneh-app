import asyncio
import websockets
import json
import base64
import os
import subprocess
from fastapi import WebSocket
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

# Configuration
# Realtime can be in a separate resource, so check for dedicated vars first
AZURE_REALTIME_ENDPOINT = os.getenv("AZURE_REALTIME_ENDPOINT") or os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_REALTIME_KEY = os.getenv("AZURE_REALTIME_KEY") or os.getenv("AZURE_OPENAI_KEY")
DEPLOYMENT_NAME = os.getenv("AZURE_OPENAI_REALTIME_DEPLOYMENT", "gpt-4o-realtime-preview")

def get_azure_realtime_url():
    """Build Azure Realtime WebSocket URL"""
    if not AZURE_REALTIME_ENDPOINT:
        print("❌ AZURE_REALTIME_ENDPOINT is missing")
        return ""
        
    # Format: wss://<resource>.cognitiveservices.azure.com/openai/realtime?api-version=...
    # or wss://<resource>.openai.azure.com/openai/realtime?api-version=...
    clean_endpoint = AZURE_REALTIME_ENDPOINT.replace("https://", "wss://").rstrip("/")
    return f"{clean_endpoint}/openai/realtime?api-version=2024-10-01-preview&deployment={DEPLOYMENT_NAME}&api-key={AZURE_REALTIME_KEY}"


import uuid

def convert_audio_to_pcm(base64_audio: str, input_format: str) -> str:
    """Convert input audio (WAV/M4A) to 24kHz Mono PCM16 for Azure Realtime"""
    try:
        audio_bytes = base64.b64decode(base64_audio)
        
        if input_format == 'wav':
            # Simply strip the 44-byte WAV header to get raw PCM
            if len(audio_bytes) > 44:
                return base64.b64encode(audio_bytes[44:]).decode('utf-8')
            return None 

        elif input_format == 'm4a':
            # Use ffmpeg command line to transcode M4A -> PCM 16-bit 24kHz Mono
            # Use absolute path to avoid CWD issues
            temp_input = os.path.abspath(f"temp_{uuid.uuid4().hex}.m4a")
            temp_output = os.path.abspath(f"temp_{uuid.uuid4().hex}.pcm")
            
            try:
                # 1. Write M4A to disk
                with open(temp_input, "wb") as f:
                    f.write(audio_bytes)

                print(f"🎤 Input Audio Size: {len(audio_bytes)} bytes (Saved to {temp_input})")

                # 2. Convert using ffmpeg command line
                # Resolve FFmpeg Path explicitly
                ffmpeg_exe = "ffmpeg"
                runtime_ffmpeg = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ffmpeg_runtime", "bin", "ffmpeg.exe"))
                if os.path.exists(runtime_ffmpeg):
                     ffmpeg_exe = runtime_ffmpeg
                     print(f"🔧 Using Local FFmpeg: {ffmpeg_exe}")

                cmd = [
                    ffmpeg_exe,
                    '-y', # Overwrite output
                    '-i', temp_input,
                    '-f', 's16le',
                    '-acodec', 'pcm_s16le',
                    '-ac', '1',
                    '-ar', '24000',
                    temp_output
                ]
                print(f"Running FFmpeg: {cmd[0]} ...")
                
                result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
                
                if result.returncode != 0:
                    print(f"⚠️ FFmpeg failed: {result.stderr}")
                    return None

                # 3. Read converted PCM
                with open(temp_output, 'rb') as f:
                    pcm_data = f.read()

                if len(pcm_data) == 0:
                    print(f"⚠️ FFmpeg produced 0 bytes! Stderr: {result.stderr}")
                    return None

                # CHECK FOR SILENCE (RMS)
                import math
                import struct
                # PCM16 is signed 16-bit little endian
                count = len(pcm_data) // 2
                sum_squares = 0.0
                for i in range(count):
                    sample = struct.unpack_from('<h', pcm_data, i * 2)[0]
                    sum_squares += sample * sample
                
                rms = math.sqrt(sum_squares / count) if count > 0 else 0
                print(f"🔊 Converted M4A -> PCM ({len(pcm_data)} bytes) | RMS Amplitude: {rms:.2f}")

                if rms < 100: # Threshold for absolute silence/near silence
                    print(f"⚠️ WARNING: Audio appears to be SILENT (RMS < 100)")
                    print(f"   First 20 samples: {[struct.unpack_from('<h', pcm_data, i * 2)[0] for i in range(min(20, count))]}")

                return base64.b64encode(pcm_data).decode('utf-8')

            except FileNotFoundError:
                print("❌ FFmpeg not found! Please ensure FFmpeg is in PATH")
                return None
            except Exception as ffmpeg_err:
                print(f"⚠️ FFmpeg Exception: {ffmpeg_err}")
                return None
            finally:
                # 3. Cleanup
                if os.path.exists(temp_input):
                    os.remove(temp_input)
                if os.path.exists(temp_output):
                    os.remove(temp_output)

        # Fallback/Unknown
        print(f"⚠️ Unknown format: {input_format}")
        return None

    except Exception as e:
        print(f"⚠️ Conversion General Error: {e}")
        return None



async def monitor_recap_task(ws, task):
    """Wait for recap to finish and notify frontend"""
    try:
        print("[Realtime] ⏳ Monitoring background recap...")
        recap = await task
        if recap:
             changes = []
             if recap.get('new_contexts'):
                 titles = [c['title'] for c in recap['new_contexts']]
                 changes.append(f"New: {', '.join(titles)}")
             if recap.get('updated_contexts'):
                 changes.append(f"Updated: {len(recap['updated_contexts'])} items")

             if changes:
                 msg = f"Brain Updated: {' | '.join(changes)}"
                 print(f"[Realtime] 🧠 {msg}")
                 await ws.send_text(json.dumps({
                     "type": "context.saved",
                     "message": msg,
                     "details": recap
                 }))
    except Exception as e:
        print(f"[Realtime] ⚠️ Recap monitor failed: {e}")


async def setup_realtime_websocket(mobile_ws: WebSocket, intensity: str = "real"):
    # ... setup code ...
    from services.ai_service import get_system_prompt
    from services.context_service import get_structured_context
    from services.session_service import add_message_to_active_session

    print(f"\n{'='*60}")
    print(f"[WS] 🚀 STARTING REALTIME WEBSOCKET SETUP")
    print(f"[WS] 📊 Intensity: {intensity}")
    print(f"[WS] 🔧 Deployment: {DEPLOYMENT_NAME}")
    print(f"{'='*60}\n")
    
    azure_url = get_azure_realtime_url()
    if not azure_url:
        print(f"[WS] ❌ ERROR: Azure URL is empty!")
        print(f"[WS] AZURE_REALTIME_ENDPOINT: {AZURE_REALTIME_ENDPOINT}")
        print(f"[WS] AZURE_REALTIME_KEY: {'SET' if AZURE_REALTIME_KEY else 'MISSING'}")
        await mobile_ws.close(code=1008, reason="Server Config Error")
        return

    print(f"[WS] ✅ Azure URL constructed successfully")
    print(f"[WS] 🔌 Azure URL: {azure_url[:80]}...")  # Show first 80 chars only
    print(f"[WS] Connecting to Azure Realtime: {DEPLOYMENT_NAME} (Intensity: {intensity})")
    
    try:
        # Prepare Context
        ace_context = get_structured_context()
        # Get system prompt based on intensity
        system_instr = get_system_prompt(intensity)
        if ace_context:
            system_instr += f"\n\nCONTEXT:\n{ace_context}"
            pass
        
        # Select Voice based on Intensity
        # Available OpenAI Realtime voices: alloy, ash, ballad, coral, echo, sage, shimmer, verse
        voice_map = {
            "gentle": "shimmer", # Soft, warm female
            "real": "alloy",     # Neutral, friendly
            "ruthless": "echo"   # Direct, processed male (closest to tough brother)
        }
        selected_voice = voice_map.get(intensity, "alloy")
        print(f"[WS] Selected Voice: {selected_voice}")
        
        async with websockets.connect(
            azure_url,
            additional_headers={"OpenAI-Beta": "realtime=v1"}
        ) as azure_ws:
            print("[Azure] ✅ Connected")
            
            # 1. Initialize Session
            session_config = {
                "type": "session.update",
                "session": {
                    "modalities": ["audio", "text"],
                    "instructions": system_instr,
                    "voice": selected_voice,
                    "input_audio_format": "pcm16",
                    "output_audio_format": "pcm16",
                    "input_audio_transcription": {
                        "model": "whisper-1" 
                    },
                    # Disable Server VAD because we use Push-to-Talk (Manual Commit)
                    "turn_detection": None
                }
            }
            await azure_ws.send(json.dumps(session_config))
            
            # 2. Relay Loops
            async def azure_receiver():
                """Receive from Azure -> Send to Mobile"""
                try:
                    async for msg in azure_ws:
                        event = json.loads(msg)
                        event_type = event.get("type", "")
                        
                        # Log ALL events to see what Azure is sending
                        if event_type not in ["response.audio.delta", "response.audio_transcript.delta"]:
                            # Don't log delta events (too many), but log everything else
                            print(f"📨 [Azure] Event: {event_type}")
                        
                        # ============================================
                        # TRANSCRIPTION LOGGING - HIGHLY VISIBLE
                        # ============================================
                        if "transcription" in event_type or "transcript" in event_type:
                            print("\n" + "="*60)
                            print(f"🎯 TRANSCRIPTION EVENT: {event_type}")
                            print("="*60)
                            
                            # Check for transcript in different possible locations
                            transcript_text = None
                            if "transcript" in event:
                                transcript_text = event.get("transcript", "")
                            elif "delta" in event:
                                transcript_text = event.get("delta", "")
                            
                            if transcript_text:
                                print(f"📝 TRANSCRIPT: '{transcript_text}'")
                            else:
                                print(f"⚠️ NO TRANSCRIPT TEXT FOUND")
                                print(f"📦 Full Event: {json.dumps(event, indent=2)}")
                            
                            print("="*60 + "\n")
                        
                        if event_type == "response.done":
                            print("\n[Azure] Response Done")
                            
                        # ============================================
                        # PERSISTENCE: Save to Session History
                        # ============================================
                        try:
                            if event_type == "conversation.item.input_audio_transcription.completed":
                                transcript = event.get("transcript", "")
                                if transcript:
                                    print(f"💾 Saving USER message: {transcript}")
                                    recap_task = await add_message_to_active_session("user", transcript, is_audio=True)
                                    if recap_task:
                                        asyncio.create_task(monitor_recap_task(mobile_ws, recap_task))
                                    
                            elif event_type == "response.audio_transcript.done":
                                transcript = event.get("transcript", "")
                                if transcript:
                                    print(f"💾 Saving AI message: {transcript}")
                                    recap_task = await add_message_to_active_session("assistant", transcript, is_audio=True)
                                    if recap_task:
                                        asyncio.create_task(monitor_recap_task(mobile_ws, recap_task))
                        except Exception as save_err:
                            print(f"⚠️ Failed to save history (non-fatal): {save_err}")

                        # Forward ALL events to mobile
                        await mobile_ws.send_text(msg)
                        
                except Exception as e:
                    print(f"[Azure Rx] Error: {e}")


            async def mobile_receiver():
                """Receive from Mobile -> Send to Azure"""
                try:
                    while True:
                        data = await mobile_ws.receive_text()
                        event = json.loads(data)
                        
                        # Forward Input Audio
                        if event.get("type") == "input_audio_buffer.append":
                            if "audio" in event:
                                fmt = event.pop("format", "wav") # Extract and remove format
                                print(f"\n📥 [Mobile] Received audio buffer (format: {fmt})")
                                print(f"   📊 Original audio size: {len(event['audio'])} bytes (base64)")
                                
                                converted_audio = convert_audio_to_pcm(event["audio"], fmt)
                                
                                if converted_audio:
                                    event["audio"] = converted_audio
                                    print(f"   ✅ Converted audio size: {len(converted_audio)} bytes (base64)")
                                    print(f"   📤 Sending to Azure...")
                                    await azure_ws.send(json.dumps(event))
                                    print(f"   ✅ Sent to Azure successfully")
                                else:
                                    # Conversion failed - log it!
                                    print("   ❌ SKIPPING AUDIO: Conversion failed")
                            
                            
                        # Forward Interruptions / Commit events
                        elif event.get("type") == "input_audio_buffer.commit":
                             print("\n" + "="*60)
                             print("📤 COMMITTING AUDIO BUFFER TO AZURE")
                             print("="*60)
                             print("   ⏳ Waiting for Azure to transcribe...")
                             await azure_ws.send(json.dumps(event))
                             print("   ✅ Commit sent successfully")
                             print("="*60 + "\n")
                        
                        # Forward 'response.create' and others
                        else:
                            if event.get("type") == "response.create":
                                print(f"\n📤 [Mobile] Requesting response from Azure")
                                print(f"   📦 Payload: {json.dumps(event)}")
                            await azure_ws.send(json.dumps(event))

                             
                except Exception as e:
                    print(f"[Mobile Rx] Error: {e}")


            # Run relays
            await asyncio.gather(azure_receiver(), mobile_receiver())

    except Exception as e:
        print(f"\n{'='*60}")
        print(f"[WS] ❌ CONNECTION FAILED")
        print(f"[WS] Error Type: {type(e).__name__}")
        print(f"[WS] Error Message: {e}")
        print(f"{'='*60}")
        
        # Print full traceback to console
        import traceback
        print("\n[WS] Full Traceback:")
        traceback.print_exc()
        print(f"{'='*60}\n")
        
        # Log to file for debugging
        try:
            with open("ws_debug_log.txt", "a") as f:
                f.write(f"\n{'='*60}\n")
                f.write(f"[{datetime.now().isoformat()}] CONNECTION FAILED\n")
                f.write(f"Error Type: {type(e).__name__}\n")
                f.write(f"Error Message: {e}\n")
                f.write(f"{'='*60}\n")
                traceback.print_exc(file=f)
                f.write(f"{'='*60}\n\n")
        except Exception as log_err:
            print(f"[WS] Failed to write to log file: {log_err}")
            
        try:
             await mobile_ws.close(code=1011, reason=str(e)[:100])
        except Exception as close_err:
            print(f"[WS] Failed to close mobile WebSocket: {close_err}")
