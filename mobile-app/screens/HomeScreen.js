import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import DeformableBlob3D from '../components/DeformableBlob3D';
import { Buffer } from 'buffer';
import { LOCAL_IP } from '../services/api';
import { Keyboard, Settings } from 'lucide-react-native';
import { getUserName, getTimeBasedGreeting } from '../utils/nameExtractor';
import { useFocusEffect } from '@react-navigation/native';
import { Animated, Easing } from 'react-native';
import ConnectionSettings from '../components/ConnectionSettings';


const WS_URL = `ws://${LOCAL_IP}:8000`; // Updated port

export default function HomeScreen({ navigation }) {
    const [orbState, setOrbState] = useState('idle'); // idle, listening, processing, speaking
    const [isRecording, setIsRecording] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(true); // Initial connecting state
    const [transcript, setTranscript] = useState(''); // AI Response
    const [userTranscript, setUserTranscript] = useState(''); // User Input
    const [userName, setUserName] = useState(null);
    const [greeting, setGreeting] = useState(getTimeBasedGreeting());
    const [showSettings, setShowSettings] = useState(false);



    // Bubble animations
    const bubble1Anim = useRef(new Animated.Value(0)).current;
    const bubble2Anim = useRef(new Animated.Value(0)).current;
    const bubble3Anim = useRef(new Animated.Value(0)).current;
    const bubble4Anim = useRef(new Animated.Value(0)).current;

    // Refs
    const recording = useRef(null);
    const ws = useRef(null);
    const audioQueue = useRef([]);
    const isPlaying = useRef(false);

    // Race Condition Protection
    const isStarting = useRef(false);
    const shouldCancel = useRef(false);
    const audioLock = useRef(false);

    useEffect(() => {

        connectWebSocket();
        return () => {
            if (ws.current) ws.current.close();
        };
    }, []);



    // Load user data and start bubble animations
    useFocusEffect(
        React.useCallback(() => {
            const loadUserData = async () => {
                const savedName = await getUserName();
                setUserName(savedName);
                setGreeting(getTimeBasedGreeting(savedName || undefined));
            };

            loadUserData();

            // Start floating animations for bubbles
            const startFloatingAnimation = (animValue, duration, toValue) => {
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(animValue, {
                            toValue: toValue,
                            duration: duration,
                            useNativeDriver: true,
                            easing: Easing.inOut(Easing.sin)
                        }),
                        Animated.timing(animValue, {
                            toValue: 0,
                            duration: duration,
                            useNativeDriver: true,
                            easing: Easing.inOut(Easing.sin)
                        })
                    ])
                ).start();
            };

            // Different speeds and ranges for each bubble - increased movement
            startFloatingAnimation(bubble1Anim, 3500, -60);
            startFloatingAnimation(bubble2Anim, 4500, -80);
            startFloatingAnimation(bubble3Anim, 3000, -50);
            startFloatingAnimation(bubble4Anim, 4000, -70);

            return () => {
                // Cleanup animations on unmount
                bubble1Anim.stopAnimation();
                bubble2Anim.stopAnimation();
                bubble3Anim.stopAnimation();
                bubble4Anim.stopAnimation();
            };
        }, [])
    );

    const connectWebSocket = () => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) return;

        console.log('🔌 Connecting to WebSocket:', WS_URL);
        ws.current = new WebSocket(WS_URL);

        ws.current.onopen = () => {
            console.log('✅ WebSocket Connected');
            setIsConnected(true);
            setIsConnecting(false);
        };

        ws.current.onclose = () => {
            console.log('❌ WebSocket Disconnected');
            setIsConnected(false);
            setIsConnecting(false);
        };

        ws.current.onerror = (e) => {
            console.log('⚠️ WebSocket Error:', e.message);
            setIsConnecting(false);
        };

        ws.current.onmessage = (e) => {
            handleServerMessage(e.data);
        };
    };

    const handleServerMessage = async (data) => {
        try {
            const event = JSON.parse(data);

            if (event.type === 'response.audio.delta') {
                handleAudioChunk(event.delta);
            } else if (event.type === 'response.audio_transcript.delta') {
                if (event.delta) {
                    setTranscript(prev => prev + event.delta);
                }
            } else if (event.type === 'conversation.item.input_audio_transcription.completed') {
                console.log('📝 User Transcript Rx:', event.transcript);
                if (event.transcript) {
                    setUserTranscript(event.transcript);
                }
            } else if (event.type === 'input_audio_buffer.speech_started') {
                setTranscript('');
                setUserTranscript('');
                audioQueue.current = [];
            } else if (event.type === 'response.done') {
                console.log('✅ Response Done');
                setOrbState('idle');
                processAudioQueue();
            }
        } catch (e) {
            console.error('Msg Parse Error:', e);
        }
    };

    const handleAudioChunk = async (base64Pcm) => {
        if (base64Pcm) {
            setOrbState('speaking');
            audioQueue.current.push(base64Pcm);
            const MIN_BUFFER_THRESHOLD = 15;
            if (isPlaying.current || audioQueue.current.length >= MIN_BUFFER_THRESHOLD) {
                processAudioQueue();
            }
        }
    };

    const processAudioQueue = async () => {
        if (isPlaying.current || audioQueue.current.length === 0) return;

        isPlaying.current = true;
        const chunksToPlay = [...audioQueue.current];
        audioQueue.current = [];

        try {
            const pcmBuffers = chunksToPlay.map(chunk => Buffer.from(chunk, 'base64'));
            const totalLength = pcmBuffers.reduce((acc, buf) => acc + buf.length, 0);
            const combinedPcmBuffer = Buffer.concat(pcmBuffers, totalLength);

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

            const { sound } = await Audio.Sound.createAsync(
                { uri: `data:audio/wav;base64,${wavBase64}` },
                { shouldPlay: true }
            );

            // Keep track of sound to unload later
            // sound.current = sound; // Not using ref here to avoid complexity in this quick fix

            sound.setOnPlaybackStatusUpdate(status => {
                if (status.didJustFinish) {
                    sound.unloadAsync();
                    isPlaying.current = false;
                    processAudioQueue();
                }
            });

        } catch (e) {
            console.log('Playback Error:', e);
            isPlaying.current = false;
            processAudioQueue();
        }
    };

    const startRecording = async () => {
        try {
            if (isStarting.current) return; // Prevent double trigger
            isStarting.current = true;
            shouldCancel.current = false;

            // Strict cleanup of previous recording
            if (recording.current) {
                try {
                    await recording.current.stopAndUnloadAsync();
                } catch (e) {
                    console.log("Cleanup warning:", e);
                }
                recording.current = null;
            }

            setTranscript('');
            setUserTranscript('');

            await Audio.requestPermissionsAsync();
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const recordingOptions = {
                android: {
                    extension: '.m4a',
                    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
                    audioEncoder: Audio.AndroidAudioEncoder.AAC,
                    sampleRate: 44100,
                    numberOfChannels: 1,
                    bitRate: 128000,
                },
                ios: {
                    extension: '.wav',
                    audioQuality: Audio.IOSAudioQuality.HIGH,
                    sampleRate: 24000,
                    numberOfChannels: 1,
                    bitRate: 128000,
                    linearPCMBitDepth: 16,
                    linearPCMIsBigEndian: false,
                    linearPCMIsFloat: false,
                },
            };

            const { recording: newRecording } = await Audio.Recording.createAsync(recordingOptions);

            if (shouldCancel.current) {
                try {
                    await newRecording.stopAndUnloadAsync();
                } catch (e) { }
                isStarting.current = false;
                return;
            }

            recording.current = newRecording;
            setIsRecording(true);
            setOrbState('listening');
            isStarting.current = false;

        } catch (err) {
            console.error('Failed to start:', err);
            isStarting.current = false;
            // Ensure state reset on error
            setIsRecording(false);
            if (recording.current) {
                try {
                    await recording.current.stopAndUnloadAsync();
                    recording.current = null;
                } catch (e) { }
            }
        }
    };

    const stopRecording = async () => {
        if (isStarting.current) {
            shouldCancel.current = true;
            return;
        }

        const recorder = recording.current;
        recording.current = null;

        if (!recorder) return;

        try {
            setIsRecording(false);
            setOrbState('processing');

            try {
                await recorder.stopAndUnloadAsync();
            } catch (unloadError) {
                if (unloadError.message.includes('no valid audio data')) {
                    setIsRecording(false);
                    setOrbState('idle');
                    return;
                }
                return;
            }

            const uri = recorder.getURI();

            // Navigate to Flow Screen with the audio file
            navigation.navigate('Flow', { audioUri: uri });
            setOrbState('idle');

        } catch (error) {
            console.error('Voice Error:', error);
            setOrbState('idle');
        }
    };

    // --- RENDER ---
    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#050816', '#090b27', '#050816']}
                style={styles.background}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            {/* Floating bubbles with animations */}
            <Animated.View style={[styles.bubble, styles.bubbleSmall, { top: 100, left: 40, transform: [{ translateY: bubble1Anim }] }]} />
            <Animated.View style={[styles.bubble, styles.bubbleMedium, { top: 160, right: 40, transform: [{ translateY: bubble2Anim }] }]} />
            <Animated.View style={[styles.bubble, styles.bubbleTiny, { bottom: 220, left: 80, transform: [{ translateY: bubble3Anim }] }]} />
            <Animated.View style={[styles.bubble, styles.bubbleTiny, { bottom: 260, right: 70, transform: [{ translateY: bubble4Anim }] }]} />

            <SafeAreaView style={styles.safeArea}>
                {/* Header / Greeting */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.settingsButton}
                        onPress={() => setShowSettings(true)}
                    >
                        <Settings size={24} color="rgba(255,255,255,0.6)" />
                    </TouchableOpacity>

                    <Text style={styles.greetingLinePrimary}>
                        {greeting}
                    </Text>
                    <Text style={styles.greetingLineSecondary}>
                        {userName ? 'Heavy day?' : 'How are you feeling today?'}
                    </Text>
                    <Text style={styles.connectionText}>
                        {isConnecting ? 'Connecting…' : isConnected ? 'Connected to Sneh' : 'Offline'}
                    </Text>


                </View>


                {/* Content */}
                <View style={styles.contentContainer}>
                    {/* Orb Section */}
                    <View style={styles.orbWrapper}>
                        <DeformableBlob3D
                            state={orbState}
                            size={220}
                        />
                    </View>

                    {/* Chat Section */}
                    <View style={styles.chatWrapper}>
                        {userTranscript ? (
                            <View style={[styles.bubbleTextWrapper, styles.userBubble]}>
                                <Text style={styles.bubbleText}>{userTranscript}</Text>
                            </View>
                        ) : null}

                        {transcript ? (
                            <View style={[styles.bubbleTextWrapper, styles.aiBubble]}>
                                <Text style={styles.bubbleText}>{transcript}</Text>
                            </View>
                        ) : null}
                    </View>
                </View>

                {/* Footer Controls */}
                <View style={styles.footer}>
                    <View style={styles.footerRow}>
                        <TouchableOpacity
                            onPressIn={startRecording}
                            onPressOut={stopRecording}
                            activeOpacity={0.9}
                            style={[
                                styles.recordButton,
                                isRecording && styles.recordButtonActive
                            ]}
                        >
                            <LinearGradient
                                colors={isRecording ? ['#f97373', '#fb7185'] : ['#22d3ee', '#a855f7']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.buttonGradient}
                            >
                                <Text style={styles.recordButtonText}>
                                    {isRecording ? 'Listening…' : 'Hold to Speak'}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                            activeOpacity={0.9}
                            style={styles.keyboardButton}
                            onPress={() => {
                                const parentNav = navigation.getParent();
                                if (parentNav) {
                                    parentNav.navigate('Chat');
                                }
                            }}
                        >
                            <LinearGradient
                                colors={['#1f2937', '#020617']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.keyboardGradient}
                            >
                                <Keyboard size={22} color="#e5e7eb" />
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>

            {/* Connection Settings Modal */}
            <ConnectionSettings
                visible={showSettings}
                onClose={() => setShowSettings(false)}
            />
        </View>
    );
}


