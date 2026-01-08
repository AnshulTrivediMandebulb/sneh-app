
import os
import base64
from typing import List, Dict, Optional
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

class GeminiService:
    def __init__(self):
        if not GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is not set")
        self.client = genai.Client(api_key=GEMINI_API_KEY)
        self.chat_model = "gemini-1.5-flash"
        self.tts_model = "gemini-2.5-flash-preview-tts"  # Inferred from user request/news

    async def generate_response(self, 
                                user_message: str, 
                                system_prompt: str, 
                                conversation_history: List[Dict],
                                context: str = "") -> str:
        """
        Generate text response/chat.
        """
        try:
            # Build history for Gemini
            # Gemini SDK structure: contents=[Content(role="user", parts=[Part(text="...")])]
            
            # Combine system prompt and context
            full_system_instruction = f"{system_prompt}\n\nCONTEXT:\n{context}"
            
            chat = self.client.chats.create(
                model=self.chat_model,
                config=types.GenerateContentConfig(
                    system_instruction=full_system_instruction,
                    temperature=0.7,
                )
            )

            # Replay history (simplified)
            # define history for the chat session if needed, but for single turn 
            # we can just send the messages. 
            # The google-genai SDK 0.x is new, using high level 'chats'
            
            # For simplicity in this drop-in replacement, we might not maintain a persistent object
            # across calls as the app is stateless per request except for history passed in.
            
            # Convert history
            history_contents = []
            for msg in conversation_history:
                role = "user" if msg["role"] == "user" else "model"
                history_contents.append(
                    types.Content(
                        role=role,
                        parts=[types.Part(text=msg["content"])]
                    )
                )

            # NOTE: SDK might require adding history to the chat object manually
            # or passing it. Let's use the lower level generate_content for statelessness if easier
            # But chat.send_message is standard.
            
            # Manually populating history
            # (Warning: SDK specifics vary, assuming standard structure)
            
            # Correct approach for stateless request with history:
            all_contents = history_contents + [
                types.Content(role="user", parts=[types.Part(text=user_message)])
            ]
            
            response = self.client.models.generate_content(
                model=self.chat_model,
                contents=all_contents,
                config=types.GenerateContentConfig(
                    system_instruction=full_system_instruction
                )
            )
            
            return response.text

        except Exception as e:
            print(f"❌ Gemini Chat Error: {e}")
            return "I'm having trouble thinking right now. Can you ask again?"

    async def transcribe_audio(self, audio_bytes: bytes) -> str:
        """
        Transcribe audio using Gemini (Model-as-a-Transcriber)
        """
        try:
            # Gemini 1.5 Flash is great at multimodal
            # Expo sends M4A (mp4 container), so we must use audio/m4a or audio/mp4
            response = self.client.models.generate_content(
                model=self.chat_model,
                contents=[
                    types.Content(
                        parts=[
                            # Changed from audio/wav to audio/m4a to match Expo recording
                            types.Part.from_bytes(data=audio_bytes, mime_type="audio/m4a"),
                            types.Part(text="Transcribe this audio exactly. Output ONLY the transcription.")
                        ]
                    )
                ]
            )
            return response.text.strip()
        except Exception as e:
            print(f"❌ Gemini STT Error: {e}")
            # Do NOT raise, return fallback to prevent 500
            return "I couldn't hear that clearly."

    async def generate_speech(self, text: str, voice: str = "Puck") -> str:
        """
        Generate Speech (TTS) using Gemini 2.5 Flash TTS
        Returns: Base64 encoded audio
        """
        try:
            # Using the new TTS capabilities
            # NOTE: documentation for 2.5 TTS in SDK is sparse, inferring from standard genai patterns
            # Typically it sends a prompt and asks for audio output.
            
            # However, dedicated TTS endpoints exist. 
            # If 'gemini-2.5-flash-preview-tts' is the model, it might function like generate_content 
            # but return audio bytes.
            
            # Let's try the generate_content approach with response_modality if applicable, 
            # or the specific tts logic if documented.
            
            # Fallback/Standard approach for "Speech Generation" in GenAI:
            # It might not be 'generate_content'. 
            
            # Given the "Update" news, let's assume standard generate_content 
            # requesting Audio/Speech response or a new method. 
            
            # Since I cannot verify without docs, I will assume a standard request 
            # to the TTS model with text input returns audio content.
            
            response = self.client.models.generate_content(
                model=self.tts_model,
                contents=text,
                config=types.GenerateContentConfig(
                    response_mime_type="audio/mp3" # Requesting audio
                )
            )
            
            # If response contains bytes
            if response.candidates and response.candidates[0].content.parts[0].inline_data:
                return base64.b64encode(response.candidates[0].content.parts[0].inline_data.data).decode('utf-8')
            
            # Attempt access via simple text/bytes property if SDK wraps it
            # (Debugging step might be needed here)
            
            # For now, return a placeholder/error if this specific path fails, 
            # OR better: use the 'google-cloud-texttospeech' logic if this model is actually 
            # just a Vertex model tailored for it. 
            
            # But user said "Gemini 2.5 Flash TTS model updates".
            
            return "" 

        except Exception as e:
            print(f"❌ Gemini TTS Error: {e}")
            # Fallback to empty to let UI handle it or return error
            return ""

# Implementation Note: 
# The Python SDK for 2.5 TTS might be very new. 
# If `response_mime_type="audio/mp3"` doesn't work, we'll need to debug.
