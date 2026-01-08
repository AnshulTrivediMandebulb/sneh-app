"""
DSPy Signature for extracting contexts from conversation messages
"""
# import dspy # Moved to inside function to avoid startup crashes if missing
from typing import List

    # contexts = dspy.OutputField(desc="...") # Defined dynamically to avoid top-level dependency


def extract_contexts_from_messages(messages: List[dict]) -> List[dict]:
    """
    Use DSPy to extract contexts from conversation messages
    
    Args:
        messages: List of message dicts with 'role' and 'content'
        
    Returns:
        List of context dicts with title, description, priority, status, tags
    """
    try:
        import json
        from services.ai_service import get_dspy_lm
        
        print(f"[Context Extraction] Starting extraction for {len(messages)} messages")
        
        # Initialize DSPy
        try:
            import dspy
            
            class ExtractContexts(dspy.Signature):
                """Analyze conversation messages and extract key contexts like goals, relationships, concerns, and topics."""
                messages = dspy.InputField(desc="List of conversation messages between user and AI")
                contexts = dspy.OutputField(desc="List of extracted contexts in JSON format with fields: title, description, priority (high/medium/low), status (active/stable/in_progress), tags")

            lm = get_dspy_lm()
            dspy.settings.configure(lm=lm)
            print("[Context Extraction] DSPy configured successfully")
        except ImportError:
            print("[Context Extraction] DSPy not found. Skipping extraction.")
            return []
        except Exception as dspy_err:
            print(f"[Context Extraction] DSPy configuration error: {dspy_err}")
            return []
        
        # Format messages for AI
        formatted_messages = "\n".join([
            f"{msg['role'].upper()}: {msg['content']}"
            for msg in messages
        ])
        
        print(f"[Context Extraction] Formatted {len(formatted_messages)} characters")
        
        # Use Chain of Thought for better reasoning
        extractor = dspy.ChainOfThought(ExtractContexts)
        
        # Extract contexts
        print("[Context Extraction] Running extractor...")
        result = extractor(messages=formatted_messages)
        print(f"[Context Extraction] Extractor result: {result.contexts[:200]}...")
        
        # Parse the JSON output
        try:
            contexts = json.loads(result.contexts)
            if isinstance(contexts, list):
                print(f"[Context Extraction] Successfully extracted {len(contexts)} contexts")
                return contexts
            print(f"[Context Extraction] Result is not a list: {type(contexts)}")
            return []
        except json.JSONDecodeError as json_err:
            # Fallback: try to extract from text
            print(f"[Context Extraction] JSON parse failed: {json_err}")
            print(f"[Context Extraction] Raw output: {result.contexts}")
            return []
            
    except Exception as e:
        print(f"[Context Extraction] Error: {e}")
        import traceback
        traceback.print_exc()
        return []
