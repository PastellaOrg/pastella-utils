/**
 * Pastella Wallet Synchronization - Utilities and Constants
 *
 * Shared constants, utility functions, and event types
 */
import { MATURITY_BLOCKS, UNLOCK_TIME_TIMESTAMP_THRESHOLD } from './config';
// Constants from pastella-core
export const LAST_KNOWN_BLOCK_HASHES_SIZE = 50;
export const MIN_BLOCK_COUNT = 5;
export const PRUNE_INTERVAL = 2880; // ~2 days worth of blocks
export const MAX_EMPTY_RETRIES = 3; // Max retries when no blocks returned
export const RETRY_DELAY = 2000; // 2 seconds between retries
/**
 * Check if an output is spendable based on maturity and unlockTime
 * @param blockHeight - Block height where the output was created
 * @param unlockTime - Explicit unlock time (block height or timestamp)
 * @param blockTimestamp - Timestamp of the block
 * @param currentHeight - Current blockchain height
 * @returns true if the output is spendable
 */
export function isOutputSpendable(blockHeight, unlockTime, blockTimestamp, currentHeight) {
    // Check block maturity: output must be at least MATURITY_BLOCKS old
    const matureHeight = currentHeight - MATURITY_BLOCKS;
    const maturityMet = blockHeight <= matureHeight;
    if (!maturityMet) {
        return false;
    }
    // Check explicit unlockTime
    if (unlockTime === 0) {
        // No explicit unlock time, only maturity matters
        return true;
    }
    // If unlockTime < threshold, it's a block height
    if (unlockTime < UNLOCK_TIME_TIMESTAMP_THRESHOLD) {
        // Block height-based unlock: current height must be >= unlockTime
        const unlockMet = currentHeight >= unlockTime;
        return unlockMet;
    }
    // Otherwise, unlockTime is a Unix timestamp
    // Current timestamp must be >= unlockTime
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const unlockMet = currentTimestamp >= unlockTime;
    return unlockMet;
}
