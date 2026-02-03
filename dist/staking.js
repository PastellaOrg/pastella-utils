/**
 * Pastella Staking Module
 *
 * Handles staking transaction creation and management
 * Based on pastella-core zedwallet++ implementation
 */
import { PendingStakeState, } from './types';
import { sendTransaction as sendTx, } from './transaction';
import { keccak256 } from 'js-sha3';
import { generateSchnorrSignature } from './crypto';
import { MATURITY_BLOCKS, BLOCK_TIME_SECONDS, STAKING_TX_TYPE, TX_EXTRA_STAKING, MIN_FEE, } from './config';
// ============================================================================
// STAKING HELPERS
// ============================================================================
/**
 * Calculate unlock time (block height) from lock duration and current height
 * Formula: unlockTime = currentHeight + (lockDurationDays * 86400) / 30
 * (30 seconds per block)
 */
export function calculateUnlockTime(lockDurationDays, currentHeight) {
    const lockPeriodBlocks = (lockDurationDays * 86400) / BLOCK_TIME_SECONDS;
    return currentHeight + Math.floor(lockPeriodBlocks);
}
/**
 * Get staking denominations for a given amount
 * For staking, we want a SINGLE output (exact amount)
 */
export function getStakingDenominations(amount) {
    return [amount];
}
/**
 * Find the transaction hash that contains precise staking outputs
 * Returns the transaction hash if found, null otherwise
 */
export function findPreciseStakingOutputsTxHash(amount, outputs, currentHeight, currentFee = MIN_FEE, maturityBlocks = MATURITY_BLOCKS) {
    // Get spendable outputs
    const matureHeight = currentHeight - maturityBlocks;
    const spendable = outputs.filter(o => {
        const isUnspent = !o.spentHeight;
        const isMature = o.blockHeight <= matureHeight;
        return isUnspent && isMature && o.unlockTime === 0;
    });
    // Find amount output
    const amountOutput = spendable.find(o => o.amount === amount);
    if (!amountOutput) {
        return null;
    }
    // Find fee output from the same transaction
    const feeOutput = spendable.find(o => o.amount === currentFee &&
        o.transactionHash === amountOutput.transactionHash &&
        o.transactionIndex === amountOutput.transactionIndex &&
        o.outputIndex !== amountOutput.outputIndex);
    if (!feeOutput) {
        return null;
    }
    // Both outputs exist in the same transaction
    return amountOutput.transactionHash;
}
/**
 * Check if wallet has precise outputs for staking
 * Needs exactly TWO inputs:
 * 1. One input matching the exact staking amount
 * 2. One input for the fee (exactly currentFee)
 */
export function hasPreciseStakingOutputs(amount, outputs, currentHeight, currentFee = MIN_FEE, // Use dynamic fee
maturityBlocks = MATURITY_BLOCKS) {
    // Get spendable outputs
    const matureHeight = currentHeight - maturityBlocks;
    const spendable = outputs.filter(o => {
        const isUnspent = !o.spentHeight;
        const isMature = o.blockHeight <= matureHeight;
        return isUnspent && isMature && o.unlockTime === 0; // Must be unlocked
    });
    // Find exact amount input
    const hasAmountInput = spendable.some(o => o.amount === amount);
    // Find exact currentFee input that's different from the amount input
    const hasFeeInput = spendable.some(o => o.amount === currentFee && o.amount !== amount);
    // Check they're from different outputs
    if (hasAmountInput && hasFeeInput) {
        const amountInputs = spendable.filter(o => o.amount === amount);
        const feeInputs = spendable.filter(o => o.amount === currentFee && o.amount !== amount);
        // Need at least one fee input that's from a different transaction
        const hasDifferentFeeInput = feeInputs.some(fee => {
            return !amountInputs.some(amount => {
                return amount.transactionHash === fee.transactionHash &&
                    amount.transactionIndex === fee.transactionIndex;
            });
        });
        return hasDifferentFeeInput;
    }
    return false;
}
/**
 * Pick exact inputs for staking transaction
 * Returns: [amountInput, feeInput] or null if not available
 *
 * @param preparationTxHash - Optional: Only pick outputs from this specific transaction
 */
