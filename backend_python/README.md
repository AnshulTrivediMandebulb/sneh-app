# Sneh Backend - Python + FastAPI + DSPy

## Quick Start

### 1. Install Dependencies

```bash
# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Linux/Mac)
source venv/bin/activate

# Install packages
pip install -r requirements.txt
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your Azure credentials:

```env
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_KEY=your-key-here
...
```

### 3. Database Setup (PostgreSQL)

1.  **Install PostgreSQL**: Download and install from [postgresql.org](https://www.postgresql.org/download/).
2.  **Create Database**: Create a database named `sneh_db` (or as configured in `.env`).
3.  **Initialize Schema**:
    ```bash
    python services/database.py
    ```

### 4. Run Server

```bash
python main.py
```

Server will start on `http://0.0.0.0:3000`

## Features

- ✅ REST API (`/chat`, `/voice`, `/greeting`)
- ✅ WebSocket real-time audio streaming
- ✅ Echo Gate protection (prevents AI hearing itself)
- ✅ ACE Framework (Agentic Context Engineering)
- ✅ Conversation memory
- ✅ DSPy prompt optimization
- ✅ Azure OpenAI integration (Whisper, GPT-4o, TTS)

## API Endpoints

### GET `/health`
Health check

### GET `/greeting`
Get initial greeting message

### POST `/chat`
```json
{
  "message": "Hello",
  "conversationHistory": []
}
```

### POST `/voice`
```json
{
  "audioBase64": "base64-encoded-audio",
  "conversationHistory": []
}
```

### WebSocket `/`
Real-time audio streaming

## DSPy Integration

The backend uses DSPy for systematic prompt optimization. See `services/dspy_optimizer.py` for:

- Prompt signatures
- Training examples
- Optimization functions

To optimize prompts with your own data:
1. Collect training examples
2. Add to `TRAINING_EXAMPLES` in `dspy_optimizer.py`
3. Run `optimize_prompts()`

## Directory Structure

```
backend_python/
├── main.py                 # FastAPI app
├── requirements.txt
├── .env
├── services/
│   ├── ai_service.py       # Chat + guardrails
│   ├── realtime_service.py # WebSocket relay
│   ├── context_service.py  # ACE framework
│   ├── memory_service.py   # Conversation logs
│   └── dspy_optimizer.py   # DSPy prompts
├── audio/                  # Session recordings
├── data/                   # ACE data
└── log/                    # Conversation logs
```

## Requirements

- Python 3.9+
- FFmpeg (for audio transcoding)
- Azure OpenAI account

## Troubleshooting

**FFmpeg not found:**
```bash
# Windows (with chocolatey)
choco install ffmpeg

# Linux
sudo apt install ffmpeg

# Mac
brew install ffmpeg
```

**Import errors:**
Make sure virtual environment is activated and dependencies installed.

**Port already in use:**
Stop the Node.js backend or change PORT in `.env`.
