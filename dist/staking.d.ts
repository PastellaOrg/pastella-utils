/**
 * Pastella Staking Module
 *
 * Handles staking transaction creation and management
 * Based on pastella-core zedwallet++ implementation
 */
import { WalletOutput, NodeConfig, PendingStake, PendingStakeState, StakingResult } from './types';
import { SelectedInput } from './transaction';
/**
 * Calculate unlock time (block height) from lock duration and current height
 * Formula: unlockTime = currentHeight + (lockDurationDays * 86400) / 30
 * (30 seconds per block)
 */
export declare function calculateUnlockTime(lockDurationDays: number, currentHeight: number): number;
/**
 * Get staking denominations for a given amount
 * For staking, we want a SINGLE output (exact amount)
 */
export declare function getStakingDenominations(amount: number): number[];
/**
 * Find the transaction hash that contains precise staking outputs
 * Returns the transaction hash if found, null otherwise
 */
export declare function findPreciseStakingOutputsTxHash(amount: number, outputs: WalletOutput[], currentHeight: number, currentFee?: number, maturityBlocks?: number): string | null;
/**
 * Check if wallet has precise outputs for staking
 * Needs exactly TWO inputs:
 * 1. One input matching the exact staking amount
 * 2. One input for the fee (exactly currentFee)
 */
export declare function hasPreciseStakingOutputs(amount: number, outputs: WalletOutput[], currentHeight: number, currentFee?: number, // Use dynamic fee
maturityBlocks?: number): boolean;
/**
 * Pick exact inputs for staking transaction
 * Returns: [amountInput, feeInput] or null if not available
 *
 * @param preparationTxHash - Optional: Only pick outputs from this specific transaction
 */
export declare function pickStakingInputs(amount: number, outputs: WalletOutput[], currentHeight: number, publicKey: string, privateKey: string, currentFee?: number, // Use dynamic fee
maturityBlocks?: number, preparationTxHash?: string): {
    inputs: SelectedInput[];
    totalInput: number;
} | null;
/**
 * Staking extra field data structure
 * Matches C++ TransactionExtraStaking from pastella-core
 */
export interface TransactionExtraStaking {
    stakingType: number;
    amount: number;
    unlockTime: number;
    lockDurationDays: number;
    signature: string;
}
/**
 * Create staking extra field with signature
 */
export declare function createStakingExtra(amount: number, unlockTime: number, lockDurationDays: number, signature: string): Uint8Array;
/**
 * Generate staking signature
 * Signs the message (amount + lockDurationDays + unlockTime) with the input's private key
 */
export declare function generateStakingSignature(amount: number, lockDurationDays: number, unlockTime: number, publicKey: string, privateKey: string): string;
/**
 * Prepare staking outputs by sending a transaction to self
 * Creates exact outputs needed for staking: [amount, currentFee]
 *
 * This manually builds a transaction to ensure we get exactly 2 outputs.
 */
export declare function prepareStakingOutputs(amount: number, address: string, outputs: WalletOutput[], publicKey: string, privateKey: string, currentHeight: number, node: NodeConfig, maturityBlocks?: number): Promise<StakingResult>;
/**
 * Create a staking transaction
 * This creates the actual staking transaction with proper extra data
 *
 * @param preparationTxHash - Optional: Transaction hash of preparation transaction (outputs will be used as inputs)
 */
export declare function createStakingTransaction(amount: number, lockDurationDays: number, address: string, outputs: WalletOutput[], publicKey: string, privateKey: string, currentHeight: number, node: NodeConfig, maturityBlocks?: number, preparationTxHash?: string): Promise<StakingResult>;
/**
 * Create a pending stake entry
 */
export declare function createPendingStake(amount: number, lockDurationDays: number, address: string, state?: PendingStakeState): PendingStake;
/**
 * Update pending stake state
 */
export declare function updatePendingStake(stake: PendingStake, updates: Partial<Omit<PendingStake, 'id' | 'createdAt' | 'amount' | 'lockDurationDays' | 'address'>>): PendingStake;
/**
 * Check if outputs are available for a pending stake
 */
export declare function checkOutputsAvailable(stake: PendingStake, outputs: WalletOutput[], currentHeight: number, currentFee?: number, maturityBlocks?: number): boolean;
declare const _default: {
    calculateUnlockTime: typeof calculateUnlockTime;
    getStakingDenominations: typeof getStakingDenominations;
    hasPreciseStakingOutputs: typeof hasPreciseStakingOutputs;
    pickStakingInputs: typeof pickStakingInputs;
    createStakingExtra: typeof createStakingExtra;
    generateStakingSignature: typeof generateStakingSignature;
    prepareStakingOutputs: typeof prepareStakingOutputs;
    createStakingTransaction: typeof createStakingTransaction;
    createPendingStake: typeof createPendingStake;
    updatePendingStake: typeof updatePendingStake;
    checkOutputsAvailable: typeof checkOutputsAvailable;
    PendingStakeState: typeof PendingStakeState;
};
export default _default;
//# sourceMappingURL=staking.d.ts.map