const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#050816',
    },
    background: {
        position: 'absolute',
        left: 0, right: 0, top: 0, bottom: 0,
    },
    safeArea: {
        flex: 1,
        paddingTop: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: 28,
        position: 'relative',
    },
    settingsButton: {
        position: 'absolute',
        top: 0,
        right: 20,
        padding: 8,
        zIndex: 10,
    },
    greetingLinePrimary: {
        fontSize: 24,
        fontWeight: '700',
        color: '#e5e7eb',
        letterSpacing: 0.3,
        textAlign: 'center',
    },
    greetingLineSecondary: {
        marginTop: 4,
        fontSize: 22,
        fontWeight: '600',
        color: '#e5e7eb',
        textAlign: 'center',
    },
    connectionText: {
        color: '#9ca3af',
        fontSize: 12,
        marginTop: 10,
    },
    statusDot: {
        fontSize: 13,
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    orbWrapper: {
        alignItems: 'center',
        marginBottom: 40,
    },
    orbBackdrop: {
        position: 'absolute',
        width: 260,
        height: 260,
        borderRadius: 130,
        backgroundColor: 'rgba(15,23,42,0.85)',
        opacity: 0.9,
    },
    chatWrapper: {
        paddingHorizontal: 20,
        minHeight: 100,
        justifyContent: 'flex-end',
    },
    bubbleTextWrapper: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 10,
        maxWidth: '85%',
    },
    userBubble: {
        backgroundColor: 'rgba(59, 130, 246, 0.2)', // Blue tint
        alignSelf: 'flex-end',
        borderBottomRightRadius: 2,
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)',
    },
    aiBubble: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)', // Glass tint
        alignSelf: 'flex-start',
        borderBottomLeftRadius: 2,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    bubbleText: {
        color: '#e2e8f0',
        fontSize: 16,
        lineHeight: 24,
    },
    footer: {
        paddingHorizontal: 24,
        paddingTop: 8,
        paddingBottom: 80,
    },
    footerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    recordButton: {
        width: '72%',
        height: 58,
        borderRadius: 28,
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    recordButtonActive: {
        transform: [{ scale: 0.97 }],
    },
    buttonGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    recordButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    keyboardButton: {
        width: 54,
        height: 54,
        borderRadius: 999,
        marginLeft: 16,
        shadowColor: '#0ea5e9',
        shadowOpacity: 0.35,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 10,
        overflow: 'hidden',
    },
    keyboardGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bubble: {
        position: 'absolute',
        backgroundColor: 'rgba(148, 163, 253, 0.18)',
        borderWidth: 1,
        borderColor: 'rgba(191, 219, 254, 0.25)',
    },
    bubbleSmall: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    bubbleMedium: {
        width: 52,
        height: 52,
        borderRadius: 26,
    },
    bubbleTiny: {
        width: 22,
        height: 22,
        borderRadius: 11,
    },
});
