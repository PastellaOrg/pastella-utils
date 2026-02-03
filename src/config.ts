/**
 * Pastella Wallet Configuration
 *
 * Central configuration constants for the Pastella wallet
 */

/**
 * Base58 address prefix for Pastella public addresses
 * This prefix is encoded as a varint in the address
 */
export const WALLET_ADDRESS_PREFIX = 0x198004;
export const WALLET_ADDRESS_PREFIX_STRING = "PAS";

/**
 * Number of decimal places for coin amounts
 * 1 PAS = 100,000,000 atomic units (8 decimal places)
 */
export const DECIMALS = 8;

/**
 * Coin ticker/symbol
 */
export const TICKER = 'PAS';

/**
 * Number of blocks before an output matures and can be spent
 */
export const MATURITY_BLOCKS = 10;

/**
 * Number of blocks to request per batch in wallet sync
 */
export const BLOCKS_PER_BATCH = 20;

/**
 * Minimum transaction fee in atomic units
 */
export const MIN_FEE = 1000;

/**
 * Threshold to distinguish between block height and timestamp in unlockTime
 * Values below this are block heights, above are Unix timestamps
 */
export const UNLOCK_TIME_TIMESTAMP_THRESHOLD = 500000000;

// ============================================================================
// STAKING CONFIGURATION
// ============================================================================

/**
 * Block height when staking becomes enabled
 */
export const STAKING_ENABLE_HEIGHT = 1000;

/**
 * Transaction extra field tag for staking (0x04)
 * NOTE: This is the EXTRA FIELD TAG, not the staking type (101)
 */
export const TX_EXTRA_STAKING = 0x04;

/**
 * Staking transaction type identifier
 */
export const STAKING_TX_TYPE = 101;

/**
 * Block time in seconds (30 seconds per block)
 */
export const BLOCK_TIME_SECONDS = 30;

/**
 * Available lock periods for staking (in days)
 */
export const MIN_LOCK_PERIOD_DAYS = [30, 90, 180, 365];

/**
 * Annual reward rates for each lock period (percentage)
 * Index matches MIN_LOCK_PERIOD_DAYS
 */
export const ANNUAL_REWARD_RATES = [5, 10, 20, 35];

/**
 * Number of blocks to wait for preparation transaction to confirm
 */
export const STAKING_PREPARATION_TIMEOUT_SECONDS = 300; // 5 minutes
