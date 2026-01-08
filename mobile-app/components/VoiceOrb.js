import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function VoiceOrb({ state = 'idle', onPress, size = 200, isConnected = true }) {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;

    // Pulse Animation
    useEffect(() => {
        let toValue = 1;
        let duration = 2000;

        if (state === 'listening') {
            toValue = 1.2;
            duration = 600;
        } else if (state === 'speaking') {
            toValue = 1.15;
            duration = 1000;
        }

        Animated.loop(
            Animated.sequence([
                Animated.timing(scaleAnim, {
                    toValue: toValue,
                    duration: duration,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 1,
                    duration: duration,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [state]);

    // Rotation Animation
    useEffect(() => {
        Animated.loop(
            Animated.timing(rotateAnim, {
                toValue: 1,
                duration: 10000,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    const getColors = () => {
        if (!isConnected) {
            return ['#bdc3c7', '#7f8c8d', '#2c3e50'];
        }
        switch (state) {
            case 'listening':
                return ['#ff6b6b', '#f06595', '#c44569'];
            case 'speaking':
                return ['#4facfe', '#00f2fe', '#43e97b'];
            default:
                return ['#a78bfa', '#8b5cf6', '#6366f1'];
        }
    };

    const rotation = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.9}
            style={styles.container}
        >
            <Animated.View
                style={[
                    styles.orbWrapper,
                    {
                        width: size,
                        height: size,
                        transform: [
                            { scale: scaleAnim },
                            { rotate: rotation },
                            // Slight squash / stretch to feel more organic
                            { scaleX: 1.08 },
                            { scaleY: 0.96 },
                        ]
                    }
                ]}
            >
                {/* Outer Glow Layer */}
                <View style={[styles.outerGlow, {
                    width: size * 1.4,
                    height: size * 1.4,
                    borderRadius: size * 0.7,
                    backgroundColor: getColors()[1],
                }]} />

                {/* Inner Glow */}
                <View style={[styles.glow, {
                    backgroundColor: getColors()[1],
                    width: size * 0.9,
                    height: size * 0.9,
                    borderRadius: size / 2
                }]} />

                {/* Main Orb */}
                <LinearGradient
                    colors={getColors()}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                        styles.orb,
                        {
                            width: size,
                            height: size * 0.98,
                            borderRadius: size / 1.9,
                        }
                    ]}
                >
                    {/* Inner blob layers to mimic 3D blobby shape */}
                    <LinearGradient
                        colors={['rgba(236, 252, 255, 0.9)', 'rgba(196, 181, 253, 0.3)', 'transparent']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0.8, y: 0.9 }}
                        style={[styles.blob, { top: -size * 0.05, left: -size * 0.02 }]}
                    />
                    <LinearGradient
                        colors={['rgba(56, 189, 248, 0.3)', 'rgba(129, 140, 248, 0.1)', 'transparent']}
                        start={{ x: 0.2, y: 0.2 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.blob, { bottom: -size * 0.1, right: -size * 0.08 }]}
                    />

                    {/* Specular Highlight (top-left) */}
                    <LinearGradient
                        colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.2)', 'rgba(255,255,255,0)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0.7, y: 0.7 }}
                        style={styles.highlight}
                    />

                    {/* Shadow (bottom-right) */}
                    <LinearGradient
                        colors={['rgba(0,0,0,0)', 'rgba(15,23,42,0.35)', 'rgba(15,23,42,0.7)']}
                        start={{ x: 0.3, y: 0.3 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.shadow}
                    />

                    {/* Rim Light */}
                    <View style={styles.rimLight}>
                        <LinearGradient
                            colors={['transparent', 'rgba(236, 252, 255,0.45)']}
                            start={{ x: 0.5, y: 0 }}
                            end={{ x: 0.5, y: 1 }}
                            style={StyleSheet.absoluteFill}
                        />
                    </View>
                </LinearGradient>
            </Animated.View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 50,
    },
    orbWrapper: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    orb: {
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.6,
        shadowRadius: 30,
        elevation: 30,
    },
    outerGlow: {
        position: 'absolute',
        opacity: 0.15,
        shadowColor: "#8b5cf6",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 60,
        elevation: 5,
    },
    glow: {
        position: 'absolute',
        opacity: 0.35,
        shadowColor: "#fff",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 40,
        elevation: 20,
    },
    blob: {
        position: 'absolute',
        width: '75%',
        height: '75%',
        borderRadius: 999,
        opacity: 0.9,
    },
    highlight: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '70%',
        height: '70%',
        borderRadius: 1000,
        opacity: 0.6,
    },
    shadow: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: 1000,
    },
    rimLight: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: 1000,
        opacity: 0.3,
    }
});
