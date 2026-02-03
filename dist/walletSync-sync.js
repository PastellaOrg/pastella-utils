/**
 * Pastella Wallet Synchronization - Sync Control
 *
 * Handles sync loop, polling, and block batch processing
 */
import { BLOCKS_PER_BATCH } from './config';
import { MIN_BLOCK_COUNT, MAX_EMPTY_RETRIES, RETRY_DELAY } from './walletSync-utils';
/**
 * Helper function to call getInfo and update connection status
 */
async function getInfoWithConnectionStatus(ctx) {
    const startTime = Date.now();
    try {
        const info = await ctx.api.getInfo();
        const latency = Date.now() - startTime;
        if (ctx.onConnectionStatusChange) {
            ctx.onConnectionStatusChange(true, latency);
        }
        return info;
    }
    catch (error) {
        if (ctx.onConnectionStatusChange) {
            ctx.onConnectionStatusChange(false);
        }
        throw error;
    }
}
/**
 * Start wallet synchronization
 */
export async function startSync(ctx, processBlock, notifyProgress, startPolling, shouldStop, isRunning) {
    if (isRunning.value) {
        return;
    }
    isRunning.value = true;
    shouldStop.value = false;
    ctx.state.isSyncing = true;
    notifyProgress();
    try {
        // Get initial network height (daemon reports next expected block, subtract 1 for current top block)
        const info = await getInfoWithConnectionStatus(ctx);
        ctx.state.networkHeight = (info.network_height || info.height) - 1;
        // Main sync loop
        while (!shouldStop.value && ctx.state.currentHeight < ctx.state.networkHeight) {
            await syncBatch(ctx, processBlock, notifyProgress, shouldStop);
            // Check if we've caught up
            if (ctx.state.currentHeight >= ctx.state.networkHeight) {
                const latestInfo = await getInfoWithConnectionStatus(ctx);
                ctx.state.networkHeight = (latestInfo.network_height || latestInfo.height) - 1;
                if (ctx.state.currentHeight >= ctx.state.networkHeight) {
                    ctx.state.isSyncing = false;
                    ctx.state.lastSyncTime = Date.now();
                    notifyProgress();
                    break;
                }
            }
        }
        // If we're already synced at the start, mark as not syncing
        if (!shouldStop.value && ctx.state.currentHeight >= ctx.state.networkHeight) {
            ctx.state.isSyncing = false;
            ctx.state.lastSyncTime = Date.now();
            notifyProgress();
        }
        // Always start polling (even if already synced, to check for new blocks)
        if (!shouldStop.value) {
            startPolling();
        }
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        ctx.state.syncErrors.push(errorMsg);
        isRunning.value = false;
        ctx.state.isSyncing = false;
        notifyProgress();
    }
}
/**
 * Create a polling function that checks for new blocks periodically
 */
export function createPollingFunction(ctx, processBlock, notifyProgress, shouldStop, isRunning, setPollTimer) {
    return () => {
        let pollTimer;
        const pollLoop = async () => {
            if (shouldStop.value) {
                pollTimer = undefined;
                setPollTimer(undefined);
                isRunning.value = false;
                ctx.state.isSyncing = false;
                notifyProgress();
                return;
            }
            try {
                // Check for new blocks
                const info = await getInfoWithConnectionStatus(ctx);
                const networkHeight = (info.network_height || info.height) - 1;
                if (networkHeight > ctx.state.currentHeight) {
                    ctx.state.networkHeight = networkHeight;
                    ctx.state.isSyncing = true;
                    notifyProgress();
                    // Sync the new blocks
                    while (!shouldStop.value && ctx.state.currentHeight < ctx.state.networkHeight) {
                        await syncBatch(ctx, processBlock, notifyProgress, shouldStop);
                        const latestInfo = await getInfoWithConnectionStatus(ctx);
                        ctx.state.networkHeight = (latestInfo.network_height || latestInfo.height) - 1;
                    }
                    ctx.state.isSyncing = false;
                    ctx.state.lastSyncTime = Date.now();
                    notifyProgress();
                }
            }
            catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                ctx.state.syncErrors.push(errorMsg);
            }
            // Schedule next poll if not stopped
            if (!shouldStop.value) {
                pollTimer = setTimeout(pollLoop, ctx.pollInterval);
                setPollTimer(pollTimer);
            }
            else {
                pollTimer = undefined;
                setPollTimer(undefined);
                isRunning.value = false;
                ctx.state.isSyncing = false;
                notifyProgress();
            }
        };
        // Start polling after the interval
        pollTimer = setTimeout(pollLoop, ctx.pollInterval);
        setPollTimer(pollTimer);
    };
}
/**
 * Sync a batch of blocks
 */
