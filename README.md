# Sneh - AI-Powered Companion App

Sneh is a modern, real-time AI companion application featuring advanced voice interaction, emotional intelligence, and long-term memory.

## 🚀 Features

- **Real-time Voice Interaction**: Seamless voice-to-voice communication using Azure Whisper and TTS.
- **Emotional Intelligence**: AI adapts its personality based on user-selected intensity modes (Gentle, Real, Ruthless).
- **ACE Architecture**: Agentic Context Engineering for sophisticated memory and context awareness.
- **Modern UI**: A sleek React Native mobile app with 3D elements and fluid animations.

## 📁 Project Structure

- `backend_python/`: FastAPI-based backend handling AI logic, DSPy prompt optimization, and voice processing.
- `mobile-app/`: Expo (React Native) application with real-time WebSocket connectivity.
- `requirements.txt`: Global Python dependencies.

## 🛠️ Setup

> [!TIP]
> This project requires **two terminal windows**: one for the Backend and one for the Mobile App.

1. **Backend**: Navigate to `backend_python/`, create a `.env` file from `.env.example`, and follow the instructions in [backend_python/README.md](backend_python/README.md).
2. **Mobile App**: Navigate to `mobile-app/`, run `npm install`, and follow the instructions to start the Expo dev server.

## 🔒 Security

Sensitive information (API keys, credentials, local logs) is excluded from this repository via `.gitignore`. Please use the provided `.env.example` templates for local configuration.
