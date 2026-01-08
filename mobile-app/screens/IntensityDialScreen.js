import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, PanResponder } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

const INTENSITY_LEVELS = [
    { id: 'gentle', label: 'Gentle', subtitle: "I'll just listen.", angle: -60, color: '#3b82f6', haptic: Haptics.ImpactFeedbackStyle.Light },
    { id: 'real', label: 'Real', subtitle: "I'll nudge you.", angle: 0, color: '#10b981', haptic: Haptics.ImpactFeedbackStyle.Medium },
    { id: 'ruthless', label: 'Ruthless', subtitle: "I'll call you out.", angle: 60, color: '#f97316', haptic: Haptics.ImpactFeedbackStyle.Heavy }
];

export default function IntensityDialScreen({ onComplete, mode = 'onboarding', navigation }) {
    const [selectedIntensity, setSelectedIntensity] = useState('real'); // Default to middle
    const rotationAnim = useRef(new Animated.Value(0)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Load current intensity if in settings mode
        if (mode === 'settings') {
            loadCurrentIntensity();
        }

        // Pulsing glow animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim, {
                    toValue: 1,
                    duration: 2000,
                    useNativeDriver: true,
                }),
                Animated.timing(glowAnim, {
                    toValue: 0,
                    duration: 2000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    const loadCurrentIntensity = async () => {
        try {
            const intensity = await AsyncStorage.getItem('intensityPreference');
            if (intensity) {
                setSelectedIntensity(intensity);
                const level = INTENSITY_LEVELS.find(l => l.id === intensity);
                if (level) {
                    Animated.spring(rotationAnim, {
                        toValue: level.angle,
                        useNativeDriver: true,
                        tension: 50,
                        friction: 7
                    }).start();
                }
            }
        } catch (error) {
            console.error('Failed to load intensity preference:', error);
        }
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderMove: (evt, gestureState) => {
                // Calculate angle from center
                const centerX = width / 2;
                const centerY = height / 2 - 50;
                const dx = gestureState.moveX - centerX;
                const dy = gestureState.moveY - centerY;
                let angle = Math.atan2(dy, dx) * (180 / Math.PI);

                // Normalize angle to -60 to 60 range
                angle = Math.max(-60, Math.min(60, angle - 90));

                // Snap to nearest intensity level
                let nearest = INTENSITY_LEVELS[0];
                let minDiff = Math.abs(angle - INTENSITY_LEVELS[0].angle);

                INTENSITY_LEVELS.forEach(level => {
                    const diff = Math.abs(angle - level.angle);
                    if (diff < minDiff) {
                        minDiff = diff;
                        nearest = level;
                    }
                });

                setSelectedIntensity(nearest.id);

                // Trigger haptic feedback
                if (nearest.haptic) {
                    Haptics.impactAsync(nearest.haptic);
                }

                Animated.spring(rotationAnim, {
                    toValue: nearest.angle,
                    useNativeDriver: true,
                    tension: 50,
                    friction: 7
                }).start();
            },
        })
    ).current;

    const handleContinue = async () => {
        try {
            // Trigger haptic feedback on confirm
            const level = INTENSITY_LEVELS.find(l => l.id === selectedIntensity);
            if (level?.haptic) {
                await Haptics.impactAsync(level.haptic);
            }

            await AsyncStorage.setItem('intensityPreference', selectedIntensity);
            console.log(`✅ [IntensityDial] Saved intensity preference: "${selectedIntensity}"`);
            console.log(`✅ [IntensityDial] Mode: ${mode}`);

            if (mode === 'settings') {
                // In settings mode, navigate back
                navigation?.goBack();
            } else {
                // In onboarding mode, call onComplete
                onComplete(selectedIntensity);
            }
        } catch (error) {
            console.error('Failed to save intensity preference:', error);
            if (mode === 'settings') {
                navigation?.goBack();
            } else {
                onComplete(selectedIntensity); // Continue anyway
            }
        }
    };

    const currentLevel = INTENSITY_LEVELS.find(l => l.id === selectedIntensity);

    return (
        <LinearGradient
            colors={['#0f172a', '#1e1b4b', '#000000']}
            style={styles.container}
        >
            {/* Title */}
            <View style={styles.header}>
                <Text style={styles.title}>How honest do you</Text>
                <Text style={styles.title}>want me to be?</Text>
            </View>

            {/* Dial Container */}
            <View style={styles.dialContainer} {...panResponder.panHandlers}>
                {/* Glow Effect */}
                <Animated.View
                    style={[
                        styles.glowRing,
                        {
                            backgroundColor: currentLevel.color,
                            shadowColor: currentLevel.color,
                            opacity: glowAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.3, 0.8],
                            }),
                            transform: [
                                {
                                    scale: glowAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [1, 1.1],
                                    }),
                                },
                            ],
                        },
                    ]}
                />

                {/* Outer Ring */}
                <LinearGradient
                    colors={[currentLevel.color, currentLevel.color, currentLevel.color]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.outerRing}
                >
                    <View style={styles.innerRing}>
                        {/* Rotating Indicator */}
                        <Animated.View
                            style={[
                                styles.indicator,
                                {
                                    transform: [
                                        {
                                            rotate: rotationAnim.interpolate({
                                                inputRange: [-60, 60],
                                                outputRange: ['-60deg', '60deg']
                                            })
                                        }
                                    ],
                                },
                            ]}
                        >
                            <View style={[styles.indicatorLine, { backgroundColor: currentLevel.color, shadowColor: currentLevel.color }]} />
                        </Animated.View>

                        {/* Center Circle */}
                        <View style={styles.centerCircle}>
                            <Text style={[styles.selectedLabel, { color: currentLevel.color }]}>
                                {currentLevel.label}
                            </Text>
                        </View>
                    </View>
                </LinearGradient>
            </View>

            {/* Labels */}
            <View style={styles.labelsContainer}>
                {INTENSITY_LEVELS.map((level, index) => (
                    <TouchableOpacity
                        key={level.id}
                        style={[
                            styles.labelButton,
                            index === 0 && styles.labelLeft,
                            index === 1 && styles.labelCenter,
                            index === 2 && styles.labelRight,
                        ]}
                        onPress={() => {
                            setSelectedIntensity(level.id);

                            // Trigger haptic feedback
                            if (level.haptic) {
                                Haptics.impactAsync(level.haptic);
                            }

                            Animated.spring(rotationAnim, {
                                toValue: level.angle,
                                useNativeDriver: true,
                                tension: 50,
                                friction: 7
                            }).start();
                        }}
                    >
                        <Text style={[
                            styles.labelText,
                            selectedIntensity === level.id && styles.labelTextActive,
                            { color: selectedIntensity === level.id ? level.color : '#94a3b8' }
                        ]}>
                            {level.label}
                        </Text>
                        <Text style={[
                            styles.labelSubtext,
                            selectedIntensity === level.id && styles.labelSubtextActive
                        ]}>
                            {level.subtitle}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Continue/Save Button */}
            <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
                <LinearGradient
                    colors={[currentLevel.color, currentLevel.color + 'CC']}
                    style={styles.continueGradient}
                >
                    <Text style={styles.continueText}>{mode === 'settings' ? 'Save' : 'Continue'}</Text>
                </LinearGradient>
            </TouchableOpacity>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 60,
        paddingHorizontal: 20,
    },
    header: {
        alignItems: 'center',
        marginTop: 40,
    },
    title: {
        fontSize: 28,
        fontWeight: '600',
        color: '#ffffff',
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    dialContainer: {
        width: 280,
        height: 280,
        alignItems: 'center',
        justifyContent: 'center',
    },
    glowRing: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 150,
        // backgroundColor and shadowColor are set dynamically
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 40,
    },
    outerRing: {
        width: 240,
        height: 240,
        borderRadius: 120,
        padding: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    innerRing: {
        width: '100%',
        height: '100%',
        borderRadius: 120,
        backgroundColor: '#1e293b',
        alignItems: 'center',
        justifyContent: 'center',
    },
    indicator: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        alignItems: 'center',
    },
    indicatorLine: {
        width: 4,
        height: 80,
        // backgroundColor and shadowColor are set dynamically
        borderRadius: 2,
        marginTop: 20,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 8,
    },
    centerCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#0f172a',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#334155',
    },
    selectedLabel: {
        fontSize: 18,
        fontWeight: '700',
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    labelsContainer: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    labelButton: {
        alignItems: 'center',
        flex: 1,
    },
    labelLeft: {
        alignItems: 'flex-start',
    },
    labelCenter: {
        alignItems: 'center',
    },
    labelRight: {
        alignItems: 'flex-end',
    },
    labelText: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    labelTextActive: {
        fontWeight: '700',
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    labelSubtext: {
        fontSize: 12,
        color: '#64748b',
    },
    labelSubtextActive: {
        color: '#94a3b8',
    },
    continueButton: {
        width: '90%',
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 20,
    },
    continueGradient: {
        paddingVertical: 18,
        alignItems: 'center',
    },
    continueText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#ffffff',
        letterSpacing: 0.5,
    },
});
