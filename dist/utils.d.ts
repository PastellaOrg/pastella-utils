/**
 * Pastella Wallet Utilities
 *
 * Helper functions for wallet operations
 */
/**
 * Convert hex string to byte array
 */
export declare function hexToBytes(hex: string): Uint8Array;
/**
 * Convert byte array to hex string
 */
export declare function bytesToHex(bytes: Uint8Array): string;
/**
 * Convert byte array to base64
 */
export declare function bytesToBase64(bytes: Uint8Array): string;
/**
 * Convert base64 to byte array
 */
export declare function base64ToBytes(base64: string): Uint8Array;
/**
 * Convert atomic units to floating point
 * Pastella uses different decimal places depending on configuration
 * Default is 2 decimal places (100 atomic units = 1 PAS)
 */
export declare function atomicToFloat(amount: number, decimals?: number): number;
/**
 * Convert floating point to atomic units
 */
export declare function floatToAtomic(amount: number, decimals?: number): number;
/**
 * Format amount for display
 */
export declare function formatAmount(amount: number, decimals?: number): string;
/**
 * Validate Pastella address format
 */
export declare function validateAddress(address: string): boolean;
/**
 * Extract payment ID from integrated address
 */
export declare function extractPaymentId(integratedAddress: string): string | null;
/**
 * Validate mnemonic phrase
 */
export declare function validateMnemonic(mnemonic: string): boolean;
/**
 * Split mnemonic into array
 */
export declare function splitMnemonic(mnemonic: string): string[];
/**
 * Join mnemonic array into string
 */
export declare function joinMnemonic(words: string[]): string;
/**
 * Calculate transaction ID from hash
 */
export declare function getTransactionId(hash: string): string;
/**
 * Convert Unix timestamp to date
 */
export declare function timestampToDate(timestamp: number): Date;
/**
 * Convert date to Unix timestamp
 */
export declare function dateToTimestamp(date: Date): number;
/**
 * Format timestamp for display
 */
export declare function formatTimestamp(timestamp: number): string;
/**
 * Get relative time string (e.g., "2 hours ago")
 */
export declare function getRelativeTime(timestamp: number): string;
/**
 * Calculate block reward (simplified)
 */
export declare function calculateBlockReward(height: number, alreadyGeneratedCoins: number): number;
/**
 * Estimate blocks to unlock
 */
export declare function getUnlockBlocks(unlockTime: number, currentHeight: number): number;
/**
 * Check if output is unlocked
 */
export declare function isOutputUnlocked(unlockTime: number, currentHeight: number, transactionHeight: number): boolean;
/**
 * Validate transaction amount
 */
export declare function validateAmount(amount: number): boolean;
/**
 * Validate fee amount
 */
export declare function validateFee(fee: number, minFee?: number): boolean;
export declare class WalletError extends Error {
    code: string;
    details?: any;
    constructor(message: string, code: string, details?: any);
}
export declare class InsufficientBalanceError extends WalletError {
    constructor(required: number, available: number);
}
export declare class InvalidAddressError extends WalletError {
    constructor(address: string);
}
export declare class TransactionFailedError extends WalletError {
    constructor(reason: string);
}
export declare class SyncError extends WalletError {
    constructor(message: string, details?: any);
}
declare const _default: {
    hexToBytes: typeof hexToBytes;
    bytesToHex: typeof bytesToHex;
    atomicToFloat: typeof atomicToFloat;
    floatToAtomic: typeof floatToAtomic;
    formatAmount: typeof formatAmount;
    validateAddress: typeof validateAddress;
    validateMnemonic: typeof validateMnemonic;
    splitMnemonic: typeof splitMnemonic;
    joinMnemonic: typeof joinMnemonic;
    getTransactionId: typeof getTransactionId;
    timestampToDate: typeof timestampToDate;
    dateToTimestamp: typeof dateToTimestamp;
    formatTimestamp: typeof formatTimestamp;
    getRelativeTime: typeof getRelativeTime;
    calculateBlockReward: typeof calculateBlockReward;
    getUnlockBlocks: typeof getUnlockBlocks;
    isOutputUnlocked: typeof isOutputUnlocked;
    validateAmount: typeof validateAmount;
    validateFee: typeof validateFee;
    WalletError: typeof WalletError;
    InsufficientBalanceError: typeof InsufficientBalanceError;
    InvalidAddressError: typeof InvalidAddressError;
    TransactionFailedError: typeof TransactionFailedError;
    SyncError: typeof SyncError;
};
export default _default;
//# sourceMappingURL=utils.d.ts.map