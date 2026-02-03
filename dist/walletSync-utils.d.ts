/**
 * Pastella Wallet Synchronization - Utilities and Constants
 *
 * Shared constants, utility functions, and event types
 */
export declare const LAST_KNOWN_BLOCK_HASHES_SIZE = 50;
export declare const MIN_BLOCK_COUNT = 5;
export declare const PRUNE_INTERVAL = 2880;
export declare const MAX_EMPTY_RETRIES = 3;
export declare const RETRY_DELAY = 2000;
/**
 * Check if an output is spendable based on maturity and unlockTime
 * @param blockHeight - Block height where the output was created
 * @param unlockTime - Explicit unlock time (block height or timestamp)
 * @param blockTimestamp - Timestamp of the block
 * @param currentHeight - Current blockchain height
 * @returns true if the output is spendable
 */
export declare function isOutputSpendable(blockHeight: number, unlockTime: number, blockTimestamp: number, currentHeight: number): boolean;
export type SyncEventHandler = (state: import('./types').WalletSyncState) => void;
export type BlockProcessedHandler = (block: import('./types').SyncedBlockInfo) => void;
export type TransactionFoundHandler = (output: import('./types').WalletOutput) => void;
export type SpendFoundHandler = (spend: import('./types').WalletSpend) => void;
export type TransactionDiscoveredHandler = (transaction: import('./types').WalletDisplayTransaction) => void;
//# sourceMappingURL=walletSync-utils.d.ts.map