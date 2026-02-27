/**
 * Pastella Cryptographic Operations
 *
 * Implements Schnorr-style signatures matching pastella-core's algorithm
 * Based on CryptoNote format with Ed25519 curve operations
 */
/**
 * Hash data to a scalar using Keccak-256 and then reduce modulo curve order
 */
export declare function hashToScalar(data: Uint8Array): Uint8Array;
/**
 * Generate a random scalar in [0, curve_order)
 * Matches random_scalar from crypto.cpp
 */
export declare function randomScalar(): Uint8Array;
/**
 * Generate a Schnorr-style signature on Ed25519 curve
 *
 * @param prefixHash - Hash of transaction prefix (32 bytes)
 * @param publicKey - Public key as hex string (64 chars)
 * @param privateKey - Private key as hex string (64 chars)
 * @returns 64-byte signature (c || s)
 */
export declare function generateSchnorrSignature(prefixHash: Uint8Array, publicKey: string, privateKey: string): Uint8Array;
/**
 * Verify a Schnorr-style signature
 *
 * @param prefixHash - Hash of transaction prefix (32 bytes)
 * @param publicKey - Public key as hex string (64 chars)
 * @param signature - 64-byte signature
 * @returns true if signature is valid
 */
export declare function verifySchnorrSignature(prefixHash: Uint8Array, publicKey: string, signature: Uint8Array): boolean;
/**
 * Convert hex string to bytes
 */
declare function hexToBytes(hex: string): Uint8Array;
/**
 * Convert bytes to hex string
 */
export declare function bytesToHex(bytes: Uint8Array): string;
/**
 * Generate a key image for an output
 *
 * The key image is computed as: keyImage = x * H(P)
 * where:
 *   - x is the private spend key
 *   - H(P) is the hash of the public key interpreted as an EC point
 *   - * is elliptic curve scalar multiplication
 *
 * This prevents double-spending because each output can only be spent once
 * with a unique key image derived from the output's public key.
 *
 * @param publicKey - The output's public key as hex string (64 chars)
 * @param privateKey - The private spend key as hex string (64 chars)
 * @returns 32-byte key image as hex string
 */
export declare function generateKeyImage(publicKey: string, privateKey: string): string;
declare const _default: {
    generateSchnorrSignature: typeof generateSchnorrSignature;
    verifySchnorrSignature: typeof verifySchnorrSignature;
    hashToScalar: typeof hashToScalar;
    randomScalar: typeof randomScalar;
    bytesToHex: typeof bytesToHex;
    hexToBytes: typeof hexToBytes;
    generateKeyImage: typeof generateKeyImage;
};
export default _default;
//# sourceMappingURL=crypto.d.ts.map