export function pickStakingInputs(amount, outputs, currentHeight, publicKey, privateKey, currentFee = MIN_FEE, // Use dynamic fee
maturityBlocks = MATURITY_BLOCKS, preparationTxHash // NEW: Only use outputs from preparation transaction
) {
    // Get spendable outputs
    const matureHeight = currentHeight - maturityBlocks;
    const spendable = outputs.filter(o => {
        const isUnspent = !o.spentHeight;
        const isMature = o.blockHeight <= matureHeight;
        return isUnspent && isMature && o.unlockTime === 0;
    });
    // If preparationTxHash is provided, only use outputs from that transaction
    const filteredOutputs = preparationTxHash
        ? spendable.filter(o => o.transactionHash === preparationTxHash)
        : spendable;
    console.log('[pickStakingInputs] Filtering outputs:', {
        totalSpendable: spendable.length,
        preparationTxHash: preparationTxHash?.substring(0, 16) + '...',
        filteredCount: filteredOutputs.length,
        filteredAmounts: filteredOutputs.map(o => o.amount),
        expectedAmount: amount,
        expectedFee: currentFee,
    });
    // Find input for the exact staking amount
    let amountInput = null;
    for (const output of filteredOutputs) {
        if (output.amount === amount) {
            amountInput = output;
            break;
        }
    }
    if (!amountInput) {
        console.log('[pickStakingInputs] Amount input not found in filtered outputs');
        return null;
    }
    // Find input for the fee (must be exactly currentFee, different output)
    let feeInput = null;
    console.log('[pickStakingInputs] Searching for fee input with amount:', currentFee);
    console.log('[pickStakingInputs] amountInput details:', {
        amount: amountInput.amount,
        transactionHash: amountInput.transactionHash.substring(0, 16) + '...',
        transactionIndex: amountInput.transactionIndex,
        outputIndex: amountInput.outputIndex,
    });
    for (const output of filteredOutputs) {
        const amountMatch = output.amount === currentFee;
        const notAmountMatch = output.amount !== amount;
        const hashDifferent = output.transactionHash !== amountInput.transactionHash;
        const indexDifferent = output.transactionIndex !== amountInput.transactionIndex;
        console.log('[pickStakingInputs] Checking output:', {
            amount: output.amount,
            transactionIndex: output.transactionIndex,
            outputIndex: output.outputIndex,
            amountMatch,
            notAmountMatch,
            hashDifferent,
            indexDifferent,
            wouldSelect: amountMatch && notAmountMatch && (hashDifferent || indexDifferent),
        });
        if (amountMatch && notAmountMatch) {
            // Check it's not the same as the amount input
            if (hashDifferent || indexDifferent) {
                feeInput = output;
                console.log('[pickStakingInputs] Found fee input!');
                break;
            }
            else {
                console.log('[pickStakingInputs] Fee output matches but is same as amount input?');
            }
        }
    }
    if (!feeInput) {
        console.log('[pickStakingInputs] Fee input not found in filtered outputs');
        return null;
    }
    // Create SelectedInput array
    const amountOutputIndex = amountInput.outputIndex ?? 0;
    const feeOutputIndex = feeInput.outputIndex ?? 0;
    const inputs = [
        {
            output: amountInput,
            transactionHash: amountInput.transactionHash,
            outputIndex: amountOutputIndex,
            publicKey,
            privateKey,
        },
        {
            output: feeInput,
            transactionHash: feeInput.transactionHash,
            outputIndex: feeOutputIndex,
            publicKey,
            privateKey,
        },
    ];
    console.log('[pickStakingInputs] === PICKED STAKING INPUTS ===');
    console.log('[pickStakingInputs] Wallet publicKey:', publicKey.substring(0, 16) + '...');
    console.log('[pickStakingInputs] Amount output key:', amountInput.key.substring(0, 16) + '...');
    console.log('[pickStakingInputs] Fee output key:', feeInput.key.substring(0, 16) + '...');
    console.log('[pickStakingInputs] Keys match output?', amountInput.key === publicKey && feeInput.key === publicKey);
    console.log('[pickStakingInputs] Amount input:', {
        amount: amountInput.amount,
        transactionHash: amountInput.transactionHash,
        outputIndex: amountInput.outputIndex,
        amountOutputIndex,
    });
    console.log('[pickStakingInputs] Fee input:', {
        amount: feeInput.amount,
        transactionHash: feeInput.transactionHash,
        outputIndex: feeInput.outputIndex,
        feeOutputIndex,
        expectedFee: currentFee,
    });
    console.log('[pickStakingInputs] SelectedInput array:', inputs.map(i => ({
        outputAmount: i.output.amount,
        outputIndex: i.outputIndex,
        txHash: i.transactionHash.substring(0, 16) + '...',
    })));
    console.log('[pickStakingInputs] Total input:', amount + currentFee);
    console.log('[pickStakingInputs] ======================================');
    return {
        inputs,
        totalInput: amount + currentFee,
    };
}
/**
 * Create staking extra field with signature
 */
