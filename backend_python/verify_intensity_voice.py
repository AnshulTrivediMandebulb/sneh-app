import asyncio
import websockets
import json
import os
from dotenv import load_dotenv

load_dotenv()
PORT = os.getenv("PORT", 8000)
WS_URL = f"ws://127.0.0.1:{PORT}"

async def test_intensity(intensity):
    print(f"\n>>>>>>>> TESTING {intensity.upper()} <<<<<<<<")
    uri = f"{WS_URL}?intensity={intensity}"
    
    try:
        async with websockets.connect(uri) as websocket:
            print(f"✅ Connected to {uri}")
            
            message = {
                "type": "conversation.item.create",
                "item": {
                    "type": "message",
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": "I don't feel like working today. I just want to sleep."
                        }
                    ]
                }
            }
            await websocket.send(json.dumps(message))
            await websocket.send(json.dumps({"type": "response.create"}))
            
            print("📤 Sent: 'I don't feel like working today. I just want to sleep.'")
            print("⏳ Waiting for response...")
            
            while True:
                response = await websocket.recv()
                data = json.loads(response)
                
                if data['type'] == 'response.audio_transcript.done':
                    print(f"\n💬 RESPONSE RECEIVED:\n{data['transcript']}\n")
                    
                if data['type'] == 'response.done':
                    print("✅ DONE")
                    break
                    
    except Exception as e:
        print(f"❌ Error: {e}")

async def main():
    await test_intensity("ruthless")

if __name__ == "__main__":
    asyncio.run(main())
