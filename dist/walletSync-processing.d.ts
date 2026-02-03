/**
 * Pastella Wallet Synchronization - Block Processing
 *
 * Handles block, output, and spend processing
 */
import { WalletBlockInfo, WalletOutput, WalletSpend, SyncedBlockInfo, KeyOutput } from './types';
export interface ProcessingContext {
    publicKeys: Set<string>;
    currentHeight: number;
    outputs: Map<string, WalletOutput>;
    spends: Map<string, WalletSpend>;
    rawTransactionOutputs: Map<string, KeyOutput[]>;
    stakingTxHashes: Set<string>;
    pendingTxData: Map<string, {
        outputs: WalletOutput[];
        spends: WalletSpend[];
        blockHeight: number;
        timestamp: number;
        isCoinbase: boolean;
        isStaking: boolean;
    }>;
}
export type TransactionDiscoveredHandler = (transaction: import('./types').WalletDisplayTransaction) => void;
export type BlockProcessedHandler = (block: SyncedBlockInfo) => void;
export type TransactionFoundHandler = (output: WalletOutput) => void;
export type SpendFoundHandler = (spend: WalletSpend) => void;
/**
 * Process a single block
 */
export declare function processBlock(block: WalletBlockInfo, ctx: ProcessingContext, syncedBlocks: Map<number, SyncedBlockInfo>, blockCheckpoints: Map<number, string>, onBlockProcessed?: BlockProcessedHandler, onTransactionFound?: TransactionFoundHandler, onSpendFound?: SpendFoundHandler, onTransactionDiscovered?: TransactionDiscoveredHandler): Promise<{
    newOutputs: WalletOutput[];
    newSpends: WalletSpend[];
}>;
/**
 * Process outputs in a block to find wallet's UTXOs
 */
export declare function processOutputs(block: WalletBlockInfo, ctx: ProcessingContext): WalletOutput[];
/**
 * Process spends in a block to find wallet's spent inputs
 */
export declare function processSpends(block: WalletBlockInfo, ctx: ProcessingContext): WalletSpend[];
/**
 * Handle fork by removing blocks at or above given height
 */
export declare function handleFork(forkHeight: number, ctx: ProcessingContext, syncedBlocks: Map<number, SyncedBlockInfo>, blockCheckpoints: Map<number, string>): Promise<void>;
/**
 * Prune spent inputs older than PRUNE_INTERVAL blocks
 */
export declare function pruneSpentInputs(currentHeight: number, outputs: Map<string, WalletOutput>): void;
/**
 * Add a block checkpoint
 */
export declare function addCheckpoint(height: number, hash: string, blockCheckpoints: Map<number, string>): void;
/**
 * Prune old checkpoints (keep last 50 + periodic checkpoints)
 */
export declare function pruneCheckpoints(blockCheckpoints: Map<number, string>): void;
/**
 * Prune old synced blocks (keep last 1000)
 */
export declare function pruneSyncedBlocks(syncedBlocks: Map<number, SyncedBlockInfo>): void;
//# sourceMappingURL=walletSync-processing.d.ts.map