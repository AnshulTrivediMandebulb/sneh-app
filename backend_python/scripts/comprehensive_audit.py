import asyncio
import sys
import os
import json
from datetime import datetime

# Add the parent directory to sys.path to allow importing services
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.database import db_service
from services.memory_service import add_message, get_recent_context, get_conversation_stats
from services.context_service import create_context, get_all_contexts, update_context, delete_context
from services.session_service import add_message_to_active_session, get_all_sessions
from services.memory_store import add_claim, get_relevant_claims
from services.context_extractor import extract_contexts_from_messages

async def run_audit():
    print("\n" + "="*50)
    print("STARTING COMPREHENSIVE SNEH APP AUDIT")
    print("="*50 + "\n")

    # 1. Database Connectivity
    print("[1/6] Testing Database Connectivity...")
    try:
        conn = db_service.get_connection()
        conn.close()
        print("[OK] Database Connection: SUCCESS\n")
    except Exception as e:
        print(f"[FAIL] Database Connection: FAILED - {e}\n")
        return

    # 2. History (Memory Service)
    print("[2/6] Auditing History (Memory Service)...")
    try:
        test_content = f"Audit test message at {datetime.now().isoformat()}"
        add_message("user", test_content, metadata={"audit": True})
        stats = get_conversation_stats()
        context = get_recent_context(limit=1)
        
        if test_content in context:
            print("[OK] History Persistence: SUCCESS")
            print(f"Stats: {stats.get('totalMessages', 0)} total messages\n")
        else:
            print("[FAIL] History Persistence: FAILED (Message not found in context)\n")
    except Exception as e:
        print(f"[FAIL] History Audit: FAILED - {e}\n")

    # 3. Context & Vault (Context Service)
    print("[3/6] Auditing Context & Vault (Context Service)...")
    try:
        test_title = f"Audit Context {datetime.now().strftime('%H%M%S')}"
        new_ctx = create_context(title=test_title, description="Testing Vault persistence")
        ctx_id = new_ctx['id']
        
        all_ctx = get_all_contexts()
        found = any(c['id'] == ctx_id for c in all_ctx)
        
        if found:
            update_context(ctx_id, {"priority": "high"})
            updated_ctx = next(c for c in get_all_contexts() if c['id'] == ctx_id)
            if updated_ctx['priority'] == 'high':
                print("[OK] Context CRUD: SUCCESS")
                delete_context(ctx_id)
                print("[OK] Context Cleanup: SUCCESS\n")
            else:
                print("[FAIL] Context Update: FAILED\n")
        else:
            print("[FAIL] Context Creation: FAILED\n")
    except Exception as e:
        print(f"[FAIL] Context Audit: FAILED - {e}\n")

    # 4. Sessions (Session Service)
    print("[4/6] Auditing Sessions (Session Service)...")
    try:
        # This will trigger add_message as well (Double Persistence)
        session_msg = f"Session test at {datetime.now().isoformat()}"
        await add_message_to_active_session("user", session_msg, audit=True)
        
        sessions = await get_all_sessions()
        if sessions:
            last_sess = sessions[-1]
            print(f"[OK] Session Management: SUCCESS (Active: {last_sess['title']})")
            
            # Check if double-persistence worked
            hist_context = get_recent_context(limit=1)
            if session_msg in hist_context:
                print("[OK] Double Persistence (Session + History): SUCCESS\n")
            else:
                print("[FAIL] Double Persistence: FAILED\n")
        else:
            print("[FAIL] Session Management: FAILED (No sessions found)\n")
    except Exception as e:
        print(f"[FAIL] Session Audit: FAILED - {e}\n")

    # 5. Atomic Claims (Memory Store)
    print("[5/6] Auditing Brain Facts (Memory Store)...")
    try:
        claim_text = f"User is running an audit at {datetime.now().strftime('%H:%M')}"
        await add_claim(text=claim_text, claim_type="fact", tags=["audit"])
        
        claims = await get_relevant_claims(tags=["audit"])
        if any(c['text'] == claim_text for c in claims):
            print("[OK] Atomic Claims Persistence: SUCCESS\n")
        else:
            print("[FAIL] Atomic Claims Persistence: FAILED\n")
    except Exception as e:
        print(f"[FAIL] Atomic Claims Audit: FAILED - {e}\n")

    # 6. DSPy & Extraction (Context Extractor)
    print("[6/6] Auditing DSPy & Extraction (Partial)...")
    try:
        mock_msgs = [
            {"role": "user", "content": "I am traveling to Japan next week for work."},
            {"role": "assistant", "content": "That sounds like a big trip! How are you feeling about it?"}
        ]
        if os.getenv("AZURE_OPENAI_KEY"):
            print("Processing DSPy Extraction (This may take a moment)...")
            extracted = extract_contexts_from_messages(mock_msgs)
            print(f"[OK] DSPy Extraction: SUCCESS (Found {len(extracted)} potential themes)")
        else:
            print("[SKIP] DSPy Extraction: SKIPPED (No API key found)")
        print("\n")
    except Exception as e:
        print(f"[FAIL] DSPy Audit: FAILED - {e}\n")

    print("="*50)
    print("AUDIT COMPLETE")
    print("="*50 + "\n")

if __name__ == "__main__":
    asyncio.run(run_audit())
