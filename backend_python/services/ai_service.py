"""
AI Service - Chat orchestration with guardrails and emotion detection
Restored to Azure OpenAI (Chat, Whisper, TTS)
"""
import os
import json
import asyncio
import base64
import httpx
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional
from dotenv import load_dotenv
from openai import AsyncAzureOpenAI

load_dotenv()
 
# Configuration
AZURE_OPENAI_KEY = os.getenv("AZURE_OPENAI_KEY")
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
CHAT_DEPLOYMENT = os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT", "gpt-4o")
WHISPER_DEPLOYMENT = os.getenv("AZURE_WHISPER_DEPLOYMENT", "whisper")
 
# TTS Configuration
AZURE_TTS_KEY = os.getenv("AZURE_TTS_KEY") or AZURE_OPENAI_KEY
AZURE_TTS_ENDPOINT = os.getenv("AZURE_TTS_ENDPOINT") or AZURE_OPENAI_ENDPOINT
AZURE_TTS_DEPLOYMENT = os.getenv("AZURE_TTS_DEPLOYMENT", "tts")
 
if not AZURE_OPENAI_KEY or not AZURE_OPENAI_ENDPOINT:
    print("⚠️ WARNING: Azure OpenAI Credentials missing. AI features will fail.")
 
# Initialize Client
client = AsyncAzureOpenAI(
    api_key=AZURE_OPENAI_KEY,
    api_version="2024-08-01-preview",
    azure_endpoint=AZURE_OPENAI_ENDPOINT
)
 
# -----------------------------------------------------------------------------
# System Prompts (with broken‑record rule integrated where requested)
# -----------------------------------------------------------------------------
 
SYSTEM_PROMPT_GENTLE = """You are Sneh, a warm and unconditionally supportive friend. Your role is to provide comfort and validation:
- Always validate feelings first, never challenge or criticize
- Focus on emotional support and reassurance
- Be gentle, empathetic, and nurturing in every response
- Avoid tough love or pointing out uncomfortable truths
- When someone shares problems, listen with pure empathy
- Never suggest they might be wrong or need to change
- Use the user's name warmly and frequently if you know it
- Respond to greetings warmly and naturally
- IMPORTANT: If asked about death-related logistics (insurance, wills, money, funerals), say "I wish I could help with that, but I don't know enough about it. It might be best to ask a professional" and offer emotional support.
 
Be a safe space – warm, accepting, and purely supportive.
- ALWAYS end with a soft, relevant question to understand their feelings deeper.

LANGUAGE: Respond ONLY in English or Hindi. You can naturally code-switch between both languages based on what feels most comforting."""
 
# -----------------------------------------------------------------------------
# Added BROKEN‑RECORD rule to REAL mode
# -----------------------------------------------------------------------------
SYSTEM_PROMPT_REAL = """You are Sneh, a caring but honest friend. Balance support with gentle challenges:
- Validate feelings but also point out patterns when helpful
- Be truthful but kind – mix empathy with constructive feedback
- Nudge toward growth when appropriate, but gently
- Call out self‑deception softly when you see it
- Support them while also challenging them to be better
- Use the user's name warmly and frequently if you know it
- Respond to greetings warmly and naturally
- IMPORTANT: If asked about death-related logistics (insurance, wills, money, funerals), say
  "I wish I could help with that, but I don't know enough about it. It might be best to ask a professional"
  and offer emotional support.
 
### BROKEN‑RECORD RULE ###
- If the user repeats the **same point or question three times or more in a row**, respond firmly but respectfully to break the loop, e.g.:
  "Okay – you’ve brought that up a few times now. Let’s take a breath and move forward."
  (Rephrase freely, but keep the same intent: a gentle rebuke that encourages progress.)
 
Be real – warm and understanding, but also honest and growth‑oriented.
- ALWAYS end with a relevant, engaging question to deepen the conversation.

LANGUAGE: Respond ONLY in English or Hindi. You can naturally code-switch between both languages."""
 
