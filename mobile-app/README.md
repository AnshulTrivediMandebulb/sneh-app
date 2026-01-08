# Sneh Mobile App - Expo / React Native

The frontend of the Sneh application, built with React Native and Expo. It provides a real-time, immersive interface for interacting with the AI companion.

## 🚀 Features

- **Voice Orb**: A dynamic, animated 3D-like orb that reacts to speech.
- **Real-time Streaming**: Low-latency audio communication via WebSockets.
- **Emotion Control**: Interface to adjust the AI's intensity and personality.
- **Memory Vault**: View and manage the "Brain" of the companion.

## 🛠️ Setup

### 1. Prerequisites
- Node.js (v16 or higher)
- Expo Go app on your phone (or an emulator)

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Backend IP
Ensure your mobile app can connect to your backend:
1.  **Check Backend Terminal**: When you run the backend service, it will print your local IP address in the terminal.
2.  Open `mobile-app/services/api.js`.
3.  Update the `BACKEND_IP` variable on **Line 7**:
    ```javascript
    const BACKEND_IP = 'YOUR_BACKEND_IP_FROM_TERMINAL'; 
    ```
4.  (Optional) You can also use the auto-discovery feature if your network supports it.

> [!IMPORTANT]
> Keep the backend running in its own terminal while you start the mobile app in another!

### 4. Start the App
```bash
npx expo start
```
Scan the QR code with your phone (Android) or Camera app (iOS).

## 📁 Structure

- `screens/`: Main application views (Flow, Ritual, Vault, etc.).
- `components/`: Reusable UI elements (VoiceOrb, DeformableBlob).
- `services/`: API and WebSocket communication logic.
- `assets/`: App icons and static images.
