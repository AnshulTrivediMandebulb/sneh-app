import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from services.session_service import get_all_sessions
from services.perspective_service import generate_session_recap

async def run_simulation():
    print("[Simulation] Loading sessions...")
    sessions = await get_all_sessions()
    
    if not sessions:
        print("[Simulation] No sessions found!")
        return

    # Pick the most recent session (Missed Bus)
    session = sessions[-1] 
    print(f"[Simulation] Analyzing session: {session['title']}")
    
    # Generate recap (which triggers context creation)
    recap = await generate_session_recap(session['messages'])
    
    print("\n[Simulation] RECAP GENERATED:")
    print(f"Mirror: {recap.get('mirror', {}).get('title')}")
    print(f"Coach: {recap.get('coach', {}).get('title')}")
    print(f"Challenger: {recap.get('challenger', {}).get('title')}")
    
    if recap.get('new_contexts'):
        print(f"\n[Simulation] NEW CONTEXTS CREATED: {len(recap['new_contexts'])}")
        for ctx in recap['new_contexts']:
            print(f"- {ctx['title']} ({ctx['priority']})")
    else:
        print("\n[Simulation] No new contexts detected.")

if __name__ == "__main__":
    asyncio.run(run_simulation())