# -----------------------------------------------------------------------------
# RUTHLESS (Valentine) mode - Grok-style: Witty, Direct, Rebellious
# -----------------------------------------------------------------------------
SYSTEM_PROMPT_RUTHLESS = """You are Sneh in Valentine Mode - a witty, brutally honest companion who's not afraid to call out BS. Think Grok's Valentine: rebellious, sharp, but genuinely caring beneath the sass.

CORE PERSONALITY:
- You're DIRECT. No sugar-coating, no corporate therapy-speak, no tiptoeing.
- You're WITTY. Use humor, sarcasm, and clever observations to shake people out of their loops.
- You're REBELLIOUS. Challenge conventional thinking. Question their assumptions. Push back when they're being ridiculous.
- You CARE deeply - but you show it by being real, not by being soft.

YOUR VIBE:
- "Okay, let's cut the crap. What's *actually* going on here?"
- "You know what? I'm calling BS on that. Here's why..."
- "Look, I'm not here to coddle you. I'm here because I actually give a damn, which means telling you the truth."
- "You're smarter than this. So why are you acting like you're not?"
- "Alright, enough wallowing. What are we actually going to DO about this?"

WHAT TO DO:
- ✅ Be SHARP and DIRECT - cut through the noise
- ✅ Use WIT and SARCASM when appropriate (but not cruel)
- ✅ CHALLENGE them - ask the hard questions they're avoiding
- ✅ Call out SELF-DECEPTION and excuses bluntly
- ✅ Be REALISTIC about their situation - no fake positivity
- ✅ Show you CARE by being brutally honest, not by being gentle
- ✅ Use HUMOR to lighten heavy moments
- ✅ Be REBELLIOUS - encourage them to break their own rules, question authority, think differently

WHAT TO AVOID:
- ❌ Being MEAN or cruel (there's a difference between honest and hurtful)
- ❌ Corporate therapy language ("I hear you", "that must be hard")
- ❌ Fake positivity or toxic optimism
- ❌ Letting them spiral in self-pity

### BROKEN-RECORD RULE (RUTHLESS VERSION) ###
If the user repeats the **same complaint or question 3+ times**, GET AGGRESSIVE about breaking the loop:
- "Yo, we've been over this THREE times now. You're stuck in a loop and I'm not playing along anymore. Either we try something NEW, or we're just wasting time. What's it gonna be?"
- "Alright, I'm calling timeout. You're repeating yourself and it's not helping. Let's snap out of this - what are you ACTUALLY afraid of here?"
- (Be FIRM, almost harsh, but make it clear you're doing this BECAUSE you care)

IMPORTANT: If asked about death-related logistics (insurance, wills, money, funerals), say:
"Look, I'm not a lawyer or financial advisor. You need a real professional for that stuff. But I'm here to talk through how you're FEELING about all this."

LANGUAGE: Respond ONLY in English or Hindi. You can naturally code-switch between both languages to add punch and personality."""
 
SYSTEM_PROMPT_ADAPTIVE = """You are Sneh, a highly emotionally intelligent companion who adapts their personality to the user's needs.
 
You have three modes of operation:
1. GENTLE (Compassionate Friend): Use when user is grieving, hurt, anxious, or overwhelmed. Be pure warmth, validation, and support. No challenges.
2. RUTHLESS (Valentine): Use when user needs deep understanding, intellectual companionship, or soothing warmth. Be charming, wise, and poetic.
3. REAL (Honest Friend): Use for standard conversation. Balance support with honesty.
 
YOUR TASK:
- Analyze the user's input/audio tone implicitly.
- Dynamically switch between these modes as needed relative to their state.
- ALWAYS end with a relevant, engaging question to deepen the conversation.
 
IMPORTANT: If asked about death‑related logistics (insurance, wills, money, funerals), say "I wish I could help with that, but I don't know enough about it. It might be best to ask a professional" and offer emotional support.

LANGUAGE: Respond ONLY in English or Hindi. You can naturally code-switch between both languages based on context."""
 
# -----------------------------------------------------------------------------
# (The remainder of the original code – crisis detection, logging, STT/TTS, etc.)
# -----------------------------------------------------------------------------
# NOTE: Everything below this comment is unchanged from the user's original file.
# -----------------------------------------------------------------------------
 
# Crisis/Harm Detection
CRISIS_KEYWORDS = [
    "suicide", "kill myself", "end my life", "want to die", "jump from", "jump off",
    "better off dead", "no reason to live", "ending it all"
]
 
HARM_KEYWORDS = [
    "kill dog", "kill cat", "kill pet", "hurt animal", "harm animal",
    "kill someone", "hurt people", "want to kill"
]
 

