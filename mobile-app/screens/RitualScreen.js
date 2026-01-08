import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, PanResponder, Dimensions, Platform, ScrollView, useAnimatedValue } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateRecapFromMessages } from '../services/api';
import { Sparkles, X } from 'lucide-react-native';
import { Fonts, TextStyles } from '../constants/Fonts';

const { width } = Dimensions.get('window');

const PERSPECTIVES = [
    {
        id: 'mirror',
        name: 'The Mirror',
        emoji: '💧',
        colors: ['#3b82f6', '#2563eb', '#1d4ed8'], // Deep Blue/Ocean
        bgColor: 'rgba(59, 130, 246, 0.2)',
        glow: '#60a5fa',
        description: 'Empathetic validation'
    },
    {
        id: 'coach',
        name: 'The Coach',
        emoji: '🎯',
        colors: ['#10b981', '#059669', '#047857'], // Emerald/Teal
        bgColor: 'rgba(16, 185, 129, 0.2)',
        glow: '#34d399',
        description: 'Supportive guidance'
    },
    {
        id: 'challenger',
        name: 'The Challenger',
        emoji: '⚡',
        colors: ['#f97316', '#ea580c', '#c2410c'], // Vibrant Orange/Red
        bgColor: 'rgba(249, 115, 22, 0.2)',
        glow: '#fb923c',
        description: 'Growth-oriented'
    }
];

