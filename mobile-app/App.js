import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, LayoutAnimation, UIManager, StatusBar, Modal, ActivityIndicator
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Send, Bot, User, Mic, RotateCcw, Phone, X, PhoneOff } from 'lucide-react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { sendMessageToBackend, fetchGreeting, LOCAL_IP } from './services/api';
import { createWavHeader, AudioQueue } from './services/audioUtils';
import { Buffer } from 'buffer';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, MessageCircle, Archive, Sparkles, Brain, Settings } from 'lucide-react-native';
import { extractAndSaveName } from './utils/nameExtractor';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HomeScreen from './screens/HomeScreen';
import VaultScreen from './screens/VaultScreen';
import FlowScreen from './screens/FlowScreen';
import RitualScreen from './screens/RitualScreen';
import SettingsScreen from './screens/SettingsScreen';
import IntensityDialScreen from './screens/IntensityDialScreen';
import { createNativeStackNavigator } from '@react-navigation/native-stack';



const Stack = createNativeStackNavigator();

const Tab = createBottomTabNavigator();

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ... imports

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#1a1a2e' }}>
          <Text style={{ color: '#ff4757', fontSize: 20, fontWeight: 'bold', marginBottom: 10 }}>Something went wrong</Text>
          <Text style={{ color: '#fff', marginBottom: 20 }}>{this.state.error?.toString()}</Text>
          <TouchableOpacity onPress={() => this.setState({ hasError: false })} style={{ padding: 10, backgroundColor: '#27ae60', borderRadius: 5 }}>
            <Text style={{ color: '#fff' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

function ChatScreen() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState('NEUTRAL');
  const [isConnecting, setIsConnecting] = useState(true); // New state for initial connection

  // Call Mode State
  const [isCallMode, setIsCallMode] = useState(false);
  const [callStatus, setCallStatus] = useState('Disconnected'); // Disconnected, Connecting, Connected, Listening, Speaking
  const ws = useRef(null);
  const audioQueue = useRef(new AudioQueue());
  const isCallActive = useRef(false);
  const isAiSpeaking = useRef(false);
  const lastUserTranscript = useRef(''); // Track last user transcript to prevent duplicates
  const lastAiTranscript = useRef(''); // Track last AI transcript to prevent duplicates
  const isFirstMessageInCall = useRef(true); // Track if this is first message for hybrid approach
  const isWaitingForFirstResponse = useRef(false); // Prevent multiple recordings during first message

  const EMOTION_COLORS = {
    SADNESS: ['#2c3e50', '#4ca1af'],    // Deep Blue/Purple
    HAPPINESS: ['#f12711', '#f5af19'],  // Warm Orange/Yellow
    ANGER: ['#1f4037', '#99f2c8'],      // Calming Teal/Green
    ANXIETY: ['#56ab2f', '#a8e063'],    // Grounding Green
    NEUTRAL: ['#1a1a2e', '#16213e']     // Default Dark Blue
  };

  const flatListRef = useRef(null);
  const recording = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const sound = useRef(null);

  useEffect(() => {
    const initSession = async () => {
      try {
        const greeting = await fetchGreeting();
        if (greeting) {
          setIsConnected(true);
          setMessages([{ id: `${Date.now()}-0-initial`, text: greeting, sender: 'ai' }]);
        } else {
          setIsConnected(false);
          setMessages([{ id: `${Date.now()}-0-initial`, text: "Hey! I'm Sneh. I'm having trouble connecting, but I'm here.", sender: 'ai' }]);
        }
      } catch (e) {
        setIsConnected(false);
        setMessages([{ id: `${Date.now()}-0-initial`, text: "Hey! I'm Sneh. I'm having trouble connecting, but I'm here.", sender: 'ai' }]);
      } finally {
        setIsConnecting(false);
      }
    };
    initSession();
  }, []);

  // --- CALL MODE LOGIC ---

  const startCall = async () => {
    setIsCallMode(true);
    isCallActive.current = true;
    isFirstMessageInCall.current = true;
    isWaitingForFirstResponse.current = false;

    // HYBRID APPROACH: Start recording for first message (will use /voice endpoint)
    setCallStatus('Tap mic to speak');
    console.log('[Hybrid] Call started - waiting for first message');
  };

  // Send first message via /voice endpoint with full safety checks
  const sendFirstMessage = async (audioBase64) => {
    try {
      setCallStatus('Processing (Safety Check)...');
      isWaitingForFirstResponse.current = true;

      const history = messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));

      console.log('[Hybrid] Sending first message via /voice endpoint');
      const { sendAudioToBackend } = require('./services/api');
      const data = await sendAudioToBackend(audioBase64, history);

      // Add messages
      if (data.transcription) {
        addMessage(data.transcription, 'user');
        lastUserTranscript.current = data.transcription;
      }
      if (data.response) {
        addMessage(data.response, 'ai');
        lastAiTranscript.current = data.response;
      }
      if (data.audioBase64) {
        await playBase64Audio(data.audioBase64);
      }

      console.log('[Hybrid] First message processed - switching to real-time mode');

      // NOW start WebSocket for real-time streaming
      isFirstMessageInCall.current = false;
      isWaitingForFirstResponse.current = false;
      startRealtimeWebSocket();

    } catch (error) {
      console.error('[Hybrid] First message error:', error);
      isWaitingForFirstResponse.current = false;
      setCallStatus('Error - Tap to retry');
    }
  };

  // Start real-time WebSocket (after first message)
  const startRealtimeWebSocket = async () => {
    try {
      const wsUrl = `ws://${LOCAL_IP}:8000`;
      console.log('[Hybrid] Connecting to WebSocket for real-time:', wsUrl);
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('[Hybrid] WebSocket connected - real-time mode active');
        setCallStatus('Connected (Real-time)');
        startStreamingRecording();
      };

      ws.current.onmessage = async (e) => {
        try {
          const event = JSON.parse(e.data);

          if (event.type === 'response.audio.delta' && event.delta) {
            setCallStatus('Speaking');
            handleAudioDelta(event.delta);
          } else if (event.type === 'response.audio_transcript.done' || event.type === 'response.done') {
            flushAudioBuffer();
          } else if (event.type === 'interrupt') {
            console.log('Interrupted by user');
          }

          // --- TRANSCRIPT INTEGRATION ---
          if (event.type === 'conversation.item.input_audio_transcription.completed') {
            const text = event.transcript;
            if (text && text !== lastUserTranscript.current) {
              lastUserTranscript.current = text;
              addMessage(text, 'user');
            }
          }

          if (event.type === 'response.audio_transcript.done') {
            const text = event.transcript;
            if (text && text !== lastAiTranscript.current) {
              lastAiTranscript.current = text;
              addMessage(text, 'ai');
            }
          }

        } catch (err) {
          console.error('WS Message Error:', err);
        }
      };

      ws.current.onerror = (error) => {
        console.error('[Hybrid] WebSocket error:', error);
      };

      ws.current.onclose = () => {
        console.log('[Hybrid] WebSocket closed');
      };

    } catch (error) {
      console.error('[Hybrid] WebSocket connection error:', error);
      setCallStatus('Error');
    }
  };

  const endCall = async () => {
    isCallActive.current = false;
    setIsCallMode(false);
    setCallStatus('Disconnected');

    // Reset hybrid state
    isFirstMessageInCall.current = true;
    isWaitingForFirstResponse.current = false;
    lastUserTranscript.current = '';
    lastAiTranscript.current = '';

    // Stop recording
    if (recording.current) {
      try {
        await recording.current.stopAndUnloadAsync();
      } catch (e) { }
      recording.current = null;
    }

    // Close WS
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }

    // Stop playback
    stopAudioPlayback();
    audioQueue.current.clear();
  };

  // Streaming Recording (Chunked)

  const startStreamingRecording = async () => {
    if (!isCallActive.current) return;

    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start a new recording
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recording.current = newRecording;
      setCallStatus('Listening');

      // Record for 1 second then send
      setTimeout(async () => {
        if (!isCallActive.current) return;
        await stopAndSendChunk();
        startStreamingRecording(); // Recursive loop
      }, 1000);

    } catch (error) {
      console.error('Recording Error:', error);
    }
  };

  const stopAndSendChunk = async () => {
    if (!recording.current) return;
    try {
      await recording.current.stopAndUnloadAsync();
      const uri = recording.current.getURI();
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });

      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        if (isAiSpeaking.current) {
          console.log('[Audio] AI Speaking - Discarding chunk to prevent echo');
        } else {
          ws.current.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: base64
          }));
        }
      }

      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch (error) {
      console.error('Send Chunk Error:', error);
    }
  };

  const accumulatedPcm = useRef(Buffer.alloc(0));
  const MIN_BUFFER_SIZE = 96000; // Increased buffer: ~2.0 seconds at 24kHz (was 0.5s)

  const speakingChunkCount = useRef(0); // Track number of active chunks to prevent race conditions

  // Audio Playback Queue
  const queueAudioChunk = async (pcmBuffer) => {
    try {
      // 1. Create WAV Header
      const headerBuffer = createWavHeader(pcmBuffer.length);

      // 2. Combine Header + PCM
      const totalBuffer = Buffer.concat([headerBuffer, pcmBuffer]);
      const wavBase64 = totalBuffer.toString('base64');

      // 3. Play using File (Data URIs can be flaky on Android)
      const filename = `${FileSystem.cacheDirectory}chunk_${Date.now()}_${Math.random()}.wav`;
      await FileSystem.writeAsStringAsync(filename, wavBase64, { encoding: 'base64' });

      // Verify file exists and size
      // const fileInfo = await FileSystem.getInfoAsync(filename);
      // console.log(`[Audio] Saved file: ${filename}, Size: ${fileInfo.size} bytes`);

      // Mark AI as speaking IMMEDIATELY and increment counter
      isAiSpeaking.current = true;
      speakingChunkCount.current += 1;

      audioQueue.current.enqueue(async () => {
        if (!isCallActive.current) {
          speakingChunkCount.current = Math.max(0, speakingChunkCount.current - 1);
          if (speakingChunkCount.current === 0) isAiSpeaking.current = false;
          return;
        }
        try {
          const { sound: chunkSound } = await Audio.Sound.createAsync(
            { uri: filename },
            { shouldPlay: true }
          );
          sound.current = chunkSound;

          await new Promise(resolve => {
            chunkSound.setOnPlaybackStatusUpdate(status => {
              if (status.didJustFinish) {
                resolve();
                // Decrement counter with a safety delay to catch echo
                setTimeout(() => {
                  speakingChunkCount.current = Math.max(0, speakingChunkCount.current - 1);
                  if (speakingChunkCount.current === 0) {
                    isAiSpeaking.current = false;
                    console.log('[Audio] AI finished speaking (all chunks done)');
                  }
                }, 2000); // 2 second buffer after EACH chunk ensures overlap coverage
              }
            });
          });

          chunkSound.unloadAsync();
        } catch (e) {
          console.error(`[Audio] Playback error for ${filename}:`, e);
          // Ensure we decrement on error too
          speakingChunkCount.current = Math.max(0, speakingChunkCount.current - 1);
          if (speakingChunkCount.current === 0) isAiSpeaking.current = false;
        }
        FileSystem.deleteAsync(filename, { idempotent: true });
      });
    } catch (error) {
      console.error('[Audio] Processing error:', error);
    }
  };

  const handleAudioDelta = (base64Delta) => {
    const chunk = Buffer.from(base64Delta, 'base64');
    accumulatedPcm.current = Buffer.concat([accumulatedPcm.current, chunk]);

    // SMART STREAMING: Play when we have enough data (0.5s)
    if (accumulatedPcm.current.length >= MIN_BUFFER_SIZE) {
      queueAudioChunk(accumulatedPcm.current);
      accumulatedPcm.current = Buffer.alloc(0);
    }
  };

  const flushAudioBuffer = () => {
    if (accumulatedPcm.current.length > 0) {
      queueAudioChunk(accumulatedPcm.current);
      accumulatedPcm.current = Buffer.alloc(0);
    }
  };

  const stopAudioPlayback = async () => {
    if (sound.current) {
      try {
        await sound.current.stopAsync();
        await sound.current.unloadAsync();
      } catch (e) { }
    }
  };


  // --- EXISTING CHAT LOGIC ---

  const messageIdCounter = useRef(0);

  const addMessage = (text, sender) => {
    messageIdCounter.current += 1;
    const uniqueId = `${Date.now()}-${messageIdCounter.current}-${Math.random().toString(36).substr(2, 9)}`;
    const newMessage = { id: uniqueId, text, sender };
    setMessages(prev => {
      const updated = [...prev, newMessage];
      if (sender === 'user') {
        // Try to extract and remember the user's name from what they share
        extractAndSaveName(updated).catch(err =>
          console.error('[NameExtractor] Failed to extract name:', err)
        );
      }
      return updated;
    });
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // Keep current chat synced for Ritual recap (Mirror / Coach / Challenger)
  useEffect(() => {
    const saveForRitual = async () => {
      try {
        if (messages.length === 0) return;
        const simplified = messages.map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text,
        }));
        await AsyncStorage.setItem('currentSessionMessages', JSON.stringify(simplified));
      } catch (e) {
        console.error('[ChatScreen] Failed to save messages for Ritual:', e);
      }
    };
    saveForRitual();
  }, [messages]);

  const playBase64Audio = async (base64Audio) => {
    try {
      if (sound.current) {
        await sound.current.unloadAsync();
      }

      const fileUri = `${FileSystem.cacheDirectory}response_${Date.now()}.mp3`;
      await FileSystem.writeAsStringAsync(fileUri, base64Audio, { encoding: 'base64' });

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: fileUri },
        { shouldPlay: true }
      );

      sound.current = newSound;
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setIsPlaying(false);
          newSound.unloadAsync();
          FileSystem.deleteAsync(fileUri, { idempotent: true });
        }
      });
    } catch (error) {
      console.error('[Audio] Playback failed:', error);
      alert('Failed to play audio response.');
    }
  };

  const startRecording = async () => {
    // For call mode first message, handle differently
    if (isCallMode && isFirstMessageInCall.current) {
      if (isWaitingForFirstResponse.current) {
        console.log('[Hybrid] Already waiting for first response');
        return;
      }
      console.log('[Hybrid] Recording first message...');
      setCallStatus('Recording first message...');
    }

    try {
      // Ensure any previous recording is completely cleaned up
      if (recording.current) {
        try {
          const status = await recording.current.getStatusAsync();
          if (status.isRecording) {
            await recording.current.stopAndUnloadAsync();
          } else if (status.canRecord || status.isDoneRecording) {
            await recording.current.stopAndUnloadAsync();
          }
        } catch (e) {
          console.log('Previous recording already cleaned up:', e.message);
        }
        recording.current = null;
      }

      await Audio.requestPermissionsAsync();

      // Reset and set audio mode with a small delay
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recording.current = newRecording;
      setIsRecording(true);
      console.log('🎙️ Recording started...');

    } catch (err) {
      console.error('Failed to start recording', err);
      alert('Failed to start recording: ' + err.message);
      recording.current = null;
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    console.log('🛑 Stopping recording...');
    setIsRecording(false);

    // Check if recording exists
    if (!recording.current) {
      console.log('⚠️ No recording to stop');
      setLoading(false);
      return;
    }

    // For call mode first message - use /voice endpoint
    if (isCallMode && isFirstMessageInCall.current) {
      try {
        // Check if recording is still valid
        try {
          const status = await recording.current.getStatusAsync();
          if (!status.canRecord && !status.isDoneRecording) {
            console.log('⚠️ Recording not in valid state');
            recording.current = null;
            setCallStatus('Error - Try again');
            return;
          }
          await recording.current.stopAndUnloadAsync();
        } catch (recorderError) {
          console.log('⚠️ Recording was already stopped or does not exist');
          recording.current = null;
          setCallStatus('Error - Try again');
          return;
        }

        const uri = recording.current.getURI();
        const base64Audio = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });

        // Send via /voice endpoint with full safety
        await sendFirstMessage(base64Audio);

        FileSystem.deleteAsync(uri, { idempotent: true });
        recording.current = null;
      } catch (error) {
        console.error('[Hybrid] First message recording error:', error);
        setCallStatus('Error - Try again');
        recording.current = null;
      } finally {
        // Reset audio mode with safety check
        try {
          console.log('🎙️ Resetting audio mode...');
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
          });
        } catch (audioError) {
          console.log('⚠️ Audio mode reset skipped (no active recorder)');
        }
      }
      return;
    }

    // For regular text chat voice messages
    setLoading(true);

    try {
      // Check if recording is still valid before attempting to stop
      try {
        const status = await recording.current.getStatusAsync();
        if (!status.canRecord && !status.isDoneRecording) {
          console.log('⚠️ Recording not in valid state');
          recording.current = null;
          setLoading(false);
          return;
        }
        await recording.current.stopAndUnloadAsync();
      } catch (recorderError) {
        console.log('⚠️ Recording was already stopped or does not exist');
        recording.current = null;
        setLoading(false);
        return;
      }

      const uri = recording.current.getURI();
      console.log('Recorded URI:', uri);

      const base64Audio = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });

      const history = messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));

      const { sendAudioToBackend } = require('./services/api');
      const data = await sendAudioToBackend(base64Audio, history);

      if (data.transcription) {
        addMessage(data.transcription, 'user');
      }
      if (data.response) {
        addMessage(data.response, 'ai');
      }
      if (data.audioBase64) {
        await playBase64Audio(data.audioBase64);
      }

      FileSystem.deleteAsync(uri, { idempotent: true });

    } catch (error) {
      console.error('Voice Error:', error);
      if (error.message !== 'Recorder does not exist.') {
        alert('Failed to process voice message.');
      }
    } finally {
      // Reset audio mode with safety check
      try {
        console.log('🎙️ Resetting audio mode...');
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
      } catch (audioError) {
        console.log('⚠️ Audio mode reset skipped (no active recorder)');
      }
      setLoading(false);
      recording.current = null;
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const userMsg = inputText.trim();
    setInputText('');
    addMessage(userMsg, 'user');
    setLoading(true);
    try {
      const history = messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));

      // Get user name from AsyncStorage
      const userName = await AsyncStorage.getItem('userName');
      console.log(`[App] Sending message with userName: ${userName}`);

      const data = await sendMessageToBackend(userMsg, history, userName);
      const aiText = typeof data === 'object' ? data.response : data;
      const emotion = typeof data === 'object' ? data.emotion : 'NEUTRAL';

      addMessage(aiText, 'ai');
      if (emotion && emotion !== 'NEUTRAL') {
        setCurrentEmotion(emotion);
      }
    } catch (error) {
      console.error('Send Error:', error);
      let errorMsg = 'Sorry, something went wrong.';
      if (error.message) errorMsg += ` (${error.message})`;
      addMessage(errorMsg, 'ai');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(false);
    setIsRecording(false);
    setIsPlaying(false);
    if (sound.current) {
      try {
        await sound.current.stopAsync();
        await sound.current.unloadAsync();
      } catch (e) { }
    }
    alert('App state reset');
  };

  const renderItem = ({ item }) => (
    item.sender === 'user' ? (
      <View style={styles.flowUserBubbleContainer}>
        <LinearGradient
          colors={['rgba(16, 185, 129, 0.18)', 'rgba(5, 150, 105, 0.12)', 'rgba(4, 120, 87, 0.18)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.flowUserBubble}
        >
          <Text style={styles.flowUserText}>{item.text}</Text>
        </LinearGradient>
      </View>
    ) : (
      <View style={styles.flowAiBubbleContainer}>
        <LinearGradient
          colors={['#8b5cf6', '#3b82f6', '#06b6d4']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.flowAiGradientBorder}
        >
          <View style={styles.flowAiContent}>
            <Text style={styles.flowAiText}>{item.text}</Text>
          </View>
        </LinearGradient>
      </View>
    )
  );

  return (
    <LinearGradient
      colors={EMOTION_COLORS[currentEmotion] || EMOTION_COLORS.NEUTRAL}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <StatusBar barStyle="light-content" />
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Sneh {isCallMode ? '📞' : ''}</Text>
            </View>

            <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
              <RotateCcw size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Connection status bar – glassy pill with subtle status text */}
          <View style={styles.statusBar}>
            <LinearGradient
              colors={
                isConnected
                  ? ['rgba(34,197,94,0.35)', 'rgba(45,212,191,0.25)']
                  : isConnecting
                    ? ['rgba(250,204,21,0.35)', 'rgba(248,250,252,0.12)']
                    : ['rgba(248,113,113,0.35)', 'rgba(15,23,42,0.4)']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.statusPill}
            >
              <View
                style={[
                  styles.statusDotOuter,
                  isConnected
                    ? { shadowColor: '#22c55e' }
                    : isConnecting
                      ? { shadowColor: '#facc15' }
                      : { shadowColor: '#f97373' },
                ]}
              >
                <View
                  style={[
                    styles.statusDotInner,
                    isConnected
                      ? { backgroundColor: '#22c55e' }
                      : isConnecting
                        ? { backgroundColor: '#facc15' }
                        : { backgroundColor: '#f97373' },
                  ]}
                />
              </View>
              <Text style={styles.statusText}>
                {isConnecting
                  ? 'One sec, I’m getting ready to listen.'
                  : isConnected
                    ? 'I’m here with you.'
                    : 'I’m not hearing you right now—try reset or reconnect.'}
              </Text>
            </LinearGradient>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
            style={styles.flex}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 100}
          >
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.messagesContainer}
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews={false}
            />

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder={
                  isCallMode ?
                    (isFirstMessageInCall.current ? "Tap mic to speak (First message)" :
                      callStatus === 'Speaking' ? "🔊 Sneh is speaking..." : "🎙️ Real-time mode...") :
                    isPlaying ? "🔊 AI is speaking..." :
                      isRecording ? "🎙️ Recording... Tap MIC to stop" :
                        "Type a message..."
                }
                placeholderTextColor="#888"
                multiline
                maxLength={500}
                editable={!isRecording && !isPlaying && !isCallMode}
              />

              <TouchableOpacity
                style={styles.sendButton}
                onPress={handleSend}
                disabled={loading || isRecording || isPlaying || isCallMode}
              >
                <LinearGradient
                  colors={['#22d3ee', '#6366f1']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', borderRadius: 24 }}
                >
                  <Send size={22} color="#f9fafb" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>

          {/* Modal Removed */}

        </SafeAreaView>
      </SafeAreaProvider>
    </LinearGradient >
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  header: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.2)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  statusBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500'
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(15,23,42,0.7)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6
  },
  statusDotOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    shadowOpacity: 0.8,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 }
  },
  statusDotInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  resetButton: {
    padding: 8
  },
  callButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    marginRight: 8
  },
  messagesContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    flexGrow: 1
  },
  // Flow-like bubbles for Chat
  flowUserBubbleContainer: {
    alignItems: 'flex-end',
    marginBottom: 16,
    maxWidth: '85%',
    alignSelf: 'flex-end',
  },
  flowUserBubble: {
    backgroundColor: 'rgba(51, 65, 85, 0.9)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderBottomRightRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  flowUserText: {
    color: '#f8fafc',
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600',
  },
  flowAiBubbleContainer: {
    marginBottom: 20,
    maxWidth: '85%',
    alignSelf: 'flex-start',
  },
  flowAiGradientBorder: {
    padding: 2,
    borderRadius: 22,
    borderTopLeftRadius: 8,
  },
  flowAiContent: {
    backgroundColor: '#020617',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  flowAiText: {
    color: '#e2e8f0',
    fontSize: 15,
    lineHeight: 22,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)'
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 16,
    maxHeight: 100,
    minHeight: 44
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4a90e2',
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  recordingButton: {
    backgroundColor: '#e74c3c'
  },
  disabledButton: {
    backgroundColor: '#555',
    opacity: 0.5
  },
  sendButton: {
    width: 56,
    height: 48,
    borderRadius: 24,
    marginLeft: 10,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    overflow: 'hidden',
    shadowColor: '#38bdf8',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  // Call Modal Styles
  callModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  callModalContent: {
    height: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  callHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40
  },
  callTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff'
  },
  closeButton: {
    padding: 8
  },
  callBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  avatarSpeaking: {
    borderColor: '#4a90e2',
    backgroundColor: 'rgba(74, 144, 226, 0.2)',
    transform: [{ scale: 1.1 }]
  },
  callStatus: {
    fontSize: 18,
    color: '#ccc',
    fontWeight: '500'
  },
  callFooter: {
    alignItems: 'center',
    paddingBottom: 40
  },
  endCallButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#e74c3c',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8
  }
});

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0f1419',
          height: 60,
          marginBottom: 20,  // Shift tab bar up
        },
        tabBarActiveTintColor: '#a855f7',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.4)',
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Home size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tab.Screen
        name="Ritual"
        component={RitualScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Sparkles size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tab.Screen
        name="Vault"
        component={VaultScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Brain size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Settings size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const handleIntensitySelected = (intensity) => {
    console.log(`✅ Intensity selected: ${intensity}`);
    // Intensity is already saved in IntensityDialScreen, just log it
  };

  // Notification setup removed as per user request


  return (
    <ErrorBoundary>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {/* Always show IntensityDial first */}
          <Stack.Screen name="IntensityDial">
            {({ navigation }) => (
              <IntensityDialScreen
                onComplete={(intensity) => {
                  handleIntensitySelected(intensity);
                  navigation.replace('MainTabs');
                }}
              />
            )}
          </Stack.Screen>

          {/* Main app screens */}
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="Flow" component={FlowScreen} />
          <Stack.Screen
            name="ChangeIntensity"
            options={{
              presentation: 'modal',
              headerShown: false
            }}
          >
            {({ navigation }) => (
              <IntensityDialScreen
                mode="settings"
                navigation={navigation}
              />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </ErrorBoundary>
  );
}