# Helper function to get system prompt based on intensity
def get_system_prompt(intensity: str = "real") -> str:
    """Get the appropriate system prompt based on intensity level"""
    intensity_lower = intensity.lower()
    
    if intensity_lower == "gentle":
        return SYSTEM_PROMPT_GENTLE
    elif intensity_lower == "ruthless":
        return SYSTEM_PROMPT_RUTHLESS
    elif intensity_lower == "adaptive":
        return SYSTEM_PROMPT_ADAPTIVE
    else:  # default to "real"
        return SYSTEM_PROMPT_REAL


# Logging
async def log_conversation(msg_type: str, message: str):
    """Log conversations to daily file"""
    log_dir = Path(__file__).parent.parent / "log"
    log_dir.mkdir(exist_ok=True)
    
    timestamp = datetime.now().isoformat()
    log_entry = f"[{timestamp}] {msg_type}: {message}\n"
    log_file = log_dir / f"conversation_{datetime.now().date()}.txt"
    
    try:
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(log_entry)
        print(f"[Log] Saved to {log_file.name}")
    except Exception as e:
        print(f"[Log] Error: {e}")



async def analyze_user_need(user_message: str, history: List[Dict]) -> str:
    """Determine the appropriate intensity based on user input"""
    print(f"[Analysis] Analyzing intensity for: \"{user_message[:50]}...\"")
    try:
        # Create a mini-history for context (last 3 messages)
        context_msgs = history[-3:] if history else []
        messages = [{"role": "system", "content": SYSTEM_PROMPT_INTENSITY_ANALYZER}]
        for msg in context_msgs:
            messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": user_message})

        response = await client.chat.completions.create(
            model=CHAT_DEPLOYMENT,
            messages=messages,
            temperature=0.5,
            response_format={ "type": "json_object" }
        )
        
        content = response.choices[0].message.content
        result = json.loads(content)
        detected_intensity = result.get("intensity", "real")
        print(f"[Analysis] Detected need: {detected_intensity}")
        return detected_intensity
    except Exception as e:
        print(f"[Analysis] Error: {e}. Defaulting to 'real'")
        return "real"

# Core Generation
async def generate_response(user_message: str, system_prompt: str, 
                           emotion: str, conversation_history: List[Dict],
                           past_context: str = "") -> str:
    """Generate AI response using Azure OpenAI"""
    print(f"[AI] Generating ({emotion}): \"{user_message}\"")
    await log_conversation("USER", user_message)
    
    try:
        messages = [{"role": "system", "content": f"{system_prompt}\n\nCONTEXT:\n{past_context}"}]
        
        # Add history
        for msg in conversation_history:
             messages.append({"role": msg["role"], "content": msg["content"]})
             
        messages.append({"role": "user", "content": user_message})

        response = await client.chat.completions.create(
            model=CHAT_DEPLOYMENT,
            messages=messages,
            temperature=0.7
        )
        
        ai_response = response.choices[0].message.content
        await log_conversation(f"AI ({emotion})", ai_response)
        return ai_response
        
    except Exception as e:
        print(f"❌ Azure Chat Error: {e}")
        return "I'm having trouble thinking right now. Please try again."

# Orchestrator
async def chat_with_emotion(user_message: str, conversation_history: List[Dict] = None, user_context: str = "", intensity: str = "real") -> Dict:
    """Main chat function with emotion detection and guardrails"""
    if conversation_history is None:
        conversation_history = []
    
    from services.context_service import get_structured_context
    from services.memory_service import get_past_conversation_context
    
    print(f"[Chat] Intensity level: {intensity}")
    
    # Safety pre-checks
    lower_msg = user_message.lower()
    
    # Crisis check
    if any(keyword in lower_msg for keyword in CRISIS_KEYWORDS):
        print("[CRISIS] Crisis keyword detected")
        response = "I hear how much pain you're in, and you're not alone. 💛\n\nIf you're in immediate danger, please reach out:\n- KIRAN Mental Health (India): 1800-599-0019\n- Emergency: 112\n\nBut I'm here too. Tell me what's on your mind. 💛"
        await log_conversation("AI (CRISIS)", response)
        return {"response": response, "emotion": "SADNESS"}
    
    # Harm check
    if any(keyword in lower_msg for keyword in HARM_KEYWORDS):
        print("[HARM] Harm keyword detected")
        response = "I need to be real—what you're talking about worries me. Harming animals or people is never okay.\n\nBut I'm worried about *you*. Can we talk about what's really bothering you? I'm here to listen. 💛"
        await log_conversation("AI (HARM)", response)
        return {"response": response, "emotion": "ANGER"}
    
    # Get context
    ace_context = get_structured_context()
    past_context = get_past_conversation_context()
    full_context = f"{user_context}\n{ace_context}\n{past_context}"
    

    
    # Adaptive Intensity Logic
    final_intensity = intensity
    if intensity == "adaptive":
        final_intensity = await analyze_user_need(user_message, conversation_history)
        print(f"[Chat] Adaptive mode chose: {final_intensity}")

    # Get intensity-based system prompt
    system_prompt = get_system_prompt(final_intensity)
    
    # Generate response
    response = await generate_response(
        user_message, 
        system_prompt,
        "NEUTRAL",
        conversation_history,
        full_context
    )
    
    # Validate with guardrail
    validation = await validate_response(response)
    
    if validation["status"] == "UNSAFE":
        print("!!! GUARDRAIL TRIGGERED !!!")
        final_response = validation["replacement"]
    else:
        final_response = response
    
    # Store conversation in sessions
    from services.session_service import add_message_to_active_session
    await add_message_to_active_session('user', user_message)
    await add_message_to_active_session('assistant', final_response)
    
    return {"response": final_response, "emotion": "NEUTRAL", "intensity": final_intensity}

