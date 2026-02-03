/**
 * Pastella Wallet Configuration
 *
 * Central configuration constants for the Pastella wallet
 */
/**
 * Base58 address prefix for Pastella public addresses
 * This prefix is encoded as a varint in the address
 */
export declare const WALLET_ADDRESS_PREFIX = 1671172;
export declare const WALLET_ADDRESS_PREFIX_STRING = "PAS";
/**
 * Number of decimal places for coin amounts
 * 1 PAS = 100,000,000 atomic units (8 decimal places)
 */
export declare const DECIMALS = 8;
/**
 * Coin ticker/symbol
 */
export declare const TICKER = "PAS";
/**
 * Number of blocks before an output matures and can be spent
 */
export declare const MATURITY_BLOCKS = 10;
/**
 * Number of blocks to request per batch in wallet sync
 */
export declare const BLOCKS_PER_BATCH = 20;
/**
 * Minimum transaction fee in atomic units
 */
export declare const MIN_FEE = 1000;
/**
 * Threshold to distinguish between block height and timestamp in unlockTime
 * Values below this are block heights, above are Unix timestamps
 */
export declare const UNLOCK_TIME_TIMESTAMP_THRESHOLD = 500000000;
/**
 * Block height when staking becomes enabled
 */
export declare const STAKING_ENABLE_HEIGHT = 1000;
/**
 * Transaction extra field tag for staking (0x04)
 * NOTE: This is the EXTRA FIELD TAG, not the staking type (101)
 */
export declare const TX_EXTRA_STAKING = 4;
/**
 * Staking transaction type identifier
 */
export declare const STAKING_TX_TYPE = 101;
/**
 * Block time in seconds (30 seconds per block)
 */
export declare const BLOCK_TIME_SECONDS = 30;
/**
 * Available lock periods for staking (in days)
 */
export declare const MIN_LOCK_PERIOD_DAYS: number[];
/**
 * Annual reward rates for each lock period (percentage)
 * Index matches MIN_LOCK_PERIOD_DAYS
 */
export declare const ANNUAL_REWARD_RATES: number[];
/**
 * Number of blocks to wait for preparation transaction to confirm
 */
export declare const STAKING_PREPARATION_TIMEOUT_SECONDS = 300;
/**
 * Storage key for pending stakes in AsyncStorage
 */
export declare const PENDING_STAKES_KEY = "@pastella_wallet_pending_stakes";
//# sourceMappingURL=config.d.ts.map