export function createStakingExtra(amount, unlockTime, lockDurationDays, signature) {
    const parts = [];
    // TX_EXTRA_STAKING tag (0x65 = 101)
    parts.push(TX_EXTRA_STAKING);
    // Serialize staking data manually to match C++ format
    // stakingType (varint)
    parts.push(...writeVarint(STAKING_TX_TYPE));
    // amount (varint)
    parts.push(...writeVarint(amount));
    // unlockTime (varint)
    parts.push(...writeVarint(unlockTime));
    // lockDurationDays (varint)
    parts.push(...writeVarint(lockDurationDays));
    // signature (64 bytes)
    const sigBytes = hexToBytes(signature);
    if (sigBytes.length !== 64) {
        throw new Error('Signature must be 64 bytes');
    }
    parts.push(...Array.from(sigBytes));
    return new Uint8Array(parts);
}
/**
 * Generate staking signature
 * Signs the message (amount + lockDurationDays + unlockTime) with the input's private key
 */
export function generateStakingSignature(amount, lockDurationDays, unlockTime, publicKey, privateKey) {
    // Create message: amount + lockDurationDays + unlockTime
    const message = new Uint8Array(8 + 4 + 8); // uint64 + uint32 + uint64
    const messageView = new DataView(message.buffer);
    // Write amount (uint64, little-endian)
    messageView.setBigUint64(0, BigInt(amount), true);
    // Write lockDurationDays (uint32, little-endian)
    messageView.setUint32(8, lockDurationDays, true);
    // Write unlockTime (uint64, little-endian)
    messageView.setBigUint64(12, BigInt(unlockTime), true);
    console.log('[generateStakingSignature] Message bytes:', Array.from(message).map(b => b.toString(16).padStart(2, '0')).join(' '));
    console.log('[generateStakingSignature] Message params:', { amount, lockDurationDays, unlockTime });
    // Hash the message using Keccak-256
    const messageHash = keccak256(message);
    const messageHashBytes = hexToBytes(messageHash);
    console.log('[generateStakingSignature] Message hash:', messageHash);
    // Generate Schnorr signature
    const signature = generateSchnorrSignature(messageHashBytes, publicKey, privateKey);
    console.log('[generateStakingSignature] Signature:', bytesToHex(signature).substring(0, 32) + '...');
    // Verify the signature locally before returning
    const { verifySchnorrSignature } = require('./crypto');
    const isValid = verifySchnorrSignature(messageHashBytes, publicKey, signature);
    console.log('[generateStakingSignature] Local signature verification:', isValid ? 'VALID' : 'INVALID');
    if (!isValid) {
        console.error('[generateStakingSignature] ERROR: Generated signature is INVALID!');
    }
    return bytesToHex(signature);
}
// ============================================================================
// PREPARATION TRANSACTION
// ============================================================================
/**
 * Prepare staking outputs by sending a transaction to self
 * Creates exact outputs needed for staking: [amount, currentFee]
 *
 * This manually builds a transaction to ensure we get exactly 2 outputs.
 */