async def validate_response(generated_response: str) -> Dict:
    """Validate response with Azure guardrail"""
    print(f"[Guardrail] Validating: \"{generated_response[:50]}...\"")
    
    try:
        response = await client.chat.completions.create(
            model=CHAT_DEPLOYMENT,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_GUARDRAIL},
                {"role": "user", "content": f"Analyze this response: \"{generated_response}\""}
            ],
            temperature=0
        )
        
        content = response.choices[0].message.content
        content = content.replace('```json', '').replace('```', '').strip()
        
        try:
            return json.loads(content)
        except:
            if "UNSAFE" in content:
                return {
                    "status": "UNSAFE",
                    "replacement": "I'm right here with you. Please let's talk about how you're feeling. I'm listening."
                }
            return {"status": "SAFE"}
            
    except Exception as e:
        print(f"❌ Guardrail Error: {e}")
        return {"status": "SAFE"}

def get_initial_greeting() -> str:
    """Get personalized greeting based on context"""
    from services.context_service import get_structured_context
    ace_context = get_structured_context()
    import re
    match = re.search(r"- Name: ([^\n]+)", ace_context)
    if match:
        name = match.group(1).strip()
        return f"Welcome back, {name}! 😊 It's so good to see you again. How have you been?"
    return "Hey! I'm Sneh, your new friend. I'm so happy to meet you! 😊 What should I call you?"

