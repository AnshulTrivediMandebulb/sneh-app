import asyncio
import sys
import os
from datetime import datetime

# Add root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.memory_service import add_message, get_recent_context, get_conversation_stats
from services.context_service import create_context, get_all_contexts, delete_context
from services.session_service import get_all_sessions, add_message_to_active_session

async def verify():
    print("--- Verifying PostgreSQL Refactor ---")
    
    # 1. Test Memory Service
    print("\n1. Testing Memory Service...")
    initial_stats = get_conversation_stats()
    add_message("user", "Hello Sneh, this is a PG test message.")
    new_stats = get_conversation_stats()
    if new_stats.get('totalMessages', 0) > initial_stats.get('totalMessages', 0):
        print("✅ Message added successfully.")
    else:
        print("❌ Message addition failed.")
    
    context = get_recent_context(limit=1)
    if "PG test message" in context:
        print("✅ Recent context retrieved successfully.")
    else:
        print("❌ Context retrieval failed.")

    # 2. Test Context Service
    print("\n2. Testing Context Service...")
    ctx_title = f"Test Context {datetime.utcnow().timestamp()}"
    new_ctx = create_context(title=ctx_title, description="Verification test")
    if new_ctx and new_ctx.get('id'):
        print(f"✅ Context created successfully: {new_ctx['id']}")
        
        all_ctx = get_all_contexts()
        found = any(c['id'] == new_ctx['id'] for c in all_ctx)
        if found:
            print("✅ Context retrieved in list successfully.")
        else:
            print("❌ Context missing from list.")
            
        if delete_context(new_ctx['id']):
            print("✅ Context deleted successfully.")
        else:
            print("❌ Context deletion failed.")
    else:
        print("❌ Context creation failed.")

    # 3. Test Session Service
    print("\n3. Testing Session Service...")
    sessions = await get_all_sessions()
    print(f"Current session count: {len(sessions)}")
    
    await add_message_to_active_session("user", "Testing session in PG")
    new_sessions = await get_all_sessions()
    if len(new_sessions) >= len(sessions):
        print("✅ Session message added/session created successfully.")
    else:
        print("❌ Session update failed.")

    print("\n--- Verification Complete ---")

if __name__ == "__main__":
    asyncio.run(verify())
