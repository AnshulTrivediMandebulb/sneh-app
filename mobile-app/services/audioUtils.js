import { Buffer } from 'buffer';

/**
 * Creates a WAV header for PCM data.
 * @param {number} dataLength - Length of the PCM data in bytes.
 * @param {number} sampleRate - Sample rate (e.g., 24000).
 * @param {number} numChannels - Number of channels (e.g., 1 for mono).
 * @param {number} bitsPerSample - Bits per sample (e.g., 16).
 * @returns {string} - Base64 encoded WAV header.
 */
export const createWavHeader = (dataLength, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) => {
    const header = Buffer.alloc(44);

    // RIFF identifier
    header.write('RIFF', 0);
    // File length
    header.writeUInt32LE(36 + dataLength, 4);
    // RIFF type
    header.write('WAVE', 8);
    // Format chunk identifier
    header.write('fmt ', 12);
    // Format chunk length
    header.writeUInt32LE(16, 16);
    // Sample format (1 is PCM)
    header.writeUInt16LE(1, 20);
    // Channels
    header.writeUInt16LE(numChannels, 22);
    // Sample rate
    header.writeUInt32LE(sampleRate, 24);
    // Byte rate (SampleRate * NumChannels * BitsPerSample/8)
    header.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
    // Block align (NumChannels * BitsPerSample/8)
    header.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
    // Bits per sample
    header.writeUInt16LE(bitsPerSample, 34);
    // Data chunk identifier
    header.write('data', 36);
    // Data chunk length
    header.writeUInt32LE(dataLength, 40);

    return header;
};

/**
 * Simple queue to manage audio playback sequentially.
 */
export class AudioQueue {
    constructor() {
        this.queue = [];
        this.isPlaying = false;
    }

    enqueue(task) {
        this.queue.push(task);
        this.process();
    }

    async process() {
        if (this.isPlaying || this.queue.length === 0) return;

        this.isPlaying = true;
        const task = this.queue.shift();

        try {
            await task();
        } catch (error) {
            console.error('AudioQueue Error:', error);
        } finally {
            this.isPlaying = false;
            this.process();
        }
    }

    clear() {
        this.queue = [];
        this.isPlaying = false;
    }
}
