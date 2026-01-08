import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Settings, Zap, Info } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

const INTENSITY_INFO = {
    gentle: {
        label: 'Gentle',
        subtitle: 'Support only',
        description: 'I\'ll be supportive and encouraging, focusing on positive reinforcement.',
        color: '#4ade80',
    },
    real: {
        label: 'Real',
        subtitle: 'Nudge me',
        description: 'I\'ll give you honest feedback and gentle nudges when needed.',
        color: '#fbbf24',
    },
    ruthless: {
        label: 'Ruthless',
        subtitle: 'Call me out',
        description: 'I\'ll be direct and call you out when you need it. No sugar coating.',
        color: '#f87171',
    },
};

export default function SettingsScreen() {
    const [currentIntensity, setCurrentIntensity] = useState('real');
    const navigation = useNavigation();

    useEffect(() => {
        loadIntensity();
    }, []);

    // Reload intensity when screen comes into focus
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            loadIntensity();
        });
        return unsubscribe;
    }, [navigation]);

    const loadIntensity = async () => {
        try {
            const intensity = await AsyncStorage.getItem('intensityPreference');
            if (intensity) {
                setCurrentIntensity(intensity);
            }
        } catch (error) {
            console.error('Failed to load intensity preference:', error);
        }
    };

    const handleChangeIntensity = () => {
        navigation.navigate('ChangeIntensity');
    };

    const intensityData = INTENSITY_INFO[currentIntensity];

    return (
        <LinearGradient
            colors={['#0f172a', '#1e1b4b', '#000000']}
            style={styles.container}
        >
            <SafeAreaProvider>
                <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Settings size={28} color="#fff" strokeWidth={2} />
                        <Text style={styles.headerTitle}>Settings</Text>
                    </View>

                    <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                        {/* Current Intensity Section */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Zap size={20} color="#fb923c" strokeWidth={2} />
                                <Text style={styles.sectionTitle}>AI Intensity</Text>
                            </View>

                            <LinearGradient
                                colors={['rgba(251, 146, 60, 0.1)', 'rgba(251, 146, 60, 0.05)']}
                                style={styles.intensityCard}
                            >
                                <View style={styles.intensityHeader}>
                                    <View>
                                        <Text style={[styles.intensityLabel, { color: intensityData.color }]}>
                                            {intensityData.label}
                                        </Text>
                                        <Text style={styles.intensitySubtitle}>{intensityData.subtitle}</Text>
                                    </View>
                                    <View style={[styles.intensityIndicator, { backgroundColor: intensityData.color }]} />
                                </View>

                                <Text style={styles.intensityDescription}>{intensityData.description}</Text>

                                <TouchableOpacity style={styles.changeButton} onPress={handleChangeIntensity}>
                                    <LinearGradient
                                        colors={[intensityData.color, intensityData.color + 'CC']}
                                        style={styles.changeButtonGradient}
                                    >
                                        <Text style={styles.changeButtonText}>Change Intensity</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </LinearGradient>
                        </View>

                        {/* App Info Section */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Info size={20} color="#fb923c" strokeWidth={2} />
                                <Text style={styles.sectionTitle}>About</Text>
                            </View>

                            <View style={styles.infoCard}>
                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>App Name</Text>
                                    <Text style={styles.infoValue}>Sneh</Text>
                                </View>
                                <View style={styles.divider} />
                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Version</Text>
                                    <Text style={styles.infoValue}>1.0.0</Text>
                                </View>
                            </View>
                        </View>

                        {/* Info Note */}
                        <View style={styles.noteContainer}>
                            <Text style={styles.noteText}>
                                Your intensity preference affects how Sneh responds to you across all conversations.
                            </Text>
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </SafeAreaProvider>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
        marginLeft: 12,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 20,
    },
    section: {
        marginBottom: 32,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginLeft: 8,
    },
    intensityCard: {
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(251, 146, 60, 0.3)',
    },
    intensityHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    intensityLabel: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 4,
    },
    intensitySubtitle: {
        fontSize: 14,
        color: '#94a3b8',
    },
    intensityIndicator: {
        width: 16,
        height: 16,
        borderRadius: 8,
        shadowColor: '#fb923c',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 8,
    },
    intensityDescription: {
        fontSize: 14,
        color: '#cbd5e1',
        lineHeight: 20,
        marginBottom: 16,
    },
    changeButton: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    changeButtonGradient: {
        paddingVertical: 14,
        alignItems: 'center',
    },
    changeButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    infoCard: {
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    infoLabel: {
        fontSize: 14,
        color: '#94a3b8',
    },
    infoValue: {
        fontSize: 14,
        color: '#fff',
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginVertical: 4,
    },
    noteContainer: {
        backgroundColor: 'rgba(251, 146, 60, 0.1)',
        borderRadius: 12,
        padding: 16,
        borderLeftWidth: 3,
        borderLeftColor: '#fb923c',
    },
    noteText: {
        fontSize: 13,
        color: '#cbd5e1',
        lineHeight: 18,
    },
});
