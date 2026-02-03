/**
 * Pastella Wallet Types
 *
 * Type definitions for the Pastella wallet library
 */

// ============================================================================
// CRYPTO TYPES
// ============================================================================

export interface KeyPair {
  publicKey: string;
  secretKey: string;
}

export interface Hash {
  [index: number]: number;
}

// ============================================================================
// TRANSACTION TYPES
// ============================================================================

export interface TransactionInput {
  amount: number;
  blockHeight: number;
  transactionPublicKey: string;
  transactionIndex: number;
  globalOutputIndex?: number;
  key: string;
  spendHeight: number;
  unlockTime: number;
  parentTransactionHash: string;
}

export interface KeyOutput {
  key: string;
  amount: number;
  globalOutputIndex?: number;
}

export interface KeyInput {
  amount: number;
  keyImage?: string;
  keyOffsets: number[];
  transactionHash?: string;
  outputIndex?: number;
  value?: {
    amount: number;
    keyOffsets: number[];
  };
}

// ============================================================================
// BLOCK TYPES
// ============================================================================

export interface BlockHeader {
  index: number;
  majorVersion: number;
  minorVersion: number;
  timestamp: number;
  hash: string;
  prevHash: string;
  nonce: number;
  isAlternative: boolean;
  depth: number;
  difficulty: number;
  reward: number;
}

export interface BlockTemplate {
  parentBlock: Block;
  transactionHashes: string[];
  version: BlockHeader;
}

export interface Block {
  majorVersion: number;
  minorVersion: number;
  timestamp: number;
  previousBlockHash: string;
  nonce: number;
  minerTx: Transaction;
  transactionHashes: string[];
}

export interface Transaction {
  version: number;
  unlockTime: number;
  extra: ArrayBuffer;
  inputs: TransactionInput[];
  outputs: KeyOutput[];
  signatures?: string[];
}

// ============================================================================
// WALLET TYPES
// ============================================================================

export interface WalletTransfer {
  address: string;
  amount: number;
}

export interface TransactionParameters {
  sourceAddresses?: string[];
  destinationAddresses: string[];
  changeDestination: string;
  amounts: number[];
  fee?: number;
  mixin?: number;
  unlockTime?: number;
  paymentId?: string;
}

export interface WalletTransaction {
  state: WalletTransactionState;
  type: WalletTransactionType;
  hash: string;
  transferCount: number;
  timestamp: number;
  blockHeight?: number;
  isCoinbase?: boolean;
  unlockTime?: number;
  amount: number;
  fee?: number;
  extra?: string;
  transfers: WalletTransfer[];
}

export enum WalletTransactionState {
  CREATED = 0,
  DELETED = 1,
  SENDING = 2,
  SENT = 3,
}

export enum WalletTransactionType {
  INVALID = 0,
  INPUT = 1,
  OUTPUT = 2,
  MINING = 3,
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface GetHeightResponse {
  height: number;
  network_height: number;
  status: string;
}

export interface GetTransactionsResponse {
  txs_as_hex: string[];
  missed_tx: string[];
  status: string;
}

export interface GetRandomOutsResponse {
  outs: RandomOuts[];
  status: string;
}

export interface RandomOuts {
  amount: number;
  outs: OutputEntry[];
}

export interface OutputEntry {
  global_amount_index: number;
  out_key: string;
}

export interface SendRawTransactionRequest {
  tx_as_hex: string;
}

export interface SendRawTransactionResponse {
  status: string;
  error?: string;
  transactionHash?: string;
}

// ============================================================================
// SYNC TYPES
// ============================================================================

export interface WalletBlockInfo {
  coinbaseTX?: RawCoinbaseTransaction; // Daemon uses 'coinbaseTX'
  transactions: RawTransaction[];
  stakingTX?: RawStakingTransaction[]; // Staking transactions
  blockHeight: number;
  blockHash: string;
  blockTimestamp: number;

  // Aliases for backwards compatibility
  coinbaseTransaction?: RawCoinbaseTransaction;
}

export interface RawCoinbaseTransaction {
  outputs: KeyOutput[]; // Daemon uses 'outputs' not 'keyOutputs'
  hash: string;
  txPublicKey: string; // Daemon uses 'txPublicKey' not 'transactionPublicKey'
  unlockTime: number;

  // Aliases for backwards compatibility
  keyOutputs?: KeyOutput[];
  transactionPublicKey?: string;
}

export interface RawTransaction extends RawCoinbaseTransaction {
  extra: ArrayBuffer;
  inputs: KeyInput[]; // Daemon uses 'inputs' not 'keyInputs'

