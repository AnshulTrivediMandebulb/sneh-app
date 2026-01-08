import json
from pathlib import Path
import sys
import os

# Add the parent directory to sys.path to import services
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.database import db_service
import psycopg2
from datetime import datetime

DATA_DIR = Path(__file__).parent.parent / "data"

def migrate_messages():
    history_file = DATA_DIR / "conversation_history.json"
    if not history_file.exists():
        print("[Migrate] No conversation_history.json found")
        return

    with open(history_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
        messages = data.get('messages', [])

    conn = db_service.get_connection()
    try:
        with conn.cursor() as cur:
            for msg in messages:
                # Prepare metadata (excluding role, content, timestamp)
                metadata = {k: v for k, v in msg.items() if k not in ['role', 'content', 'timestamp']}
                
                cur.execute(
                    "INSERT INTO messages (role, content, timestamp, metadata) VALUES (%s, %s, %s, %s)",
                    (msg['role'], msg['content'], msg.get('timestamp'), json.dumps(metadata))
                )
        print(f"[Migrate] Successfully migrated {len(messages)} messages")
    finally:
        conn.close()

def migrate_contexts():
    context_file = DATA_DIR / "user_contexts.json"
    if not context_file.exists():
        print("[Migrate] No user_contexts.json found")
        return

    with open(context_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
        contexts = data.get('contexts', [])

    conn = db_service.get_connection()
    try:
        with conn.cursor() as cur:
            for ctx in contexts:
                # Prepare extra_metadata (fields not in schema)
                extra = {k: v for k, v in ctx.items() if k not in ['id', 'title', 'description', 'priority', 'status', 'tags', 'createdAt', 'updatedAt']}
                
                cur.execute(
                    """
                    INSERT INTO user_contexts (id, title, description, priority, status, tags, created_at, updated_at, extra_metadata)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET 
                        title = EXCLUDED.title,
                        description = EXCLUDED.description,
                        priority = EXCLUDED.priority,
                        status = EXCLUDED.status,
                        tags = EXCLUDED.tags,
                        updated_at = EXCLUDED.updated_at,
                        extra_metadata = EXCLUDED.extra_metadata
                    """,
                    (
                        ctx['id'],
                        ctx['title'],
                        ctx.get('description'),
                        ctx.get('priority', 'medium'),
                        ctx.get('status', 'active'),
                        ctx.get('tags', []),
                        ctx.get('createdAt'),
                        ctx.get('updatedAt'),
                        json.dumps(extra)
                    )
                )
        print(f"[Migrate] Successfully migrated {len(contexts)} contexts")
    finally:
        conn.close()

def migrate_app_state():
    files_to_migrate = {
        "conversation_sessions": DATA_DIR / "conversation_sessions.json",
        "atomic_claims": DATA_DIR / "atomic_claims.json"
    }
    
    conn = db_service.get_connection()
    try:
        with conn.cursor() as cur:
            for key, path in files_to_migrate.items():
                if path.exists():
                    with open(path, 'r', encoding='utf-8') as f:
                        content = json.load(f)
                        cur.execute(
                            "INSERT INTO app_state (key, value, updated_at) VALUES (%s, %s, %s) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at",
                            (key, json.dumps(content), datetime.utcnow())
                        )
                    print(f"[Migrate] Successfully migrated {key}")
    finally:
        conn.close()

if __name__ == "__main__":
    print("Starting migration to PostgreSQL...")
    migrate_messages()
    migrate_contexts()
    migrate_app_state()
    print("Migration complete!")