export async function prepareStakingOutputs(amount, address, outputs, publicKey, privateKey, currentHeight, node, maturityBlocks = MATURITY_BLOCKS) {
    console.log('[prepareStakingOutputs] Called with currentHeight:', currentHeight);
    try {
        // Use MIN_FEE constant
        const currentFee = MIN_FEE;
        console.log('[prepareStakingOutputs] Using MIN_FEE:', currentFee);
        // Get spendable outputs
        const matureHeight = currentHeight - maturityBlocks;
        const spendable = outputs.filter(o => {
            const isUnspent = !o.spentHeight;
            const isMature = o.blockHeight <= matureHeight;
            return isUnspent && isMature && o.unlockTime === 0;
        });
        // We need to create outputs: [amount, currentFee]
        // The transaction fee should be the currentFee as well (to match inputs)
        // So we need: amount + currentFee + currentFee = amount + 2*currentFee
        const txFee = currentFee; // Use currentFee as the transaction fee
        const totalNeeded = amount + currentFee + txFee;
        // Try to find outputs that sum to exactly what we need
        // Sort by amount (descending)
        const sorted = [...spendable].sort((a, b) => b.amount - a.amount);
        // Try to find a single output with exactly the amount we need
        let selectedInputs = [];
        let totalInput = 0;
        for (const output of sorted) {
            selectedInputs.push(output);
            totalInput += output.amount;
            if (totalInput >= totalNeeded) {
                break;
            }
        }
        if (totalInput < totalNeeded) {
            return {
                success: false,
                error: `Insufficient funds. Need ${totalNeeded}, have ${totalInput}`,
            };
        }
        console.log('[prepareStakingOutputs] Selected inputs:', selectedInputs.length, 'total:', totalInput);
        // Build the preparation transaction manually
        // Convert to SelectedInput format
        const inputs = selectedInputs.map(output => ({
            output,
            transactionHash: output.transactionHash,
            outputIndex: output.outputIndex ?? 0,
            publicKey,
            privateKey,
        }));
        // Get the output key (public key) from address
        let outputKey;
        if (address.length === 64 && /^[0-9a-fA-F]{64}$/.test(address)) {
            outputKey = address;
        }
        else {
            const { addressToPublicKey } = await import('./transaction');
            outputKey = addressToPublicKey(address);
        }
        // Build the transaction manually
        const txHex = await buildPreparationTransactionHex(amount, currentFee, // Pass currentFee
        inputs, outputKey, publicKey, privateKey);
        if (!txHex) {
            return {
                success: false,
                error: 'Failed to build preparation transaction',
            };
        }
        // Send transaction
        console.log('[prepareStakingOutputs] Sending transaction...');
        const result = await sendTx(txHex, node);
        console.log('[prepareStakingOutputs] Transaction sent:', result);
        return {
            success: true,
            txHash: result.hash,
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
// ============================================================================
// STAKING TRANSACTION CREATION
// ============================================================================
/**
 * Create a staking transaction
 * This creates the actual staking transaction with proper extra data
 *
 * @param preparationTxHash - Optional: Transaction hash of preparation transaction (outputs will be used as inputs)
 */
export async function createStakingTransaction(amount, lockDurationDays, address, outputs, publicKey, privateKey, currentHeight, node, maturityBlocks = MATURITY_BLOCKS, preparationTxHash // NEW: Use outputs from this specific transaction
) {
    try {
        console.log('[createStakingTransaction] Starting with amount:', amount);
        console.log('[createStakingTransaction] currentHeight:', currentHeight);
        if (preparationTxHash) {
            console.log('[createStakingTransaction] Using preparation tx:', preparationTxHash.substring(0, 16) + '...');
        }
        // Use MIN_FEE constant
        const currentFee = MIN_FEE;
        console.log('[createStakingTransaction] Using MIN_FEE:', currentFee);
        // Check if precise outputs exist (using the current fee)
        if (!hasPreciseStakingOutputs(amount, outputs, currentHeight, currentFee, maturityBlocks)) {
            return {
                success: false,
                error: 'Precise staking outputs not available. Please prepare outputs first.',
            };
        }
        // Pick exact inputs (passing preparationTxHash if provided)
        const picked = pickStakingInputs(amount, outputs, currentHeight, publicKey, privateKey, currentFee, maturityBlocks, preparationTxHash);
        if (!picked) {
            return {
                success: false,
                error: 'Failed to pick staking inputs - exact amounts not available',
            };
        }
        console.log('[createStakingTransaction] Picked inputs:', picked.inputs.length, 'totalInput:', picked.totalInput);
        console.log('[createStakingTransaction] Picked inputs details:', picked.inputs.map((i, idx) => ({
            index: idx,
            amount: i.output.amount,
            outputIndex: i.outputIndex,
            txHash: i.transactionHash.substring(0, 16) + '...',
        })));
        // Calculate unlock time
        console.log('[createStakingTransaction] unlockTime calculation:', {
            lockDurationDays,
            currentHeight,
            blockTimeSeconds: BLOCK_TIME_SECONDS,
            lockPeriodBlocks: (lockDurationDays * 86400) / BLOCK_TIME_SECONDS,
            unlockTime: calculateUnlockTime(lockDurationDays, currentHeight),
        });
        const unlockTime = calculateUnlockTime(lockDurationDays, currentHeight);
        // Generate staking signature
        // CRITICAL: Must use the same public key that's in the UTXO output being spent
        // The daemon will extract this key from the preparation transaction output
        const utxoPublicKey = picked.inputs[0].output.key;
        console.log('[createStakingTransaction] UTXO public key:', utxoPublicKey.substring(0, 16) + '...');
        console.log('[createStakingTransaction] Wallet public key:', publicKey.substring(0, 16) + '...');
        console.log('[createStakingTransaction] Keys match:', utxoPublicKey === publicKey);
        const signature = generateStakingSignature(amount, lockDurationDays, unlockTime, publicKey, privateKey);
        console.log('[createStakingTransaction] Signature generated');
        // Build transaction manually with staking extra
        const txHex = await buildStakingTransactionHex(amount, lockDurationDays, unlockTime, signature, address, picked.inputs, publicKey, privateKey);
        if (!txHex) {
            return {
                success: false,
                error: 'Failed to build staking transaction',
            };
        }
        console.log('[createStakingTransaction] Transaction hex length:', txHex.length);
        console.log('[createStakingTransaction] Transaction hex (first 200 chars):', txHex.substring(0, 200));
        console.log('[createStakingTransaction] Transaction built, sending...');
        // Calculate proper transaction hash using Keccak-256 of full transaction bytes
        const txBytes = hexToBytes(txHex);
        const txHash = keccak256(txBytes);
        console.log('[createStakingTransaction] Transaction hash:', txHash);
        // Send transaction
        const result = await sendTx(txHex, node);
        console.log('[createStakingTransaction] Transaction sent:', result);
        return {
            success: true,
            txHash: txHash, // Use proper Keccak-256 hash
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
/**
 * Build preparation transaction hex
 * Creates a transaction that sends [amount, currentFee] to self
 * This creates the exact outputs needed for the staking transaction
 */
async function buildPreparationTransactionHex(amount, currentFee, inputs, outputKey, publicKey, privateKey) {
    const { keccak256 } = await import('js-sha3');
    const { generateSchnorrSignature } = await import('./crypto');
    // Convert SelectedInput[] to SerializedKeyInput[]
    const serializedInputs = inputs.map(input => ({
        amount: input.output.amount,
        outputIndexes: [input.outputIndex ?? 0],
        transactionHash: input.transactionHash,
        outputIndex: input.outputIndex ?? 0,
        publicKey: input.publicKey,
        privateKey: input.privateKey,
    }));
    // Calculate total input
    const totalInput = inputs.reduce((sum, input) => sum + input.output.amount, 0);
    // Create 3 outputs: [staking amount, staking tx fee, change]
    const outputAmount1 = amount; // Staking amount
    const outputAmount2 = currentFee; // Fee for staking transaction
    const preparationTxFee = MIN_FEE; // Fee for this preparation transaction
    const change = totalInput - outputAmount1 - outputAmount2 - preparationTxFee;
    if (change < 0) {
        console.error('[buildPreparationTransactionHex] ERROR: Insufficient inputs!', {
            totalInput,
            needed: amount + currentFee + preparationTxFee,
            stakingAmount: amount,
            stakingTxFee: currentFee,
            preparationTxFee,
        });
        return '';
    }
    const totalOutput = outputAmount1 + outputAmount2 + change;
    console.log('[buildPreparationTransactionHex] === PREPARATION TRANSACTION DETAILS ===');
    console.log('[buildPreparationTransactionHex] Building tx:', {
        totalInput,
        outputs: [outputAmount1, outputAmount2, change],
        totalOutput,
        preparationTxFee,
        currentFee,
        expectedOutputs: `Output1: ${amount} (staking), Output2: ${currentFee} (staking tx fee), Output3: ${change} (change)`,
        stakingAmount: amount,
    });
    console.log('[buildPreparationTransactionHex] After this tx is mined, wallet should have outputs:');
    console.log(`[buildPreparationTransactionHex]   - ${amount} (staking amount)`);
    console.log(`[buildPreparationTransactionHex]   - ${currentFee} (fee for staking tx)`);
    console.log(`[buildPreparationTransactionHex]   - ${change} (change returned to wallet)`);
    console.log('[buildPreparationTransactionHex] ==================================================');
    // Build outputs: [staking amount, staking tx fee, change]
    const serializedOutputs = [
        { key: outputKey, amount: outputAmount1 },
        { key: outputKey, amount: outputAmount2 },
        { key: outputKey, amount: change },
    ];
    // Build extra field with only transaction public key (normal extra field)
    const extraData = buildNormalExtra(publicKey);
    // Build transaction prefix
    const prefixBytes = serializeTransactionPrefixWithCustomExtra(serializedInputs, serializedOutputs, extraData, 0, // unlockTime = 0 (normal transaction)
    1 // version = 1
    );
    // Compute hash of the prefix for signing
    const prefixHash = keccak256(prefixBytes);
    const prefixHashBytes = hexToBytes(prefixHash);
    // Generate signatures for each input
    const signatures = [];
    for (const input of inputs) {
        const sig = generateSchnorrSignature(prefixHashBytes, input.publicKey, input.privateKey);
        signatures.push(sig);
    }
    // Concatenate prefix + signatures
    const txParts = [prefixBytes, ...signatures];
    const txBytes = concatBytes(...txParts);
    // Convert to hex
    return bytesToHex(txBytes);
}
/**
 * Build normal extra field (only public key, no staking data)
 */
function buildNormalExtra(publicKey) {
    const extra = [];
    // TX_EXTRA_TAG_PUBKEY (0x01)
    extra.push(0x01);
    const pubKeyBytes = hexToBytes(publicKey);
    extra.push(...Array.from(pubKeyBytes));
    return new Uint8Array(extra);
}
/**
 * Build staking transaction hex with staking extra field
 * Uses TransactionSerializer from transaction.ts for proper serialization
 */
async function buildStakingTransactionHex(amount, lockDurationDays, unlockTime, signature, address, inputs, publicKey, privateKey) {
    // Import TransactionSerializer and utilities from transaction.ts
    const { TransactionSerializer, addressToPublicKey } = await import('./transaction');
    const { keccak256 } = await import('js-sha3');
    const { generateSchnorrSignature } = await import('./crypto');
    // Convert SelectedInput[] to SerializedKeyInput[]
    console.log('[buildStakingTransactionHex] Inputs before conversion:', inputs.map(i => ({
        amount: i.output.amount,
        outputIndex: i.outputIndex,
        transactionHash: i.transactionHash.substring(0, 16) + '...',
    })));
    const serializedInputs = inputs.map(input => {
        const result = {
            amount: input.output.amount,
            outputIndexes: [input.outputIndex ?? 0],
            transactionHash: input.transactionHash,
            outputIndex: input.outputIndex ?? 0,
            publicKey: input.publicKey,
            privateKey: input.privateKey,
        };
        console.log('[buildStakingTransactionHex] Converted input:', {
            amount: result.amount,
            outputIndexes: result.outputIndexes,
            outputIndex: result.outputIndex,
        });
        return result;
    });
    console.log('[buildStakingTransactionHex] serializedInputs:', serializedInputs.length);
    // Build output - single output with the staking amount
    let outputKey;
    if (address.length === 64 && /^[0-9a-fA-F]{64}$/.test(address)) {
        // Already a hex public key
        outputKey = address;
    }
    else {
        // Need to extract from address
        outputKey = addressToPublicKey(address);
    }
    const serializedOutputs = [{
            key: outputKey,
            amount: amount,
        }];
    // Build extra field with both public key AND staking data
    const extraData = buildExtraWithStaking(publicKey, amount, unlockTime, lockDurationDays, signature);
    console.log('[buildStakingTransactionHex] About to build prefix with unlockTime:', unlockTime);
    // Build transaction prefix manually (to include custom extra field)
    const prefixBytes = serializeTransactionPrefixWithCustomExtra(serializedInputs, serializedOutputs, extraData, unlockTime, 1 // version
    );
    console.log('[buildStakingTransactionHex] Prefix bytes length:', prefixBytes.length);
    console.log('[buildStakingTransactionHex] First 10 bytes:', Array.from(prefixBytes.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    // Decode unlockTime from prefix to verify
    const { readVarint } = createSerializationHelpers();
    const unlockTimeCheck = readVarint(prefixBytes, 1); // Skip version byte
    console.log('[buildStakingTransactionHex] Decoded unlockTime from prefix:', unlockTimeCheck.value, '(expected:', unlockTime, ')');
    // Compute hash of the prefix for signing
    const prefixHash = keccak256(prefixBytes);
    const prefixHashBytes = hexToBytes(prefixHash);
    // Generate signatures for each input
    const signatures = [];
    for (const input of inputs) {
        const sig = generateSchnorrSignature(prefixHashBytes, input.publicKey, input.privateKey);
        signatures.push(sig);
    }
    // Concatenate prefix + signatures
    const txParts = [prefixBytes, ...signatures];
    const txBytes = concatBytes(...txParts);
    // Convert to hex
    return bytesToHex(txBytes);
}
/**
 * Build extra field with both transaction public key and staking data
 */
function buildExtraWithStaking(publicKey, amount, unlockTime, lockDurationDays, signature) {
    const extra = [];
    // TX_EXTRA_TAG_PUBKEY (0x01)
    extra.push(0x01);
    const pubKeyBytes = hexToBytes(publicKey);
    extra.push(...Array.from(pubKeyBytes));
    // TX_EXTRA_STAKING (0x04)
    extra.push(TX_EXTRA_STAKING);
    // Staking data - using BinaryOutputStreamSerializer format (varints, no field names)
    extra.push(...writeVarintLocal(STAKING_TX_TYPE)); // stakingType (varint)
    extra.push(...writeVarintLocal(amount)); // amount (varint)
    extra.push(...writeVarintLocal(unlockTime)); // unlockTime (varint)
    extra.push(...writeVarintLocal(lockDurationDays)); // lockDurationDays (varint)
    // Signature (64 bytes, raw)
    const sigBytes = hexToBytes(signature);
    if (sigBytes.length !== 64) {
        throw new Error('Signature must be 64 bytes');
    }
    extra.push(...Array.from(sigBytes));
    const result = new Uint8Array(extra);
    console.log('[buildExtraWithStaking] Extra field length:', result.length);
    console.log('[buildExtraWithStaking] Extra field hex:', bytesToHex(result));
    // Log individual parts
    console.log('[buildExtraWithStaking] TX_EXTRA_TAG_PUBKEY: 0x01');
    console.log('[buildExtraWithStaking] Public key:', publicKey.substring(0, 16) + '...');
    console.log('[buildExtraWithStaking] TX_EXTRA_STAKING: 0x' + TX_EXTRA_STAKING.toString(16));
    console.log('[buildExtraWithStaking] STAKING_TX_TYPE:', STAKING_TX_TYPE);
    console.log('[buildExtraWithStaking] amount:', amount);
    console.log('[buildExtraWithStaking] unlockTime:', unlockTime);
    console.log('[buildExtraWithStaking] lockDurationDays:', lockDurationDays);
    console.log('[buildExtraWithStaking] signature:', signature.substring(0, 32) + '...');
    return result;
}
/**
 * Concatenate multiple byte arrays
 * Used to build the full transaction from prefix + signatures
 */
function concatBytes(...arrays) {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}
/**
 * Serialize transaction prefix with custom extra field
 * Matches TransactionSerializer.serializeTransactionPrefix but allows custom extra data
 */
function serializeTransactionPrefixWithCustomExtra(inputs, outputs, extraData, unlockTime = 0, version = 1) {
    const parts = [];
    // Import helper functions
    const { writeVarint } = createSerializationHelpers();
    // version (varint)
    parts.push(writeVarint(version));
    // unlockTime (varint encoded uint64_t)
    parts.push(writeVarint(unlockTime));
    // inputs (varint count + inputs)
    parts.push(writeVarint(inputs.length));
    for (const input of inputs) {
        // Write variant tag (TAG_KEY_INPUT = 0x02)
        parts.push(new Uint8Array([0x02]));
        parts.push(serializeKeyInput(input));
    }
    // outputs (varint count + outputs)
    parts.push(writeVarint(outputs.length));
    for (const output of outputs) {
        // serializeTransactionOutput already writes TAG_KEY_OUTPUT internally
        parts.push(serializeTransactionOutput(output));
    }
    // extra (custom data)
    parts.push(writeVarint(extraData.length));
    parts.push(extraData);
    return concatBytes(...parts);
}
/**
 * Create serialization helpers (closures to avoid circular dependencies)
 */
function createSerializationHelpers() {
    // Write varint to byte array
    // Standard varint encoding: value is split into 7-bit chunks,
    // each chunk has a continuation bit (0x80) set except the last one
    const writeVarint = (value) => {
        const bytes = [];
        const bigValue = BigInt(value);
        if (value === 518785) {
            console.log('[writeVarint] ===== Encoding 518785 (0x' + bigValue.toString(16).toUpperCase() + ') =====');
            console.log('[writeVarint] Binary:', bigValue.toString(2).padStart(24, '0'));
        }
        let n = bigValue;
        let iteration = 0;
        while (true) {
            // Extract lowest 7 bits
            const lowest7Bits = n & 0x7fn;
            if (value === 518785) {
                console.log(`[writeVarint] Iter ${iteration}: n=0x${n.toString(16).padStart(5, '0').toUpperCase()}, lowest7Bits=0x${lowest7Bits.toString(16).padStart(2, '0').toUpperCase()}`);
            }
            // Check if this is the last byte (no more bits beyond the 7 we just extracted)
            const isLastByte = (n >> 7n) === 0n;
            if (isLastByte) {
                // Last byte: no continuation bit
                bytes.push(Number(lowest7Bits));
                if (value === 518785) {
                    console.log(`[writeVarint] Iter ${iteration}: LAST BYTE, writing 0x${lowest7Bits.toString(16).padStart(2, '0').toUpperCase()} (no continuation)`);
                }
                break;
            }
            else {
                // Not the last byte: set continuation bit (0x80)
                const byteWithContinuation = lowest7Bits | 0x80n;
                bytes.push(Number(byteWithContinuation));
                if (value === 518785) {
                    console.log(`[writeVarint] Iter ${iteration}: MORE BYTES, writing 0x${byteWithContinuation.toString(16).padStart(2, '0').toUpperCase()} (with continuation 0x80)`);
                }
                // Shift right by 7 bits for next iteration
                n >>= 7n;
                iteration++;
            }
        }
        if (value === 518785) {
            console.log('[writeVarint] Final bytes:', Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' '));
            console.log('[writeVarint] Total bytes:', bytes.length);
            console.log('[writeVarint] =====');
        }
        return new Uint8Array(bytes);
    };
    // Read varint from byte array
    const readVarint = (bytes, offset) => {
        let value = 0n;
        let shift = 0n;
        let bytesRead = 0;
        for (let i = offset; i < bytes.length; i++) {
            const byte = BigInt(bytes[i]);
            value |= (byte & 0x7fn) << shift;
            bytesRead++;
            if ((byte & 0x80n) === 0n) {
                break;
            }
            shift += 7n;
        }
        return { value: Number(value), bytesRead };
    };
    return { writeVarint, readVarint };
}
/**
 * Serialize a KeyInput to binary format
 *
 * KeyInput structure (from CryptoNote - matches normal transaction format):
 * - amount: varint uint64_t
 * - outputIndexes: varint count + varint[] array
 * - transactionHash: 32 bytes
 * - outputIndex: varint uint32_t
 *
 * NOTE: keyImage is NOT part of serialized KeyInput - it's derived by daemon during validation
 */
function serializeKeyInput(input) {
    const parts = [];
    const { writeVarint } = createSerializationHelpers();
    console.log('[serializeKeyInput] Serializing input:', {
        amount: input.amount,
        outputIndexes: input.outputIndexes,
        outputIndex: input.outputIndex,
        txHash: input.transactionHash.substring(0, 16) + '...',
    });
    // amount (varint encoded uint64_t)
    parts.push(writeVarint(input.amount));
    // outputIndexes count (varint)
    parts.push(writeVarint(input.outputIndexes.length));
    // outputIndexes (varint encoded uint32_t)
    for (const index of input.outputIndexes) {
        parts.push(writeVarint(index));
    }
    // transactionHash (32 bytes, raw binary)
    const hashBytes = hexToBytes(input.transactionHash);
    if (hashBytes.length !== 32) {
        throw new Error(`transactionHash must be 32 bytes, got ${hashBytes.length}`);
    }
    parts.push(hashBytes);
    // outputIndex (varint encoded uint32_t) - CRITICAL: This MUST be written!
    parts.push(writeVarint(input.outputIndex));
    console.log('[serializeKeyInput] outputIndex varint:', Array.from(writeVarint(input.outputIndex)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    return concatBytes(...parts);
}
/**
 * Serialize a transaction output (amount + KeyOutput)
 */
function serializeTransactionOutput(output) {
    const parts = [];
    const { writeVarint } = createSerializationHelpers();
    // amount (varint encoded uint64_t)
    parts.push(writeVarint(output.amount));
    // target (KeyOutput variant) - write variant tag BEFORE KeyOutput data
    parts.push(new Uint8Array([0x02])); // TAG_KEY_OUTPUT
    // key (32 bytes, raw binary)
    const keyBytes = hexToBytes(output.key);
    if (keyBytes.length !== 32) {
        throw new Error(`Output key must be 32 bytes, got ${keyBytes.length}`);
    }
    parts.push(keyBytes);
    return concatBytes(...parts);
}
/**
 * Write varint locally (inline implementation)
 */
function writeVarintLocal(value) {
    const bytes = [];
    const bigValue = BigInt(value);
    const mask = 0x7fn;
    const continuation = 0x80n;
    let remaining = bigValue;
    do {
        const byte = Number((remaining & mask) | continuation);
        bytes.push(byte);
        remaining >>= 7n;
    } while (remaining > 0n); // FIX: Continue while there's remaining value, not just while >= threshold
    bytes[bytes.length - 1] &= 0x7f; // Clear continuation bit on last byte
    return bytes;
}
// ============================================================================
// PENDING STAKE MANAGEMENT
// ============================================================================
/**
 * Create a pending stake entry
 */
export function createPendingStake(amount, lockDurationDays, address, state = PendingStakeState.PREPARING) {
    return {
        id: `stake_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        state,
        amount,
        lockDurationDays,
        address,
        createdAt: Date.now(),
    };
}
/**
 * Update pending stake state
 */
export function updatePendingStake(stake, updates) {
    return { ...stake, ...updates };
}
/**
 * Check if outputs are available for a pending stake
 */
export function checkOutputsAvailable(stake, outputs, currentHeight, currentFee = MIN_FEE, maturityBlocks = MATURITY_BLOCKS) {
    return hasPreciseStakingOutputs(stake.amount, outputs, currentHeight, currentFee, maturityBlocks);
}
// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
/**
 * Write varint to byte array
 */
function writeVarint(value) {
    const bytes = [];
    const bigValue = BigInt(value);
    const mask = 0x7fn;
    const continuation = 0x80n;
    const threshold = 0x80n;
    let remaining = bigValue;
    do {
        const byte = Number((remaining & mask) | continuation);
        bytes.push(byte);
        remaining >>= 7n;
    } while (remaining >= threshold);
    bytes[bytes.length - 1] &= 0x7f; // Clear continuation bit on last byte
    return bytes;
}
/**
 * Write single byte
 */
function writeByte(value) {
    return new Uint8Array([value & 0xff]);
}
/**
 * Read varint from byte array
 */
function readVarint(bytes, offset) {
    let value = 0n;
    let shift = 0n;
    let bytesRead = 0;
    for (let i = offset; i < bytes.length; i++) {
        const byte = BigInt(bytes[i]);
        value |= (byte & 0x7fn) << shift;
        bytesRead++;
        if ((byte & 0x80n) === 0n) {
            break;
        }
        shift += 7n;
    }
    return { value: Number(value), bytesRead };
}
/**
 * Convert hex string to bytes
 */
function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
}
/**
 * Convert bytes to hex string
 */
function bytesToHex(bytes) {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
// ============================================================================
// EXPORTS
// ============================================================================
export default {
    // Helpers
    calculateUnlockTime,
    getStakingDenominations,
    hasPreciseStakingOutputs,
    pickStakingInputs,
    // Extra field
    createStakingExtra,
    generateStakingSignature,
    // Transactions
    prepareStakingOutputs,
    createStakingTransaction,
    // Pending stakes
    createPendingStake,
    updatePendingStake,
    checkOutputsAvailable,
    // Types
    PendingStakeState,
};
