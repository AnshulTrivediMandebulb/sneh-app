/**
 * Reset Onboarding State
 * 
 * Run this to clear the intensity preference and see the dial screen again.
 * This will make the app show the IntensityDialScreen on next launch.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const resetOnboarding = async () => {
    try {
        await AsyncStorage.removeItem('intensityPreference');
        console.log('✅ Onboarding reset - dial screen will show on next app restart');
        alert('Onboarding reset! Please restart the app to see the intensity dial.');
    } catch (error) {
        console.error('Failed to reset onboarding:', error);
    }
};

export const checkOnboardingStatus = async () => {
    try {
        const intensityPref = await AsyncStorage.getItem('intensityPreference');
        console.log(`Current intensity preference: ${intensityPref || 'Not set'}`);
        return intensityPref;
    } catch (error) {
        console.error('Failed to check onboarding:', error);
        return null;
    }
};
