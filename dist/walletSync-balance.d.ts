/**
 * Pastella Wallet Synchronization - Balance Calculation
 *
 * Handles balance calculation and output retrieval
 */
import { WalletOutput } from './types';
export interface BalanceContext {
    outputs: Map<string, WalletOutput>;
    stakingTxHashes: Set<string>;
    currentHeight: number;
}
/**
 * Recalculate balances from current outputs and spends
 */
export declare function recalculateBalances(ctx: BalanceContext): {
    available: number;
    locked: number;
    stakingLocked: number;
};
/**
 * Get staking locked balance (outputs from staking transactions that are not yet unlocked)
 */
export declare function getStakingLockedBalance(ctx: BalanceContext): number;
/**
 * Get unspent outputs
 */
export declare function getUnspentOutputs(allOutputs: WalletOutput[]): WalletOutput[];
/**
 * Get available outputs (unspent and matured)
 * Checks both block maturity and unlock time
 * Excludes staking outputs which are tracked separately in stakingLocked
 */
export declare function getAvailableOutputs(allOutputs: WalletOutput[], stakingTxHashes: Set<string>, currentHeight: number): WalletOutput[];
/**
 * Get locked outputs (unspent but not yet matured or unlocked)
 * Excludes staking outputs which are counted separately in stakingLocked
 */
export declare function getLockedOutputs(allOutputs: WalletOutput[], stakingTxHashes: Set<string>, currentHeight: number): WalletOutput[];
//# sourceMappingURL=walletSync-balance.d.ts.map