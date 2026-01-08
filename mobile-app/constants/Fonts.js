/**
 * iOS-style Font Configuration
 * Uses Helvetica Neue font (iPhone default)
 */

export const Fonts = {
    // Helvetica Neue (iOS default font)
    regular: {
        fontFamily: 'Helvetica Neue',
        fontWeight: '400',
    },
    medium: {
        fontFamily: 'Helvetica Neue',
        fontWeight: '500',
    },
    semibold: {
        fontFamily: 'Helvetica Neue',
        fontWeight: '600',
    },
    bold: {
        fontFamily: 'Helvetica Neue',
        fontWeight: '700',
    },
    heavy: {
        fontFamily: 'Helvetica Neue',
        fontWeight: '800',
    },
    black: {
        fontFamily: 'Helvetica Neue',
        fontWeight: '900',
    },
};

// Text styles matching iOS design
export const TextStyles = {
    // Large Title (iOS 11+)
    largeTitle: {
        ...Fonts.bold,
        fontSize: 34,
        lineHeight: 41,
        letterSpacing: 0.37,
    },

    // Title 1
    title1: {
        ...Fonts.bold,
        fontSize: 28,
        lineHeight: 34,
        letterSpacing: 0.36,
    },

    // Title 2
    title2: {
        ...Fonts.bold,
        fontSize: 22,
        lineHeight: 28,
        letterSpacing: 0.35,
    },

    // Title 3
    title3: {
        ...Fonts.semibold,
        fontSize: 20,
        lineHeight: 25,
        letterSpacing: 0.38,
    },

    // Headline
    headline: {
        ...Fonts.semibold,
        fontSize: 17,
        lineHeight: 22,
        letterSpacing: -0.41,
    },

    // Body
    body: {
        ...Fonts.regular,
        fontSize: 17,
        lineHeight: 22,
        letterSpacing: -0.41,
    },

    // Callout
    callout: {
        ...Fonts.regular,
        fontSize: 16,
        lineHeight: 21,
        letterSpacing: -0.32,
    },

    // Subheadline
    subheadline: {
        ...Fonts.regular,
        fontSize: 15,
        lineHeight: 20,
        letterSpacing: -0.24,
    },
    // Base
    base: {
        ...Fonts.regular,
        fontSize: 14,
        lineHeight: 19,
        letterSpacing: -0.15
    },

    // Footnote
    footnote: {
        ...Fonts.regular,
        fontSize: 13,
        lineHeight: 18,
        letterSpacing: -0.08,
    },

    // Caption 1
    caption1: {
        ...Fonts.regular,
        fontSize: 12,
        lineHeight: 16,
        letterSpacing: 0,
    },

    // Caption 2
    caption2: {
        ...Fonts.regular,
        fontSize: 11,
        lineHeight: 13,
        letterSpacing: 0.07,
    },
};
