/**
 * Pastella Wallet Synchronization - Block Processing
 *
 * Handles block, output, and spend processing
 */
import { isOutputSpendable } from './walletSync-utils';
import { classifyTransaction } from './walletSync-transactions';
import { PRUNE_INTERVAL } from './walletSync-sync';
/**
 * Process a single block
 */
export async function processBlock(block, ctx, syncedBlocks, blockCheckpoints, onBlockProcessed, onTransactionFound, onSpendFound, onTransactionDiscovered) {
    // Check for fork
    const existingBlock = syncedBlocks.get(block.blockHeight);
    if (existingBlock && existingBlock.blockHash !== block.blockHash) {
        await handleFork(block.blockHeight, ctx, syncedBlocks, blockCheckpoints);
    }
    // Store raw transaction outputs for from/to address tracking
    const blockCoinbase = block.coinbaseTX || block.coinbaseTransaction;
    if (blockCoinbase) {
        const outputs = blockCoinbase.outputs || blockCoinbase.keyOutputs || [];
        ctx.rawTransactionOutputs.set(blockCoinbase.hash, outputs);
    }
    for (const tx of block.transactions) {
        const outputs = tx.outputs || tx.keyOutputs || [];
        ctx.rawTransactionOutputs.set(tx.hash, outputs);
    }
    if (block.stakingTX && Array.isArray(block.stakingTX) && block.stakingTX.length > 0) {
        for (const stakingTx of block.stakingTX) {
            const outputs = stakingTx.outputs || stakingTx.keyOutputs || [];
            ctx.rawTransactionOutputs.set(stakingTx.hash, outputs);
            ctx.stakingTxHashes.add(stakingTx.hash);
        }
    }
    // Process outputs (find our UTXOs)
    const newOutputs = processOutputs(block, ctx);
    // Process spends (find our spent inputs)
    const newSpends = processSpends(block, ctx);
    // Track transactions for real-time classification
    if (onTransactionDiscovered) {
        trackPendingTransactions(newOutputs, newSpends, block, ctx, onTransactionDiscovered);
    }
    // Store block info
    const coinbase = block.coinbaseTX || block.coinbaseTransaction;
    const syncedBlock = {
        blockHeight: block.blockHeight,
        blockHash: block.blockHash,
        timestamp: block.blockTimestamp,
        transactions: [
            ...(coinbase ? [coinbase.hash] : []),
            ...block.transactions.map(tx => tx.hash),
            ...(block.stakingTX ? block.stakingTX.map(tx => tx.hash) : []),
        ],
    };
    syncedBlocks.set(block.blockHeight, syncedBlock);
    // Add to checkpoints
    addCheckpoint(block.blockHeight, block.blockHash, blockCheckpoints);
    // Update current height
    ctx.currentHeight = block.blockHeight;
    // Fire events
    if (onBlockProcessed) {
        onBlockProcessed(syncedBlock);
    }
    for (const output of newOutputs) {
        if (onTransactionFound) {
            onTransactionFound(output);
        }
    }
    for (const spend of newSpends) {
        if (onSpendFound) {
            onSpendFound(spend);
        }
    }
    // Prune old spent inputs periodically
    if (block.blockHeight % PRUNE_INTERVAL === 0) {
        pruneSpentInputs(block.blockHeight, ctx.outputs);
    }
    // Remove old checkpoints
    pruneCheckpoints(blockCheckpoints);
    // Remove old synced blocks (keep last 1000)
    pruneSyncedBlocks(syncedBlocks);
    return { newOutputs, newSpends };
}
/**
 * Process outputs in a block to find wallet's UTXOs
 */
