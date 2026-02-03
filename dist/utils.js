/**
 * Pastella Wallet Utilities
 *
 * Helper functions for wallet operations
 */
// ============================================================================
// CRYPTO UTILITIES
// ============================================================================
/**
 * Convert hex string to byte array
 */
export function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
}
/**
 * Convert byte array to hex string
 */
export function bytesToHex(bytes) {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
/**
 * Convert byte array to base64
 */
export function bytesToBase64(bytes) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}
/**
 * Convert base64 to byte array
 */
export function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}
// ============================================================================
// AMOUNT UTILITIES
// ============================================================================
/**
 * Convert atomic units to floating point
 * Pastella uses different decimal places depending on configuration
 * Default is 2 decimal places (100 atomic units = 1 PAS)
 */
export function atomicToFloat(amount, decimals = 2) {
    return amount / Math.pow(10, decimals);
}
/**
 * Convert floating point to atomic units
 */
export function floatToAtomic(amount, decimals = 2) {
    return Math.floor(amount * Math.pow(10, decimals));
}
/**
 * Format amount for display
 */
export function formatAmount(amount, decimals = 2) {
    return atomicToFloat(amount, decimals).toFixed(decimals);
}
// ============================================================================
// ADDRESS UTILITIES
// ============================================================================
/**
 * Validate Pastella address format
 */
export function validateAddress(address) {
    // Pastella addresses start with 'N' or 'P' and are Base58 encoded
    // Typical length is 98-99 characters for standard addresses
    if (!address)
        return false;
    // Check prefix
    if (!address.match(/^[NP]/)) {
        return false;
    }
    // Check length (approximately 98-99 characters for Base58)
    if (address.length < 90 || address.length > 110) {
        return false;
    }
    // Check for valid Base58 characters
    if (!address.match(/^[1-9A-HJ-NP-Za-km-z]+$/)) {
        return false;
    }
    return true;
}
/**
 * Extract payment ID from integrated address
 */
export function extractPaymentId(integratedAddress) {
    // Integrated addresses contain payment ID
    // Implementation depends on address format
    return null;
}
// ============================================================================
// MNEMONIC UTILITIES
// ============================================================================
/**
 * Validate mnemonic phrase
 */
export function validateMnemonic(mnemonic) {
    const words = mnemonic.trim().split(/\s+/);
    // Pastella uses 25-word mnemonics (24 words + checksum)
    if (words.length !== 25) {
        return false;
    }
    // Check if all words are valid (would need wordlist)
    return true;
}
/**
 * Split mnemonic into array
 */
export function splitMnemonic(mnemonic) {
    return mnemonic.trim().split(/\s+/);
}
/**
 * Join mnemonic array into string
 */
export function joinMnemonic(words) {
    return words.join(' ');
}
// ============================================================================
// TRANSACTION UTILITIES
// ============================================================================
/**
 * Calculate transaction ID from hash
 */
export function getTransactionId(hash) {
    // In Pastella, transaction ID is typically the hash
    return hash;
}
/**
 * Calculate estimated transaction size
 */
export function estimateTransactionSize(inputs, outputs, mixin, paymentId = false) {
    // Basic size estimation formula
    const headerSize = 1; // version
    const unlockTimeSize = 8; // uint64
    const extraSize = paymentId ? 34 : 2; // Payment ID or nonce
    // Input size: type (1) + amount (8) + offsets (variable)
    const inputSize = inputs * (1 + 8 + (mixin + 1) * 4);
    // Output size: amount (8) + key (32)
    const outputSize = outputs * (8 + 32);
    // Signatures: 64 bytes per input
    const signatureSize = inputs * 64;
    return headerSize + unlockTimeSize + inputSize + outputSize + extraSize + signatureSize;
}
/**
 * Calculate transaction fee
 */
export function calculateFee(inputs, outputs, mixin, feePerByte = 0.01) {
    const size = estimateTransactionSize(inputs, outputs, mixin);
    return Math.ceil(size * feePerByte);
}
// ============================================================================
// TIME UTILITIES
// ============================================================================
/**
 * Convert Unix timestamp to date
 */
export function timestampToDate(timestamp) {
    return new Date(timestamp * 1000);
}
/**
 * Convert date to Unix timestamp
 */