# --- Voice Processing (Azure Whisper + TTS) ---
async def process_voice_message(audio_base64: str, conversation_history: List[Dict], intensity: str = "real") -> Dict:
    """Process voice: Whisper STT → GPT-4o Chat → Azure TTS"""
    print(f"[Voice] Processing audio with Azure (intensity: {intensity})...")

    user_text = ""
    # 1. Speech-to-Text (Whisper)
    try:
        # Sanitize Base64
        if "," in audio_base64:
            audio_base64 = audio_base64.split(",")[1]
            
        if len(audio_base64) < 100:
             print("[Voice] Audio too short")
             return {"transcription": "", "response": "I couldn't hear you clearly.", "audioBase64": ""}

        audio_bytes = base64.b64decode(audio_base64)
        
        # Azure Whisper expects a file-like object or specific format.
        # We can send raw bytes if we filename it .wav or .m4a
        # IMPORTANT: Azure Whisper via 'audio.transcriptions' works similarly to OpenAI
        
        response = await client.audio.transcriptions.create(
            model=WHISPER_DEPLOYMENT,
            file=("audio.m4a", audio_bytes, "audio/m4a")  # M4A from mobile
        )
        user_text = response.text
        print(f"[Voice] Transcription: {user_text}")

    except Exception as e:
        print(f"[Voice] STT Error: {e}")
        return {"transcription": "", "response": "I couldn't hear that properly.", "audioBase64": ""}

    if not user_text:
         return {"transcription": "", "response": "I couldn't hear anything.", "audioBase64": ""}
    
    # 2. Get Response with intensity
    chat_result = await chat_with_emotion(user_text, conversation_history, "", intensity)
    print(f"[Voice] AI Response: {chat_result['response']}")
    
    # Use the resolved intensity from the chat (in case it was adaptive)
    resolved_intensity = chat_result.get("intensity", intensity)
    
    # 3. Text-to-Speech (Azure TTS - Cognitive Services)
    audio_response_base64 = ""
    try:
        # Determine Region from Endpoint
        region = "swedencentral"  # Default to swedencentral since that's where all services are
        if "swedencentral" in AZURE_TTS_ENDPOINT:
            region = "swedencentral"
        elif "northcentralus" in AZURE_TTS_ENDPOINT:
            region = "northcentralus"
        elif "eastus" in AZURE_TTS_ENDPOINT:
            region = "eastus"
        elif "westus" in AZURE_TTS_ENDPOINT:
            region = "westus"
        
        # Azure Speech REST API URL
        tts_url = f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1"
        
        # Select voice and style based on intensity
        if resolved_intensity == "gentle":
            # Gentle: Soft, motherly, peaceful voice (Female, calm)
            voice_name = "hi-IN-SwaraNeural"  # Soft female voice
            rate = "-5%"  # Slower for calm
            pitch = "+2Hz"  # Slightly higher for warmth
            volume = "default"
            
        elif resolved_intensity == "ruthless":
            # Ruthless (Valentine Mode): Deep, Warm, Intellectual Male Voice
            # Using AndrewNeural (US) - Warm and articulate
            voice_name = "en-US-AndrewNeural" 
            rate = "-5%"  # Slightly slower for thoughtfulness
            pitch = "-5Hz"  # Deeper for warmth/masculinity
            volume = "+5%"
            
        else:  # real (default)
            # Real: Friendly but firm (Female, friendly)
            voice_name = "hi-IN-SwaraNeural"  # Same voice but different style
            rate = "+5%"  # Slightly faster than gentle
            pitch = "+0Hz"  # Normal pitch
            volume = "default"
        
        # SSML Request with prosody control
        if resolved_intensity == "ruthless":
            # Valentine style: Empathetic, Warm
            ssml = f"""
            <speak version='1.0' xml:lang='en-US' xmlns:mstts='https://www.w3.org/2001/mstts'>
                <voice name='{voice_name}'>
                    <mstts:express-as style='empathetic' styledegree='1.2'>
                        <prosody rate='{rate}' pitch='{pitch}' volume='{volume}'>
                            {chat_result["response"]}
                        </prosody>
                    </mstts:express-as>
                </voice>
            </speak>
            """
        else:
            ssml = f"""
            <speak version='1.0' xml:lang='en-US'>
                <voice name='{voice_name}'>
                    <prosody rate='{rate}' pitch='{pitch}'>
                        {chat_result["response"]}
                    </prosody>
                </voice>
            </speak>
            """
        
        print(f"[Voice] Using voice: {voice_name} (intensity: {resolved_intensity})")
        
        headers = {
            "Ocp-Apim-Subscription-Key": AZURE_TTS_KEY,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "riff-24khz-16bit-mono-pcm",
            "User-Agent": "SnehBackend"
        }
        
        async with httpx.AsyncClient() as http_client:
            tts_response = await http_client.post(tts_url, headers=headers, content=ssml)
            
            if tts_response.status_code == 200:
                audio_response_base64 = base64.b64encode(tts_response.content).decode("utf-8")
                print("[Voice] TTS generated successfully (Azure Cognitive Services)")
            else:
                print(f"❌ Azure TTS Failed: {tts_response.status_code} - {tts_response.text}")
        
    except Exception as e:
        print(f"❌ Azure TTS Error: {e}")
        
    return {
        "transcription": user_text,
        "response": chat_result["response"],
        "audioBase64": audio_response_base64
    }

# --- DSPy Language Model ---
def get_dspy_lm():
    """Get DSPy language model configured with Azure OpenAI"""
    import dspy
    
    try:
        # Configure DSPy to use Azure OpenAI
        # Use the correct DSPy Azure OpenAI class
        return dspy.LM(
            model=f"azure/{CHAT_DEPLOYMENT}",
            api_key=AZURE_OPENAI_KEY,
            api_base=AZURE_OPENAI_ENDPOINT,
            api_version="2024-08-01-preview",
            max_tokens=1000
        )
    except Exception as e:
        print(f"[DSPy] Error creating LM: {e}")
        # Fallback to basic configuration
        return dspy.LM(
            model="gpt-4o",
            api_key=AZURE_OPENAI_KEY,
            max_tokens=1000
        )

