import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ⚙️ MANUAL IP CONFIGURATION
// Change this to match your backend IP address
const BACKEND_IP = '192.168.29.136';
const PORT = 8000;

// Base URL for all API requests
const BASE_URL = `http://${BACKEND_IP}:${PORT}`;

// Export for WebSocket connections
export const LOCAL_IP = BACKEND_IP;
export const WS_PORT = PORT;

console.log(`📡 Backend URL: ${BASE_URL}`);

/**
 * Get intensity preference from AsyncStorage
 */
const getIntensityPreference = async () => {
    try {
        const intensity = await AsyncStorage.getItem('intensityPreference');
        console.log(`📊 [Intensity] Retrieved from storage: "${intensity}"`);
        const finalIntensity = intensity || 'real';
        console.log(`📊 [Intensity] Using: "${finalIntensity}"`);
        return finalIntensity;
    } catch (error) {
        console.error('Failed to get intensity preference:', error);
        return 'real';
    }
};

export const sendMessageToBackend = async (message, conversationHistory = [], userName = null) => {
    try {
        const intensity = await getIntensityPreference();
        console.log(`Sending message to: ${BASE_URL}/chat (intensity: ${intensity})`);
        const response = await axios.post(`${BASE_URL}/chat`, {
            message,
            conversationHistory,
            userName,
            intensity
        }, { timeout: 30000 });
        return response.data;
    } catch (error) {
        console.error("API Error:", error);
        throw error;
    }
};

export const fetchGreeting = async () => {
    try {
        console.log(`Fetching greeting from: ${BASE_URL}/greeting`);
        const response = await axios.get(`${BASE_URL}/greeting`, { timeout: 3000 }); // Reduced to 3s for faster startup feedback
        return response.data.greeting;
    } catch (error) {
        console.error("Greeting API Error:", error.message);
        if (error.response) {
            console.error("Response Data:", error.response.data);
            console.error("Response Status:", error.response.status);
        } else if (error.request) {
            console.error("No response received (Network Error)");
        }
        return null; // Fallback to default if fails
    }
};

export const sendAudioToBackend = async (audioBase64, conversationHistory = []) => {
    try {
        const intensity = await getIntensityPreference();
        console.log(`Sending audio to: ${BASE_URL}/voice (intensity: ${intensity})`);
        const response = await axios.post(`${BASE_URL}/voice`, {
            audioBase64,
            conversationHistory,
            intensity
        }, { timeout: 30000 }); // Longer timeout for audio processing
        return response.data;
    } catch (error) {
        console.error("Voice API Error:", error);
        throw error;
    }
};

// Context API functions
export const getContexts = async () => {
    try {
        console.log(`Fetching contexts from: ${BASE_URL}/contexts`);
        const response = await axios.get(`${BASE_URL}/contexts`, { timeout: 10000 });
        return response.data;
    } catch (error) {
        console.error("Contexts API Error:", error);
        throw error;
    }
};

export const createContext = async (context) => {
    try {
        console.log(`Creating context: ${BASE_URL}/contexts`);
        const response = await axios.post(`${BASE_URL}/contexts`, context, { timeout: 10000 });
        return response.data;
    } catch (error) {
        console.error("Create Context Error:", error);
        throw error;
    }
};

export const updateContext = async (contextId, updates) => {
    try {
        console.log(`Updating context ${contextId}: ${BASE_URL}/contexts/${contextId}`);
        const response = await axios.put(`${BASE_URL}/contexts/${contextId}`, updates, { timeout: 10000 });
        return response.data;
    } catch (error) {
        console.error("Update Context Error:", error);
        throw error;
    }
};

export const deleteContext = async (contextId) => {
    try {
        console.log(`Deleting context ${contextId}: ${BASE_URL}/contexts/${contextId}`);
        await axios.delete(`${BASE_URL}/contexts/${contextId}`, { timeout: 10000 });
    } catch (error) {
        console.error("Delete Context Error:", error);
        throw error;
    }
};

export const extractContextsFromMessages = async (messages) => {
    try {
        console.log(`Extracting contexts from ${messages.length} messages: ${BASE_URL}/contexts/extract`);
        const response = await axios.post(`${BASE_URL}/contexts/extract`, { messages }, { timeout: 15000 });
        return response.data;
    } catch (error) {
        console.error("Extract Contexts Error:", error);
        throw error;
    }
};

// Conversation history API (flat messages - deprecated)
export const getConversations = async () => {
    try {
        console.log(`Fetching conversations: ${BASE_URL}/conversations`);
        const response = await axios.get(`${BASE_URL}/conversations`, { timeout: 10000 });
        return response.data;
    } catch (error) {
        console.error("Conversations API Error:", error);
        throw error;
    }
};

// Session API (grouped conversations with AI titles)
export const getSessions = async () => {
    try {
        console.log(`Fetching sessions: ${BASE_URL}/sessions`);
        const response = await axios.get(`${BASE_URL}/sessions`, { timeout: 10000 });
        return response.data;
    } catch (error) {
        console.error("Sessions API Error:", error);
        throw error;
    }
};


export const generateRecap = async (sessionId) => {
    try {
        console.log(`Generating recap for ${sessionId}: ${BASE_URL}/sessions/${sessionId}/recap`);
        const response = await axios.post(`${BASE_URL}/sessions/${sessionId}/recap`, {}, { timeout: 30000 }); // AI generation takes time
        return response.data;
    } catch (error) {
        console.error("Recap API Error:", error);
        throw error;
    }
};

export const fetchLatestRecap = async () => {
    try {
        console.log(`Fetching latest recap from backend`);

        // Get all sessions
        const sessionsResponse = await getSessions();
        console.log('Sessions response:', JSON.stringify(sessionsResponse));

        // Extract sessions array from response
        const sessions = sessionsResponse?.sessions || [];

        if (!sessions || sessions.length === 0) {
            console.log('No sessions found');
            return null;
        }

        // Get the latest session (last one in array = most recent)
        const latestSession = sessions[sessions.length - 1];
        console.log(`Latest session:`, latestSession);

        // Extract session ID
        const sessionId = latestSession.id || latestSession.session_id;

        if (!sessionId) {
            console.log('No session ID found in latest session');
            return null;
        }

        console.log(`Generating recap for session ID: ${sessionId}`);

        // Generate recap using POST endpoint
        const response = await axios.post(
            `${BASE_URL}/sessions/${sessionId}/recap`,
            {},
            { timeout: 30000 }  // Longer timeout for AI generation
        );

        console.log('Recap response:', response.data);
        return response.data;
    } catch (error) {
        console.error("Latest Recap API Error:", error.message || error);
        if (error.response) {
            console.error("Response status:", error.response.status);
            console.error("Response error:", error.response.data);
        }
        return null;
    }
};

export const generateRecapFromMessages = async (messages) => {
    try {
        console.log(`Generating recap from ${messages.length} messages`);

        const response = await axios.post(
            `${BASE_URL}/recap/generate`,
            { messages },
            { timeout: 30000 }  // Longer timeout for AI generation
        );

        console.log('Recap generated:', response.data);
        return response.data;
    } catch (error) {
        console.error("Recap Generation Error:", error.message || error);
        if (error.response) {
            console.error("Response status:", error.response.status);
            console.error("Response error:", error.response.data);
        }
        return null;
    }
};
