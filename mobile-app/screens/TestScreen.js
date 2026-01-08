import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function SimpleTestScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>✅ Navigation Works!</Text>
            <Text style={styles.subtext}>This is a test screen</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a2e',
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 16,
    },
    subtext: {
        fontSize: 16,
        color: '#888',
    },
});
