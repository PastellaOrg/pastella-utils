/**
 * Pastella Wallet Synchronization - Balance Calculation
 *
 * Handles balance calculation and output retrieval
 */
import { isOutputSpendable } from './walletSync-utils';
/**
 * Recalculate balances from current outputs and spends
 */
export function recalculateBalances(ctx) {
    const { outputs, stakingTxHashes } = ctx;
    const currentHeight = ctx.currentHeight;
    let available = 0;
    let locked = 0;
    let stakingLocked = 0;
    // DEBUG: Count outputs by status
    let totalOutputs = 0;
    let spentOutputs = 0;
    let unspentOutputs = 0;
    let totalAllAmount = 0;
    let totalUnspentAmount = 0;
    let totalSpentAmount = 0;
    for (const output of outputs.values()) {
        totalOutputs++;
        totalAllAmount += output.amount;
        // Skip spent outputs - they should not be included in balance
        if (output.spentHeight) {
            spentOutputs++;
            totalSpentAmount += output.amount;
            continue;
        }
        unspentOutputs++;
        totalUnspentAmount += output.amount;
        // Pass 0 for blockTimestamp since we don't store it
        // Timestamp-based unlocks will be treated as locked (conservative)
        const unlockMet = isOutputSpendable(output.blockHeight, output.unlockTime, 0, // blockTimestamp not stored
        currentHeight);
        if (unlockMet) {
            available += output.amount;
        }
        else {
            // Check if this is a staking output (by flag OR by transaction hash)
            // This handles both new outputs (with isStaking flag) and old saved state (without flag)
            const isStakingOutput = output.isStaking || stakingTxHashes.has(output.transactionHash);
            if (isStakingOutput) {
                stakingLocked += output.amount;
            }
            else {
                locked += output.amount;
            }
        }
    }
    return { available, locked, stakingLocked };
}
/**
 * Get staking locked balance (outputs from staking transactions that are not yet unlocked)
 */
export function getStakingLockedBalance(ctx) {
    const { outputs, stakingTxHashes, currentHeight } = ctx;
    let stakingLocked = 0;
    for (const output of outputs.values()) {
        // Skip spent outputs
        if (output.spentHeight)
            continue;
        // Check if this is a staking output (by flag OR by transaction hash)
        const isStakingOutput = output.isStaking || stakingTxHashes.has(output.transactionHash);
        if (isStakingOutput) {
            const unlockMet = isOutputSpendable(output.blockHeight, output.unlockTime, 0, // blockTimestamp not stored
            currentHeight);
            if (!unlockMet) {
                stakingLocked += output.amount;
            }
        }
    }
    return stakingLocked;
}
/**
 * Get unspent outputs
 */
export function getUnspentOutputs(allOutputs) {
    return allOutputs.filter(o => !o.spentHeight);
}
/**
 * Get available outputs (unspent and matured)
 * Checks both block maturity and unlock time
 * Excludes staking outputs which are tracked separately in stakingLocked
 */
export function getAvailableOutputs(allOutputs, stakingTxHashes, currentHeight) {
    return getUnspentOutputs(allOutputs).filter(o => {
        // Exclude staking outputs (they're tracked separately in stakingLocked)
        const isStakingOutput = o.isStaking || stakingTxHashes.has(o.transactionHash);
        if (isStakingOutput) {
            return false; // Never include staking outputs in available
        }
        return isOutputSpendable(o.blockHeight, o.unlockTime, 0, // blockTimestamp not stored
        currentHeight);
    });
}
/**
 * Get locked outputs (unspent but not yet matured or unlocked)
 * Excludes staking outputs which are counted separately in stakingLocked
 */
export function getLockedOutputs(allOutputs, stakingTxHashes, currentHeight) {
    const locked = getUnspentOutputs(allOutputs).filter(o => {
        // Exclude staking outputs (they're counted in stakingLocked)
        const isStakingOutput = o.isStaking || stakingTxHashes.has(o.transactionHash);
        if (isStakingOutput) {
            return false; // Never include staking outputs in locked
        }
        // Only include outputs that are not yet spendable (mature + unlockTime met)
        const spendable = isOutputSpendable(o.blockHeight, o.unlockTime, 0, // blockTimestamp not stored
        currentHeight);
        return !spendable;
    });
    return locked;
}
