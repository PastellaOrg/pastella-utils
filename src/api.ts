/**
 * Pastella Daemon API Client
 *
 * Handles all RPC communication with the Pastella daemon
 */

import {
  GetHeightResponse,
  GetTransactionsResponse,
  GetRandomOutsResponse,
  SendRawTransactionRequest,
  SendRawTransactionResponse,
  NodeConfig,
  GetRawBlocksResponse,
  GetWalletSyncDataRequest,
  GetWalletSyncDataResponse,
  GetTransactionsStatusRequest,
  GetTransactionsStatusResponse,
  GetFeeResponse,
  GetStakingPoolInfoResponse,
  GetPendingRewardsRequest,
  GetPendingRewardsResponse,
  GetUserStakesRequest,
  GetUserStakesResponse,
  GetAllStakesRequest,
  GetAllStakesResponse,
} from './types';

export class DaemonApi {
  private node: NodeConfig;
  private timeout: number;

  constructor(node: NodeConfig, timeout: number = 30000) {
    this.node = node;
    this.timeout = timeout;
  }

  /**
   * Get the base URL for the node
   */
  private getBaseUrl(): string {
    const protocol = this.node.ssl ? 'https' : 'http';
    return `${protocol}://${this.node.ip}:${this.node.port}`;
  }

  /**
   * Update the node configuration
   */
  setNode(node: NodeConfig): void {
    this.node = node;
  }

  /**
   * Get current node configuration
   */
  getNode(): NodeConfig {
    return { ...this.node };
  }

  // ========================================================================
  // BASIC INFO
  // ========================================================================

  /**
   * Get daemon /info (GET request)
   */
  async getInfo(): Promise<GetHeightResponse & {
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
  }> {
    return await this.httpGet<GetHeightResponse & {
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
    }>('/info');
  }

  /**
   * Get current height (GET request)
   */
  async getHeight(): Promise<GetHeightResponse> {
    return await this.httpGet<GetHeightResponse>('/getheight');
  }

  /**
   * Get fee information (GET request)
   */
  async getFee(): Promise<GetFeeResponse> {
    return await this.httpGet<GetFeeResponse>('/fee');
  }

  // ========================================================================
  // BLOCKS
  // ========================================================================

  /**
   * Get blocks fast
   */
  async getBlocksFast(blockIds: string[], blockCount: number): Promise<{
    status: string;
    blocks: Array<{
      block?: string;
      txs?: string[];
    }>;
    start_height: number;
    current_height: number;
  }> {
    return await this.rpcCall('/getblocks.fast', {
      block_ids: blockIds,
      blockCount,
    });
  }

  /**
   * Get raw blocks for wallet synchronization
   * This is the preferred method for wallet sync
   */
  async getRawBlocks(
    blockHashCheckpoints: string[],
    startHeight?: number,
    startTimestamp?: number,
    blockCount: number = 20
  ): Promise<GetRawBlocksResponse> {
    const params: any = {
      blockHashCheckpoints,
      blockCount,
    };

    if (startHeight !== undefined) {
      params.startHeight = startHeight;
    }

    if (startTimestamp !== undefined) {
      params.startTimestamp = startTimestamp;
    }

    return await this.rpcCall<GetRawBlocksResponse>('/getrawblocks', params);
  }

  /**
   * Get wallet sync data (optimized for wallet sync)
   * Alternative to getRawBlocks
   */
  async getWalletSyncData(
    request: GetWalletSyncDataRequest
  ): Promise<GetWalletSyncDataResponse> {
    return await this.rpcCall<GetWalletSyncDataResponse>('/getwalletsyncdata', request);
  }

  // ========================================================================
  // TRANSACTIONS
  // ========================================================================

  /**
   * Get transactions by hash
   */
  async getTransactions(txHashes: string[]): Promise<GetTransactionsResponse> {
    return await this.rpcCall<GetTransactionsResponse>('/gettransactions', {
      txs_hashes: txHashes,
    });
  }

  /**
   * Get transaction status (for pool/unconfirmed transactions)
   */
  async getTransactionsStatus(
    request: GetTransactionsStatusRequest
  ): Promise<GetTransactionsStatusResponse> {
    return await this.rpcCall<GetTransactionsStatusResponse>('/get_transactions_status', request);
  }

  /**
   * Send raw transaction to the network
   */
  async sendRawTransaction(txHex: string): Promise<SendRawTransactionResponse> {
    return await this.rpcCall<SendRawTransactionResponse>('/sendrawtransaction', {
      tx_as_hex: txHex,
    });
  }

  // ========================================================================
  // OUTPUTS (UTXOS)
  // ========================================================================

  /**
   * Get random outputs for mixing (mixin)
   */
  async getRandomOutsForAmounts(
    amounts: number[],
    outsCount: number
  ): Promise<GetRandomOutsResponse> {
    return await this.rpcCall<GetRandomOutsResponse>('/getrandom_outs_for_amounts', {
      amounts,
      outs_count: outsCount,
    });
  }

  /**
   * Get transaction global output indexes
   */
  async getTransactionGlobalIndexes(txHash: string): Promise<{
    status: string;
    o_indexes: number[];
  }> {
    return await this.rpcCall('/get_tx_global_output_indexes', {
      txid: txHash,
    });
  }

  /**
   * Get global indexes for range (batch query)
   */
  async getGlobalIndexesForRange(
    startHeight: number,
    endHeight: number
  ): Promise<{
    status: string;
    indexes: { [txHash: string]: number[] };
  }> {
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
  async getPoolChanges(
    tailBlockId: string,
    knownTxsIds: string[]
  ): Promise<{
    status: string;
    isTailBlockActual: boolean;
    addedTxs: string[];
    deletedTxsIds: string[];
  }> {
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
  async getStakingPoolInfo(): Promise<GetStakingPoolInfoResponse> {
    return await this.httpGet<GetStakingPoolInfoResponse>('/getstakingpool');
  }

  /**
   * Get pending staking rewards for an address
   */
  async getPendingRewards(
    request: GetPendingRewardsRequest
  ): Promise<GetPendingRewardsResponse> {
    return await this.rpcCall<GetPendingRewardsResponse>('/getpendingrewards', request);
  }

  /**
   * Get user stakes by transaction hashes
   */
  async getUserStakes(
    request: GetUserStakesRequest
  ): Promise<GetUserStakesResponse> {
    return await this.rpcCall<GetUserStakesResponse>('/getuserstakes', request);
  }

  /**
   * Get all stakes with pagination
   */
  async getAllStakes(
    request?: GetAllStakesRequest
  ): Promise<GetAllStakesResponse> {
    return await this.rpcCall<GetAllStakesResponse>('/getallstakes', request || {});
  }

  // ========================================================================
  // PRIVATE METHODS
  // ========================================================================

  private async rpcCall<T>(endpoint: string, params: any): Promise<T> {
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

      const data: any = await response.json();

      if (data.status && data.status !== 'OK') {
        const errorMsg = data.error || data.status || 'Unknown error';
        throw new Error(`RPC error: ${errorMsg}`);
      }

      return data as T;
    } catch (error) {
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
  private async httpGet<T>(endpoint: string): Promise<T> {
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

      return await response.json() as T;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}

export default DaemonApi;
