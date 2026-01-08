
import requests
import json

def trigger_recap():
    session_id = "sess_56c8c41c" 
    url = f"http://127.0.0.1:3000/sessions/{session_id}/recap"
    print(f"Triggering recap for {session_id}...")
    try:
        res = requests.post(url, timeout=30)
        print("Status:", res.status_code)
        if res.status_code == 200:
            print("Response:", json.dumps(res.json(), indent=2))
        else:
            print("Error:", res.text)
    except Exception as e:
        print(f"Failed: {e}")

if __name__ == "__main__":
    trigger_recap()
