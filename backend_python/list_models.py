
import asyncio
import os
from dotenv import load_dotenv
from google import genai

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY)

def list_models():
    print("Fetching available models...")
    try:
        with open("models.txt", "w", encoding="utf-8") as f:
            pager = client.models.list()
            for model in pager:
                f.write(f"- {model.name} (Wrapper: {model.display_name})\n")
        print("Models written to models.txt")
    except Exception as e:
        print(f"Error listing models: {e}")

if __name__ == "__main__":
    list_models()
