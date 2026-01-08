import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Super simple test - just show text
export default function App() {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>✅ App Loading Test</Text>
            <Text style={styles.subtext}>If you see this, the app works!</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a2e',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
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