export function processOutputs(block, ctx) {
    const { publicKeys, currentHeight, outputs } = ctx;
    const newOutputs = [];
    // Process coinbase transaction
    const coinbase = block.coinbaseTX || block.coinbaseTransaction;
    if (coinbase) {
        const txOutputs = coinbase.outputs || coinbase.keyOutputs || [];
        for (let outputIndex = 0; outputIndex < txOutputs.length; outputIndex++) {
            const output = txOutputs[outputIndex];
            if (publicKeys.has(output.key)) {
                const walletOutput = {
                    key: output.key,
                    amount: output.amount,
                    blockHeight: block.blockHeight,
                    timestamp: block.blockTimestamp,
                    transactionHash: coinbase.hash,
                    transactionIndex: outputIndex, // FIX: Use outputIndex, not hardcoded 0
                    unlockTime: coinbase.unlockTime,
                    transactionPublicKey: coinbase.txPublicKey || coinbase.transactionPublicKey || '',
                    isSpendable: isOutputSpendable(block.blockHeight, coinbase.unlockTime, block.blockTimestamp, currentHeight),
                    globalOutputIndex: output.globalOutputIndex,
                    outputIndex,
                    compositeKey: `${coinbase.hash}:${outputIndex}`,
                };
                const uniqueKey = `${coinbase.hash}:${outputIndex}`;
                if (!outputs.has(uniqueKey)) {
                    outputs.set(uniqueKey, walletOutput);
                }
                newOutputs.push(walletOutput);
            }
        }
    }
    // Process regular transactions
    let txIndex = 1;
    for (const tx of block.transactions) {
        const txOutputs = tx.outputs || tx.keyOutputs || [];
        for (let outputIndex = 0; outputIndex < txOutputs.length; outputIndex++) {
            const output = txOutputs[outputIndex];
            if (publicKeys.has(output.key)) {
                const walletOutput = {
                    key: output.key,
                    amount: output.amount,
                    blockHeight: block.blockHeight,
                    timestamp: block.blockTimestamp,
                    transactionHash: tx.hash,
                    transactionIndex: outputIndex, // FIX: Use outputIndex, not txIndex
                    unlockTime: tx.unlockTime,
                    transactionPublicKey: tx.txPublicKey || tx.transactionPublicKey || '',
                    isSpendable: isOutputSpendable(block.blockHeight, tx.unlockTime, block.blockTimestamp, currentHeight),
                    globalOutputIndex: output.globalOutputIndex,
                    outputIndex,
                    compositeKey: `${tx.hash}:${outputIndex}`,
                };
                const uniqueKey = `${tx.hash}:${outputIndex}`;
                if (!outputs.has(uniqueKey)) {
                    outputs.set(uniqueKey, walletOutput);
                }
                newOutputs.push(walletOutput);
            }
        }
        txIndex++;
    }
    // Process staking transactions
    if (block.stakingTX && Array.isArray(block.stakingTX) && block.stakingTX.length > 0) {
        for (const stakingTx of block.stakingTX) {
            const txOutputs = stakingTx.outputs || stakingTx.keyOutputs || [];
            for (let outputIndex = 0; outputIndex < txOutputs.length; outputIndex++) {
                const output = txOutputs[outputIndex];
                if (publicKeys.has(output.key)) {
                    const walletOutput = {
                        key: output.key,
                        amount: output.amount,
                        blockHeight: block.blockHeight,
                        timestamp: block.blockTimestamp,
                        transactionHash: stakingTx.hash,
                        transactionIndex: outputIndex, // FIX: Use outputIndex, not txIndex
                        unlockTime: stakingTx.unlockTime,
                        transactionPublicKey: stakingTx.txPublicKey || stakingTx.transactionPublicKey || '',
                        isSpendable: isOutputSpendable(block.blockHeight, stakingTx.unlockTime, block.blockTimestamp, currentHeight),
                        globalOutputIndex: output.globalOutputIndex,
                        outputIndex,
                        compositeKey: `${stakingTx.hash}:${outputIndex}`,
                        isStaking: true,
                    };
                    const uniqueKey = `${stakingTx.hash}:${outputIndex}`;
                    if (!outputs.has(uniqueKey)) {
                        outputs.set(uniqueKey, walletOutput);
                    }
                    newOutputs.push(walletOutput);
                }
            }
            txIndex++;
        }
    }
    return newOutputs;
}
/**
 * Process spends from a transaction array
 * Helper function to process inputs from any transaction type (regular or staking)
 */
