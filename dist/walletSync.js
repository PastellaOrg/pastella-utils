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
import { DaemonApi } from './api';
import { recalculateBalances, getStakingLockedBalance, getUnspentOutputs, getAvailableOutputs, getLockedOutputs, } from './walletSync-balance';
import { getTransactions, } from './walletSync-transactions';
import { startSync, createPollingFunction, } from './walletSync-sync';
import { processBlock as processBlockImpl, } from './walletSync-processing';
// Re-export constants
export { LAST_KNOWN_BLOCK_HASHES_SIZE, MIN_BLOCK_COUNT, PRUNE_INTERVAL, MAX_EMPTY_RETRIES, RETRY_DELAY, } from './walletSync-utils';
export class WalletSync {
    constructor(config) {
        // Connection state tracking
        this.lastConnectionState = null;
        this.lastInfoRequestTime = 0;
        // Refs for sync control
        this.shouldStopRef = { value: false };
        this.isRunningRef = { value: false };
        this.api = new DaemonApi(config.node);
        this.publicKeys = new Set(config.publicKeys);
        this.startHeight = config.startHeight || 0;
        this.startTimestamp = config.startTimestamp || 0;
        this.pollInterval = config.pollInterval || 5000;
        this.blockCheckpoints = new Map();
        this.outputs = new Map();
        this.spends = new Map();
        this.syncedBlocks = new Map();
        this.rawTransactionOutputs = new Map();
        this.stakingTxHashes = new Set();
        this.pendingTxData = new Map();
        this.isRunning = false;
        this.shouldStop = false;
        this.emptyRetryCount = 0;
        // Load initial state if provided
        if (config.initialState) {
            for (const output of config.initialState.outputs) {
                const mapKey = output.compositeKey || `${output.transactionHash}:${output.transactionIndex ?? 0}`;
                this.outputs.set(mapKey, output);
            }
            for (const spend of config.initialState.spends) {
                let spendKey;
                let output;
                if (spend.outputKey) {
                    spendKey = spend.outputKey;
                    output = this.outputs.get(spendKey);
                    // If outputKey doesn't find output, try fallback by parentTransactionHash
                    if (!output) {
                        // Find output by parentTransactionHash alone (handles corrupted outputKey)
                        for (const [key, out] of this.outputs.entries()) {
                            if (out.transactionHash === spend.parentTransactionHash) {
                                // Prefer exact index match, but accept first match if none
                                if (out.transactionIndex === spend.transactionIndex || !output) {
                                    spendKey = key;
                                    output = out;
                                    if (out.transactionIndex === spend.transactionIndex)
                                        break;
                                }
                            }
                        }
                    }
                }
                else {
                    const compositeKey = `${spend.parentTransactionHash}:${spend.transactionIndex ?? 0}`;
                    output = this.outputs.get(compositeKey);
                    if (output) {
                        spendKey = compositeKey;
                        spend.outputKey = compositeKey;
                    }
                    else {
                        // Find by parentTransactionHash alone
                        for (const [key, out] of this.outputs.entries()) {
                            if (out.transactionHash === spend.parentTransactionHash) {
                                spendKey = key;
                                output = out;
                                spend.outputKey = key;
                                break;
                            }
                        }
                        if (!output)
                            spendKey = spend.parentTransactionHash;
                    }
                }
                this.spends.set(spendKey, spend);
                if (output && !output.spentHeight) {
                    output.spentHeight = spend.blockHeight;
                    this.outputs.set(spendKey, output);
                }
            }
        }
        // Initialize state
        this.state = {
            isSyncing: false,
            currentHeight: config.initialState?.currentHeight || this.startHeight,
            networkHeight: 0,
            blocksProcessed: 0,
            transactionsFound: 0,
            lastSyncTime: 0,
            syncErrors: [],
            availableBalance: 0,
            lockedBalance: 0,
            stakingLocked: 0,
            stakingTxHashes: [],
        };
        // Calculate initial balances from loaded state
        if (config.initialState) {
            const savedStakingTxHashes = config.initialState.syncState?.stakingTxHashes || [];
            for (const hash of savedStakingTxHashes) {
                this.stakingTxHashes.add(hash);
            }
            for (const output of this.outputs.values()) {
                if (output.isStaking) {
                    this.stakingTxHashes.add(output.transactionHash);
                }
            }
            this.recalculateBalances();
        }
        // Set event handlers
        this.onSyncProgress = config.onSyncProgress;
        this.onBlockProcessed = config.onBlockProcessed;
        this.onTransactionFound = config.onTransactionFound;
        this.onSpendFound = config.onSpendFound;
        this.onTransactionDiscovered = config.onTransactionDiscovered;
        this.onConnectionStatusChange = config.onConnectionStatusChange;
    }
    /**
     * Update connection status (called after /info requests)
     * @private
     */
    updateConnectionStatus(isConnected, latency) {
        // Only notify if status changed
        if (this.lastConnectionState !== isConnected && this.onConnectionStatusChange) {
            this.lastConnectionState = isConnected;
            this.onConnectionStatusChange(isConnected, latency);
        }
    }
    /**
     * Recalculate balances from current outputs and spends
     * @private
     */
    recalculateBalances() {
        const { available, locked, stakingLocked } = recalculateBalances({
            outputs: this.outputs,
            stakingTxHashes: this.stakingTxHashes,
            currentHeight: this.state.currentHeight,
        });
        this.state.availableBalance = available;
        this.state.lockedBalance = locked;
        this.state.stakingLocked = stakingLocked;
    }
    /**
     * Notify progress with updated balances
     * @private
     */
    notifyProgress() {
        if (this.onSyncProgress) {
            const availableBal = this.getAvailableBalance();
            const lockedBal = this.getLockedBalance();
            const stakingLockedBal = this.getStakingLockedBalance();
            this.state.availableBalance = availableBal;
            this.state.lockedBalance = lockedBal;
            this.state.stakingLocked = stakingLockedBal;
            this.onSyncProgress(this.getState());
        }
    }
    /**
     * Process a single block with context
     * @private
     */
    async processBlock(block) {
        const ctx = {
            publicKeys: this.publicKeys,
            currentHeight: this.state.currentHeight,
            outputs: this.outputs,
            spends: this.spends,
            rawTransactionOutputs: this.rawTransactionOutputs,
            stakingTxHashes: this.stakingTxHashes,
            pendingTxData: this.pendingTxData,
        };
        const result = await processBlockImpl(block, ctx, this.syncedBlocks, this.blockCheckpoints, this.onBlockProcessed, this.onTransactionFound, this.onSpendFound, this.onTransactionDiscovered);
        // Update state
        this.state.currentHeight = ctx.currentHeight;
        this.state.blocksProcessed++;
        this.state.transactionsFound += result.newOutputs.length;
        return result;
    }
    /**
     * Start wallet synchronization
     */
    async start() {
        const syncCtx = {
            api: this.api,
            startHeight: this.startHeight,
            startTimestamp: this.startTimestamp,
            pollInterval: this.pollInterval,
            state: this.state,
            blockCheckpoints: this.blockCheckpoints,
            syncedBlocks: this.syncedBlocks,
            emptyRetryCount: this.emptyRetryCount,
            onConnectionStatusChange: this.onConnectionStatusChange,
        };
        const startPolling = createPollingFunction(syncCtx, this.processBlock.bind(this), this.notifyProgress.bind(this), this.shouldStopRef, this.isRunningRef, (timer) => {
            this.pollTimer = timer;
        });
        await startSync(syncCtx, this.processBlock.bind(this), this.notifyProgress.bind(this), startPolling, this.shouldStopRef, this.isRunningRef);
    }
    /**
     * Stop wallet synchronization
     */
    stop() {
        this.shouldStop = true;
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = undefined;
        }
        this.isRunning = false;
        this.state.isSyncing = false;
        this.notifyProgress();
    }
    /**
     * Check if sync is actively running
     */
    isActive() {
        return this.isRunning || !!this.pollTimer;
    }
    /**
     * Update node configuration
     */
    setNode(node) {
        this.api.setNode(node);
    }
    /**
     * Get current sync state
     */
    getState() {
        return {
            ...this.state,
            stakingTxHashes: Array.from(this.stakingTxHashes),
        };
    }
    /**
     * Get synced blocks
     */
    getSyncedBlocks() {
        return Array.from(this.syncedBlocks.values()).sort((a, b) => a.blockHeight - b.blockHeight);
    }
    /**
     * Get wallet outputs (UTXOs)
     */
    getOutputs() {
        return Array.from(this.outputs.values());
    }
    /**
     * Get unspent outputs
     */
    getUnspentOutputs() {
        return getUnspentOutputs(this.getOutputs());
    }
    /**
     * Get current balance (sum of all unspent outputs)
     */
    getBalance() {
        return this.getUnspentOutputs()
            .reduce((sum, output) => sum + output.amount, 0);
    }
    /**
     * Get available balance (unspent outputs that have matured)
     */
    getAvailableBalance() {
        return this.getAvailableOutputs()
            .reduce((sum, output) => sum + output.amount, 0);
    }
    /**
     * Get locked balance (unspent outputs that haven't matured yet)
     */
    getLockedBalance() {
        return this.getLockedOutputs()
            .reduce((sum, output) => sum + output.amount, 0);
    }
    /**
     * Get staking locked balance
     */
    getStakingLockedBalance() {
        return getStakingLockedBalance({
            outputs: this.outputs,
            stakingTxHashes: this.stakingTxHashes,
            currentHeight: this.state.currentHeight,
        });
    }
    /**
     * Get available outputs (unspent and matured)
     */
    getAvailableOutputs() {
        return getAvailableOutputs(this.getOutputs(), this.stakingTxHashes, this.state.currentHeight);
    }
    /**
     * Get locked outputs (unspent but not yet matured)
     */
    getLockedOutputs() {
        return getLockedOutputs(this.getOutputs(), this.stakingTxHashes, this.state.currentHeight);
    }
    /**
     * Get spends
     */
    getSpends() {
        return Array.from(this.spends.values());
    }
    /**
     * Get transactions with proper classification
     */
    getTransactions(limit = Number.MAX_SAFE_INTEGER) {
        return getTransactions(this.getOutputs(), this.getSpends(), this.stakingTxHashes, this.publicKeys, this.state.currentHeight, this.rawTransactionOutputs, limit);
    }
}
export default WalletSync;
