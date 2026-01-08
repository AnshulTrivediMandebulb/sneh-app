"""
Context Service - Manage user's personal contexts using PostgreSQL
Provides CRUD operations and AI-friendly summaries
"""
import json
import uuid
from datetime import datetime
from typing import List, Dict, Optional
from services.database import db_service

def get_all_contexts() -> List[Dict]:
    """Get all user contexts from PostgreSQL"""
    try:
        conn = db_service.get_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM user_contexts ORDER BY updated_at DESC")
            rows = cur.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    except Exception as e:
        print(f"Error getting contexts from DB: {e}")
        return []

def get_context_by_id(context_id: str) -> Optional[Dict]:
    """Get specific context by ID from PostgreSQL"""
    try:
        conn = db_service.get_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM user_contexts WHERE id = %s", (context_id,))
            row = cur.fetchone()
        conn.close()
        return dict(row) if row else None
    except Exception as e:
        print(f"Error getting context by ID: {e}")
        return None

def create_context(title: str, description: str = "", priority: str = "medium", 
                   tags: List[str] = None, status: str = "active", **kwargs) -> Dict:
    """Create new context in PostgreSQL"""
    context_id = f"ctx_{uuid.uuid4().hex[:8]}"
    now = datetime.utcnow()
    
    try:
        conn = db_service.get_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO user_contexts (id, title, description, priority, status, tags, created_at, updated_at, extra_metadata)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (context_id, title, description, priority, status, tags or [], now, now, json.dumps(kwargs))
            )
        conn.close()
        print(f"[Context] Created: {title} in PostgreSQL")
        return {
            'id': context_id,
            'title': title,
            'description': description,
            'priority': priority,
            'status': status,
            'tags': tags or [],
            'createdAt': now.isoformat() + 'Z',
            'updatedAt': now.isoformat() + 'Z',
            **kwargs
        }
    except Exception as e:
        print(f"Error creating context in DB: {e}")
        return {}

def ensure_context(title: str, description: str = "", priority: str = "medium", **kwargs) -> Dict:
    """Create a new context only if a similar one doesn't exist"""
    try:
        conn = db_service.get_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM user_contexts WHERE LOWER(title) = LOWER(%s)", (title,))
            existing = cur.fetchone()
        conn.close()
        
        if existing:
            print(f"[Context] Exists, skipping creation: {title}")
            return dict(existing)
            
        return create_context(title, description, priority, **kwargs)
    except Exception as e:
        print(f"Error in ensure_context: {e}")
        return {}

def update_context(context_id: str, updates: Dict) -> Optional[Dict]:
    """Update existing context in PostgreSQL"""
    now = datetime.utcnow()
    
    # Separate core fields from extra_metadata
    core_fields = ['title', 'description', 'priority', 'status', 'tags']
    core_updates = {k: v for k, v in updates.items() if k in core_fields}
    extra_updates = {k: v for k, v in updates.items() if k not in core_fields and k not in ['id', 'createdAt', 'updatedAt']}
    
    try:
        conn = db_service.get_connection()
        with conn.cursor() as cur:
            # 1. Update core fields if any
            if core_updates:
                set_clause = ", ".join([f"{k} = %s" for k in core_updates.keys()])
                cur.execute(
                    f"UPDATE user_contexts SET {set_clause}, updated_at = %s WHERE id = %s",
                    list(core_updates.values()) + [now, context_id]
                )
            
            # 2. Update extra_metadata if any
            if extra_updates:
                cur.execute(
                    "UPDATE user_contexts SET extra_metadata = extra_metadata || %s, updated_at = %s WHERE id = %s",
                    (json.dumps(extra_updates), now, context_id)
                )
            
            # Fetch updated version
            cur.execute("SELECT * FROM user_contexts WHERE id = %s", (context_id,))
            updated = cur.fetchone()
            
        conn.close()
        if updated:
            print(f"[Context] Updated: {updated['title']}")
            return dict(updated)
    except Exception as e:
        print(f"Error updating context in DB: {e}")
        
    return None

def delete_context(context_id: str) -> bool:
    """Delete context by ID from PostgreSQL"""
    try:
        conn = db_service.get_connection()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM user_contexts WHERE id = %s", (context_id,))
            deleted = cur.rowcount > 0
        conn.close()
        if deleted:
            print(f"[Context] Deleted: {context_id}")
        return deleted
    except Exception as e:
        print(f"Error deleting context from DB: {e}")
        return False

def get_contexts_summary_for_ai() -> str:
    """Get formatted summary of contexts from PostgreSQL for AI prompts"""
    contexts = get_all_contexts()
    
    if not contexts:
        return "No active contexts."
    
    # Filter out archived
    active_contexts = [ctx for ctx in contexts if ctx.get('status') != 'archived']
    
    if not active_contexts:
        return "No active contexts."
    
    summary_lines = ["ACTIVE USER CONTEXTS:"]
    
    for ctx in active_contexts:
        priority_emoji = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(ctx['priority'], "⚪")
        status_text = ctx['status'].replace('_', ' ').title()
        
        line = f"{priority_emoji} {ctx['title']} ({status_text})"
        if ctx.get('description'):
            line += f" - {ctx['description']}"
        
        summary_lines.append(line)
    
    return "\n".join(summary_lines)

def get_structured_context() -> str:
    """Legacy function for compatibility"""
    return get_contexts_summary_for_ai()