export function dateToTimestamp(date) {
    return Math.floor(date.getTime() / 1000);
}
/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp) {
    const date = timestampToDate(timestamp);
    return date.toLocaleString();
}
/**
 * Get relative time string (e.g., "2 hours ago")
 */
export function getRelativeTime(timestamp) {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;
    const seconds = diff;
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (seconds < 60)
        return `${seconds}s ago`;
    if (minutes < 60)
        return `${minutes}m ago`;
    if (hours < 24)
        return `${hours}h ago`;
    if (days < 30)
        return `${days}d ago`;
    const date = timestampToDate(timestamp);
    return date.toLocaleDateString();
}
// ============================================================================
// BLOCK UTILITIES
// ============================================================================
/**
 * Calculate block reward (simplified)
 */
export function calculateBlockReward(height, alreadyGeneratedCoins) {
    // This is a simplified calculation
    // Actual implementation depends on the emission curve
    const baseReward = 1000000; // 1 PAS coin
    return baseReward;
}
/**
 * Estimate blocks to unlock
 */
export function getUnlockBlocks(unlockTime, currentHeight) {
    // If unlockTime is a timestamp
    if (unlockTime > 500000000) { // Arbitrary large number to detect timestamp
        // Can't convert timestamp to height without knowing block time
        return 0;
    }
    // unlockTime is a block height
    return Math.max(0, unlockTime - currentHeight);
}
/**
 * Check if output is unlocked
 */
export function isOutputUnlocked(unlockTime, currentHeight, transactionHeight) {
    // Coinbase transactions have a maturity period (default 10 blocks)
    const coinbaseMaturity = 10;
    // Check if transaction is old enough
    const blocksSinceTx = currentHeight - transactionHeight;
    if (blocksSinceTx < coinbaseMaturity) {
        return false;
    }
    // Check if unlock time has passed
    if (unlockTime === 0) {
        return true;
    }
    if (unlockTime > 500000000) {
        // Timestamp-based unlock
        const now = Math.floor(Date.now() / 1000);
        return now >= unlockTime;
    }
    else {
        // Height-based unlock
        return currentHeight >= unlockTime;
    }
}
// ============================================================================
// VALIDATION UTILITIES
// ============================================================================
/**
 * Validate transaction amount
 */
export function validateAmount(amount) {
    return amount > 0 && Number.isFinite(amount);
}
/**
 * Validate mixin count
 */
export function validateMixin(mixin, maxMixin = 10) {
    return mixin >= 0 && mixin <= maxMixin && Number.isInteger(mixin);
}
/**
 * Validate fee amount
 */
export function validateFee(fee, minFee = 1000) {
    return fee >= minFee && Number.isFinite(fee);
}
// ============================================================================
// ERROR HANDLING
// ============================================================================
export class WalletError extends Error {
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'WalletError';
    }
}
export class InsufficientBalanceError extends WalletError {
    constructor(required, available) {
        super(`Insufficient balance. Required: ${required}, Available: ${available}`, 'INSUFFICIENT_BALANCE', { required, available });
        this.name = 'InsufficientBalanceError';
    }
}
export class InvalidAddressError extends WalletError {
    constructor(address) {
        super(`Invalid address: ${address}`, 'INVALID_ADDRESS', { address });
        this.name = 'InvalidAddressError';
    }
}
export class TransactionFailedError extends WalletError {
    constructor(reason) {
        super(`Transaction failed: ${reason}`, 'TRANSACTION_FAILED', { reason });
        this.name = 'TransactionFailedError';
    }
}
export class SyncError extends WalletError {
    constructor(message, details) {
        super(message, 'SYNC_ERROR', details);
        this.name = 'SyncError';
    }
}
// ============================================================================
// EXPORTS
// ============================================================================
export default {
    hexToBytes,
    bytesToHex,
    atomicToFloat,
    floatToAtomic,
    formatAmount,
    validateAddress,
    validateMnemonic,
    splitMnemonic,
    joinMnemonic,
    getTransactionId,
    estimateTransactionSize,
    calculateFee,
    timestampToDate,
    dateToTimestamp,
    formatTimestamp,
    getRelativeTime,
    calculateBlockReward,
    getUnlockBlocks,
    isOutputUnlocked,
    validateAmount,
    validateMixin,
    validateFee,
    WalletError,
    InsufficientBalanceError,
    InvalidAddressError,
    TransactionFailedError,
    SyncError,
};
