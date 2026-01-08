"""
Memory Service - Store and retrieve conversation history using PostgreSQL
Provides full conversation memory without RAG/embeddings
"""
import json
from datetime import datetime
from services.database import db_service

MAX_CONTEXT_MESSAGES = 50  # Load last 50 messages for context

def add_message(role: str, content: str, metadata: dict = None) -> None:
    """
    Add a message to conversation history in PostgreSQL
    
    Args:
        role: 'user' or 'assistant'
        content: Message text
        metadata: Optional dict with emotion, timestamp, etc.
    """
    try:
        conn = db_service.get_connection()
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO messages (role, content, timestamp, metadata) VALUES (%s, %s, %s, %s)",
                (role, content, datetime.utcnow(), json.dumps(metadata or {}))
            )
        conn.close()
        print(f"[Memory] Stored {role} message in PostgreSQL")
    except Exception as e:
        print(f"Error adding message to DB: {e}")

def get_recent_context(limit: int = MAX_CONTEXT_MESSAGES) -> str:
    """
    Get recent conversation history from PostgreSQL formatted for AI context
    """
    try:
        conn = db_service.get_connection()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT role, content, timestamp FROM messages ORDER BY timestamp DESC LIMIT %s",
                (limit,)
            )
            rows = cur.fetchall()
        conn.close()

        if not rows:
            return "No previous conversations."
        
        # Reverse to get chronological order
        recent = rows[::-1]
        
        context_lines = ["RECENT CONVERSATION HISTORY:"]
        context_lines.append(f"(Showing last {len(recent)} messages)\n")
        
        for msg in recent:
            role_label = "You" if msg['role'] == 'user' else "Sneh"
            timestamp = msg['timestamp']
            date_str = timestamp.strftime('%b %d, %Y %H:%M') if timestamp else "Unknown time"
            context_lines.append(f"[{date_str}] {role_label}: {msg['content']}")
        
        return "\n".join(context_lines)
    except Exception as e:
        print(f"Error getting recent context from DB: {e}")
        return "Error retrieving history."

def get_past_conversation_context() -> str:
    """Legacy function for compatibility"""
    return get_recent_context()

def get_conversation_stats() -> dict:
    """Get statistics about conversation history from PostgreSQL"""
    try:
        conn = db_service.get_connection()
        stats = {
            'totalMessages': 0,
            'userMessages': 0,
            'assistantMessages': 0,
            'firstMessage': None,
            'lastMessage': None
        }
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) as total FROM messages")
            stats['totalMessages'] = cur.fetchone()['total']
            
            cur.execute("SELECT COUNT(*) as users FROM messages WHERE role = 'user'")
            stats['userMessages'] = cur.fetchone()['users']
            
            cur.execute("SELECT COUNT(*) as assistants FROM messages WHERE role = 'assistant'")
            stats['assistantMessages'] = cur.fetchone()['assistants']
            
            cur.execute("SELECT MIN(timestamp) as first, MAX(timestamp) as last FROM messages")
            row = cur.fetchone()
            stats['firstMessage'] = row['first'].isoformat() if row['first'] else None
            stats['lastMessage'] = row['last'].isoformat() if row['last'] else None
            
        conn.close()
        return stats
    except Exception as e:
        print(f"Error getting conversation stats: {e}")
        return {}

def clear_history() -> bool:
    """Clear all conversation history from PostgreSQL"""
    try:
        conn = db_service.get_connection()
        with conn.cursor() as cur:
            cur.execute("TRUNCATE TABLE messages")
        conn.close()
        print("[Memory] Conversation history cleared in PostgreSQL")
        return True
    except Exception as e:
        print(f"[Memory] Failed to clear history: {e}")
        return False
