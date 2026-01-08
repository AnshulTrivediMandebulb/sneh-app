import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv()

class DatabaseService:
    def __init__(self):
        self.host = os.getenv("POSTGRES_HOST", "localhost")
        self.port = os.getenv("POSTGRES_PORT", "5432")
        self.user = os.getenv("POSTGRES_USER", "postgres")
        self.password = os.getenv("POSTGRES_PASSWORD")
        self.database = os.getenv("POSTGRES_DB", "sneh_db")

    def get_connection(self):
        """Get a central connection to PostgreSQL"""
        conn = psycopg2.connect(
            host=self.host,
            port=self.port,
            user=self.user,
            password=self.password,
            database=self.database,
            cursor_factory=RealDictCursor
        )
        conn.autocommit = True
        return conn

    def init_db(self):
        """Initialize database tables"""
        queries = [
            # Messages table
            """
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                metadata JSONB
            );
            """,
            # User Contexts table
            """
            CREATE TABLE IF NOT EXISTS user_contexts (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                priority TEXT DEFAULT 'medium',
                status TEXT DEFAULT 'active',
                tags TEXT[],
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                extra_metadata JSONB
            );
            """,
            # Sessions/State table (for conversation_sessions.json)
            """
            CREATE TABLE IF NOT EXISTS app_state (
                key TEXT PRIMARY KEY,
                value JSONB,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            """,
            # View for easy reading of chat sessions
            """
            DROP VIEW IF EXISTS v_chat_sessions;
            CREATE OR REPLACE VIEW v_chat_sessions AS
            SELECT 
                session->>'title' AS chat_name,
                session->>'priority' AS priority,
                session->'tags' AS tags,
                msg->>'timestamp' AS time,
                msg->>'role' AS sender,
                msg->>'content' AS message
            FROM app_state,
            LATERAL jsonb_array_elements(value->'sessions') AS session,
            LATERAL jsonb_array_elements(session->'messages') AS msg
            WHERE key = 'conversation_sessions'
            ORDER BY chat_name, time;
            """
        ]
        
        conn = self.get_connection()
        try:
            with conn.cursor() as cur:
                for query in queries:
                    cur.execute(query)
            print("[Database] Schema initialized successfully")
        except Exception as e:
            print(f"[Database] Error initializing schema: {e}")
        finally:
            conn.close()

# Singleton instance
db_service = DatabaseService()

if __name__ == "__main__":
    db_service.init_db()
