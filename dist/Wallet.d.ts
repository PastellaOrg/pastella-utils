/**
 * Pastella Wallet Class
 *
 * Simple wallet interface for sending transactions
 * Handles syncing and transaction creation internally
 */
import { WalletOutput } from './types';
import { TransactionDestination } from './transaction';
export interface WalletConfig {
    ip: string;
    port: number;
    ssl?: boolean;
    publicKey: string;
    startHeight?: number;
}
export interface SendRequest {
    mnemonic: string;
    destinations: TransactionDestination[];
    fee?: number;
    maturityBlocks?: number;
}
export interface SendResult {
    hash: string;
    fee: number;
    inputsUsed: number;
    change: number;
    txHex: string;
}
export declare class Wallet {
    private walletSync;
    private publicKey;
    private node;
    constructor(config: WalletConfig);
    /**
     * Get current wallet sync state
     */
    getSyncState(): import("./types").WalletSyncState;
    /**
     * Get available outputs for spending
     */
    getAvailableOutputs(): WalletOutput[];
    /**
     * Get available balance
     */
    getAvailableBalance(): number;
    /**
     * Sync wallet with blockchain
     */
    performSync(): Promise<void>;
    /**
     * Stop wallet sync
     */
    stopSync(): void;
    /**
     * Resync from a specific height
     * Creates a new WalletSync instance and starts syncing from the given height
     */
    resyncFromHeight(height: number): Promise<void>;
    /**
     * Send a transaction
     * Handles key derivation, transaction creation, and sending internally
     */
    sendTransaction(request: SendRequest): Promise<SendResult>;
}
//# sourceMappingURL=Wallet.d.ts.map