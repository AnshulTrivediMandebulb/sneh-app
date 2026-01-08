import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X } from 'lucide-react-native';

// Simplified version without gesture handler/reanimated
// Just shows the levels, no interactive dial for now

export default function HonestySlider({ visible, onClose }) {
    const [selectedLevel, setSelectedLevel] = useState(1); // 0: Gentle, 1: Real, 2: Ruthless

    const LEVELS = [
        { id: 0, name: 'Gentle', color: '#27ae60', emoji: '🌱' },
        { id: 1, name: 'Real', color: '#f39c12', emoji: '⚖️' },
        { id: 2, name: 'Ruthless', color: '#e74c3c', emoji: '🔥' },
    ];

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <LinearGradient
                colors={['#c0392b', '#e74c3c', '#f39c12']}
                style={styles.modalBackground}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.modalContent}>
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <X size={28} color="#fff" />
                    </TouchableOpacity>

                    <Text style={styles.title}>How honest do you{'\n'}want me to be?</Text>

                    <View style={styles.levelsContainer}>
                        {LEVELS.map((level) => (
                            <TouchableOpacity
                                key={level.id}
                                style={[
                                    styles.levelCard,
                                    selectedLevel === level.id && styles.selectedLevel,
                                ]}
                                onPress={() => setSelectedLevel(level.id)}
                            >
                                <Text style={styles.emoji}>{level.emoji}</Text>
                                <Text style={styles.levelName}>{level.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.hint}>Tap to select your preferred honesty level</Text>
                </View>
            </LinearGradient>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalBackground: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        alignItems: 'center',
        paddingHorizontal: 20,
        width: '100%',
    },
    closeButton: {
        position: 'absolute',
        top: -180,
        right: 20,
        zIndex: 10,
        padding: 12,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 30,
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 60,
        lineHeight: 42,
    },
    levelsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        paddingHorizontal: 20,
    },
    levelCard: {
        width: 100,
        height: 120,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    selectedLevel: {
        backgroundColor: 'rgba(255,255,255,0.4)',
        borderColor: '#fff',
        transform: [{ scale: 1.1 }],
    },
    emoji: {
        fontSize: 48,
        marginBottom: 12,
    },
    levelName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    hint: {
        marginTop: 40,
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
    },
});
