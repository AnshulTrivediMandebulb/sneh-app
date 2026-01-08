"""
Perspective Service - Generates the Mirror, Coach, and Challenger insights
Uses AI to analyze full conversation sessions and extract deep context.
"""
import json
import os
from typing import Dict, List
from openai import AsyncAzureOpenAI
from dotenv import load_dotenv

load_dotenv()

client = AsyncAzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_KEY"),
    api_version="2024-08-01-preview",
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
)

CHAT_DEPLOYMENT = os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT", "gpt-4o")

async def generate_session_recap(messages: List[Dict]) -> Dict:
    """
    Generates the 3-Perspective Recap (Mirror, Coach, Challenger)
    based on the conversation session.
    """
    try:
        if not messages:
            return None

        # Format conversation for the AI
        conversation_text = ""
        for msg in messages:
            role = "You" if msg['role'] == 'user' else "Sneh"
            conversation_text += f"{role}: {msg['content']}\n"

        # Get existing contexts to inform the AI
        from services.context_service import get_all_contexts, update_context, ensure_context
        existing_contexts = get_all_contexts()
        existing_contexts_summary = "\n".join([f"- {c['title']} (ID: {c['id']}, Priority: {c['priority']})" for c in existing_contexts])

        prompt = f"""
You are Sneh's internal reflection engine. Your job is to analyze this conversation and:
1. Generate 3 distinct perspectives (Mirror, Coach, Challenger).
2. Manage User Contexts:
   - CREATE new contexts if a NEW major life theme appears.
   - UPDATE existing contexts if the user provides new info (e.g., priority change, status change).

EXISTING CONTEXTS:
{existing_contexts_summary}

CONTEXTS CRITERIA:
- identifying a major life area users is struggling with or working on.
- Only create a context if it seems like a durable topic, not just a one-off chat.
- Assign a priority (high/medium/low).

1. THE MIRROR (Reflective & Empathetic):
   - What is the user feeling? What themes are recurring?
   - Tone: Warm, validating, observant.

2. THE COACH (Action-Oriented):
   - Propose ONE tiny, concrete micro-experiment for tomorrow.
   - Tone: Encouraging, practical, forward-looking.

3. THE CHALLENGER (Honest & direct):
   - Call out avoidance, contradictions, or excuses. Use evidence.
   - Tone: Firm but kind. "I noticed you said X, but..."

Conversation:
{conversation_text}

Response must be a SINGLE JSON object with this exact structure:
{{
  "mirror": {{
    "title": "Reflecting Your Feelings",
    "content": "Short paragraph...",
    "sentiment": "emotion_name"
  }},
  "coach": {{
    "title": "Try This Tomorrow",
    "content": "Short paragraph...",
    "action_item": "Micro-step description"
  }},
  "challenger": {{
    "title": "A Gentle Nudge",
    "content": "Short paragraph...",
    "pattern_detected": "Pattern name"
  }},
  "new_contexts": [
    {{
      "title": "Work Anxiety",
      "description": "Feeling overwhelmed by deadlines",
      "priority": "high",
      "status": "active",
      "tags": ["work", "stress"]
    }}
  ],
  "updated_contexts": [
    {{
      "id": "ctx_123",
      "updates": {{ "priority": "high", "title": "New Title" }}
    }}
  ]
}}
"""

        response = await client.chat.completions.create(
            model=CHAT_DEPLOYMENT,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            response_format={ "type": "json_object" }
        )

        content = response.choices[0].message.content.strip()
        recap = json.loads(content)
        
        # 1. Update Existing Contexts
        if recap.get('updated_contexts'):
            for update_req in recap['updated_contexts']:
                print(f"[Perspective] Updating context: {update_req['id']}")
                update_context(update_req['id'], update_req['updates'])

        # 2. Create New Contexts (Deduplicated)
        if recap.get('new_contexts'):
            for ctx in recap['new_contexts']:
                print(f"[Perspective] Ensuring context: {ctx['title']}")
                ensure_context(**ctx)
                
        return recap

    except Exception as e:
        print(f"[Perspective] Error generating recap: {e}")
        return None
