/**
 * Pastella Cryptographic Operations
 *
 * Implements Schnorr-style signatures matching pastella-core's algorithm
 * Based on CryptoNote format with Ed25519 curve operations
 */
import * as ed from '@noble/ed25519';
import { keccak256 } from 'js-sha3';
// ============================================================================
// SCALAR REDUCTION (Matches crypto-ops.c sc_reduce32)
// ============================================================================
/**
 * Ed25519 curve order (l)
 * l = 2^252 + 27742317777372353535851937790883648493
 */
const CURVE_ORDER = 0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3edn;
/**
 * Reduce a 64-byte array to a 32-byte scalar modulo the curve order
 * This matches the sc_reduce32 function from crypto-ops.c
 *
 * The algorithm takes a 64-byte input and reduces it modulo the curve order
 * to produce a canonical 32-byte scalar
 */
function scReduce32(input) {
    if (input.length !== 64) {
        throw new Error(`scReduce32 requires 64 bytes, got ${input.length}`);
    }
    // Convert to BigInt (little-endian)
    let num = 0n;
    for (let i = 0; i < 32; i++) {
        num |= BigInt(input[i]) << (BigInt(i) * 8n);
    }
    // Reduce modulo curve order
    const reduced = num % CURVE_ORDER;
    // Convert back to bytes (little-endian, 32 bytes)
    const result = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
        result[i] = Number((reduced >> (BigInt(i) * 8n)) & 0xffn);
    }
    return result;
}
/**
 * Reduce a 64-byte array to a 32-byte scalar
 * This matches the sc_reduce function from crypto-ops.c
 * Takes first 64 bytes and reduces them
 */
function scReduce(input) {
    if (input.length < 64) {
        // Pad with zeros if needed
        const padded = new Uint8Array(64);
        padded.set(input);
        return scReduce32(padded);
    }
    return scReduce32(input.subarray(0, 64));
}
/**
 * Hash data to a scalar using Keccak-256 and then reduce modulo curve order
 */
export function hashToScalar(data) {
    // Hash using Keccak-256 (cn_fast_hash uses Keccak)
    const hash = keccak256(data);
    const hashBytes = hexToBytes(hash);
    // Reduce to 32-byte scalar
    const result = new Uint8Array(64);
    result.set(hashBytes);
    result.set(hashBytes, 32); // Duplicate for 64-byte input
    return scReduce32(result);
}
/**
 * Generate a random scalar in [0, curve_order)
 * Matches random_scalar from crypto.cpp
 */
export function randomScalar() {
    // Generate 64 random bytes
    const randomBytes = new Uint8Array(64);
    crypto.getRandomValues(randomBytes);
    // Reduce to scalar
    return scReduce(randomBytes);
}
// ============================================================================
// SCHNORR SIGNATURE GENERATION
// ============================================================================
/**
 * Generate a Schnorr-style signature on Ed25519 curve
 *
 * @param prefixHash - Hash of transaction prefix (32 bytes)
 * @param publicKey - Public key as hex string (64 chars)
 * @param privateKey - Private key as hex string (64 chars)
 * @returns 64-byte signature (c || s)
 */
export function generateSchnorrSignature(prefixHash, publicKey, privateKey) {
    // Convert keys to bytes
    const publicKeyBytes = hexToBytes(publicKey);
    const privateKeyBytes = hexToBytes(privateKey);
    if (prefixHash.length !== 32) {
        throw new Error(`Prefix hash must be 32 bytes, got ${prefixHash.length}`);
    }
    if (publicKeyBytes.length !== 32) {
        throw new Error(`Public key must be 32 bytes, got ${publicKeyBytes.length}`);
    }
    if (privateKeyBytes.length !== 32) {
        throw new Error(`Private key must be 32 bytes, got ${privateKeyBytes.length}`);
    }
    // Generate random nonce k
    const k = randomScalar();
    // Compute commitment R = k*G
    const kBigInt = scalarToBigInt(k);
    const pointR = ed.Point.BASE.multiply(kBigInt);
    const comm = pointR.toRawBytes(); // 32 bytes
    // Create s_comm structure (h || key || comm)
    const sComm = new Uint8Array(96); // 32 + 32 + 32
    sComm.set(prefixHash, 0); // h
    sComm.set(publicKeyBytes, 32); // key
    sComm.set(comm, 64); // comm
    // Hash s_comm to get c (challenge)
    const c = hashToScalar(sComm);
    // Compute s = k - c*sec (scalar subtraction)
    const secBigInt = scalarToBigInt(privateKeyBytes);
    const cBigInt = scalarToBigInt(c);
    // s = k - (c * sec) mod curve_order
    const cTimesSec = (cBigInt * secBigInt) % CURVE_ORDER;
    let sBigInt = (kBigInt - cTimesSec) % CURVE_ORDER;
    if (sBigInt < 0n) {
        sBigInt += CURVE_ORDER;
    }
    const s = bigIntToScalar(sBigInt);
    // Signature is (c || s)
    const signature = new Uint8Array(64);
    signature.set(c, 0);
    signature.set(s, 32);
    return signature;
}
// ============================================================================
// SCHNORR SIGNATURE VERIFICATION
// ============================================================================
/**
 * Verify a Schnorr-style signature
 *
 * @param prefixHash - Hash of transaction prefix (32 bytes)
 * @param publicKey - Public key as hex string (64 chars)
 * @param signature - 64-byte signature
 * @returns true if signature is valid
 */
