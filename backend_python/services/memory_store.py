"""
Memory Store - Manages Atomic Claims using PostgreSQL
Stores specific facts, worries, goals, and recurring themes as individual 'claims'
instead of blob text.
"""
import json
import uuid
from datetime import datetime
from typing import List, Dict, Optional
from services.database import db_service

def _load_claims() -> List[Dict]:
    """Load atomic claims from PostgreSQL app_state"""
    try:
        conn = db_service.get_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT value FROM app_state WHERE key = 'atomic_claims'")
            row = cur.fetchone()
        conn.close()
        if row:
            data = row['value']
            return data.get('claims', [])
        return []
    except Exception as e:
        print(f"Error loading claims from DB: {e}")
        return []

def _save_claims(claims: List[Dict]) -> None:
    """Save atomic claims to PostgreSQL app_state"""
    try:
        conn = db_service.get_connection()
        with conn.cursor() as cur:
            value = {
                'claims': claims,
                'lastUpdated': datetime.utcnow().isoformat() + 'Z'
            }
            cur.execute(
                """
                INSERT INTO app_state (key, value, updated_at)
                VALUES ('atomic_claims', %s, %s)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
                """,
                (json.dumps(value), datetime.utcnow())
            )
        conn.close()
    except Exception as e:
        print(f"Error saving claims to DB: {e}")
        raise

async def add_claim(
    text: str, 
    claim_type: str, 
    tags: List[str] = [], 
    confidence: float = 1.0, 
    source_session_id: str = None
) -> Dict:
    """
    Add a new atomic claim to memory in PostgreSQL.
    Updates existing claim if a very similar one exists.
    """
    claims = _load_claims()
    now = datetime.utcnow().isoformat() + 'Z'
    
    # Simple check for duplicates
    existing_claim = next((c for c in claims if c['text'].lower() == text.lower()), None)
    
    if existing_claim:
        existing_claim['last_seen'] = now
        existing_claim['confidence'] = min(1.0, existing_claim['confidence'] + 0.1)
        if source_session_id and source_session_id not in existing_claim.get('evidence_refs', []):
             existing_claim.setdefault('evidence_refs', []).append(source_session_id)
        
        _save_claims(claims)
        print(f"[MemoryStore] Updated existing claim: {existing_claim['id']} in PostgreSQL")
        return existing_claim
    
    new_claim = {
        'id': f"claim_{uuid.uuid4().hex[:8]}",
        'type': claim_type,
        'text': text,
        'tags': tags,
        'confidence': confidence,
        'first_seen': now,
        'last_seen': now,
        'evidence_refs': [source_session_id] if source_session_id else []
    }
    
    claims.append(new_claim)
    _save_claims(claims)
    print(f"[MemoryStore] Added new claim: {new_claim['id']} in PostgreSQL")
    return new_claim

async def get_relevant_claims(tags: List[str] = None, claim_type: str = None) -> List[Dict]:
    """Retrieve claims matching specific tags or type from PostgreSQL"""
    claims = _load_claims()
    results = []
    
    for claim in claims:
        if claim_type and claim['type'] != claim_type:
            continue
        if tags:
            if not any(t in claim['tags'] for t in tags):
                continue
        results.append(claim)
        
    results.sort(key=lambda x: x['last_seen'], reverse=True)
    return results[:10]
