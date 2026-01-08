
import requests
import base64
import json

# Create a tiny dummy WAV file (1 second of silence)
# This header + data is a valid minimal WAV
wav_header = b'RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x44\xac\x00\x00\x88\x58\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00'
audio_b64 = base64.b64encode(wav_header).decode('utf-8')

url = "http://localhost:3000/voice"
payload = {
    "audioBase64": audio_b64,
    "conversationHistory": []
}

print(f"Sending request to {url}...")
try:
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