export function verifySchnorrSignature(prefixHash, publicKey, signature) {
    // Convert to bytes
    const publicKeyBytes = hexToBytes(publicKey);
    if (signature.length !== 64) {
        throw new Error(`Signature must be 64 bytes, got ${signature.length}`);
    }
    // Split signature into c and s
    const c = signature.subarray(0, 32);
    const s = signature.subarray(32, 64);
    // Compute s*G + c*pub
    const sBigInt = scalarToBigInt(s);
    const cBigInt = scalarToBigInt(c);
    const pointSG = ed.Point.BASE.multiply(sBigInt);
    const pointPub = ed.Point.fromHex(publicKey);
    const pointCPub = pointPub.multiply(cBigInt);
    const pointResult = pointSG.add(pointCPub);
    const comm = pointResult.toRawBytes();
    // Create s_comm structure
    const sComm = new Uint8Array(96);
    sComm.set(prefixHash, 0);
    sComm.set(publicKeyBytes, 32);
    sComm.set(comm, 64);
    // Hash to get expected c
    const expectedC = hashToScalar(sComm);
    // Check if c == expected_c
    for (let i = 0; i < 32; i++) {
        if (c[i] !== expectedC[i]) {
            return false;
        }
    }
    return true;
}
// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
/**
 * Convert hex string to bytes
 */
function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
}
/**
 * Convert bytes to hex string
 */
export function bytesToHex(bytes) {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
/**
 * Convert scalar bytes (little-endian) to BigInt
 */
function scalarToBigInt(scalar) {
    let num = 0n;
    for (let i = 0; i < 32; i++) {
        num |= BigInt(scalar[i]) << (BigInt(i) * 8n);
    }
    return num;
}
/**
 * Convert BigInt to scalar bytes (little-endian, 32 bytes)
 */
function bigIntToScalar(num) {
    const result = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
        result[i] = Number((num >> (BigInt(i) * 8n)) & 0xffn);
    }
    return result;
}
// ============================================================================
// KEY IMAGE GENERATION (Matches generate_key_image from crypto.cpp)
// ============================================================================
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
export function generateKeyImage(publicKey, privateKey) {
    // Convert keys to bytes
    const publicKeyBytes = hexToBytes(publicKey);
    const privateKeyBytes = hexToBytes(privateKey);
    if (publicKeyBytes.length !== 32) {
        throw new Error(`Public key must be 32 bytes, got ${publicKeyBytes.length}`);
    }
    if (privateKeyBytes.length !== 32) {
        throw new Error(`Private key must be 32 bytes, got ${privateKeyBytes.length}`);
    }
    // Hash the public key using Keccak-256
    const hash = keccak256(publicKeyBytes);
    const hashBytes = hexToBytes(hash);
    // Reduce hash to get a valid scalar
    const hashScalar = hashToScalar(hashBytes);
    // Interpret the scalar as an EC point (H(P))
    // In Ed25519, we multiply the base point by the hash scalar
    const hashScalarBigInt = scalarToBigInt(hashScalar);
    const pointHP = ed.Point.BASE.multiply(hashScalarBigInt);
    // Compute keyImage = x * H(P)
    const privateKeyBigInt = scalarToBigInt(privateKeyBytes);
    const keyImagePoint = pointHP.multiply(privateKeyBigInt);
    // Return key image as hex string
    return bytesToHex(keyImagePoint.toRawBytes());
}
// ============================================================================
// EXPORTS
// ============================================================================
export default {
    generateSchnorrSignature,
    verifySchnorrSignature,
    hashToScalar,
    randomScalar,
    bytesToHex,
    hexToBytes,
    generateKeyImage,
};
