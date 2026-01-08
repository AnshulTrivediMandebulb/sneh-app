import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getCurrentIP, setBackendIP, retryConnection } from '../services/api';
import { RefreshCw, Check, X } from 'lucide-react-native';

export default function ConnectionSettings({ visible, onClose }) {
    const [currentIP, setCurrentIP] = useState('');
    const [manualIP, setManualIP] = useState('');
    const [isDiscovering, setIsDiscovering] = useState(false);
    const [testResult, setTestResult] = useState(null);

    useEffect(() => {
        if (visible) {
            const ip = getCurrentIP();
            setCurrentIP(ip);
            setManualIP(ip);
        }
    }, [visible]);

    const handleAutoDiscover = async () => {
        setIsDiscovering(true);
        setTestResult(null);

        try {
            const result = await retryConnection();

            if (result.success) {
                setCurrentIP(result.ip);
                setManualIP(result.ip);
                setTestResult({ success: true, message: `Found backend at ${result.ip}` });
            } else {
                setTestResult({ success: false, message: 'Auto-discovery failed. Try manual IP.' });
            }
        } catch (error) {
            setTestResult({ success: false, message: 'Discovery error: ' + error.message });
        } finally {
            setIsDiscovering(false);
        }
    };

    const handleManualSet = () => {
        if (!manualIP.trim()) {
            Alert.alert('Error', 'Please enter an IP address');
            return;
        }

        // Basic IP validation
        const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipPattern.test(manualIP.trim())) {
            Alert.alert('Error', 'Please enter a valid IP address (e.g., 192.168.1.100)');
            return;
        }

        setBackendIP(manualIP.trim());
        setCurrentIP(manualIP.trim());
        setTestResult({ success: true, message: `Backend IP set to ${manualIP.trim()}` });

        Alert.alert(
            'IP Updated',
            `Backend IP has been set to ${manualIP.trim()}. Please restart the app for changes to take effect.`,
            [{ text: 'OK', onPress: onClose }]
        );
    };

    if (!visible) return null;

    return (
        <View style={styles.overlay}>
            <LinearGradient
                colors={['#1a1a2e', '#16213e', '#0f1419']}
                style={styles.container}
            >
                <Text style={styles.title}>Connection Settings</Text>

                <View style={styles.section}>
                    <Text style={styles.label}>Current Backend IP:</Text>
                    <Text style={styles.currentIP}>{currentIP}</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>Auto-Discover Backend:</Text>
                    <TouchableOpacity
                        style={styles.discoverButton}
                        onPress={handleAutoDiscover}
                        disabled={isDiscovering}
                    >
                        {isDiscovering ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <RefreshCw size={20} color="#fff" />
                                <Text style={styles.buttonText}>Discover</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>Manual IP Address:</Text>
                    <TextInput
                        style={styles.input}
                        value={manualIP}
                        onChangeText={setManualIP}
                        placeholder="192.168.1.100"
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        keyboardType="numeric"
                    />
                    <TouchableOpacity
                        style={styles.setButton}
                        onPress={handleManualSet}
                    >
                        <Check size={20} color="#fff" />
                        <Text style={styles.buttonText}>Set IP</Text>
                    </TouchableOpacity>
                </View>

                {testResult && (
                    <View style={[
                        styles.resultBox,
                        { backgroundColor: testResult.success ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)' }
                    ]}>
                        {testResult.success ? (
                            <Check size={16} color="#22c55e" />
                        ) : (
                            <X size={16} color="#ef4444" />
                        )}
                        <Text style={[
                            styles.resultText,
                            { color: testResult.success ? '#22c55e' : '#ef4444' }
                        ]}>
                            {testResult.message}
                        </Text>
                    </View>
                )}

                <TouchableOpacity
                    style={styles.closeButton}
                    onPress={onClose}
                >
                    <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>

                <Text style={styles.hint}>
                    💡 Tip: Your backend shows the IP address when it starts. Look for "📡 Local Network IP" in the console.
                </Text>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    container: {
        width: '90%',
        maxWidth: 400,
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.3)',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 24,
        textAlign: 'center',
    },
    section: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 8,
    },
    currentIP: {
        fontSize: 18,
        color: '#a855f7',
        fontWeight: '600',
        padding: 12,
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(168, 85, 247, 0.3)',
    },
    input: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        borderRadius: 8,
        padding: 12,
        color: '#fff',
        fontSize: 16,
        marginBottom: 12,
    },
    discoverButton: {
        backgroundColor: '#3b82f6',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        gap: 8,
    },
    setButton: {
        backgroundColor: '#22c55e',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        gap: 8,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    resultBox: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        marginBottom: 20,
        gap: 8,
    },
    resultText: {
        fontSize: 14,
        flex: 1,
    },
    closeButton: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 12,
    },
    closeButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    hint: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        textAlign: 'center',
        fontStyle: 'italic',
    },
});
