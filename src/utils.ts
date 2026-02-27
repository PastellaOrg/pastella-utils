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
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Convert byte array to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert byte array to base64
 */
export function bytesToBase64(bytes: Uint8Array): string {
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
export function base64ToBytes(base64: string): Uint8Array {
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
export function atomicToFloat(amount: number, decimals: number = 2): number {
  return amount / Math.pow(10, decimals);
}

/**
 * Convert floating point to atomic units
 */
export function floatToAtomic(amount: number, decimals: number = 2): number {
  return Math.floor(amount * Math.pow(10, decimals));
}

/**
 * Format amount for display
 */
export function formatAmount(amount: number, decimals: number = 2): string {
  return atomicToFloat(amount, decimals).toFixed(decimals);
}

// ============================================================================
// ADDRESS UTILITIES
// ============================================================================

/**
 * Validate Pastella address format
 */
export function validateAddress(address: string): boolean {
  // Pastella addresses start with 'N' or 'P' and are Base58 encoded
  // Typical length is 98-99 characters for standard addresses
  if (!address) return false;

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
export function extractPaymentId(integratedAddress: string): string | null {
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
export function validateMnemonic(mnemonic: string): boolean {
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
export function splitMnemonic(mnemonic: string): string[] {
  return mnemonic.trim().split(/\s+/);
}

/**
 * Join mnemonic array into string
 */
export function joinMnemonic(words: string[]): string {
  return words.join(' ');
}

// ============================================================================
// TRANSACTION UTILITIES
// ============================================================================

/**
 * Calculate transaction ID from hash
 */
export function getTransactionId(hash: string): string {
  // In Pastella, transaction ID is typically the hash
  return hash;
}

// ============================================================================
// TIME UTILITIES
// ============================================================================

/**
 * Convert Unix timestamp to date
 */
export function timestampToDate(timestamp: number): Date {
  return new Date(timestamp * 1000);
}

/**
 * Convert date to Unix timestamp
 */
export function dateToTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: number): string {
  const date = timestampToDate(timestamp);
  return date.toLocaleString();
}

/**
 * Get relative time string (e.g., "2 hours ago")
 */
export function getRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  const seconds = diff;
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;

  const date = timestampToDate(timestamp);
  return date.toLocaleDateString();
}

// ============================================================================
// BLOCK UTILITIES
// ============================================================================

/**
 * Calculate block reward (simplified)
 */
export function calculateBlockReward(
  height: number,
  alreadyGeneratedCoins: number
): number {
  // This is a simplified calculation
  // Actual implementation depends on the emission curve
  const baseReward = 1000000; // 1 PAS coin
  return baseReward;
}

/**
 * Estimate blocks to unlock
 */
export function getUnlockBlocks(
  unlockTime: number,
  currentHeight: number
): number {
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
export function isOutputUnlocked(
  unlockTime: number,
  currentHeight: number,
  transactionHeight: number
): boolean {
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
  } else {
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
export function validateAmount(amount: number): boolean {
  return amount > 0 && Number.isFinite(amount);
}

/**
 * Validate fee amount
 */
export function validateFee(fee: number, minFee: number = 1000): boolean {
  return fee >= minFee && Number.isFinite(fee);
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export class WalletError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'WalletError';
  }
}

export class InsufficientBalanceError extends WalletError {
  constructor(required: number, available: number) {
    super(
      `Insufficient balance. Required: ${required}, Available: ${available}`,
      'INSUFFICIENT_BALANCE',
      { required, available }
    );
    this.name = 'InsufficientBalanceError';
  }
}

export class InvalidAddressError extends WalletError {
  constructor(address: string) {
    super(
      `Invalid address: ${address}`,
      'INVALID_ADDRESS',
      { address }
    );
    this.name = 'InvalidAddressError';
  }
}

export class TransactionFailedError extends WalletError {
  constructor(reason: string) {
    super(
      `Transaction failed: ${reason}`,
      'TRANSACTION_FAILED',
      { reason }
    );
    this.name = 'TransactionFailedError';
  }
}

export class SyncError extends WalletError {
  constructor(message: string, details?: any) {
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
  timestampToDate,
  dateToTimestamp,
  formatTimestamp,
  getRelativeTime,
  calculateBlockReward,
  getUnlockBlocks,
  isOutputUnlocked,
  validateAmount,
  validateFee,
  WalletError,
  InsufficientBalanceError,
  InvalidAddressError,
  TransactionFailedError,
  SyncError,
};
