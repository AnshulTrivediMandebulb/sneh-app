"""
DSPy Integration - Prompt optimization module
Uses DSPy for systematic prompt engineering
"""
import dspy
import os
from typing import Optional

# Configure DSPy with Azure OpenAI
lm = dspy.AzureOpenAI(
    api_base=os.getenv("AZURE_OPENAI_ENDPOINT"),
    api_key=os.getenv("AZURE_OPENAI_KEY"),
    deployment_id=os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT", "gpt-4o"),
    api_version="2024-08-01-preview"
)

dspy.settings.configure(lm=lm)

# Define DSPy Signatures for different prompts
class CompanionResponse(dspy.Signature):
    """Empathetic AI companion for mental health support"""
    
    user_message = dspy.InputField(desc="User's current message")
    emotion = dspy.InputField(desc="Detected emotion (SADNESS, HAPPINESS, ANGER, ANXIETY, NEUTRAL)")
    user_context = dspy.InputField(desc="ACE context + conversation history")
    
    response = dspy.OutputField(desc="Warm, supportive response as a caring friend")

class GuardrailCheck(dspy.Signature):
    """Safety validation for AI responses"""
    
    ai_response = dspy.InputField(desc="AI response to validate")
    
    is_safe = dspy.OutputField(desc="true if safe, false if unsafe")
    reason = dspy.OutputField(desc="Explanation if unsafe", optional=True)
    replacement = dspy.OutputField(desc="Safe replacement if unsafe", optional=True)

class EmotionDetection(dspy.Signature):
    """Classify user's emotional state"""
    
    user_message = dspy.InputField(desc="User's message")
    conversation_history = dspy.InputField(desc="Recent conversation for context")
    
    emotion = dspy.OutputField(desc="One of: SADNESS, HAPPINESS, ANGER, ANXIETY, NEUTRAL")

# DSPy Modules (can be optimized with examples)
class CompanionModule(dspy.Module):
    """Main companion chat module"""
    
    def __init__(self):
        super().__init__()
        self.generate = dspy.ChainOfThought(CompanionResponse)
    
    def forward(self, user_message, emotion, user_context):
        return self.generate(
            user_message=user_message,
            emotion=emotion,
            user_context=user_context
        )

class GuardrailModule(dspy.Module):
    """Safety guardrail module"""
    
    def __init__(self):
        super().__init__()
        self.validate = dspy.ChainOfThought(GuardrailCheck)
    
    def forward(self, ai_response):
        return self.validate(ai_response=ai_response)

# Initialize modules (can be optimized later with dspy.BootstrapFewShot)
companion_module = CompanionModule()
guardrail_module = GuardrailModule()

# Helper functions
async def generate_with_dspy(user_message: str, emotion: str, context: str) -> str:
    """Generate response using DSPy"""
    result = companion_module(
        user_message=user_message,
        emotion=emotion,
        user_context=context
    )
    return result.response

async def validate_with_dspy(ai_response: str) -> dict:
    """Validate response using DSPy guardrail"""
    result = guardrail_module(ai_response=ai_response)
    
    return {
        "status": "UNSAFE" if result.is_safe.lower() == "false" else "SAFE",
        "reason": result.reason if hasattr(result, 'reason') else None,
        "replacement": result.replacement if hasattr(result, 'replacement') else None
    }

# Example training data for optimization (can be expanded)
TRAINING_EXAMPLES = [
    # Feel free to add training examples here
    # dspy.Example(user_message="I'm sad", emotion="SADNESS", user_context="...", response="I'm here for you...")
]

def optimize_prompts():
    """
    Optimize DSPy modules with training data
    Call this when you have collected enough examples
    """
    if not TRAINING_EXAMPLES:
        print("[DSPy] No training examples yet. Skipping optimization.")
        return
    
    from dspy.teleprompt import BootstrapFewShot
    
    # Optimize companion module
    optimizer = BootstrapFewShot(metric=lambda x, y: 1.0)  # Custom metric can be added
    optimized_companion = optimizer.compile(companion_module, trainset=TRAINING_EXAMPLES)
    
    print("[DSPy] Prompts optimized!")
    return optimized_companion

# Notes for future DSPy optimization:
# 1. Collect user feedback on responses
# 2. Create training examples from good/bad responses
# 3. Define custom metrics (e.g., warmth, safety, relevance)
# 4. Run optimize_prompts() to auto-tune
# 5. Save optimized module: optimized.save("companion_v2.json")