  // Alias for backwards compatibility
  keyInputs?: KeyInput[];
}

export interface RawStakingTransaction extends RawCoinbaseTransaction {
  inputs: KeyInput[]; // Staking transactions have inputs
}

export interface SyncResult {
  blocksProcessed: number;
  transactionsFound: number;
  newTransactions: Transaction[];
  currentHeight: number;
  networkHeight: number;
}

// ============================================================================
// NODE CONFIGURATION TYPES
// ============================================================================

export interface NodeConfig {
  ip: string;
  port: number;
  ssl: boolean;
}

// ============================================================================
// WALLET SYNC DATA TYPES
// ============================================================================

export interface GetRawBlocksResponse {
  status: string;
  items?: WalletBlockInfo[];
  synced?: boolean;
  topBlock?: {
    hash: string;
    height: number;
  };
}

export interface GetWalletSyncDataRequest {
  blockHashCheckpoints: string[];
  startHeight?: number;
  startTimestamp?: number;
  blockCount?: number;
  skipCoinbaseTransactions?: boolean;
}

export interface GetWalletSyncDataResponse {
  status: string;
  newBlocks?: WalletBlockInfo[];
  synced?: boolean;
  topBlock?: {
    hash: string;
    height: number;
  };
}

export interface GetTransactionsStatusRequest {
  transactionHashes: string[];
}

export interface GetTransactionsStatusResponse {
  status: string;
  transactionsInPool?: string[];
  transactionsInBlock?: Array<{
    hash: string;
    blockHeight: number;
    timestamp?: number;
  }>;
  transactionsUnknown?: string[];
}

export interface GetFeeResponse {
  status: string;
  address?: string;
  amount?: number;
}

// ============================================================================
// WALLET SYNC STATE TYPES
// ============================================================================

export interface WalletSyncState {
  isSyncing: boolean;
  currentHeight: number;
  networkHeight: number;
  blocksProcessed: number;
  transactionsFound: number;
  lastSyncTime: number;
  syncErrors: string[];
  availableBalance: number;
  lockedBalance: number;
  stakingLocked: number; // Amount locked in staking deposits
  stakingTxHashes: string[]; // List of staking transaction hashes for persistence
}

export interface SyncedBlockInfo {
  blockHeight: number;
  blockHash: string;
  timestamp: number;
  transactions: string[];
}

export interface WalletOutput {
  key: string;
  amount: number;
  blockHeight: number;
  timestamp: number; // Block timestamp when this output was created
  transactionHash: string;
  transactionIndex: number;
  unlockTime: number;
  transactionPublicKey: string;
  isSpendable: boolean;
  spentHeight?: number;
  globalOutputIndex?: number;
  outputIndex?: number;
  compositeKey?: string; // Internal composite key (transactionHash:outputIndex) for spend linking
  isStaking?: boolean; // True if this output is from a staking transaction (from stakingTX API field)
}

export interface WalletSpend {
  amount: number;
  parentTransactionHash: string;
  transactionIndex: number;
  blockHeight: number;
  timestamp: number; // Block timestamp when this output was spent
  keyImage?: string;
  outputKey: string; // Key of the output that was spent
  spendingTxHash?: string; // Hash of the transaction that spent this output
}

/**
 * Address info
 */
export interface AddressInfo {
  address: string;
}

/**
 * Wallet transaction for display in the UI
 * Represents a transaction that involves the wallet (incoming, outgoing, coinbase, etc.)
 */
export interface WalletDisplayTransaction {
  hash: string;
  type: 'incoming' | 'outgoing' | 'staking' | 'coinbase';
  amount: number;
  timestamp: number;
  status: 'confirmed' | 'pending';
  blockHeight: number;
  confirmations: number; // Number of confirmations (currentHeight - blockHeight)
  from?: AddressInfo[]; // Source address(es) - empty for coinbase
  to?: AddressInfo[]; // Destination address(es)
}

// ============================================================================
// STAKING TYPES
// ============================================================================

/**
 * Active stake entry from /getallstakes endpoint
 * All field names use snake_case to match the API response
 */
export interface StakeEntry {
  staking_tx_hash: string;
  staker_address: string;
  amount: number;
  lock_duration_days: number;
  unlock_time: number;
  creation_height: number;
  is_active: boolean;
  blocks_staked: number;
  blocks_remaining: number;
  progress_percentage: number;
  accumulated_reward: number;
  accumulated_earnings: number;
  daily_reward_rate: number;
  est_daily_reward: number;
  est_weekly_reward: number;
  est_monthly_reward: number;
  est_yearly_reward: number;
  total_reward_at_maturity: number;
  total_payout_at_maturity: number;
  roi_daily: number;
  roi_yearly: number;
  status: string;
}

/**
 * Finished/completed stake entry from /getallstakes endpoint
 */
export interface FinishedStakeEntry {
  staking_tx_hash: string;
  staker_address: string;
  amount: number;
  lock_duration_days: number;
  unlock_time: number;
  creation_height: number;
  is_active: boolean;
  blocks_staked: number;
  blocks_remaining: number;
  progress_percentage: number;
  accumulated_reward: number;
  accumulated_earnings: number;
  daily_reward_rate: number;
  earned_rewards: number;
  earned_rewards_formatted: string;
  total_payout: number;
  total_payout_formatted: string;
  status: string;
}

export interface GetStakingPoolInfoResponse {
  status: string;
  staking_enabled: boolean;
  staking_enable_height: number;
  current_height: number;
  minimum_stake: number;
  total_staked: number;
  pending_stakes: number;
  total_pool_balance: number;
  available_balance: number;
  total_paid_staking_rewards: number;
  interest_rate: number;
  inflation_rate: number;
  active_stake_count: number;
  message?: string;
}

export interface GetPendingRewardsRequest {
  address: string;
}

export interface GetPendingRewardsResponse {
  status: string;
  address: string;
  pending_rewards: number;
  current_height: number;
  message?: string;
}

export interface GetUserStakesRequest {
  staking_hashes: string[];
}

export interface GetUserStakesResponse {
  status: string;
  stake_count: number;
  stakes: StakingEntry[];
  message?: string;
}

export interface GetAllStakesRequest {
  page?: number;
  limit?: number;
}

/**
 * Response from /getallstakes endpoint
 * Returns all stakes on the network with pagination
 */
export interface GetAllStakesResponse {
  status: string;
  pagination: {
    total_stakes: number;
    current_page: number;
    total_pages: number;
    limit: number;
    start_index: number;
    end_index: number;
  };
  current_height: number;
  total_staked: number;
  total_earned: number;
  stakes: StakeEntry[];
  finished_stakes: FinishedStakeEntry[];
  message?: string;
}

/**
 * Legacy StakingEntry with camelCase for backwards compatibility
 * @deprecated Use StakeEntry instead to match API response format
 */
export interface StakingEntry {
  amount: number;
  unlockTime: number;
  lockDurationDays: number;
  stakingTxHash: string;
  accumulatedReward: number;
  creationHeight: number;
  isActive: boolean;
  blocksStaked: number;
  estDailyReward: number;
  estWeeklyReward: number;
  estMonthlyReward: number;
  estYearlyReward: number;
  totalRewardAtMaturity: number;
  stakerAddress: string;
}

// ============================================================================
// PENDING STAKE TYPES
// ============================================================================

/**
 * States for pending stakes during the multi-step creation process
 */
export enum PendingStakeState {
  /** Preparation transaction sent, waiting for outputs to become available */
  PREPARING = 'preparing',
  /** Outputs available, waiting for user to finalize staking transaction */
  AWAITING_FINALIZATION = 'awaiting_finalization',
  /** Staking transaction sent, waiting for network confirmation */
  PENDING = 'pending',
}

/**
 * Pending stake entry stored in wallet state
 * Represents a stake that is being created through the multi-step process
 */
export interface PendingStake {
  /** Unique ID for this pending stake */
  id: string;
  /** Current state of the pending stake */
  state: PendingStakeState;
  /** Amount to stake (in atomic units) */
  amount: number;
  /** Lock duration in days */
  lockDurationDays: number;
  /** Wallet address for staking */
  address: string;
  /** Timestamp when this pending stake was created */
  createdAt: number;
  /** Hash of the preparation transaction (if sent) */
  preparationTxHash?: string;
  /** Hash of the staking transaction (if sent) */
  stakingTxHash?: string;
  /** Block height when outputs will be available (estimated) */
  outputsAvailableHeight?: number;
  /** Error message if the process failed */
  error?: string;
}

/**
 * Result of a staking operation
 */
export interface StakingResult {
  /** Whether the operation was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Transaction hash (if applicable) */
  txHash?: string;
  /** Pending stake ID (for tracking) */
  pendingStakeId?: string;
  /** Next state the stake is in */
  nextState?: PendingStakeState;
}
