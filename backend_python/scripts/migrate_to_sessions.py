"""
One-time migration script to convert flat messages to sessions
Run this to migrate existing conversation_history.json into sessions
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from services.session_service import group_messages_into_sessions, _save_sessions
from services.memory_service import _load_history

async def migrate():
    print("[Migration] Starting conversation to session migration...")
    
    # Load old flat messages
    messages = _load_history()
    
    if not messages:
        print("[Migration] No messages to migrate")
        return
    
    print(f"[Migration] Found {len(messages)} messages")
    
    # Group into sessions with AI-generated titles
    print("[Migration] Grouping messages and generating titles...")
    sessions = await group_messages_into_sessions(messages)
    
    print(f"[Migration] Created {len(sessions)} sessions:")
    for session in sessions:
        print(f"  - {session['title']} ({session['messageCount']} messages)")
    
    # Save sessions
    _save_sessions(sessions)
    print("[Migration] ✅ Migration complete!")

if __name__ == "__main__":
    asyncio.run(migrate())
