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
import {
  NodeConfig,
  WalletBlockInfo,
  WalletSyncState,
  WalletOutput,
  WalletSpend,
  SyncedBlockInfo,
  GetWalletSyncDataResponse,
  WalletDisplayTransaction,
} from './types';
import {
  recalculateBalances,
  getStakingLockedBalance,
  getUnspentOutputs,
  getAvailableOutputs,
  getLockedOutputs,
} from './walletSync-balance';
import {
  classifyTransaction,
  extractFromToAddresses,
  createDisplayTransaction,
  getTransactions,
  TransactionContext,
} from './walletSync-transactions';
import {
  startSync,
  createPollingFunction,
  LAST_KNOWN_BLOCK_HASHES_SIZE,
  PRUNE_INTERVAL,
} from './walletSync-sync';
import {
  processBlock as processBlockImpl,
  processOutputs,
  processSpends,
  handleFork,
  pruneSpentInputs,
  addCheckpoint,
  pruneCheckpoints,
  pruneSyncedBlocks,
  ProcessingContext,
} from './walletSync-processing';

// Re-export event types
export type {
  SyncEventHandler,
  BlockProcessedHandler,
  TransactionFoundHandler,
  SpendFoundHandler,
  TransactionDiscoveredHandler,
} from './walletSync-utils';

// Re-export constants
export {
  LAST_KNOWN_BLOCK_HASHES_SIZE,
  MIN_BLOCK_COUNT,
  PRUNE_INTERVAL,
  MAX_EMPTY_RETRIES,
  RETRY_DELAY,
} from './walletSync-utils';

export interface WalletSyncConfig {
  node: NodeConfig;
  publicKeys: string[]; // Wallet's public spend keys (transparent system)
  startHeight?: number;
  startTimestamp?: number;
  pollInterval?: number; // Interval in ms to check for new blocks after initial sync (default: 5000)
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

export class WalletSync {
  private api: DaemonApi;
  private publicKeys: Set<string>;
  private startHeight: number;
  private startTimestamp: number;
  private pollInterval: number;
  private state: WalletSyncState;
  private blockCheckpoints: Map<number, string>;
  private outputs: Map<string, WalletOutput>;
  private spends: Map<string, WalletSpend>;
  private syncedBlocks: Map<number, SyncedBlockInfo>;
  private rawTransactionOutputs: Map<string, import('./types').KeyOutput[]>;
  private stakingTxHashes: Set<string>;
  private pendingTxData: Map<string, {
    outputs: WalletOutput[];
    spends: WalletSpend[];
    blockHeight: number;
    timestamp: number;
    isCoinbase: boolean;
    isStaking: boolean;
  }>;
  private isRunning: boolean;
  private shouldStop: boolean;
  private emptyRetryCount: number;
  private pollTimer?: NodeJS.Timeout;

  // Event handlers
  private onSyncProgress?: (state: WalletSyncState) => void;
  private onBlockProcessed?: (block: SyncedBlockInfo) => void;
  private onTransactionFound?: (output: WalletOutput) => void;
  private onSpendFound?: (spend: WalletSpend) => void;
  private onTransactionDiscovered?: (transaction: WalletDisplayTransaction) => void;
  private onConnectionStatusChange?: (isConnected: boolean, latency?: number) => void;

  // Connection state tracking
  private lastConnectionState: boolean | null = null;
  private lastInfoRequestTime: number = 0;

  // Refs for sync control
  private shouldStopRef = { value: false };
  private isRunningRef = { value: false };