function processTransactionSpends(transactions, block, ctx, newSpends, processedInputs) {
    const { outputs, spends } = ctx;
    for (const tx of transactions) {
        const inputs = tx.inputs || tx.keyInputs;
        if (!inputs || !Array.isArray(inputs)) {
            continue;
        }
        for (let inputIndex = 0; inputIndex < inputs.length; inputIndex++) {
            const input = inputs[inputIndex];
            const inputId = `${tx.hash}:${inputIndex}`;
            if (processedInputs.has(inputId)) {
                continue;
            }
            const inputAmount = input.value?.amount ?? input.amount;
            if (!inputAmount)
                continue;
            processedInputs.add(inputId);
            let matchedOutput = null;
            let matchMethod = 'none';
            // METHOD 0: EXACT UTXO REFERENCE MATCHING (PRIMARY METHOD)
            // In transparent system, KeyInput explicitly identifies which UTXO is being spent
            // This is the most accurate method - matches by transactionHash AND outputIndex
            if (input.transactionHash && input.outputIndex !== undefined) {
                for (const [key, output] of outputs) {
                    if (output.spentHeight)
                        continue;
                    /* CRITICAL FIX: Compare output.outputIndex (not transactionIndex) with input.outputIndex
                     * transactionIndex = transaction's position in the block (1, 2, 3...)
                     * outputIndex = output's position in the transaction (0, 1, 2...)
                     * The input's outputIndex refers to which output in the transaction is being spent */
                    if (output.transactionHash === input.transactionHash &&
                        output.outputIndex === input.outputIndex) {
                        matchedOutput = { key, output };
                        matchMethod = 'exact-utxo';
                        break;
                    }
                }
            }
            // METHOD 1: Global output index matching (fallback when exact reference not available)
            // This is accurate when globalOutputIndex is available from daemon
            if (!matchedOutput) {
                const keyOffsets = input.value?.keyOffsets ?? input.keyOffsets;
                if (keyOffsets && Array.isArray(keyOffsets) && keyOffsets.length > 0) {
                    const spentGlobalIndex = keyOffsets[keyOffsets.length - 1];
                    for (const [key, output] of outputs) {
                        if (output.spentHeight)
                            continue;
                        if (output.globalOutputIndex !== undefined && output.globalOutputIndex === spentGlobalIndex) {
                            matchedOutput = { key, output };
                            matchMethod = 'global-index';
                            break;
                        }
                    }
                }
            }
            // METHOD 2: Amount-based FIFO matching (LAST RESORT fallback)
            // This is a heuristic that matches oldest unspent output with the same amount
            // NOT RECOMMENDED - can match wrong outputs when multiple outputs have same amount
            if (!matchedOutput) {
                const matchingOutputs = [];
                for (const [key, output] of outputs) {
                    if (output.spentHeight)
                        continue;
                    if (output.amount === inputAmount) {
                        matchingOutputs.push({ key, output });
                    }
                }
                // Sort by height (oldest first) and then by index
                matchingOutputs.sort((a, b) => {
                    if (a.output.blockHeight !== b.output.blockHeight) {
                        return a.output.blockHeight - b.output.blockHeight;
                    }
                    return (a.output.transactionIndex || 0) - (b.output.transactionIndex || 0);
                });
                if (matchingOutputs.length > 0) {
                    matchedOutput = matchingOutputs[0];
                    matchMethod = 'amount-fifo';
                }
            }
            if (matchedOutput) {
                // Mark output as spent
                matchedOutput.output.spentHeight = block.blockHeight;
                // Create spend record
                const spend = {
                    amount: inputAmount,
                    parentTransactionHash: matchedOutput.output.transactionHash,
                    transactionIndex: matchedOutput.output.outputIndex,
                    blockHeight: block.blockHeight,
                    timestamp: block.blockTimestamp,
                    keyImage: input.keyImage,
                    outputKey: matchedOutput.key,
                    spendingTxHash: tx.hash,
                };
                // Track spend
                spends.set(matchedOutput.key, spend);
                newSpends.push(spend);
                const isStakingTx = ctx.stakingTxHashes.has(tx.hash);
                console.log(`[WalletSync] Output spent by ${matchMethod}:`, {
                    amount: matchedOutput.output.amount,
                    transactionHash: matchedOutput.output.transactionHash.substring(0, 16) + '...',
                    outputIndex: matchedOutput.output.outputIndex,
                    spentBy: tx.hash.substring(0, 16) + '...',
                    stakingTx: isStakingTx,
                });
            }
        }
    }
}
/**
 * Process spends in a block to find wallet's spent inputs
 */
export function processSpends(block, ctx) {
    const { outputs, spends } = ctx;
    const newSpends = [];
    const processedInputs = new Set();
    // Process regular transactions (coinbase doesn't have inputs)
    processTransactionSpends(block.transactions, block, ctx, newSpends, processedInputs);
    // CRITICAL FIX: Also process staking transaction inputs!
    // Staking transactions can spend outputs just like regular transactions
    if (block.stakingTX && Array.isArray(block.stakingTX) && block.stakingTX.length > 0) {
        console.log(`[WalletSync] Processing ${block.stakingTX.length} staking transaction(s) for spends`);
        processTransactionSpends(block.stakingTX, block, ctx, newSpends, processedInputs);
    }
    return newSpends;
}
/**
 * Handle fork by removing blocks at or above given height
 */
