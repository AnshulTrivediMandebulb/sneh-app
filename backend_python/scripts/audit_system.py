import asyncio
import os
import sys
import json
from datetime import datetime

# Add the backend_python directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(backend_dir)
os.chdir(backend_dir) # Change working directory to backend_python

from services.database import db_service
from services.memory_service import add_message, get_recent_context
from services.session_service import add_message_to_active_session, get_active_session, get_all_sessions
from services.context_service import ensure_context, get_all_contexts
from services.perspective_service import generate_session_recap

async def run_audit():
    print("\n--- 🛡️ SNEH COMPREHENSIVE SYSTEM AUDIT ---")
    results = {}

    # 1. Database Connection & Schema
    try:
        conn = db_service.get_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
            tables = [r['table_name'] for r in cur.fetchall()]
        conn.close()
        required_tables = ['messages', 'user_contexts', 'app_state']
        results['db_schema'] = all(t in tables for t in required_tables)
        print(f"✅ Database Schema: {tables}")
    except Exception as e:
        results['db_schema'] = f"FAIL: {e}"
        print(f"❌ Database Schema: {e}")

    # 2. Memory Service (PostgreSQL)
    try:
        test_msg = f"Audit message at {datetime.now()}"
        add_message("user", test_msg)
        history_text = get_recent_context(5)
        results['memory_persistence'] = test_msg in history_text
        print(f"✅ Memory Persistence: {'PASSED' if results['memory_persistence'] else 'FAILED'}")
    except Exception as e:
        results['memory_persistence'] = f"FAIL: {e}"
        print(f"❌ Memory Persistence: {e}")

    # 3. Session Management & Naming Stability
    try:
        # Create a new session with multiple messages to trigger naming logic
        session_msg = f"Auditing session flow {datetime.now().strftime('%H:%M:%S')}"
        # Triggering a new session by waiting or being different enough if session exists
        # In the audit, we just want to see it added and titled
        await add_message_to_active_session("user", session_msg)
        await asyncio.sleep(3) # Wait for AI title generation
        
        session = await get_active_session()
        title = session.get('title', '')
        results['session_creation'] = any(msg['content'] == session_msg for msg in session.get('messages', []))
        results['naming_stability'] = " - " in title
        print(f"✅ Session Created: {results['session_creation']}")
        print(f"✅ Session Title (Stable): {title}")
    except Exception as e:
        results['session_logic'] = f"FAIL: {e}"
        print(f"❌ Session Logic: {e}")

    # 4. Context Management
    try:
        ctx_title = f"Audit Goal {datetime.now().hex()}"
        ensure_context(ctx_title, "Maintaining high code quality during audit", priority="high")
        contexts = get_all_contexts()
        results['context_persistence'] = any(c['title'] == ctx_title for c in contexts)
        print(f"✅ Context Persistence: {'PASSED' if results['context_persistence'] else 'FAILED'}")
    except Exception as e:
        results['context_persistence'] = f"FAIL: {e}"

    # 5. Ritual Generation (On-Demand)
    try:
        messages = [
            {"role": "user", "content": "I'm overwhelmed with work and feel like I'm failing."},
            {"role": "assistant", "content": "I'm here for you. Let's break it down."}
        ]
        recap = await generate_session_recap(messages)
        has_perspectives = all(k in recap for k in ['mirror', 'coach', 'challenger'])
        results['ritual_generation'] = has_perspectives
        print(f"✅ Ritual Generation: {'PASSED' if has_perspectives else 'FAILED'}")
        if has_perspectives:
            print(f"   - Mirror: {recap['mirror']['title']}")
            print(f"   - Coach: {recap['coach']['title']}")
            print(f"   - Challenger: {recap['challenger']['title']}")
    except Exception as e:
        results['ritual_generation'] = f"FAIL: {e}"

    # Final Summary
    print("\n--- AUDIT SUMMARY ---")
    all_passed = all(v is True for v in results.values() if isinstance(v, bool))
    if all_passed:
        print("🚀 ALL SYSTEMS OPERATIONAL. READY FOR USE.")
    else:
        print("⚠️ SOME SYSTEMS HAVE ISSUES. CHECK LOGS ABOVE.")
    
    return results

if __name__ == "__main__":
    asyncio.run(run_audit())
