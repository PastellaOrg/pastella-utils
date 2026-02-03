/**
 * Pastella Wallet Synchronization - Sync Control
 *
 * Handles sync loop, polling, and block batch processing
 */
import { DaemonApi } from './api';
import { WalletBlockInfo, WalletSyncState } from './types';
export interface SyncContext {
    api: DaemonApi;
    startHeight: number;
    startTimestamp: number;
    pollInterval: number;
    state: WalletSyncState;
    blockCheckpoints: Map<number, string>;
    syncedBlocks: Map<number, import('./types').SyncedBlockInfo>;
    emptyRetryCount?: number;
    onConnectionStatusChange?: (isConnected: boolean, latency?: number) => void;
}
export interface ProcessBlockResult {
    newOutputs: import('./types').WalletOutput[];
    newSpends: import('./types').WalletSpend[];
    syncedBlock: import('./types').SyncedBlockInfo;
}
export type ProcessBlockFn = (block: WalletBlockInfo) => Promise<ProcessBlockResult>;
export type HandleForkFn = (forkHeight: number) => Promise<void>;
export type PruneSpentInputsFn = (currentHeight: number) => void;
export type PruneCheckpointsFn = () => void;
export type PruneSyncedBlocksFn = () => void;
export type NotifyProgressFn = () => void;
/**
 * Start wallet synchronization
 */
export declare function startSync(ctx: SyncContext, processBlock: ProcessBlockFn, notifyProgress: NotifyProgressFn, startPolling: () => void, shouldStop: {
    value: boolean;
}, isRunning: {
    value: boolean;
}): Promise<void>;
/**
 * Create a polling function that checks for new blocks periodically
 */
export declare function createPollingFunction(ctx: SyncContext, processBlock: ProcessBlockFn, notifyProgress: NotifyProgressFn, shouldStop: {
    value: boolean;
}, isRunning: {
    value: boolean;
}, setPollTimer: (timer: NodeJS.Timeout | undefined) => void): () => void;
export { LAST_KNOWN_BLOCK_HASHES_SIZE, PRUNE_INTERVAL } from './walletSync-utils';
//# sourceMappingURL=walletSync-sync.d.ts.map