export default function RitualScreen({ navigation }) {
    const [recap, setRecap] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeIndex, setActiveIndex] = useState(0);
    const [selectedArchetype, setSelectedArchetype] = useState('mirror');
    const [fullScreenContent, setFullScreenContent] = useState(null);
    const [autoRotate, setAutoRotate] = useState(true); // Auto-carousel enabled by default
    const pan = useRef(new Animated.ValueXY()).current;
    const glowAnim = useRef(new Animated.Value(0)).current;
    const translateAnim = useAnimatedValue(0)

    // Use ref to track current index for PanResponder (avoids stale closure)
    const activeIndexRef = useRef(0);

    // Update ref whenever activeIndex changes
    useEffect(() => {
        activeIndexRef.current = activeIndex;
    }, [activeIndex]);

    // Auto-carousel: rotate cards every 2 seconds
    useEffect(() => {
        return
        if (!autoRotate) return;

        const interval = setInterval(() => {
            setActiveIndex((prevIndex) => {
                const newIndex = (prevIndex + 1) % PERSPECTIVES.length;
                activeIndexRef.current = newIndex;
                console.log(`[RitualScreen] Auto-rotating to index ${newIndex}`);
                return newIndex;
            });
        }, 5000); // 2 second interval

        return () => clearInterval(interval);
    }, [autoRotate]);

    // Reload recap whenever screen comes into focus
    useFocusEffect(
        React.useCallback(() => {
            console.log('[RitualScreen] Screen focused - loading recap');
            loadRecap();
            loadArchetype();

            // Glow animation for Dive Deeper button
            Animated.loop(
                Animated.sequence([
                    Animated.timing(glowAnim, {
                        toValue: 1,
                        duration: 2000,
                        useNativeDriver: false
                    }),
                    Animated.timing(glowAnim, {
                        toValue: 0,
                        duration: 2000,
                        useNativeDriver: false
                    })
                ])
            ).start();
        }, [])
    );

    const loadArchetype = async () => {
        try {
            const saved = await AsyncStorage.getItem('selectedArchetype');
            if (saved) setSelectedArchetype(saved);
        } catch (e) {
            console.error('Error loading archetype:', e);
        }
    };

    const loadRecap = async () => {
        setLoading(true);
        try {
            // Try to load cached recap first (instant loading!)
            const cachedRecapJson = await AsyncStorage.getItem('cachedRecap');

            if (cachedRecapJson) {
                const cachedData = JSON.parse(cachedRecapJson);
                console.log('[RitualScreen] ✅ Loaded cached recap instantly');
                console.log('[RitualScreen] 📦 Cached data structure:', JSON.stringify(cachedData, null, 2));
                console.log('[RitualScreen] Mirror exists?', !!cachedData.mirror);
                console.log('[RitualScreen] Coach exists?', !!cachedData.coach);
                console.log('[RitualScreen] Challenger exists?', !!cachedData.challenger);
                if (cachedData.mirror) {
                    console.log('[RitualScreen] Mirror content:', cachedData.mirror.content?.substring(0, 50) + '...');
                }
                setRecap(cachedData);
                setLoading(false);
                return; // Exit early - we have cached data!
            }

            // No cache - fall back to generating (slower)
            console.log('[RitualScreen] No cached recap, generating from messages...');

            // Get current session messages from AsyncStorage
            const messagesJson = await AsyncStorage.getItem('currentSessionMessages');

            if (!messagesJson) {
                console.log('[RitualScreen] No current session messages found');
                setRecap(null);
                setLoading(false);
                return;
            }

            const messages = JSON.parse(messagesJson);
            console.log(`[RitualScreen] Loaded ${messages.length} messages from current session`);

            // Generate recap from current session messages
            const data = await generateRecapFromMessages(messages);
            console.log('[RitualScreen] Recap data received:', JSON.stringify(data, null, 2));
            console.log('[RitualScreen] Mirror:', data?.mirror?.title, '-', data?.mirror?.content);
            console.log('[RitualScreen] Coach:', data?.coach?.title, '-', data?.coach?.content);
            console.log('[RitualScreen] Challenger:', data?.challenger?.title, '-', data?.challenger?.content);

            setRecap(data);

            // Cache it for next time
            await AsyncStorage.setItem('cachedRecap', JSON.stringify(data));
            console.log('[RitualScreen] Recap cached for next time');
        } catch (error) {
            console.error('[RitualScreen] Error loading recap:', error);
            setRecap(null);
        } finally {
            setLoading(false);
        }
    };

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gesture) => {
                // Only take control if move is STRONGLY horizontal
                // Increased threshold to allow vertical scrolling
                const isHorizontal = Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2;
                const isSignificantMove = Math.abs(gesture.dx) > 20;
                return isHorizontal && isSignificantMove;
            },
            onPanResponderMove: Animated.event([null, { dx: pan.x }], { useNativeDriver: false }),
            onPanResponderRelease: (_, gesture) => {
                console.log(`[RitualScreen] Swipe released - dx: ${gesture.dx}`);

                // Simple distance-based swipe (lower threshold for easier swiping)
                // We ignore velocity to avoid "rebound" errors where finger moves back slightly at end
                if (gesture.dx > 25) {
                    // Swipe right -> go to previous card
                    console.log('[RitualScreen] Swiping right (previous)');
                    nextCard(-1);
                } else if (gesture.dx < -25) {
                    // Swipe left -> go to next card
                    console.log('[RitualScreen] Swiping left (next)');
                    nextCard(1);
                } else {
                    // Reset position if swipe was too small
                    Animated.spring(pan, {
                        toValue: { x: 0, y: 0 },
                        useNativeDriver: false
                    }).start();
                }
            }
        })
    ).current;

    const nextCard = (direction) => {
        // Use ref to get current value (not stale closure value)
        const currentIndex = activeIndexRef.current;
        const newIndex = (currentIndex + direction + 3) % 3;
        console.log(`[RitualScreen] Swiping from index ${currentIndex} to ${newIndex}`);
        console.log(`[RitualScreen] New perspective: ${PERSPECTIVES[newIndex].name}`);
        setActiveIndex(newIndex);
        Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false
        }).start();
    };

    const handleDiveDeeper = () => {
        console.log('[RitualScreen] 🎯 Dive Deeper tapped!');
        const perspective = PERSPECTIVES[activeIndex];
        const message = recap?.[perspective.id]?.content;

        console.log('[RitualScreen] Active perspective:', perspective.name);
        console.log('[RitualScreen] Message exists?', !!message);
        console.log('[RitualScreen] Navigation available?', !!navigation);

        if (!message) {
            console.log('[RitualScreen] ❌ No message content for', perspective.id);
            return;
        }

        console.log('[RitualScreen] ✅ Navigating to Flow with message...');
        navigation.navigate('Flow', {
            initialMessage: message
        });
    };

    if (loading) {
        return (
            <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
                <SafeAreaView style={styles.safeArea}>
                    <Text style={styles.loadingText}>Loading your ritual...</Text>
                </SafeAreaView>
            </LinearGradient>
        );
    }

    if (!recap) {
        return (
            <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.emptyState}>
                        <Sparkles size={64} color="rgba(255,255,255,0.3)" />
                        <Text style={styles.emptyTitle}>No Ritual Yet</Text>
                        <Text style={styles.emptyText}>
                            Start a conversation in Flow to unlock your personalized ritual reflections
                        </Text>
                    </View>
                </SafeAreaView>
            </LinearGradient>
        );
    }

    const activePerspective = PERSPECTIVES[activeIndex];
    const glowOpacity = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.8]
    });

    return (
        <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>The Ritual</Text>
                </View>

                {/* Card Stack */}
                <View style={styles.cardStackContainer} {...panResponder.panHandlers}>
                    {PERSPECTIVES.map((perspective, index) => {
                        const isActive = index === activeIndex;
                        const offset = index - activeIndex;

                        const clampedOffset = Math.max(-2, Math.min(2, offset));
                        const scale = isActive ? 1 : 0.94 - Math.abs(clampedOffset) * 0.04;
                        const translateY = Math.abs(clampedOffset) * -60; // Tighter stack
                        const opacity = isActive ? 1 : 0; // Hide background cards completely
                        const zIndex = 10 - Math.abs(offset);

                        return (
                            <Animated.View
                                key={perspective.id}
                                style={[
                                    styles.cardWrapper,
                                    {
                                        zIndex,
                                        transform: [
                                            { scale },
                                            { translateY },
                                        ],
                                        opacity
                                    }
                                ]}

                            >
                                {/* Active Glow (Ambient behind card) */}
                                {isActive && (
                                    <View style={[styles.ambientGlow, { shadowColor: perspective.glow }]} />
                                )}

                                {/* Beautiful Ritual Card - Tap to Expand */}
                                {isActive ? (
                                    <View
                                        style={styles.cardContainer}
                                        key={`card-content-${perspective.id}-${activeIndex}`}
                                    >
                                        <LinearGradient
                                            colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                                            style={styles.glassCardBorder}
                                        >
                                            <View style={styles.glassCard}>
                                                {/* Navigation Arrows */}
                                                <TouchableOpacity
                                                    style={[styles.navButton, styles.navButtonLeft]}
                                                    onPress={(e) => {
                                                        e.stopPropagation(); // Prevent card tap
                                                        setAutoRotate(false);
                                                        const newIndex = activeIndex === 0 ? PERSPECTIVES.length - 1 : activeIndex - 1;
                                                        setActiveIndex(newIndex);
                                                        activeIndexRef.current = newIndex;
                                                        setTimeout(() => setAutoRotate(true), 5000);
                                                    }}
                                                >
                                                    <Text style={styles.navButtonText}>‹</Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={[styles.navButton, styles.navButtonRight]}
                                                    onPress={(e) => {
                                                        e.stopPropagation(); // Prevent card tap
                                                        setAutoRotate(false);
                                                        const newIndex = (activeIndex + 1) % PERSPECTIVES.length;
                                                        setActiveIndex(newIndex);
                                                        activeIndexRef.current = newIndex;
                                                        setTimeout(() => setAutoRotate(true), 5000);
                                                    }}
                                                >
                                                    <Text style={styles.navButtonText}>›</Text>
                                                </TouchableOpacity>

                                                {/* Scrollable Card Content */}
                                                <ScrollView
                                                    style={{ flex: 1 }}
                                                    contentContainerStyle={{
                                                        alignItems: 'center',
                                                        paddingTop: 40,
                                                        paddingBottom: 60,
                                                        paddingHorizontal: 20,

                                                    }}
                                                    showsVerticalScrollIndicator={true}
                                                    indicatorStyle="white"
                                                    scrollEnabled={false}
                                                    bounces={true}
                                                >
                                                    {/* Glowing Emoji */}
                                                    <View style={[styles.emojiContainer, { shadowColor: perspective.glow }]}>
                                                        <LinearGradient
                                                            colors={[perspective.colors[0], perspective.colors[2]]}
                                                            style={styles.emojiGradient}
                                                        >
                                                            <Text style={styles.emoji}>{perspective.emoji}</Text>
                                                        </LinearGradient>
                                                    </View>

                                                    {/* Title */}
                                                    <Text style={styles.cardTitle}>
                                                        {recap[perspective.id]?.title || perspective.name}
                                                    </Text>

                                                    {/* Message - Full or Truncated */}
                                                    <Text style={styles.cardMessage}>
                                                        {(() => {
                                                            const content = recap[perspective.id]?.content || 'Take a moment to breathe. The ritual is forming...';
                                                            return content;
                                                        })()}
                                                    </Text>
                                                </ScrollView>
                                            </View>
                                        </LinearGradient>
                                        <TouchableOpacity
                                            style={styles.exploreButton}
                                            onPress={() => {
                                                setAutoRotate(true);
                                                handleDiveDeeper();
                                            }}
                                        >
                                            <Text style={styles.exploreButtonText}>Explore in Chat  →</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <View style={[styles.glassCard, styles.backCard, { backgroundColor: perspective.bgColor, borderColor: perspective.colors[0] }]}>
                                        <View style={styles.backCardLabel}>
                                            <Text style={[styles.perspectiveName, { color: '#fff' }]}>{perspective.name}</Text>
                                        </View>
                                    </View>
                                )}
                            </Animated.View>
                        );
                    })}
                </View>


                {/* Full Screen Modal */}
                {
                    fullScreenContent && (
                        <BlurView intensity={100} tint="dark" style={styles.fullScreenModal}>
                            <SafeAreaView style={{ flex: 1 }}>
                                <View style={styles.modalHeader}>
                                    <TouchableOpacity
                                        onPress={() => setFullScreenContent(null)}
                                        style={styles.closeButton}
                                    >
                                        <X size={24} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                                <ScrollView style={styles.modalContent}>
                                    <Text style={styles.modalEmoji}>{fullScreenContent.emoji}</Text>
                                    <Text style={[styles.modalTitle, { color: fullScreenContent.color }]}>
                                        {fullScreenContent.title}
                                    </Text>
                                    <Text style={styles.modalText}>
                                        {fullScreenContent.content}
                                    </Text>
                                    <View style={{ height: 100 }} />
                                </ScrollView>
                            </SafeAreaView>
                        </BlurView>
                    )
                }

                {/* Swipe hint with position indicator */}
                <View style={styles.swipeIndicatorContainer}>
                    {PERSPECTIVES.map((_, idx) => (
                        <View
                            key={idx}
                            style={[
                                styles.swipeDot,
                                idx === activeIndex && styles.swipeDotActive
                            ]}
                        />
                    ))}
                </View>
                <Text style={styles.swipeHint}>
                    {PERSPECTIVES[activeIndex].name} ({activeIndex + 1}/3) • Auto-rotating
                </Text>

                {/* Swipe hint */}
                <Text style={styles.hint}>Swipe to explore perspectives</Text>
            </SafeAreaView >
        </LinearGradient >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    header: {
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 24,
    },
    headerTitle: {
        ...TextStyles.title1,
        color: '#fff'
    },

    loadingText: {
        fontSize: 18,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        marginTop: 100
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40
    },
    emptyTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
        marginTop: 20,
        marginBottom: 12
    },
    emptyText: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        lineHeight: 24
    },
    cardStackContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 24,
    },
    cardWrapper: {
        position: 'absolute',
        top: 0,
        width: width - 70,
        height: 550,
    },
    cardWrapperExpanded: {
        position: 'absolute',
        width: Dimensions.get('window').width,
        height: Dimensions.get('window').height,
        top: 0,
        // left: -35, // Offset to center (since cardWrapper has margin)
        zIndex: 1000, // Ensure it's on top
        backgroundColor: 'rgba(15, 23, 42, 0.95)', // Dark background
    },
    cardContainer: {
        flex: 1,
        borderRadius: 36,
        alignItems: "center"
    },
    glassCardBorder: {
        flex: 1,
        padding: 1,
        borderRadius: 36,
    },
    glassCard: {
        flex: 1,
        borderRadius: 35,
        backgroundColor: 'rgba(15, 23, 42, 0.98)', // Almost fully opaque for maximum visibility
        overflow: 'visible',
    },
    backCard: {
        borderRadius: 32,
        paddingVertical: 22,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
    },
    backCardLabel: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    perspectiveName: {
        fontSize: 20,
        fontWeight: '600',
        letterSpacing: 0.5
    },
    cardContent: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        padding: 26,
    },
    cardContentContainer: {
        alignItems: 'center',
        paddingBottom: 100,
        flexGrow: 1
    },
    ambientGlow: {
        position: 'absolute',
        top: 20,
        left: 20,
        right: 20,
        bottom: 20,
        backgroundColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 50,
        elevation: 20
    },
    emojiContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 20,
        elevation: 10
    },
    emojiGradient: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)'
    },
    emoji: {
        fontSize: 56,
    },
    cardTitle: {
        ...TextStyles.title1,
        color: '#FFFFFF',
        marginBottom: 16,
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,

    },
    cardMessage: {
        ...TextStyles.base,
        color: '#FFFFFF',
        textAlign: 'center',
        paddingHorizontal: 20,
        marginBottom: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.2)', // Subtle dark background for better contrast
        paddingVertical: 12,
        borderRadius: 12,
        overflow: "scroll",
        maxHeight: 200,
    },
    bottomOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 120,
        borderBottomLeftRadius: 35,
        borderBottomRightRadius: 35
    },
    perspectiveBadge: {
        position: 'absolute',
        top: 20,
        alignSelf: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        zIndex: 10
    },
    perspectiveBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1.5,
        textTransform: 'uppercase'
    },
    actionItemBox: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 20,
        marginTop: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)'
    },
    actionItemLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8
    },
    actionItemText: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.9)',
        lineHeight: 22
    },
    buttonContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingBottom: 24,
        paddingTop: 12,
        gap: 12, // Space between buttons
    },
    glowRing: {
        position: 'absolute',
        width: '110%',
        height: '110%',
        borderRadius: 100,
        backgroundColor: '#8b5cf6',
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 30,
        elevation: 10
    },
    diveButton: {
        width: '100%',
        borderRadius: 100,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'rgba(139, 92, 246, 0.5)'
    },
    diveButtonGradient: {
        paddingVertical: 18,
        alignItems: 'center',
        borderRadius: 100
    },
    diveButtonText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 0.5
    },
    hint: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.4)',
        textAlign: 'center',
        marginBottom: 20
    },
    scrollHint: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.5)',
        textAlign: 'center',
        marginTop: 16,
        fontWeight: '500',
        letterSpacing: 0.5
    },
    tapHint: {
        fontSize: 14,
        color: 'rgba(139, 92, 246, 0.9)', // Purple hint
        textAlign: 'center',
        marginTop: 20,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    expandedButtonContainer: {
        marginTop: 32,
        gap: 16,
        width: '100%',
        alignItems: 'center',
    },
    exploreButton: {
        marginTop: 20,
        width: '90%',
        paddingVertical: 18,
        paddingHorizontal: 32,
        backgroundColor: 'rgba(139, 92, 246, 0.9)', // Bright purple
        borderRadius: 28,
        borderWidth: 2,
        borderColor: 'rgba(167, 139, 250, 1)',
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
    },
    exploreButtonText: {
        fontSize: 18,
        color: '#FFFFFF',
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    closeButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
    },
    closeButtonText: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '600',
        textAlign: 'center',
    },
    readMoreButton: {
        width: '90%',
        marginTop: 8,
        paddingVertical: 14,
        paddingHorizontal: 28,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 24,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    readMoreText: {
        fontSize: 15,
        color: '#FFFFFF',
        fontWeight: '600',
        textAlign: 'center',
    },
    diveDeeperButton: {
        width: '90%',
        marginTop: 8,
        paddingVertical: 16,
        paddingHorizontal: 32,
        backgroundColor: 'rgba(139, 92, 246, 0.4)', // Brighter purple
        borderRadius: 24,
        borderWidth: 2,
        borderColor: 'rgba(167, 139, 250, 0.8)',
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
    },
    diveDeeperText: {
        fontSize: 15,
        color: '#FFFFFF',
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    closeExpandedButton: {
        marginTop: 24,
        paddingVertical: 14,
        paddingHorizontal: 32,
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 24,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    closeExpandedText: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '700',
        textAlign: 'center',
    },
    // Navigation Button Styles
    navButton: {
        position: 'absolute',
        top: '50%',
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
    },
    navButtonLeft: {
        left: 10,
    },
    navButtonRight: {
        right: 10,
    },
    navButtonText: {
        fontSize: 32,
        color: '#FFFFFF',
        fontWeight: 'bold',
        marginTop: -4,
    },
    // List View Styles
    listContainer: {
        flex: 1
    },
    listContentContainer: {
        padding: 20,
        paddingBottom: 40
    },
    listCard: {
        marginBottom: 20,
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8
    },
    listCardGradient: {
        padding: 24,
        borderRadius: 24
    },
    listEmoji: {
        fontSize: 48,
        textAlign: 'center',
        marginBottom: 12
    },
    listCardTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 8
    },
    listPerspectiveDesc: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        marginBottom: 16,
        letterSpacing: 1,
        textTransform: 'uppercase'
    },
    listCardMessage: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.95)',
        lineHeight: 24,
        textAlign: 'center'
    },
    listActionBox: {
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 12,
        padding: 12,
        marginTop: 16
    },
    perspectiveBadge: {
        position: 'absolute',
        top: 16,
        left: 16,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        zIndex: 10
    },
    perspectiveBadgeText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase'
    },
    swipeHint: {
        textAlign: 'center',
        color: 'rgba(255,255,255,0.5)',
        fontSize: 13,
        marginBottom: 12,
        fontWeight: '500',
        letterSpacing: 0.5
    },
    swipeIndicatorContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        gap: 8,
        height: 20
    },
    swipeDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.1)'
    },
    swipeDotActive: {
        backgroundColor: '#8b5cf6',
        width: 24,
        borderRadius: 4,
        height: 6
    },
    expandButton: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        zIndex: 20,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 20,
        padding: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)'
    },
    fullScreenModal: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        padding: 20,
        paddingTop: Platform.OS === 'android' ? 40 : 20
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)'
    },
    modalContent: {
        flex: 1,
        paddingHorizontal: 24
    },
    modalEmoji: {
        fontSize: 64,
        textAlign: 'center',
        marginBottom: 24,
        marginTop: 20
    },
    modalTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 32,
        letterSpacing: 0.5
    },
    modalText: {
        fontSize: 18,
        color: 'rgba(255,255,255,0.9)',
        lineHeight: 30,
        fontWeight: '500',
        paddingBottom: 40
    }
});

