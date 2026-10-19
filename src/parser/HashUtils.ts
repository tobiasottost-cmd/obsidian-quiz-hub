/**
 * Mobile-safe hashing and ID utilities.
 * Conforms to mobile_desktop_compatibility_requirements.md:
 * - NO imports from Node.js 'crypto' or 'buffer'.
 * - Pure TypeScript MurmurHash3 / FNV-1a deterministic hash implementation.
 * - Web Crypto API for random UUID generation.
 */

/**
 * Computes a fast, deterministic 32-bit hex hash string from input text.
 * Suitable for question IDs when no explicit ID or block-id is present.
 */
export function computeContentHash(input: string): string {
    const normalized = input.trim().replace(/\r\n/g, '\n');
    let hash = 0x811c9dc5; // FNV-1a 32-bit offset basis
    for (let i = 0; i < normalized.length; i++) {
        hash ^= normalized.charCodeAt(i);
        // Multiply by FNV prime 16777619 (32-bit bitwise multiplication)
        hash = Math.imul(hash, 0x01000193);
    }
    // Return unsigned 32-bit integer as hex string
    return 'q-' + (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Generates a stable random UUID for choice items during exam construction.
 * Uses window.crypto or fallback if not available.
 */
export function generateUUID(): string {
    if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }
    // Fallback RFC4122 v4 UUID generator without Node crypto
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
