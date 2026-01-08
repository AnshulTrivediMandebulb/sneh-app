"""
Sneh Backend - FastAPI + DSPy
Main application with REST endpoints and WebSocket support
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv
import uvicorn

import sys
import io

# Force UTF-8 encoding for stdout/stderr (Fixes UnicodeEncodeError on Windows)
if sys.platform.startswith('win'):
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

from services.ai_service import chat_with_emotion, get_initial_greeting

# Configure path for local ffmpeg if it exists
# This allows the app to find the downloaded FFmpeg binary automatically
ffmpeg_path = os.path.join(os.getcwd(), "ffmpeg_runtime", "bin")
if os.path.exists(ffmpeg_path):
    print(f"[FFmpeg] Adding local FFmpeg to PATH: {ffmpeg_path}")
    os.environ["PATH"] = ffmpeg_path + os.pathsep + os.environ["PATH"]

from services.realtime_service import setup_realtime_websocket

# Load environment variables
load_dotenv()

app = FastAPI(title="Sneh Backend", version="2.0.0")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response Models
class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    conversationHistory: List[Message] = []
    userName: Optional[str] = None  # User's name for personalization
    intensity: Optional[str] = "real"  # Intensity level: gentle, real, ruthless

class VoiceRequest(BaseModel):
    audioBase64: str
    conversationHistory: List[Message] = []
    intensity: Optional[str] = "real"  # Intensity level: gentle, real, ruthless

class ContextRequest(BaseModel):
    title: str
    description: str = ""
    priority: str = "medium"  # high, medium, low
    status: str = "active"  # active, stable, in_progress, archived
    tags: List[str] = []

class ContextUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[List[str]] = None

# ============================================
# REST ENDPOINTS
# ============================================

@app.get("/")
async def root():
    """Root endpoint to verify server is running"""
    return {
        "status": "online",
        "message": "Sneh Backend is running!",
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "timestamp": __import__('time').time()}

@app.get("/greeting")
async def greeting():
    """Get initial greeting message"""
    try:
        print("[Greeting] Request received")
        greeting_text = get_initial_greeting()
        return {"greeting": greeting_text}
    except Exception as e:
        print(f"[Greeting] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def handle_chat(request: ChatRequest):
    """Handle chat message with emotion detection"""
    try:
        from services.ai_service import chat_with_emotion
        
        conversation_history = [
            {"role": msg.role, "content": msg.content} 
            for msg in request.conversationHistory
        ]
        
        # Add userName to context if provided
        user_context = ""
        if request.userName:
            user_context = f"The user's name is {request.userName}. Address them by name warmly and frequently."
            print(f"[Chat] User name: {request.userName}")
        
        print(f"[Chat] 📊 Received intensity: '{request.intensity}'")
        print(f"[Chat] 📊 Using intensity: '{request.intensity or 'real'}'")
        
        result = await chat_with_emotion(
            request.message, 
            conversation_history,
            user_context,
            request.intensity or "real"
        )
        return result
        
    except Exception as e:
        print(f"[Chat] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/voice")
async def voice(request: VoiceRequest):
    """Voice endpoint: STT → GPT-4o → TTS"""
    try:
        from services.ai_service import process_voice_message
        
        print("[Voice] Processing audio...")
        print(f"[Voice] 📊 Received intensity: '{request.intensity}'")
        print(f"[Voice] 📊 Using intensity: '{request.intensity or 'real'}'")
        
        history = [{"role": msg.role, "content": msg.content} for msg in request.conversationHistory]
        
        result = await process_voice_message(request.audioBase64, history, request.intensity or "real")
        return result
        
    except Exception as e:
        print(f"[Voice] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/contexts")
async def get_contexts():
    """Get all user contexts"""
    try:
        from services.context_service import get_all_contexts
        contexts = get_all_contexts()
        return {"contexts": contexts}
    except Exception as e:
        print(f"[Contexts] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/contexts")
async def create_context(request: ContextRequest):
    """Create new context"""
    try:
        from services.context_service import create_context
        context = create_context(
            title=request.title,
            description=request.description,
            priority=request.priority,
            status=request.status,
            tags=request.tags
        )
        return context
    except Exception as e:
        print(f"[Contexts] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/contexts/{context_id}")
async def update_context(context_id: str, request: ContextUpdateRequest):
    """Update existing context"""
    try:
        from services.context_service import update_context as update_ctx
        
        # Build updates dict from non-None fields
        updates = {k: v for k, v in request.dict().items() if v is not None}
        
        context = update_ctx(context_id, updates)
        if not context:
            raise HTTPException(status_code=404, detail="Context not found")
        return context
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Contexts] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/contexts/{context_id}")
async def delete_context(context_id: str):
    """Delete context"""
    try:
        from services.context_service import delete_context as delete_ctx
        
        success = delete_ctx(context_id)
        if not success:
            raise HTTPException(status_code=404, detail="Context not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Contexts] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/contexts/extract")
async def extract_contexts(request: dict):
    """Extract contexts from conversation messages using AI"""
    try:
        from services.context_extractor import extract_contexts_from_messages
        from services.context_service import ensure_context
        
        messages = request.get("messages", [])
        if not messages:
            print("[Context Extraction] No messages provided")
            return {"contexts": [], "extracted": []}
        
        print(f"[Context Extraction] Analyzing {len(messages)} messages...")
        print(f"[Context Extraction] Sample message: {messages[0] if messages else 'None'}")
        
        # Use DSPy to extract contexts
        try:
            extracted = extract_contexts_from_messages(messages)
            print(f"[Context Extraction] Extracted {len(extracted)} contexts")
        except Exception as extract_err:
            print(f"[Context Extraction] Extraction failed: {extract_err}")
            import traceback
            traceback.print_exc()
            # Return empty result instead of raising
            return {"contexts": [], "extracted": [], "error": str(extract_err)}
        
        # Save extracted contexts (with deduplication)
        saved_contexts = []
        for ctx_data in extracted:
            try:
                context = ensure_context(
                    title=ctx_data.get("title", ""),
                    description=ctx_data.get("description", ""),
                    priority=ctx_data.get("priority", "medium"),
                    status=ctx_data.get("status", "active"),
                    tags=ctx_data.get("tags", [])
                )
                saved_contexts.append(context)
            except Exception as e:
                print(f"[Context Extraction] Failed to save context: {e}")
        
        print(f"[Context Extraction] Extracted and saved {len(saved_contexts)} contexts")
        return {"contexts": saved_contexts, "extracted": extracted}
        
    except Exception as e:
        print(f"[Context Extraction] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/session/end")
async def end_active_session():
    """Explicitly end the current active session and trigger context analysis"""
    try:
        from services.session_service import force_end_active_session
        result = await force_end_active_session()
        return {"success": result, "message": "Session analysis triggered" if result else "No active session"}
    except Exception as e:
        print(f"[Session] Error forcing end: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        import traceback
        traceback.print_exc()
        # Return graceful error instead of 500
        return {"contexts": [], "extracted": [], "error": f"Context extraction failed: {str(e)}"}


@app.post("/recap/generate")
async def generate_recap(request: dict):
    """Generate Mirror/Coach/Challenger perspectives from conversation messages"""
    try:
        from services.ai_service import client, CHAT_DEPLOYMENT
        import json
        
        messages = request.get("messages", [])
        if not messages:
            return {"mirror": None, "coach": None, "challenger": None}
        
        print(f"[Recap Generation] Analyzing {len(messages)} messages...")
        
        # Format conversation
        conversation_text = "\n".join([
            f"{msg['role'].upper()}: {msg['content']}"
            for msg in messages
        ])
        
        # Generate all three perspectives using Azure GPT-4o
        prompts = {
            "mirror": f"""Analyze this conversation and provide empathetic validation.

