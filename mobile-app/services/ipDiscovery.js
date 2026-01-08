import * as Network from 'expo-network';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_PORT = 3000;
const DISCOVERY_TIMEOUT = 1000; // 1 second per IP attempt (reduced for faster startup)
const CACHED_IP_KEY = 'sneh_backend_ip'; // AsyncStorage key for persistent caching

/**
 * Get the device's local IP address
 */
export const getDeviceIP = async () => {
    try {
        const ip = await Network.getIpAddressAsync();
        console.log(`📱 Device IP: ${ip}`);
        return ip;
    } catch (error) {
        console.error('Failed to get device IP:', error);
        return null;
    }
};

/**
 * Generate possible backend IPs based on device IP
 * For example, if device is 192.168.29.100, we'll try 192.168.29.1-255
 */
const generatePossibleIPs = (deviceIP) => {
    if (!deviceIP) return [];

    const parts = deviceIP.split('.');
    if (parts.length !== 4) return [];

    const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;

    // Common router/server IPs to try first
    const priorityIPs = [
        `${subnet}.236`, // Current backend IP
        `${subnet}.223`, // Previous IP
        `${subnet}.1`,   // Common router IP
        `${subnet}.100`, // Common static IP
        `${subnet}.254`, // Another common router IP
        deviceIP,        // Try device's own IP (in case backend is on same device)
    ];

    // Then try all IPs in the subnet (but we'll limit this in practice)
    const allIPs = [];
    for (let i = 1; i <= 255; i++) {
        const ip = `${subnet}.${i}`;
        if (!priorityIPs.includes(ip)) {
            allIPs.push(ip);
        }
    }

    return [...priorityIPs, ...allIPs];
};

/**
 * Test if a specific IP has the backend running
 */
const testBackendIP = async (ip) => {
    try {
        const url = `http://${ip}:${BACKEND_PORT}/health`;
        const response = await axios.get(url, {
            timeout: DISCOVERY_TIMEOUT,
            validateStatus: (status) => status === 200
        });

        if (response.data && response.data.status === 'ok') {
            console.log(`✅ Found backend at ${ip}`);
            return true;
        }
        return false;
    } catch (error) {
        // Silently fail - this is expected for most IPs
        return false;
    }
};

/**
 * Discover the backend IP automatically
 * Returns the IP address if found, null otherwise
 */
export const discoverBackendIP = async () => {
    console.log('🔍 Starting backend IP discovery...');

    try {
        // Get device IP
        const deviceIP = await getDeviceIP();
        if (!deviceIP) {
            console.log('❌ Could not get device IP');
            return null;
        }

        // Generate possible IPs
        const possibleIPs = generatePossibleIPs(deviceIP);

        // Test priority IPs in parallel (first 6 for speed)
        const priorityIPs = possibleIPs.slice(0, 6);
        console.log(`🔎 Testing ${priorityIPs.length} priority IPs in parallel: ${priorityIPs.join(', ')}`);

        // Test all priority IPs simultaneously
        const results = await Promise.allSettled(
            priorityIPs.map(async (ip) => {
                const found = await testBackendIP(ip);
                return { ip, found };
            })
        );

        // Find the first successful result
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value.found) {
                console.log(`✅ Discovery successful: ${result.value.ip}`);
                return result.value.ip;
            }
        }

        console.log('❌ Backend not found in priority IPs');
        return null;

    } catch (error) {
        console.error('Discovery error:', error);
        return null;
    }
};

/**
 * Get backend IP with caching
 * First tries cached IP, then falls back to discovery
 */
let cachedIP = null;
let isLoadingFromStorage = false;

export const getBackendIP = async (forceRediscover = false) => {
    // Load from AsyncStorage on first call
    if (!cachedIP && !isLoadingFromStorage) {
        isLoadingFromStorage = true;
        try {
            const storedIP = await AsyncStorage.getItem(CACHED_IP_KEY);
            if (storedIP) {
                cachedIP = storedIP;
                console.log(`💾 Loaded cached IP from storage: ${cachedIP}`);
            }
        } catch (error) {
            console.error('Failed to load cached IP from storage:', error);
        }
        isLoadingFromStorage = false;
    }

    // If we have a cached IP and not forcing rediscovery, use it immediately
    if (cachedIP && !forceRediscover) {
        console.log(`⚡ Using cached IP immediately: ${cachedIP}`);

        // Validate in background (non-blocking)
        testBackendIP(cachedIP).then(stillValid => {
            if (!stillValid) {
                console.log(`⚠️ Cached IP ${cachedIP} no longer valid, will rediscover on next call`);
                cachedIP = null;
                AsyncStorage.removeItem(CACHED_IP_KEY).catch(e =>
                    console.error('Failed to remove invalid IP from storage:', e)
                );
            }
        });

        return cachedIP;
    }

    // Discover new IP
    const discoveredIP = await discoverBackendIP();
    if (discoveredIP) {
        cachedIP = discoveredIP;

        // Save to AsyncStorage for future app launches
        try {
            await AsyncStorage.setItem(CACHED_IP_KEY, discoveredIP);
            console.log(`💾 Saved discovered IP to storage: ${discoveredIP}`);
        } catch (error) {
            console.error('Failed to save IP to storage:', error);
        }

        return discoveredIP;
    }

    return null;
};

/**
 * Clear cached IP (useful for manual refresh)
 */
export const clearCachedIP = async () => {
    cachedIP = null;
    try {
        await AsyncStorage.removeItem(CACHED_IP_KEY);
        console.log('🗑️ Cleared cached IP from memory and storage');
    } catch (error) {
        console.error('Failed to clear cached IP from storage:', error);
    }
};