  constructor(config: WalletSyncConfig) {
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
        let spendKey: string;
        let output: WalletOutput | undefined;

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
                  if (out.transactionIndex === spend.transactionIndex) break;
                }
              }
            }
          }
        } else {
          const compositeKey = `${spend.parentTransactionHash}:${spend.transactionIndex ?? 0}`;
          output = this.outputs.get(compositeKey);
          if (output) {
            spendKey = compositeKey;
            spend.outputKey = compositeKey;
          } else {
            // Find by parentTransactionHash alone
            for (const [key, out] of this.outputs.entries()) {
              if (out.transactionHash === spend.parentTransactionHash) {
                spendKey = key;
                output = out;
                spend.outputKey = key;
                break;
              }
            }
            if (!output) spendKey = spend.parentTransactionHash;
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
  private updateConnectionStatus(isConnected: boolean, latency?: number): void {
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
  private recalculateBalances(): void {
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
  private notifyProgress(): void {
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
  private async processBlock(block: WalletBlockInfo): Promise<{ newOutputs: WalletOutput[]; newSpends: WalletSpend[] }> {
    const ctx: ProcessingContext = {
      publicKeys: this.publicKeys,
      currentHeight: this.state.currentHeight,
      outputs: this.outputs,
      spends: this.spends,
      rawTransactionOutputs: this.rawTransactionOutputs,
      stakingTxHashes: this.stakingTxHashes,
      pendingTxData: this.pendingTxData,
    };

    const result = await processBlockImpl(
      block,
      ctx,
      this.syncedBlocks,
      this.blockCheckpoints,
      this.onBlockProcessed,
      this.onTransactionFound,
      this.onSpendFound,
      this.onTransactionDiscovered
    );

    // Update state
    this.state.currentHeight = ctx.currentHeight;
    this.state.blocksProcessed++;
    this.state.transactionsFound += result.newOutputs.length;

    return result;
  }

  /**
   * Start wallet synchronization
   */
  async start(): Promise<void> {
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

    const startPolling = createPollingFunction(
      syncCtx,
      this.processBlock.bind(this),
      this.notifyProgress.bind(this),
      this.shouldStopRef,
      this.isRunningRef,
      (timer: NodeJS.Timeout | undefined) => {
        this.pollTimer = timer;
      }
    );

    await startSync(
      syncCtx,
      this.processBlock.bind(this),
      this.notifyProgress.bind(this),
      startPolling,
      this.shouldStopRef,
      this.isRunningRef
    );
  }

  /**
   * Stop wallet synchronization
   */
  stop(): void {
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
  isActive(): boolean {
    return this.isRunning || !!this.pollTimer;
  }

  /**
   * Update node configuration
   */
  setNode(node: NodeConfig): void {
    this.api.setNode(node);
  }

  /**
   * Get current sync state
   */
  getState(): WalletSyncState {
    return {
      ...this.state,
      stakingTxHashes: Array.from(this.stakingTxHashes),
    };
  }

  /**
   * Get synced blocks
   */
  getSyncedBlocks(): SyncedBlockInfo[] {
    return Array.from(this.syncedBlocks.values()).sort((a, b) => a.blockHeight - b.blockHeight);
  }

  /**
   * Get wallet outputs (UTXOs)
   */
  getOutputs(): WalletOutput[] {
    return Array.from(this.outputs.values());
  }

  /**
   * Get unspent outputs
   */
  getUnspentOutputs(): WalletOutput[] {
    return getUnspentOutputs(this.getOutputs());
  }

  /**
   * Get current balance (sum of all unspent outputs)
   */
  getBalance(): number {
    return this.getUnspentOutputs()
      .reduce((sum, output) => sum + output.amount, 0);
  }

  /**
   * Get available balance (unspent outputs that have matured)
   */
  getAvailableBalance(): number {
    return this.getAvailableOutputs()
      .reduce((sum, output) => sum + output.amount, 0);
  }

  /**
   * Get locked balance (unspent outputs that haven't matured yet)
   */
  getLockedBalance(): number {
    return this.getLockedOutputs()
      .reduce((sum, output) => sum + output.amount, 0);
  }

  /**
   * Get staking locked balance
   */
  getStakingLockedBalance(): number {
    return getStakingLockedBalance({
      outputs: this.outputs,
      stakingTxHashes: this.stakingTxHashes,
      currentHeight: this.state.currentHeight,
    });
  }

  /**
   * Get available outputs (unspent and matured)
   */
  getAvailableOutputs(): WalletOutput[] {
    return getAvailableOutputs(
      this.getOutputs(),
      this.stakingTxHashes,
      this.state.currentHeight
    );
  }

  /**
   * Get locked outputs (unspent but not yet matured)
   */
  getLockedOutputs(): WalletOutput[] {
    return getLockedOutputs(
      this.getOutputs(),
      this.stakingTxHashes,
      this.state.currentHeight
    );
  }

  /**
   * Get spends
   */
  getSpends(): WalletSpend[] {
    return Array.from(this.spends.values());
  }

  /**
   * Get transactions with proper classification
   */
  getTransactions(limit: number = Number.MAX_SAFE_INTEGER): WalletDisplayTransaction[] {
    return getTransactions(
      this.getOutputs(),
      this.getSpends(),
      this.stakingTxHashes,
      this.publicKeys,
      this.state.currentHeight,
      this.rawTransactionOutputs,
      limit
    );
  }
}

export default WalletSync;
