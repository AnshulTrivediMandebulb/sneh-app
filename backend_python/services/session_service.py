"""
Session Service - Detect and manage conversation sessions using PostgreSQL
Groups messages into sessions with AI-generated titles
"""
import json
from typing import List, Dict
from datetime import datetime, timedelta
from openai import AsyncAzureOpenAI
import os
import asyncio
from dotenv import load_dotenv
from services.database import db_service

load_dotenv()

# Initialize Azure OpenAI client
client = AsyncAzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_KEY"),
    api_version="2024-08-01-preview",
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
)

CHAT_DEPLOYMENT = os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT", "gpt-4o")
SESSION_GAP_HOURS = 2  # New session after 2 hour gap

def _load_sessions() -> List[Dict]:
    """Load conversation sessions from PostgreSQL app_state"""
    try:
        conn = db_service.get_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT value FROM app_state WHERE key = 'conversation_sessions'")
            row = cur.fetchone()
        conn.close()
        if row:
            data = row['value']
            return data.get('sessions', [])
        return []
    except Exception as e:
        print(f"Error loading sessions from DB: {e}")
        return []

def _save_sessions(sessions: List[Dict]) -> None:
    """Save conversation sessions to PostgreSQL app_state"""
    try:
        conn = db_service.get_connection()
        with conn.cursor() as cur:
            value = {
                'sessions': sessions,
                'lastUpdated': datetime.utcnow().isoformat() + 'Z'
            }
            cur.execute(
                """
                INSERT INTO app_state (key, value, updated_at)
                VALUES ('conversation_sessions', %s, %s)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
                """,
                (json.dumps(value), datetime.utcnow())
            )
        conn.close()
    except Exception as e:
        print(f"Error saving sessions to DB: {e}")
        raise

async def generate_session_metadata(messages: List[Dict]) -> Dict:
    """Generate title, priority, and tags for a session using AI"""
    try:
        # Format conversation for context
        conversation_text = ""
        for i, msg in enumerate(messages[:8]):
            role = "You" if msg['role'] == 'user' else "Sneh"
            conversation_text += f"{role}: {msg['content']}\n"
        
        prompt = f"""Analyze this conversation and provide a JSON response with:
1. title: Short 3-5 word title (specific topic)
2. priority: 'high', 'medium', or 'low' based on emotional intensity or importance
3. tags: List of 1-2 short keywords (e.g. 'work', 'stress', 'casual', 'goal',"sad", "happy")

Conversation:
{conversation_text}

Response format (JSON only):
{{
  "title": "Title Here",
  "priority": "medium",
  "tags": ["tag1", "tag2"]
}}"""
        
        response = await client.chat.completions.create(
            model=CHAT_DEPLOYMENT,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=60,
            temperature=0.7,
            response_format={ "type": "json_object" }
        )
        
        content = response.choices[0].message.content.strip()
        metadata = json.loads(content)
        
        print(f"[Sessions] Generated metadata: {metadata}")
        return metadata
        
    except Exception as e:
        print(f"[Sessions] Error generating metadata: {e}")
        # Fallback
        first_msg_time = datetime.fromisoformat(messages[0]['timestamp'].replace('Z', '+00:00'))
        return {
            "title": f"Conversation {first_msg_time.strftime('%b %d')}",
            "priority": "low",
            "tags": ["chat"]
        }

def detect_session_end(messages: List[Dict]) -> bool:
    """Detect if a session should end based on last message"""
    if not messages:
        return False
    
    last_msg = messages[-1]
    content_lower = last_msg['content'].lower()
    
    # Check for goodbye keywords
    goodbye_keywords = ['bye', 'goodbye', 'good night', 'see you', 'talk later', 'gotta go', 'ttyl']
    
    return any(keyword in content_lower for keyword in goodbye_keywords)

async def create_session_from_messages(messages: List[Dict], session_id: str = None) -> Dict:
    """Create a session object from messages with AI-generated title"""
    import uuid
    
    if not messages:
        return None
    
    # Generate metadata using AI
    metadata = await generate_session_metadata(messages)
    
    # Append date to title for better organization
    base_title = metadata.get('title', 'New Conversation')
    first_msg_time = datetime.fromisoformat(messages[0]['timestamp'].replace('Z', '+00:00'))
    date_str = first_msg_time.strftime('%b %d')
    final_title = f"{base_title} - {date_str}"
    
    session = {
        'id': session_id or f"sess_{uuid.uuid4().hex[:8]}",
        'title': final_title,
        'priority': metadata.get('priority', 'low'),
        'tags': metadata.get('tags', []),
        'timestamp': messages[0]['timestamp'],
        'messageCount': len(messages),
        'lastMessageTime': messages[-1]['timestamp'],
        'messages': messages
    }
    
    return session

