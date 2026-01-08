"""
Quick validation script to check all imports (Gemini Version)
Run this to verify backend is ready before starting
"""
import sys
import os

print("🔍 Checking Python Backend (Gemini Edition)...")
print(f"Python version: {sys.version}\n")

errors = []

# Check main.py
print("1️⃣ Checking main.py...")
try:
    import main
    print("   ✅ main.py imports successfully")
except Exception as e:
    print(f"   ❌ main.py failed: {e}")
    errors.append(("main.py", str(e)))

# Check services
services = [
    "ai_service",
    "context_service", 
    "memory_service",
    "realtime_service",
    "gemini_service"
]

for i, service in enumerate(services, 2):
    print(f"{i}️⃣ Checking services/{service}.py...")
    try:
        exec(f"from services import {service}")
        print(f"   ✅ {service}.py imports successfully")
    except Exception as e:
        print(f"   ❌ {service}.py failed: {e}")
        errors.append((f"services/{service}.py", str(e)))

# Check SDK
print("7️⃣ Checking Google GenAI SDK...")
try:
    import google.genai
    print("   ✅ google.genai imported")
except ImportError:
    print("   ❌ google.genai NOT found")
    errors.append(("sdk", "google-genai not installed"))

print("\n" + "="*50)
if errors:
    print("❌ VALIDATION FAILED")
    print("\nErrors found:")
    for file, error in errors:
        print(f"  - {file}: {error}")
    print("\n💡 Fix: Install dependencies:")
    print("   pip install -r requirements.txt")
    sys.exit(1)
else:
    print("✅ ALL CHECKS PASSED!")
    print("\n🚀 Backend is ready to run:")
    print("   python main.py")
    sys.exit(0)
