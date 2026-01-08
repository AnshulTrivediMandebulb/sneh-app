import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, FlatList, TextInput, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { Play, Pause, Mic, Send, MessageCircle, Eye, ArrowLeft } from 'lucide-react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';
import { LOCAL_IP, generateRecapFromMessages } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Fonts, TextStyles } from '../constants/Fonts';

const WS_URL = `ws://${LOCAL_IP}:8000`;

export default function FlowScreen({ navigation, route }) {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');

    // Generate waveform pattern
    const generateWaveform = () => {
        const bars = [];
        const count = 30;
        for (let i = 0; i < count; i++) {
            let height = 10 + Math.random() * 20;
            if (i < 5 || i > count - 5) height *= 0.4;
            else if (i < 10 || i > count - 10) height *= 0.8;
            bars.push(height);
        }
        return bars;
    };

    const [staticWaveform] = useState(() => generateWaveform());

    // Animated values for waveform bars
    const waveformAnims = useRef(
        staticWaveform.map(() => new Animated.Value(1))
    ).current;

    const [isConnected, setIsConnected] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [currentPlayingId, setCurrentPlayingId] = useState(null);

    const ws = useRef(null);
    const recording = useRef(null);
    const sound = useRef(null);
    const flatListRef = useRef(null);
    const audioBuffer = useRef([]); // Accumulate audio chunks
    const processingMessageId = useRef(null); // Track which AI message we are building
    const userAudioMessageId = useRef(null); // Track user message to update with transcript
    const pendingAIResponse = useRef(null); // Store AI response if waiting for user transcript
    const responseTimeout = useRef(null); // Track response timeout
    const lastAudioData = useRef(null); // Store last audio sent for retry
    const retryCount = useRef(0); // Track number of retries

    useEffect(() => {
        connectWebSocket();

        // Handle initialMessage from Ritual "Dive Deeper"
        if (route.params?.initialMessage) {
            const msg = route.params.initialMessage;
            setMessages([{
                id: Date.now().toString(),
                text: msg,
                sender: 'ai',
                isAudio: false
            }]);
            // Clear params to prevent re-adding
            navigation.setParams({ initialMessage: null });
        }

        // 🌐 HTTP Connectivity Check
        fetch(`http://${LOCAL_IP}:8000/health`)
            .then(res => {
                console.log(`[FlowScreen] 🌐 HTTP Check Status: ${res.status}`);
                return res.json();
            })
            .then(data => console.log(`[FlowScreen] 🌐 HTTP Check Data:`, data))
            .catch(err => console.error(`[FlowScreen] ❌ HTTP Check FAILED:`, err));

        return () => {
            if (ws.current) ws.current.close();
            if (sound.current) sound.current.unloadAsync();
            clearResponseTimeout(); // Clean up timeout
        };
    }, []);

    // 🔄 Reconnect on Focus if Intensity Changed
    useFocusEffect(
        React.useCallback(() => {
            const checkIntensity = async () => {
                const storedIntensity = await AsyncStorage.getItem('intensityPreference') || 'adaptive';

                // If the current connection has a different intensity query param, reconnect.
                if (ws.current && ws.current.url && !ws.current.url.includes(`intensity=${storedIntensity}`)) {
                    console.log(`[FlowScreen] 🔄 Intensity changed to '${storedIntensity}'. Reconnecting...`);
                    if (ws.current) ws.current.close();

                    // Small delay to ensure clean close
                    setTimeout(() => {
                        connectWebSocket();
                    }, 500);
                }
            };
            checkIntensity();
        }, [])
    );

    // 🚪 Save on Navigation Back (Force Save)
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', async () => {
            console.log('[FlowScreen] 🚪 Exiting - Saving Session...');
            if (messages.length > 0) {
                try {
                    // 1. Save locally
                    const messagesToStore = messages.map(msg => ({
                        role: msg.sender === 'user' ? 'user' : 'assistant',
                        content: msg.text
                    }));
                    await AsyncStorage.setItem('currentSessionMessages', JSON.stringify(messagesToStore));

                    // 2. Trigger Explicit Session End (Backend Analysis)
                    console.log('[FlowScreen] 🧠 Triggering backend session analysis...');
                    fetch(`http://${LOCAL_IP}:8000/session/end`, { method: 'POST' })
                        .then(res => res.json())
                        .then(data => console.log('[FlowScreen] 🧠 Backend response:', data))
                        .catch(err => console.error('[FlowScreen] ❌ Backend save failed:', err));

                    console.log('[FlowScreen] ✅ Forced save on exit successful');
                } catch (e) {
                    console.error('[FlowScreen] ❌ Failed to save on exit:', e);
                }
            }
        });
        return unsubscribe;
    }, [navigation, messages]);

    // Handle incoming audio from Home Screen
    useEffect(() => {
        if (route.params?.audioUri) {
            const { audioUri } = route.params;
            processIncomingAudio(audioUri);
            // Clear params to prevent re-processing if component updates
            navigation.setParams({ audioUri: null });
        }
    }, [route.params?.audioUri]);

    // Save current session messages to AsyncStorage for Ritual tab
    useEffect(() => {
        const saveMessages = async () => {
            try {
                // Convert messages to simple format for storage
                const messagesToStore = messages.map(msg => ({
                    role: msg.sender === 'user' ? 'user' : 'assistant',
                    content: msg.text
                }));
                await AsyncStorage.setItem('currentSessionMessages', JSON.stringify(messagesToStore));
            } catch (e) {
                console.error('Error saving messages:', e);
            }
        };

        if (messages.length > 0) {
            saveMessages();
        }
    }, [messages]);

    // Save messages to AsyncStorage for auto-context extraction
    useEffect(() => {
        const saveMessages = async () => {
            try {
                const messagesToStore = messages.map(msg => ({
                    role: msg.sender === 'user' ? 'user' : 'assistant',
                    content: msg.text
                }));
                await AsyncStorage.setItem('currentSessionMessages', JSON.stringify(messagesToStore));
                console.log('[FlowScreen] Saved', messages.length, 'messages to storage');

                // Pre-generate recap in background for faster Ritual screen loading
                // Only generate if we have at least 2 messages (1 exchange)
                if (messages.length >= 2) {
                    console.log('[FlowScreen] Pre-generating recap in background...');
                    generateRecapFromMessages(messagesToStore)
                        .then(recapData => {
                            AsyncStorage.setItem('cachedRecap', JSON.stringify(recapData));
                            console.log('[FlowScreen] ✅ Recap pre-generated and cached');
                        })
                        .catch(err => {
                            console.error('[FlowScreen] Failed to pre-generate recap:', err);
                        });
                }
            } catch (e) {
                console.error('[FlowScreen] Error saving messages:', e);
            }
        };

        if (messages.length > 0) {
            saveMessages();
        }
    }, [messages]);

    // Animate waveform when playing
    useEffect(() => {
        if (currentPlayingId) {
            // Start animations for all bars with staggered timing
            const animations = waveformAnims.map((anim, index) =>
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(anim, {
                            toValue: 0.4 + Math.random() * 0.8,
                            duration: 200 + Math.random() * 200,
                            useNativeDriver: false,
                        }),
                        Animated.timing(anim, {
                            toValue: 0.6 + Math.random() * 0.8,
                            duration: 200 + Math.random() * 200,
                            useNativeDriver: false,
                        }),
                    ])
                )
            );
            animations.forEach(anim => anim.start());
            return () => {
                animations.forEach(anim => anim.stop());
                waveformAnims.forEach(anim => anim.setValue(1));
            };
        }
    }, [currentPlayingId]);

    const connectWebSocket = async () => {
        try {
            const intensity = await AsyncStorage.getItem('intensityPreference') || 'adaptive';
            console.log(`[FlowScreen] 🔌 Connecting to WebSocket (Flow): ${WS_URL}?intensity=${intensity}`);
            const connectionId = `FLOW_${Date.now()}`;
            ws.current = new WebSocket(`${WS_URL}?intensity=${intensity}`);


            ws.current.onopen = () => {
                console.log(`[${connectionId}] ✅ Connected to Flow`);
                setIsConnected(true);
            };

            ws.current.onclose = (event) => {
                console.log(`[${connectionId}] ❌ Disconnected from Flow`);
                console.log(`Close code: ${event.code}, reason: ${event.reason}`);
                setIsConnected(false);

                // Handle network errors during active request
                if (lastAudioData.current && lastAudioData.current.msgId) {
                    console.log('⚠️ Connection lost during request');
                    handleNetworkError('Connection lost. Please check your internet connection.');
                }
            };

            ws.current.onerror = (e) => {
                console.log(`[${connectionId}] ⚠️ WebSocket Error:`, e.message);

                // Handle network errors
                if (lastAudioData.current && lastAudioData.current.msgId) {
                    console.log('⚠️ Network error during request');
                    handleNetworkError('Network error. Please check your internet connection.');
                }
            };

            ws.current.onmessage = (e) => {
                console.log(`[${connectionId}] 📨 Message received`);
                handleServerMessage(e.data);
            };
        } catch (error) {
            console.error('[FlowScreen] Failed to connect WebSocket:', error);
        }
    };

    // Timeout and retry functions
    const startResponseTimeout = () => {
        // Clear any existing timeout
        if (responseTimeout.current) {
            clearTimeout(responseTimeout.current);
        }

        console.log('⏱️ Starting 5-second response timeout...');
        responseTimeout.current = setTimeout(() => {
            console.log('⚠️ Response timeout! No response received within 5 seconds');
            retryResponse();
        }, 5000);
    };

    const clearResponseTimeout = () => {
        if (responseTimeout.current) {
            clearTimeout(responseTimeout.current);
            responseTimeout.current = null;
            console.log('✅ Response timeout cleared');
        }
    };

    const retryResponse = () => {
        const MAX_RETRIES = 2;

        if (retryCount.current >= MAX_RETRIES) {
            console.log(`❌ Max retries (${MAX_RETRIES}) reached. Giving up.`);
            // Update message to show error
            if (lastAudioData.current?.msgId) {
                setMessages(prev => prev.map(msg =>
                    msg.id === lastAudioData.current.msgId
                        ? { ...msg, text: '⏱️ Response timeout - please try again' }
                        : msg
                ));
            }
            return;
        }

        retryCount.current++;
        console.log(`🔄 Retry attempt ${retryCount.current}/${MAX_RETRIES}...`);

        if (lastAudioData.current && ws.current && ws.current.readyState === WebSocket.OPEN) {
            const { base64Audio, format } = lastAudioData.current;

            // Resend the audio
            ws.current.send(JSON.stringify({
                type: "input_audio_buffer.append",
                audio: base64Audio,
                format: format
            }));
            ws.current.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
            ws.current.send(JSON.stringify({ type: "response.create" }));

            // Start timeout again
            startResponseTimeout();
        }
    };

    const handleNetworkError = (errorMessage) => {
        console.log('🌐 Network Error:', errorMessage);

        // Clear any pending timeout
        clearResponseTimeout();

        // Update the user's message to show network error
        if (lastAudioData.current && lastAudioData.current.msgId) {
            setMessages(prev => prev.map(msg =>
                msg.id === lastAudioData.current.msgId
                    ? { ...msg, text: `🌐 ${errorMessage}` }
                    : msg
            ));

            // Clear the stored audio data
            lastAudioData.current = null;
            retryCount.current = 0;
        }
    };

    const processIncomingAudio = async (uri) => {
        try {
            // Add user message with audio placeholder
            const msgId = Date.now().toString();
            userAudioMessageId.current = msgId;

            setMessages(prev => {
                const newMsg = {
                    id: msgId,
                    text: "...",
                    sender: 'user',
                    audioUri: uri
                };
                console.log('📝 Creating user message:', newMsg);
                return [...prev, newMsg];
            });

            const base64Audio = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });

            // Detect format from file extension
            const format = uri.toLowerCase().endsWith('.wav') ? 'wav' : 'm4a';
            console.log(`📎 Detected audio format: ${format} from URI: ${uri}`);

            // Store audio data for potential retry
            lastAudioData.current = { base64Audio, format, msgId };
            retryCount.current = 0;

            // Wait for WS if not ready
            const sendAudio = () => {
                console.log(`📤 Sending audio with format: ${format}`);
                ws.current.send(JSON.stringify({
                    type: "input_audio_buffer.append",
                    audio: base64Audio,
                    format: format  // Add format specification
                }));
                ws.current.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
                ws.current.send(JSON.stringify({ type: "response.create" }));

                // Start 5-second timeout for response
                startResponseTimeout();
            };

            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                sendAudio();
            } else {
                console.log("WS not ready, waiting...");
                const interval = setInterval(() => {
                    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                        clearInterval(interval);
                        sendAudio();
                    }
                }, 500);
            }
        } catch (e) {
            console.error("Error processing incoming audio:", e);
        }
    };

    const handleServerMessage = async (data) => {
        try {
            const event = JSON.parse(data);

            // Log ALL events to see what we're receiving
            console.log(`[FlowScreen] Event Type: ${event.type}`);

            // Debug logging for transcript events
            if (event.type && event.type.includes('transcription')) {
                console.log('🎯 [FlowScreen] Transcript Event Received:', event.type);
                console.log('📦 Full Event:', JSON.stringify(event, null, 2));
            }

            // Handle error events (content safety filter, etc.)
            if (event.type === 'error') {
                console.log('❌ [FlowScreen] Error Event:', JSON.stringify(event, null, 2));
                clearResponseTimeout();

                const errorMessage = event.error?.message || 'An error occurred';

                // Check if it's a content safety filter error
                if (errorMessage.includes('filtered') || errorMessage.includes('content_filter')) {
                    console.log('🚫 Content safety filter triggered');

                    // Update the last AI message or create one
                    if (processingMessageId.current) {
                        setMessages(prev => prev.map(msg =>
                            msg.id === processingMessageId.current
                                ? { ...msg, text: '🚫 Response filtered by content safety. Please rephrase your message.' }
                                : msg
                        ));
                    } else {
                        // Create error message
                        setMessages(prev => [...prev, {
                            id: Date.now().toString(),
                            text: '🚫 Response filtered by content safety. Please rephrase your message.',
                            sender: 'ai',
                            isAudio: false
                        }]);
                    }
                } else {
                    // Generic error
                    console.log('⚠️ Generic error:', errorMessage);
                    if (processingMessageId.current) {
                        setMessages(prev => prev.map(msg =>
                            msg.id === processingMessageId.current
                                ? { ...msg, text: `⚠️ Error: ${errorMessage}` }
                                : msg
                        ));
                    }
                }

                // Clean up
                processingMessageId.current = null;
                audioBuffer.current = [];
                return; // Don't process further
            }

            // Handle Context Updates (User Feedback)
            if (event.type === 'context.saved') {
                console.log('\n==========================================');
                console.log('🧠 ' + (event.message || 'Context Updated'));
                if (event.details) {
                    const newCtx = event.details.new_contexts || [];
                    const updCtx = event.details.updated_contexts || [];
                    if (newCtx.length) console.log('   New:', newCtx.map(c => c.title).join(', '));
                    if (updCtx.length) console.log('   Updated:', updCtx.map(c => c.id).join(', '));
                }
                console.log('==========================================\n');
            }

            if (event.type === 'response.created') {
                // Clear timeout - we got a response!
                clearResponseTimeout();

                audioBuffer.current = [];
                const newId = Date.now().toString();
                processingMessageId.current = newId;

                // Create placeholder AI message
                setMessages(prev => [...prev, {
                    id: newId,
                    text: "...",
                    sender: 'ai',
                    isAudio: true,
                    audioUri: null
                }]);

            } else if (event.type === 'response.audio.delta') {
                if (event.delta) {
                    audioBuffer.current.push(event.delta);
                }

            } else if (event.type === 'response.audio_transcript.done') {
                const text = event.transcript;
                console.log('✅ AI Transcript Done:', text);
                // Update AI message text
                setMessages(prev => prev.map(msg =>
                    msg.id === processingMessageId.current ? { ...msg, text: text } : msg
                ));

            } else if (event.type === 'response.done') {
                // Compile Audio and Save
                await saveAndPlayAudio();

            } else if (event.type === 'conversation.item.input_audio_transcription.delta') {
                // Handle incremental transcription updates
                const delta = event.delta || '';
                console.log('📝 User Transcript Delta:', delta);

                if (userAudioMessageId.current && delta) {
                    const targetId = userAudioMessageId.current;
                    setMessages(prev => prev.map(msg => {
                        if (msg.id === targetId) {
                            // Append delta to existing text (or replace "..." with delta)
                            const currentText = msg.text === '...' ? '' : msg.text;
                            return { ...msg, text: currentText + delta };
                        }
                        return msg;
                    }));
                }

            } else if (event.type === 'conversation.item.input_audio_transcription.completed') {

                // Try multiple possible field names for the transcript
                const text = event.transcript || event.text || event.content || '';
                console.log("✅ User Transcript Received:", text);
                console.log("📦 Full Event:", JSON.stringify(event, null, 2));

                if (!text) {
                    console.log("⚠️ WARNING: Transcript event received but no text found!");
                    console.log("Available fields:", Object.keys(event));
                }

                // Update the user message text
                if (userAudioMessageId.current) {
                    const targetId = userAudioMessageId.current;
                    console.log('🔄 Updating message ID:', targetId, 'with text:', text);

                    setMessages(prev => {
                        console.log('📊 Current messages count:', prev.length);
                        const targetMsg = prev.find(m => m.id === targetId);
                        console.log('🎯 Target message found:', targetMsg ? 'YES' : 'NO', targetMsg);

                        const updated = prev.map(msg => {
                            if (msg.id === targetId) {
                                console.log('✏️ Updating message:', { old: msg.text, new: text });
                                return { ...msg, text: text || '(No transcript)' };
                            }
                            return msg;
                        });

                        console.log('📝 Updated messages:', updated.map(m => ({ id: m.id, text: m.text, sender: m.sender })));
                        return updated;
                    });

                    // Check if text is non-empty before resetting, or just reset.
                    // Assuming 'completed' means final.
                    userAudioMessageId.current = null;

                    // CHECK FOR PENDING PLAYBACK
                    if (pendingAIResponse.current) {
                        console.log("Playing pending AI response...");
                        const { uri, id } = pendingAIResponse.current;
                        pendingAIResponse.current = null;
                        playAudio(uri, id);
                    }
                } else {
                    console.log('⚠️ No userAudioMessageId.current - trying fallback');
                    // Fallback: update the last user message if it has '...' or '(Processing...)'
                    setMessages(prev => {
                        const lastUserMsg = [...prev].reverse().find(m => m.sender === 'user' && (m.text === '...' || m.text === '(Processing...)'));
                        if (lastUserMsg) {
                            console.log('✅ Found fallback message:', lastUserMsg.id);
                            return prev.map(msg => msg.id === lastUserMsg.id ? { ...msg, text: text || '(No transcript)' } : msg);
                        }
                        console.log('❌ No fallback message found');
                        return prev;
                    });
                }
            }
        } catch (e) {
            console.error('Error handling server message:', e);
        }
    };

    const saveAndPlayAudio = async () => {
        if (audioBuffer.current.length === 0) return;

        try {
            const pcmBuffers = audioBuffer.current.map(chunk => Buffer.from(chunk, 'base64'));
            const totalLength = pcmBuffers.reduce((acc, buf) => acc + buf.length, 0);
            const combinedPcmBuffer = Buffer.concat(pcmBuffers, totalLength);

            // WAV Header Creation
            const sampleRate = 24000;
            const numChannels = 1;
            const bitsPerSample = 16;
            const blockAlign = numChannels * bitsPerSample / 8;
            const byteRate = sampleRate * blockAlign;
            const dataSize = combinedPcmBuffer.length;
            const headerBuffer = Buffer.alloc(44);

            headerBuffer.write('RIFF', 0);
            headerBuffer.writeUInt32LE(36 + dataSize, 4);
            headerBuffer.write('WAVE', 8);
            headerBuffer.write('fmt ', 12);
            headerBuffer.writeUInt32LE(16, 16);
            headerBuffer.writeUInt16LE(1, 20);
            headerBuffer.writeUInt16LE(numChannels, 22);
            headerBuffer.writeUInt32LE(sampleRate, 24);
            headerBuffer.writeUInt32LE(byteRate, 28);
            headerBuffer.writeUInt16LE(blockAlign, 32);
            headerBuffer.writeUInt16LE(bitsPerSample, 34);
            headerBuffer.write('data', 36);
            headerBuffer.writeUInt32LE(dataSize, 40);

            const wavBuffer = Buffer.concat([headerBuffer, combinedPcmBuffer]);
            const wavBase64 = wavBuffer.toString('base64');

            const filename = `${FileSystem.cacheDirectory}ai_response_${Date.now()}.wav`;
            await FileSystem.writeAsStringAsync(filename, wavBase64, { encoding: 'base64' });

            // Update Message with URI
            const currentId = processingMessageId.current;
            setMessages(prev => prev.map(msg =>
                msg.id === currentId ? { ...msg, audioUri: filename } : msg
            ));

            // Auto Play Logic
            if (userAudioMessageId.current) {
                console.log("Waiting for user transcript before playing...");
                pendingAIResponse.current = { uri: filename, id: currentId };

                // Safety Timeout: Play anyway after 2 seconds if transcript doesn't arrive
                setTimeout(() => {
                    if (pendingAIResponse.current && pendingAIResponse.current.id === currentId) {
                        console.log("Transcript timeout - playing pending audio");
                        pendingAIResponse.current = null;
                        userAudioMessageId.current = null; // Clear to prevent double play logic
                        playAudio(filename, currentId);
                    }
                }, 2000);

            } else {
                playAudio(filename, currentId);
            }

        } catch (e) {
            console.error("Save/Play Error:", e);
        }
    };

    const playAudio = async (uri, id) => {
        try {
            // If clicking on currently playing item, pause it
            if (currentPlayingId === id && sound.current) {
                const status = await sound.current.getStatusAsync();
                if (status.isLoaded && status.isPlaying) {
                    await sound.current.pauseAsync();
                    setCurrentPlayingId(null);
                    return;
                } else if (status.isLoaded && !status.isPlaying) {
                    // Resume if paused
                    await sound.current.playAsync();
                    setCurrentPlayingId(id);
                    return;
                }
            }

            // Stop any other playing audio
            if (sound.current) {
                try {
                    await sound.current.stopAsync();
                    await sound.current.unloadAsync();
                } catch (e) { }
            }

            setCurrentPlayingId(id);
            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri },
                { shouldPlay: true }
            );
            sound.current = newSound;

            newSound.setOnPlaybackStatusUpdate(status => {
                if (status.didJustFinish) {
                    setCurrentPlayingId(null);
                    newSound.unloadAsync();
                }
            });
        } catch (e) {
            console.error("Playback error:", e);
            setCurrentPlayingId(null);
        }
    };

    // --- RECORDING ---
    const startRecording = async () => {
        try {
            if (recording.current) await recording.current.stopAndUnloadAsync();
            await Audio.requestPermissionsAsync();
            await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
            const { recording: newRecording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
            recording.current = newRecording;
            setIsRecording(true);
        } catch (err) {
            console.error('Failed to start recording', err);
        }
    };

    const stopRecording = async () => {
        if (!recording.current) return;
        setIsRecording(false);

        try {
            await recording.current.stopAndUnloadAsync();
            const uri = recording.current.getURI();

            if (!uri) {
                console.error('No URI from recording');
                recording.current = null;
                return;
            }

            const base64Audio = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });

            // Add User Bubble locally
            const msgId = Date.now().toString();
            userAudioMessageId.current = msgId;

            setMessages(prev => {
                const newMessages = [...prev, { id: msgId, text: "...", sender: 'user', audioUri: uri }];
                console.log('📝 User message added! Total messages:', newMessages.length);
                console.log('📝 Latest message:', newMessages[newMessages.length - 1]);
                return newMessages;
            });


            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({
                    type: "input_audio_buffer.append",
                    audio: base64Audio,
                    format: "m4a"  // Tell backend to convert from m4a to PCM16
                }));
                ws.current.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
                ws.current.send(JSON.stringify({ type: "response.create" }));
            }


            recording.current = null;
        } catch (error) {
            console.error('Error in stopRecording:', error);
            recording.current = null;
        }
    };

    const handleSend = () => {
        if (!inputText.trim()) return;

        const msgId = Date.now().toString();
        setMessages(prev => [...prev, { id: msgId, text: inputText, sender: 'user' }]);

        // Send text message to AI via WebSocket
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
                type: "conversation.item.create",
                item: {
                    type: "message",
                    role: "user",
                    content: [
                        {
                            type: "input_text",
                            text: inputText
                        }
                    ]
                }
            }));
            ws.current.send(JSON.stringify({ type: "response.create" }));
        }

        setInputText('');
    };

    const renderItem = ({ item }) => {
        if (item.sender === 'user') {
            return (
                <View style={styles.userBubbleContainer}>
                    <LinearGradient
                        colors={['rgba(16, 185, 129, 0.15)', 'rgba(5, 150, 105, 0.1)', 'rgba(4, 120, 87, 0.15)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.userBubble, { borderWidth: 1.5, borderColor: 'rgba(16, 185, 129, 0.4)' }]}
                    >
                        {item.audioUri && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                <TouchableOpacity
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 18,
                                        backgroundColor: '#10b981',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        marginRight: 10
                                    }}
                                    onPress={() => playAudio(item.audioUri, item.id)}
                                >
                                    {currentPlayingId === item.id ?
                                        <Pause size={18} color="#fff" fill="#fff" /> :
                                        <Play size={18} color="#fff" fill="#fff" />
                                    }
                                </TouchableOpacity>
                                <View style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    height: 36,
                                    marginRight: 8,
                                    overflow: 'hidden'
                                }}>
                                    {staticWaveform.map((height, index) => (
                                        <Animated.View
                                            key={index}
                                            style={{
                                                width: 3,
                                                borderRadius: 1.5,
                                                marginHorizontal: 1,
                                                height: currentPlayingId === item.id
                                                    ? waveformAnims[index].interpolate({
                                                        inputRange: [0, 1],
                                                        outputRange: [height * 0.3, height]
                                                    })
                                                    : height,
                                                backgroundColor: '#10b981',
                                                opacity: currentPlayingId === item.id ? 1 : 0.6
                                            }}
                                        />
                                    ))}
                                </View>
                            </View>
                        )
                        }
                        <Text style={[styles.userText, { fontSize: 17, fontWeight: '600', lineHeight: 24 }]}>
                            {item.text || '...'}
                        </Text>
                    </LinearGradient >
                </View >
            );
        }

        // AI Message with gradient
        return (
            <View style={styles.aiBubbleContainer}>
                <LinearGradient
                    colors={['#8b5cf6', '#3b82f6', '#06b6d4']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradientBorder}
                >
                    <View style={styles.aiContent}>
                        {item.audioUri ? (
                            <View style={styles.aiTopRow}>
                                <TouchableOpacity style={styles.playButton} onPress={() => playAudio(item.audioUri, item.id)}>
                                    <LinearGradient
                                        colors={['#8b5cf6', '#06b6d4']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={styles.playButtonGradient}
                                    >
                                        {currentPlayingId === item.id ? (
                                            <Pause size={18} color="#fff" fill="#fff" />
                                        ) : (
                                            <Play size={18} color="#fff" fill="#fff" />
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>

                                <View style={styles.waveformContainer}>
                                    {staticWaveform.map((height, index) => (
                                        <Animated.View
                                            key={index}
                                            style={[
                                                styles.waveBar,
                                                {
                                                    height: currentPlayingId === item.id
                                                        ? waveformAnims[index].interpolate({
                                                            inputRange: [0, 1],
                                                            outputRange: [height * 0.3, height]
                                                        })
                                                        : height,
                                                    backgroundColor: currentPlayingId === item.id ? '#fff' : '#8b5cf6',
                                                    opacity: currentPlayingId === item.id ? 1 : 0.7
                                                }
                                            ]}
                                        />
                                    ))}
                                </View>
                            </View>
                        ) : null}
                        <Text style={styles.aiText}>{item.text}</Text>
                    </View>
                </LinearGradient>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <ArrowLeft size={28} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>The Flow</Text>
                    <View style={{ width: 28 }} />
                </View>

                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
                />

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Type a message..."
                        placeholderTextColor="#64748b"
                        value={inputText}
                        onChangeText={setInputText}
                    />
                    {inputText.length > 0 ? (
                        <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
                            <Send size={24} color="#8b5cf6" />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            onPressIn={startRecording}
                            onPressOut={stopRecording}
                            style={[styles.micButton, isRecording && styles.micActive]}
                        >
                            <Mic size={24} color="#fff" />
                        </TouchableOpacity>
                    )}
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    background: { ...StyleSheet.absoluteFillObject },
    safeArea: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#f8fafc',
    },
    backButton: { padding: 4 },
    listContent: { padding: 16, paddingBottom: 100 },

    // User Bubble
    userBubbleContainer: {
        marginBottom: 20,
        maxWidth: '85%',
        alignSelf: 'flex-end',
        marginRight: 16,
    },
    userBubble: {
        backgroundColor: 'rgba(51, 65, 85, 0.8)',
        padding: 12,
        borderRadius: 20,
        borderBottomRightRadius: 4,
        overflow: 'hidden', // Fix for waveform overflow
    },
    userText: { color: '#f8fafc', fontSize: 16 },

    // AI Bubble with gradient
    aiBubbleContainer: {
        marginBottom: 24,
    },
    gradientBorder: {
        padding: 2,
        borderRadius: 24,
        borderTopLeftRadius: 6,
        maxWidth: '85%',
    },
    aiContent: {
        backgroundColor: '#1e293b',
        borderRadius: 22,
        padding: 16,
    },
    aiTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    playButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        overflow: 'hidden',
        marginRight: 12,
    },
    playButtonGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    waveformContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        height: 40,
    },
    waveBar: {
        width: 3,
        borderRadius: 1.5,
        marginRight: 3,
    },
    aiText: {
        color: '#e2e8f0',
        fontSize: 15,
        lineHeight: 22,
    },

    // Input
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    input: {
        flex: 1,
        backgroundColor: 'rgba(30, 41, 59, 0.5)',
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 12,
        color: '#fff',
        fontSize: 16,
        marginRight: 12,
    },
    micButton: {
        width: 52,
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderWidth: 2,
        borderColor: '#8b5cf6',
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    micActive: {
        backgroundColor: 'rgba(139, 92, 246, 0.3)',
        borderColor: '#a78bfa',
    },
    sendButton: {
        width: 52,
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderWidth: 2,
        borderColor: '#8b5cf6',
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
});
