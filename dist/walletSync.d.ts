/**
 * Pastella Wallet Synchronization - Main Entry Point
 *
 * This file exports the WalletSync class which orchestrates
 * all wallet synchronization functionality.
 *
 * The implementation is split across multiple files for maintainability:
 * - walletSync-utils.ts: Constants, utilities, event types
 * - walletSync-balance.ts: Balance calculations
 * - walletSync-transactions.ts: Transaction classification
 * - walletSync-sync.ts: Sync control (start/stop/polling)
 * - walletSync-processing.ts: Block/output/spend processing
 */
import { NodeConfig, WalletSyncState, WalletOutput, WalletSpend, SyncedBlockInfo, WalletDisplayTransaction } from './types';
export type { SyncEventHandler, BlockProcessedHandler, TransactionFoundHandler, SpendFoundHandler, TransactionDiscoveredHandler, } from './walletSync-utils';
export { LAST_KNOWN_BLOCK_HASHES_SIZE, MIN_BLOCK_COUNT, PRUNE_INTERVAL, MAX_EMPTY_RETRIES, RETRY_DELAY, } from './walletSync-utils';
export interface WalletSyncConfig {
    node: NodeConfig;
    publicKeys: string[];
    startHeight?: number;
    startTimestamp?: number;
    pollInterval?: number;
    initialState?: {
        outputs: WalletOutput[];
        spends: WalletSpend[];
        currentHeight?: number;
        syncState?: WalletSyncState;
    };
    onSyncProgress?: (state: WalletSyncState) => void;
    onBlockProcessed?: (block: SyncedBlockInfo) => void;
    onTransactionFound?: (output: WalletOutput) => void;
    onSpendFound?: (spend: WalletSpend) => void;
    onTransactionDiscovered?: (transaction: WalletDisplayTransaction) => void;
    onConnectionStatusChange?: (isConnected: boolean, latency?: number) => void;
}
export declare class WalletSync {
    private api;
    private publicKeys;
    private startHeight;
    private startTimestamp;
    private pollInterval;
    private state;
    private blockCheckpoints;
    private outputs;
    private spends;
    private syncedBlocks;
    private rawTransactionOutputs;
    private stakingTxHashes;
    private pendingTxData;
    private isRunning;
    private shouldStop;
    private emptyRetryCount;
    private pollTimer?;
    private onSyncProgress?;
    private onBlockProcessed?;
    private onTransactionFound?;
    private onSpendFound?;
    private onTransactionDiscovered?;
    private onConnectionStatusChange?;
    private lastConnectionState;
    private lastInfoRequestTime;
    private shouldStopRef;
    private isRunningRef;
    constructor(config: WalletSyncConfig);
    /**
     * Update connection status (called after /info requests)
     * @private
     */
    private updateConnectionStatus;
    /**
     * Recalculate balances from current outputs and spends
     * @private
     */
    private recalculateBalances;
    /**
     * Notify progress with updated balances
     * @private
     */
    private notifyProgress;
    /**
     * Process a single block with context
     * @private
     */
    private processBlock;
    /**
     * Start wallet synchronization
     */
    start(): Promise<void>;
    /**
     * Stop wallet synchronization
     */
    stop(): void;
    /**
     * Check if sync is actively running
     */
    isActive(): boolean;
    /**
     * Update node configuration
     */
    setNode(node: NodeConfig): void;
    /**
     * Get current sync state
     */
    getState(): WalletSyncState;
    /**
     * Get synced blocks
     */
    getSyncedBlocks(): SyncedBlockInfo[];
    /**
     * Get wallet outputs (UTXOs)
     */
    getOutputs(): WalletOutput[];
    /**
     * Get unspent outputs
     */
    getUnspentOutputs(): WalletOutput[];
    /**
     * Get current balance (sum of all unspent outputs)
     */
    getBalance(): number;
    /**
     * Get available balance (unspent outputs that have matured)
     */
    getAvailableBalance(): number;
    /**
     * Get locked balance (unspent outputs that haven't matured yet)
     */
    getLockedBalance(): number;
    /**
     * Get staking locked balance
     */
    getStakingLockedBalance(): number;
    /**
     * Get available outputs (unspent and matured)
     */
    getAvailableOutputs(): WalletOutput[];
    /**
     * Get locked outputs (unspent but not yet matured)
     */
    getLockedOutputs(): WalletOutput[];
    /**
     * Get spends
     */
    getSpends(): WalletSpend[];
    /**
     * Get transactions with proper classification
     */
    getTransactions(limit?: number): WalletDisplayTransaction[];
}
export default WalletSync;
//# sourceMappingURL=walletSync.d.ts.map