Conversation:
{conversation_text}

Respond in JSON format:
{{
    "title": "Brief empathetic title (max 5 words)",
    "content": "Warm, validating reflection of their feelings and experience (2-3 sentences)"
}}""",
            "coach": f"""Analyze this conversation and provide supportive guidance.

Conversation:
{conversation_text}

Respond in JSON format:
{{
    "title": "Supportive guidance title (max 5 words)",
    "content": "Encouraging advice with practical next steps (2-3 sentences)",
    "action_item": "One specific actionable step they can take"
}}""",
            "challenger": f"""Analyze this conversation and provide growth-oriented feedback.

Conversation:
{conversation_text}

Respond in JSON format:
{{
    "title": "Growth challenge title (max 5 words)",
    "content": "Constructive challenge to help them grow (2-3 sentences)"
}}"""
        }
        
        result = {}
        for perspective_id, prompt in prompts.items():
            try:
                response = await client.chat.completions.create(
                    model=CHAT_DEPLOYMENT,
                    messages=[
                        {"role": "system", "content": "You are an AI that provides therapeutic perspectives. Always respond in valid JSON format."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.7,
                    max_tokens=300
                )
                
                content = response.choices[0].message.content.strip()
                # Remove markdown code blocks if present
                content = content.replace('```json', '').replace('```', '').strip()
                
                perspective_data = json.loads(content)
                result[perspective_id] = perspective_data
                print(f"[Recap] Generated {perspective_id}: {perspective_data.get('title')}")
                
            except Exception as e:
                print(f"[Recap] Failed to generate {perspective_id}: {e}")
                result[perspective_id] = {
                    "title": f"{perspective_id.title()} Perspective",
                    "content": "Unable to generate this perspective at the moment."
                }
        
        return result
        
    except Exception as e:
        print(f"[Recap Generation] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/conversations")
async def get_conversations():
    """Get conversation history"""
    try:
        from services.memory_service import _load_history
        messages = _load_history()
        return {"messages": messages}
    except Exception as e:
        print(f"[Conversations] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/sessions")
async def get_sessions():
    """Get conversation sessions with AI-generated titles"""
    try:
        from services.session_service import get_all_sessions
        sessions = await get_all_sessions()
        return {"sessions": sessions}
    except Exception as e:
        print(f"[Sessions] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/sessions/{session_id}/recap")
async def generate_recap(session_id: str):
    """Generate 3-Perspective Recap (Mirror, Coach, Challenger)"""
    try:
        from services.session_service import get_all_sessions
        from services.perspective_service import generate_session_recap
        
        sessions = await get_all_sessions()
        session = next((s for s in sessions if s['id'] == session_id), None)
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
            
        recap = await generate_session_recap(session['messages'])
        return recap
        
    except Exception as e:
        print(f"[Recap] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class RecapGenerateRequest(BaseModel):
    messages: List[Message]

@app.post("/recap/generate")
async def generate_recap_from_messages(request: RecapGenerateRequest):
    """Generate 3-Perspective Recap from messages array (for current session)"""
    try:
        from services.perspective_service import generate_session_recap
        
        print(f"[Recap] Generating recap from {len(request.messages)} messages")
        
        # Convert to dict format expected by generate_session_recap
        messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]
        
        recap = await generate_session_recap(messages)
        return recap
        
    except Exception as e:
        print(f"[Recap] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# WEBSOCKET ENDPOINT
# ============================================

@app.websocket("/")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time audio streaming"""
    try:
        print(f"[WS] 🔵 Incoming connection request from {websocket.client.host}:{websocket.client.port}")
        await websocket.accept()
        
        # Extract intensity from query params
        intensity = websocket.query_params.get("intensity", "real")
        print(f"[WS] Mobile client connected (intensity: {intensity})", flush=True)
        
        await setup_realtime_websocket(websocket, intensity)
        
    except WebSocketDisconnect:
        print("[WS] Mobile disconnected", flush=True)
    except Exception as e:
        print(f"[WS] CRITICAL ERROR: {e}", flush=True)
        import traceback
        traceback.print_exc()
        try:
             await websocket.close(code=1011)
        except: 
             pass


# ============================================
# STARTUP
# ============================================

if __name__ == "__main__":
    PORT = int(os.getenv("PORT", 8000))
    
    print("\n" + "=" * 50)
    print(f"SNEH SERVER STARTED on port {PORT}")
    print(f"Backend: Python + FastAPI + DSPy")
    
    # Print Local IP Addresses
    import socket
    try:
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
        print(f"Local Network IP: {local_ip}")
        
        # Try to find all IPs (in case of multiple adapters)
        print("Available IPs:")
        ips = socket.gethostbyname_ex(hostname)[2]
        for ip in ips:
            if not ip.startswith("127."):
               print(f"   http://{ip}:{PORT}")
    except Exception as e:
        print(f"Could not detect local IP: {e}")

    print("=" * 50 + "\n")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=PORT,
        reload=True,
        log_level="info"
    )
