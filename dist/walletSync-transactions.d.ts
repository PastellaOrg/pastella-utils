/**
 * Pastella Wallet Synchronization - Transaction Processing
 *
 * Handles transaction classification and address extraction
 */
import { WalletOutput, WalletSpend, WalletDisplayTransaction, AddressInfo, KeyOutput } from './types';
export interface TransactionContext {
    publicKeys: Set<string>;
    currentHeight: number;
    rawTransactionOutputs: Map<string, KeyOutput[]>;
    stakingTxHashes: Set<string>;
}
export interface TransactionData {
    outputs: WalletOutput[];
    spends: WalletSpend[];
    blockHeight: number;
    timestamp: number;
    isCoinbase: boolean;
    isStaking: boolean;
}
/**
 * Classify a transaction and return a WalletDisplayTransaction
 */
export declare function classifyTransaction(txHash: string, data: TransactionData, ctx: TransactionContext): WalletDisplayTransaction | null;
/**
 * Extract from/to addresses for a transaction
 */
export declare function extractFromToAddresses(txHash: string, type: 'incoming' | 'outgoing' | 'staking' | 'coinbase', walletOutputs: WalletOutput[], ctx: TransactionContext): {
    from?: AddressInfo[];
    to?: AddressInfo[];
};
/**
 * Helper to create a WalletDisplayTransaction
 */
export declare function createDisplayTransaction(hash: string, type: 'incoming' | 'outgoing' | 'staking' | 'coinbase', amount: number, blockHeight: number, timestamp: number, currentHeight: number, walletOutputs: WalletOutput[], ctx: TransactionContext): WalletDisplayTransaction;
/**
 * Get transactions with proper classification
 * Returns an array of wallet transactions sorted by block height (newest first)
 */
export declare function getTransactions(allOutputs: WalletOutput[], allSpends: WalletSpend[], stakingTxHashes: Set<string>, publicKeys: Set<string>, currentHeight: number, rawTransactionOutputs: Map<string, KeyOutput[]>, limit?: number): WalletDisplayTransaction[];
//# sourceMappingURL=walletSync-transactions.d.ts.map