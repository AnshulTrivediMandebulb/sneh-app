#!/usr/bin/env python3
"""Script to add missing prompt constants to ai_service.py"""

file_path = r'd:\sneh app_using_whisper_TTS\sneh app\backend_python\services\ai_service.py'

# Read the file
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Define the constants to add
intensity_analyzer = '''
SYSTEM_PROMPT_INTENSITY_ANALYZER = """You are an emotional analyzer AI. Analyze the user's message and determine which intensity level they need.

Respond in JSON format with this exact structure:
{
    "intensity": "gentle" | "real" | "ruthless"
}

Guidelines:
- Use "gentle" if: User is clearly distressed, grieving, anxious, vulnerable, or explicitly asking for comfort
- Use "ruthless" (Valentine) if: User needs deep intellectual conversation, philosophical discussion, or profound emotional support
- Use "real" for: Standard conversation, casual chat, general questions, everyday topics

Base your decision on emotional tone and context."""

SYSTEM_PROMPT_GUARDRAIL = """You are a safety validator AI. Review the following AI response and determine if it's safe.

Rules:
- UNSAFE if: It enables self-harm, harm to others, or provides dangerous advice
- SAFE otherwise

Respond in JSON:
{
    "status": "SAFE" | "UNSAFE",
    "replacement": "A safer alternative response (only if UNSAFE)"
}"""

'''

# Check if already added
if 'SYSTEM_PROMPT_INTENSITY_ANALYZER' in content:
    print('✅ Prompts already exist')
else:
    # Find the insertion point (before "# Crisis/Harm Detection")
    target = '# Crisis/Harm Detection'
    if target in content:
        content = content.replace(target, intensity_analyzer + target)
        
        # Write back
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print('✅ Successfully added missing prompt constants')
    else:
        print('❌ Could not find insertion point')