export async function handleFork(forkHeight, ctx, syncedBlocks, blockCheckpoints) {
    const { outputs, spends } = ctx;
    // Remove synced blocks at or above fork height
    for (const [height] of syncedBlocks) {
        if (height >= forkHeight) {
            syncedBlocks.delete(height);
        }
    }
    // Remove outputs created at or above fork height
    for (const [key, output] of outputs) {
        if (output.blockHeight >= forkHeight) {
            outputs.delete(key);
        }
    }
    // Remove spends at or above fork height
    for (const [key, spend] of spends) {
        if (spend.blockHeight >= forkHeight) {
            spends.delete(key);
        }
    }
    // Remove checkpoints at or above fork height
    for (const [height] of blockCheckpoints) {
        if (height >= forkHeight) {
            blockCheckpoints.delete(height);
        }
    }
    // Update current height
    ctx.currentHeight = Math.max(0, forkHeight - 1);
}
/**
 * Prune spent inputs older than PRUNE_INTERVAL blocks
 */
export function pruneSpentInputs(currentHeight, outputs) {
    const cutoffHeight = currentHeight - PRUNE_INTERVAL;
    for (const [key, output] of outputs) {
        if (output.spentHeight && output.spentHeight < cutoffHeight) {
            outputs.delete(key);
        }
    }
}
/**
 * Add a block checkpoint
 */
export function addCheckpoint(height, hash, blockCheckpoints) {
    blockCheckpoints.set(height, hash);
}
/**
 * Prune old checkpoints (keep last 50 + periodic checkpoints)
 */
export function pruneCheckpoints(blockCheckpoints) {
    const { LAST_KNOWN_BLOCK_HASHES_SIZE } = require('./walletSync-utils');
    const sortedHeights = Array.from(blockCheckpoints.keys()).sort((a, b) => b - a);
    for (let i = LAST_KNOWN_BLOCK_HASHES_SIZE; i < sortedHeights.length; i++) {
        const height = sortedHeights[i];
        if (height % 5000 !== 0) {
            blockCheckpoints.delete(height);
        }
    }
}
/**
 * Prune old synced blocks (keep last 1000)
 */
export function pruneSyncedBlocks(syncedBlocks) {
    const sortedHeights = Array.from(syncedBlocks.keys()).sort((a, b) => b - a);
    for (let i = 1000; i < sortedHeights.length; i++) {
        syncedBlocks.delete(sortedHeights[i]);
    }
}
/**
 * Track pending transactions for real-time classification
 */
function trackPendingTransactions(newOutputs, newSpends, block, ctx, onTransactionDiscovered) {
    const { stakingTxHashes, pendingTxData, publicKeys, currentHeight, rawTransactionOutputs } = ctx;
    // Group new outputs by transaction hash
    for (const output of newOutputs) {
        const txHash = output.transactionHash;
        if (!pendingTxData.has(txHash)) {
            pendingTxData.set(txHash, {
                outputs: [],
                spends: [],
                blockHeight: output.blockHeight,
                timestamp: output.timestamp,
                isCoinbase: output.transactionIndex === 0,
                isStaking: stakingTxHashes.has(txHash),
            });
        }
        pendingTxData.get(txHash).outputs.push(output);
    }
    // Group new spends by the transaction where they happened
    for (const spend of newSpends) {
        const txHash = spend.spendingTxHash || spend.parentTransactionHash;
        if (!pendingTxData.has(txHash)) {
            pendingTxData.set(txHash, {
                outputs: [],
                spends: [],
                blockHeight: spend.blockHeight,
                timestamp: spend.timestamp,
                isCoinbase: false,
                isStaking: stakingTxHashes.has(txHash),
            });
        }
        const data = pendingTxData.get(txHash);
        data.spends.push(spend);
        // Try to classify and fire the callback when we have spends
        const transactionCtx = {
            publicKeys,
            currentHeight,
            rawTransactionOutputs,
            stakingTxHashes,
        };
        const classified = classifyTransaction(txHash, data, transactionCtx);
        if (classified) {
            onTransactionDiscovered(classified);
        }
    }
    // Also try to classify transactions that only have outputs (no spends yet)
    for (const [txHash, data] of pendingTxData) {
        if (data.outputs.length > 0 && data.spends.length === 0) {
            const transactionCtx = {
                publicKeys,
                currentHeight,
                rawTransactionOutputs,
                stakingTxHashes,
            };
            const classified = classifyTransaction(txHash, data, transactionCtx);
            if (classified) {
                onTransactionDiscovered(classified);
                pendingTxData.delete(txHash);
            }
        }
    }
    // Clean up processed transactions from pending data
    for (const txHash of Array.from(pendingTxData.keys())) {
        const data = pendingTxData.get(txHash);
        if (data && data.spends.length > 0) {
            pendingTxData.delete(txHash);
        }
    }
}