async function syncBatch(ctx, processBlock, notifyProgress, shouldStop) {
    const { api, state, startTimestamp, blockCheckpoints } = ctx;
    // Get block checkpoints (last 50 blocks)
    const checkpoints = getBlockCheckpoints(blockCheckpoints);
    // Determine block count (adaptive)
    let blockCount = BLOCKS_PER_BATCH;
    if (state.blocksProcessed > 0 && state.syncErrors.length > 0) {
        blockCount = Math.max(MIN_BLOCK_COUNT, Math.floor(BLOCKS_PER_BATCH / 2));
    }
    // Try getWalletSyncData first, fall back to getRawBlocks if needed
    let response = await api.getWalletSyncData({
        blockHashCheckpoints: checkpoints,
        startHeight: state.currentHeight,
        startTimestamp,
        blockCount,
    });
    if (response.status !== 'OK') {
        throw new Error(`Daemon error: ${response.status}`);
    }
    // Update network height if provided
    if (response.topBlock) {
        state.networkHeight = response.topBlock.height;
    }
    // Process blocks
    const blocks = response.items || response.newBlocks || [];
    // Check if we're fully synced
    if (response.synced || (blocks.length === 0 && response.topBlock)) {
        if (response.topBlock) {
            state.currentHeight = response.topBlock.height;
        }
        state.isSyncing = false;
        state.lastSyncTime = Date.now();
        notifyProgress();
        return;
    }
    // Track empty retries
    if (!ctx.emptyRetryCount) {
        ctx.emptyRetryCount = 0;
    }
    if (blocks.length === 0) {
        ctx.emptyRetryCount++;
        if (ctx.emptyRetryCount >= MAX_EMPTY_RETRIES) {
            state.isSyncing = false;
            state.lastSyncTime = Date.now();
            state.syncErrors.push('No blocks returned after multiple retries');
            notifyProgress();
            return;
        }
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return;
    }
    // Reset retry count on successful block fetch
    ctx.emptyRetryCount = 0;
    // Process each block in order
    for (const block of blocks) {
        if (shouldStop.value)
            break;
        // Verify block ordering
        if (ctx.syncedBlocks.size > 0) {
            const expectedHeight = state.currentHeight + 1;
            if (block.blockHeight !== expectedHeight) {
                blockCheckpoints.clear();
                break;
            }
        }
        await processBlock(block);
    }
    // Check if synced after processing
    if (response.synced || state.currentHeight >= state.networkHeight) {
        state.isSyncing = false;
        state.lastSyncTime = Date.now();
    }
}
/**
 * Get block checkpoints for fork detection
 */
function getBlockCheckpoints(blockCheckpoints) {
    // Import here to avoid circular dependency
    const { LAST_KNOWN_BLOCK_HASHES_SIZE } = require('./walletSync-utils');
    const sortedHeights = Array.from(blockCheckpoints.keys())
        .sort((a, b) => b - a)
        .slice(0, LAST_KNOWN_BLOCK_HASHES_SIZE);
    return sortedHeights.map(height => blockCheckpoints.get(height));
}
// Re-export for use in other modules
export { LAST_KNOWN_BLOCK_HASHES_SIZE, PRUNE_INTERVAL } from './walletSync-utils';
