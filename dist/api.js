/**
 * Pastella Daemon API Client
 *
 * Handles all RPC communication with the Pastella daemon
 */
export class DaemonApi {
    constructor(node, timeout = 30000) {
        this.node = node;
        this.timeout = timeout;
    }
    /**
     * Get the base URL for the node
     */
    getBaseUrl() {
        const protocol = this.node.ssl ? 'https' : 'http';
        return `${protocol}://${this.node.ip}:${this.node.port}`;
    }
    /**
     * Update the node configuration
     */
    setNode(node) {
        this.node = node;
    }
    /**
     * Get current node configuration
     */
    getNode() {
        return { ...this.node };
    }
    // ========================================================================
    // BASIC INFO
    // ========================================================================
    /**
     * Get daemon /info (GET request)
     */
    async getInfo() {
        return await this.httpGet('/info');
    }
    /**
     * Get current height (GET request)
     */
    async getHeight() {
        return await this.httpGet('/getheight');
    }
    /**
     * Get fee information (GET request)
     */
    async getFee() {
        return await this.httpGet('/fee');
    }
    // ========================================================================
    // BLOCKS
    // ========================================================================
    /**
     * Get blocks fast
     */
    async getBlocksFast(blockIds, blockCount) {
        return await this.rpcCall('/getblocks.fast', {
            block_ids: blockIds,
            blockCount,
        });
    }
    /**
     * Get raw blocks for wallet synchronization
     * This is the preferred method for wallet sync
     */
    async getRawBlocks(blockHashCheckpoints, startHeight, startTimestamp, blockCount = 20) {
        const params = {
            blockHashCheckpoints,
            blockCount,
        };
        if (startHeight !== undefined) {
            params.startHeight = startHeight;
        }
        if (startTimestamp !== undefined) {
            params.startTimestamp = startTimestamp;
        }
        return await this.rpcCall('/getrawblocks', params);
    }
    /**
     * Get wallet sync data (optimized for wallet sync)
     * Alternative to getRawBlocks
     */
    async getWalletSyncData(request) {
        return await this.rpcCall('/getwalletsyncdata', request);
    }
    // ========================================================================
    // TRANSACTIONS
    // ========================================================================
    /**
     * Get transactions by hash
     */
    async getTransactions(txHashes) {
        return await this.rpcCall('/gettransactions', {
            txs_hashes: txHashes,
        });
    }
    /**
     * Get transaction status (for pool/unconfirmed transactions)
     */
    async getTransactionsStatus(request) {
        return await this.rpcCall('/get_transactions_status', request);
    }
    /**
     * Send raw transaction to the network
     */
    async sendRawTransaction(txHex) {
        return await this.rpcCall('/sendrawtransaction', {
            tx_as_hex: txHex,
        });
    }
    // ========================================================================
    // OUTPUTS (UTXOS)
    // ========================================================================
    /**
     * Get random outputs for mixing (mixin)
     */
    async getRandomOutsForAmounts(amounts, outsCount) {
        return await this.rpcCall('/getrandom_outs_for_amounts', {
            amounts,
            outs_count: outsCount,
        });
    }
    /**
     * Get transaction global output indexes
     */
    async getTransactionGlobalIndexes(txHash) {
        return await this.rpcCall('/get_tx_global_output_indexes', {
            txid: txHash,
        });
    }
    /**
     * Get global indexes for range (batch query)
     */
    async getGlobalIndexesForRange(startHeight, endHeight) {
        return await this.rpcCall('/get_global_indexes_for_range', {
            startHeight,
            endHeight,
        });
    }
    // ========================================================================
    // POOL
    // ========================================================================
    /**
     * Get pool changes
     */
    async getPoolChanges(tailBlockId, knownTxsIds) {
        return await this.rpcCall('/get_pool_changes', {
            tailBlockId,
            knownTxsIds,
        });
    }
    // ========================================================================
    // STAKING
    // ========================================================================
    /**
     * Get staking pool information
     */
    async getStakingPoolInfo() {
        return await this.httpGet('/getstakingpool');
    }
    /**
     * Get pending staking rewards for an address
     */
    async getPendingRewards(request) {
        return await this.rpcCall('/getpendingrewards', request);
    }
    /**
     * Get user stakes by transaction hashes
     */
    async getUserStakes(request) {
        return await this.rpcCall('/getuserstakes', request);
    }
    /**
     * Get all stakes with pagination
     */
    async getAllStakes(request) {
        return await this.rpcCall('/getallstakes', request || {});
    }
    // ========================================================================
    // PRIVATE METHODS
    // ========================================================================
    async rpcCall(endpoint, params) {
        const url = `${this.getBaseUrl()}${endpoint}`;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(params),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            if (data.status && data.status !== 'OK') {
                const errorMsg = data.error || data.status || 'Unknown error';
                throw new Error(`RPC error: ${errorMsg}`);
            }
            return data;
        }
        catch (error) {
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    throw new Error(`Request timeout after ${this.timeout}ms`);
                }
                throw error;
            }
            throw new Error('Unknown error occurred');
        }
    }
    /**
     * Helper method for GET requests
     */
    async httpGet(endpoint) {
        const url = `${this.getBaseUrl()}${endpoint}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        try {
            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        }
        catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
}
export default DaemonApi;
