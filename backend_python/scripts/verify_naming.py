import asyncio
import os
import sys

# Add the backend_python directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(backend_dir)
os.chdir(backend_dir) # Change working directory to backend_python

from services.session_service import add_message_to_active_session, get_active_session
from services.database import db_service
from datetime import datetime

async def verify_naming_stability():
    print("🚀 Starting Naming Stability Verification...")
    
    # 1. Add first message to create a session
    await add_message_to_active_session("user", "Hello Sneh, I'm feeling a bit anxious today.")
    
    # Wait for session creation and metadata generation
    await asyncio.sleep(2) 
    
    session = await get_active_session()
    initial_title = session.get('title')
    print(f"Initial Title: {initial_title}")
    
    if " - " not in initial_title:
        print("❌ Error: Initial title does not contain a date-stamp.")
        return
    
    # 2. Add more messages to trigger metadata regeneration (logic triggered <= 10 msgs)
    print("Adding more messages to trigger title update...")
    for i in range(5):
        await add_message_to_active_session("user", f"I'm worried about step {i}")
        await add_message_to_active_session("assistant", f"I understand your worry about step {i}")
        await asyncio.sleep(1) # Small delay to let async tasks breathe
    
    # Wait for final metadata update
    await asyncio.sleep(2)
    
    updated_session = await get_active_session()
    updated_title = updated_session.get('title')
    print(f"Updated Title: {updated_title}")
    
    if " - " in updated_title:
        print("✅ Success: Date-stamp preserved in updated title.")
    else:
        print("❌ Error: Date-stamp was lost in updated title.")
    
    # 3. Check Database View
    print("\nChecking database view 'v_chat_sessions'...")
    conn = db_service.get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT chat_name, priority, tags FROM v_chat_sessions LIMIT 1")
            row = cur.fetchone()
            if row:
                print(f"View Data: Name={row['chat_name']}, Priority={row['priority']}, Tags={row['tags']}")
                print("✅ Success: View updated with new columns.")
            else:
                print("⚠️ No data in view yet (might need more messages or wait)")
    finally:
        conn.close()

if __name__ == "__main__":
    asyncio.run(verify_naming_stability())