async def group_messages_into_sessions(messages: List[Dict]) -> List[Dict]:
    """Group flat message list into conversation sessions"""
    if not messages:
        return []
    
    sessions = []
    current_session_messages = []
    
    for i, msg in enumerate(messages):
        current_session_messages.append(msg)
        
        # Check if session should end
        is_last_message = (i == len(messages) - 1)
        has_goodbye = detect_session_end([msg])
        
        # Check time gap for next message
        time_gap_detected = False
        if i < len(messages) - 1:
            current_time = datetime.fromisoformat(msg['timestamp'].replace('Z', '+00:00'))
            next_time = datetime.fromisoformat(messages[i + 1]['timestamp'].replace('Z', '+00:00'))
            time_gap = (next_time - current_time).total_seconds() / 3600  # hours
            time_gap_detected = time_gap > SESSION_GAP_HOURS
        
        # End session if conditions met
        if has_goodbye or time_gap_detected or is_last_message:
            session = await create_session_from_messages(current_session_messages)
            if session:
                sessions.append(session)
            current_session_messages = []
    
    return sessions

async def get_all_sessions() -> List[Dict]:
    """Get all conversation sessions from DB"""
    return _load_sessions()

async def get_active_session() -> Dict:
    """Get the currently active session or the most recent one from DB"""
    sessions = _load_sessions()
    if not sessions:
        return {}
    
    return sessions[-1]

async def add_message_to_active_session(role: str, content: str, timestamp: str = None, **metadata) -> None:
    """Add a message to the current active session in DB with optional metadata"""
    sessions = _load_sessions()
    
    if timestamp is None:
        timestamp = datetime.utcnow().isoformat() + 'Z'
    
    new_message = {
        'role': role,
        'content': content,
        'timestamp': timestamp,
        **metadata  # valid JSON only
    }
    
    # [NEW] Also store in the flat 'messages' table for easy querying/redundancy
    from services.memory_service import add_message
    add_message(role, content, metadata=metadata)
    
    # Check if we should add to existing session or create new one
    if sessions:
        last_session = sessions[-1]
        last_msg_time = datetime.fromisoformat(last_session['lastMessageTime'].replace('Z', '+00:00'))
        current_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        time_gap = (current_time - last_msg_time).total_seconds() / 3600
        
        # Check if last session ended with goodbye
        last_message_had_goodbye = detect_session_end(last_session['messages'])
        
        # Add to existing session if no time gap and no goodbye
        if time_gap <= SESSION_GAP_HOURS and not last_message_had_goodbye:
            last_session['messages'].append(new_message)
            last_session['messageCount'] = len(last_session['messages'])
            last_session['lastMessageTime'] = timestamp
            
            # Regenerate metadata if session is still growing
            if len(last_session['messages']) <= 10:
                metadata = await generate_session_metadata(last_session['messages'])
                
                # [FIX]: Preserve the date-stamp when updating the title
                new_base_title = metadata.get('title', last_session['title'].split(' - ')[0])
                first_msg_time = datetime.fromisoformat(last_session['timestamp'].replace('Z', '+00:00'))
                date_str = first_msg_time.strftime('%b %d')
                
                last_session['title'] = f"{new_base_title} - {date_str}"
                last_session['priority'] = metadata.get('priority', 'low')
                last_session['tags'] = metadata.get('tags', [])
            
            _save_sessions(sessions)
            
            # Auto-Recap: If goodbye detected, run analysis in background
            if detect_session_end([new_message]):
                print(f"[Session] Goodbye detected in '{last_session['title']}'. Triggering background recap...")
                from services.perspective_service import generate_session_recap
                return asyncio.create_task(generate_session_recap(last_session['messages']))
            
            return None
    
    # Create new session
    recap_task = None
    if sessions:
        last_session = sessions[-1]
        print(f"[Session] New session starting. Triggering recap for previous: '{last_session['title']}'")
        from services.perspective_service import generate_session_recap
        recap_task = asyncio.create_task(generate_session_recap(last_session['messages']))
        
    new_session = await create_session_from_messages([new_message])
    sessions.append(new_session)
    _save_sessions(sessions)
    
    print(f"[Sessions] Created new session in PostgreSQL: {new_session['title']}")
    return recap_task

async def force_end_active_session() -> bool:
    """Force the current active session to be analyzed immediately"""
    sessions = _load_sessions()
    if not sessions:
        return False
        
    last_session = sessions[-1]
    print(f"[Session] forcing end for: '{last_session['title']}'. Triggering background recap...")
    from services.perspective_service import generate_session_recap
    
    asyncio.create_task(generate_session_recap(last_session['messages']))
    return True
