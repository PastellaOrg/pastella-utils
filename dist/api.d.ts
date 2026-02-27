/**
 * Pastella Daemon API Client
 *
 * Handles all RPC communication with the Pastella daemon
 */
import { GetHeightResponse, GetTransactionsResponse, SendRawTransactionResponse, NodeConfig, GetRawBlocksResponse, GetWalletSyncDataRequest, GetWalletSyncDataResponse, GetTransactionsStatusRequest, GetTransactionsStatusResponse, GetFeeResponse, GetStakingPoolInfoResponse, GetPendingRewardsRequest, GetPendingRewardsResponse, GetUserStakesRequest, GetUserStakesResponse, GetAllStakesRequest, GetAllStakesResponse } from './types';
export declare class DaemonApi {
    private node;
    private timeout;
    constructor(node: NodeConfig, timeout?: number);
    /**
     * Get the base URL for the node
     */
    private getBaseUrl;
    /**
     * Update the node configuration
     */
    setNode(node: NodeConfig): void;
    /**
     * Get current node configuration
     */
    getNode(): NodeConfig;
    /**
     * Get daemon /info (GET request)
     */
    getInfo(): Promise<GetHeightResponse & {
        difficulty: number;
        tx_count: number;
        tx_pool_size: number;
        alt_blocks_count: number;
        outgoing_connections_count: number;
        incoming_connections_count: number;
        white_peerlist_size: number;
        grey_peerlist_size: number;
        last_known_block_index: number;
        synced: boolean;
    }>;
    /**
     * Get current height (GET request)
     */
    getHeight(): Promise<GetHeightResponse>;
    /**
     * Get fee information (GET request)
     */
    getFee(): Promise<GetFeeResponse>;
    /**
     * Get blocks fast
     */
    getBlocksFast(blockIds: string[], blockCount: number): Promise<{
        status: string;
        blocks: Array<{
            block?: string;
            txs?: string[];
        }>;
        start_height: number;
        current_height: number;
    }>;
    /**
     * Get raw blocks for wallet synchronization
     * This is the preferred method for wallet sync
     */
    getRawBlocks(blockHashCheckpoints: string[], startHeight?: number, startTimestamp?: number, blockCount?: number): Promise<GetRawBlocksResponse>;
    /**
     * Get wallet sync data (optimized for wallet sync)
     * Alternative to getRawBlocks
     */
    getWalletSyncData(request: GetWalletSyncDataRequest): Promise<GetWalletSyncDataResponse>;
    /**
     * Get transactions by hash
     */
    getTransactions(txHashes: string[]): Promise<GetTransactionsResponse>;
    /**
     * Get transaction status (for pool/unconfirmed transactions)
     */
    getTransactionsStatus(request: GetTransactionsStatusRequest): Promise<GetTransactionsStatusResponse>;
    /**
     * Send raw transaction to the network
     */
    sendRawTransaction(txHex: string): Promise<SendRawTransactionResponse>;
    /**
     * Get transaction global output indexes
     */
    getTransactionGlobalIndexes(txHash: string): Promise<{
        status: string;
        o_indexes: number[];
    }>;
    /**
     * Get global indexes for range (batch query)
     */
    getGlobalIndexesForRange(startHeight: number, endHeight: number): Promise<{
        status: string;
        indexes: {
            [txHash: string]: number[];
        };
    }>;
    /**
     * Get pool changes
     */
    getPoolChanges(tailBlockId: string, knownTxsIds: string[]): Promise<{
        status: string;
        isTailBlockActual: boolean;
        addedTxs: string[];
        deletedTxsIds: string[];
    }>;
    /**
     * Get staking pool information
     */
    getStakingPoolInfo(): Promise<GetStakingPoolInfoResponse>;
    /**
     * Get pending staking rewards for an address
     */
    getPendingRewards(request: GetPendingRewardsRequest): Promise<GetPendingRewardsResponse>;
    /**
     * Get user stakes by transaction hashes
     */
    getUserStakes(request: GetUserStakesRequest): Promise<GetUserStakesResponse>;
    /**
     * Get all stakes with pagination
     */
    getAllStakes(request?: GetAllStakesRequest): Promise<GetAllStakesResponse>;
    private rpcCall;
    /**
     * Helper method for GET requests
     */
    private httpGet;
}
export default DaemonApi;
//# sourceMappingURL=api.d.ts.map