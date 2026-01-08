import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Extract user's name from conversation history
 * Looks for patterns like "I'm [Name]", "My name is [Name]", "call me [Name]"
 */
export async function extractAndSaveName(messages) {
    try {
        // [NEW] Check if name is already set. If so, don't try to extract again.
        // This makes it feel more natural and prevents "I am good" from overriding your name.
        const existingName = await AsyncStorage.getItem('userName');
        if (existingName && existingName !== 'null' && existingName !== '') {
            return existingName;
        }

        // Patterns to look for (case insensitive)
        const patterns = [
            /(?:my name is|i'm|i am|call me)\s+([A-Z][a-z]+)/i,
            /(?:this is|it's)\s+([A-Z][a-z]+)(?:\s+speaking)?/i,
        ];

        // Search through user messages
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            if (msg.sender === 'user') {
                for (const pattern of patterns) {
                    const match = msg.text.match(pattern);
                    if (match && match[1]) {
                        const name = match[1].trim();

                        // [NEW] Blacklist of common words that aren't names
                        const blacklist = ['Good', 'Fine', 'Okay', 'Sad', 'Happy', 'Great', 'Bad', 'Tired', 'Okay', 'Ok', 'Not', 'Well', 'Busy'];
                        if (blacklist.includes(name.charAt(0).toUpperCase() + name.slice(1).toLowerCase())) {
                            continue;
                        }

                        const existingName = await AsyncStorage.getItem('userName');

                        // Update name if different
                        if (existingName !== name) {
                            await AsyncStorage.setItem('userName', name);
                            console.log(`[NameExtractor] Updated user name: ${name}`);
                        }
                        return name;
                    }
                }
            }
        }

        // Return existing name if no new name found
        return await AsyncStorage.getItem('userName');
    } catch (error) {
        console.error('[NameExtractor] Error:', error);
        return null;
    }
}

/**
 * Get saved user name
 */
export async function getUserName() {
    try {
        return await AsyncStorage.getItem('userName');
    } catch (error) {
        console.error('[NameExtractor] Error getting name:', error);
        return null;
    }
}

/**
 * Clear saved user name (for testing)
 */
export async function clearUserName() {
    try {
        await AsyncStorage.removeItem('userName');
    } catch (error) {
        console.error('[NameExtractor] Error clearing name:', error);
    }
}

/**
 * Generate personalized greeting based on time of day
 */
export function getTimeBasedGreeting(name = null) {
    const hour = new Date().getHours();
    let timeOfDay;

    if (hour < 12) {
        timeOfDay = 'morning';
    } else if (hour < 18) {
        timeOfDay = 'afternoon';
    } else {
        timeOfDay = 'evening';
    }

    const greetings = {
        morning: name ? `Good morning, ${name}.` : 'Good morning.',
        afternoon: name ? `Good afternoon, ${name}.` : 'Good afternoon.',
        evening: name ? `Good evening, ${name}.` : 'Good evening.',
    };

    return greetings[timeOfDay];
}
