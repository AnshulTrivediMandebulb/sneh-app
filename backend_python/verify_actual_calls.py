
import asyncio
import os
import sys
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Load env from .env file
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    print("❌ GEMINI_API_KEY not found in .env")
    sys.exit(1)

client = genai.Client(api_key=GEMINI_API_KEY)

async def verify_chat():
    print(f"\n1️⃣ Testing Model: models/gemini-2.0-flash-exp")
    try:
        response = client.models.generate_content(
            model="models/gemini-2.0-flash-exp",
            contents="Say hello!",
        )
        print(f"   ✅ 2.0 Success: {response.text[:50]}...")
        return True
    except Exception as e:
        print(f"   ❌ 2.0 Failed: {e}")
        return False

async def verify_tts():
    print(f"\n2️⃣ Testing TTS Model: models/gemini-2.5-flash-preview-tts")
    try:
        response = client.models.generate_content(
            model="models/gemini-2.5-flash-preview-tts",
            contents="Hello",
            config=types.GenerateContentConfig(
                response_mime_type="audio/mp3"
            )
        )
        if response.candidates and response.candidates[0].content.parts[0].inline_data:
             print(f"   ✅ TTS Success: Received audio bytes")
             return True
        else:
             print(f"   ❌ TTS Failed: No audio. Response: {response}")
             return False
             
    except Exception as e:
        print(f"   ❌ TTS Failed: {e}")
        return False

async def main():
    print(f"🔑 Using Key: {GEMINI_API_KEY[:5]}...{GEMINI_API_KEY[-5:]}")
    
    chat_ok = await verify_chat()
    tts_ok = await verify_tts()
    
    if chat_ok and tts_ok:
        print("\n✅ ALL SYSTEMS GREEN")
    else:
        print("\n⚠️  ISSUES DETECTED - See above")

if __name__ == "__main__":
    asyncio.run(main())
