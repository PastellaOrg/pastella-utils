/**
 * Pastella Wallet Synchronization - Transaction Processing
 *
 * Handles transaction classification and address extraction
 */

import { MATURITY_BLOCKS } from './config';
import { publicKeyHexToAddress } from './index';
import { WalletOutput, WalletSpend, WalletDisplayTransaction, AddressInfo, KeyOutput } from './types';

export interface TransactionContext {
  publicKeys: Set<string>;
  currentHeight: number;
  rawTransactionOutputs: Map<string, KeyOutput[]>;
  stakingTxHashes: Set<string>;
}

export interface TransactionData {
  outputs: WalletOutput[];
  spends: WalletSpend[];
  blockHeight: number;
  timestamp: number;
  isCoinbase: boolean;
  isStaking: boolean;
}

/**
 * Classify a transaction and return a WalletDisplayTransaction
 */
export function classifyTransaction(
  txHash: string,
  data: TransactionData,
  ctx: TransactionContext
): WalletDisplayTransaction | null {
  const { publicKeys, currentHeight, stakingTxHashes } = ctx;
  const totalIncoming = data.outputs.reduce((sum, o) => sum + o.amount, 0);
  const totalOutgoing = data.spends.reduce((sum, s) => sum + s.amount, 0);

  // Determine transaction type based on pastella-core logic
  let type: 'incoming' | 'outgoing' | 'staking' | 'coinbase';
  let amount: number;

  // Check if coinbase first
  if (data.isCoinbase) {
    type = 'coinbase';
    amount = totalIncoming;
  }
  // Check for staking: transaction marked as staking from API
  else if (data.isStaking) {
    type = 'staking';
    amount = totalIncoming;
  }
  // Both incoming and outgoing - this is a send with change
  else if (totalIncoming > 0 && totalOutgoing > 0) {
    // Check if this is a self-transfer (all outputs to our wallet)
    const allOutputsToWallet = data.outputs.every(o => publicKeys.has(o.key));

    if (allOutputsToWallet && data.outputs.length > 0) {
      // Self-transfer: all outputs go to our wallet
      // Show as outgoing with the fee amount (totalOutgoing - totalIncoming)
      type = 'outgoing';
      amount = totalOutgoing - totalIncoming; // This is the fee
    } else {
      // Regular transaction with external addresses
      const netAmount = totalOutgoing - totalIncoming;
      if (netAmount > 0) {
        type = 'outgoing';
        amount = netAmount;
      } else {
        type = 'incoming';
        amount = totalIncoming;
      }
    }
  }
  // Only outgoing
  else if (totalOutgoing > 0) {
    type = 'outgoing';
    amount = totalOutgoing;
  }
  // Only incoming
  else if (totalIncoming > 0) {
    type = 'incoming';
    amount = totalIncoming;
  }
  else {
    return null; // Skip transactions with no involvement
  }

  // Determine confirmation status based on block depth
  const confirmations = Math.max(0, currentHeight - data.blockHeight);
  const status: 'confirmed' | 'pending' = confirmations >= MATURITY_BLOCKS ? 'confirmed' : 'pending';

  // Extract from/to addresses
  const { from, to } = extractFromToAddresses(txHash, type, data.outputs, ctx);

  return {
    hash: txHash,
    type,
    amount,
    timestamp: data.timestamp * 1000, // Convert to milliseconds for JS Date
    status,
    blockHeight: data.blockHeight,
    confirmations,
    from,
    to,
  };
}

/**
 * Extract from/to addresses for a transaction
 */
export function extractFromToAddresses(
  txHash: string,
  type: 'incoming' | 'outgoing' | 'staking' | 'coinbase',
  walletOutputs: WalletOutput[],
  ctx: TransactionContext
): { from?: AddressInfo[]; to?: AddressInfo[] } {
  const { publicKeys, rawTransactionOutputs } = ctx;

  // Helper to deduplicate addresses
  const deduplicateAddresses = (addresses: AddressInfo[]): AddressInfo[] => {
    const seen = new Set<string>();
    const result: AddressInfo[] = [];
    for (const addr of addresses) {
      if (!seen.has(addr.address)) {
        seen.add(addr.address);
        result.push(addr);
      }
    }
    return result;
  };

  // Helper to get all wallet addresses from our public keys
  const getWalletAddresses = (): string[] => {
    const addresses = new Set<string>();
    for (const key of publicKeys) {
      addresses.add(publicKeyHexToAddress(key));
    }
    return Array.from(addresses);
  };

  // Always show our wallet addresses as "to" for incoming/staking/coinbase
  if (type === 'coinbase') {
    // Coinbase has no "from" - it's mined
    const to = deduplicateAddresses(
      walletOutputs.map(o => ({
        address: publicKeyHexToAddress(o.key)
      }))
    );
    return { from: [], to };
  }

  if (type === 'incoming') {
    // For incoming: from = unknown (UTXO system doesn't reveal sender), to = our addresses
    const to = deduplicateAddresses(
      walletOutputs.map(o => ({
        address: publicKeyHexToAddress(o.key)
      }))
    );
    return { from: undefined, to };
  }

  // Staking - similar to incoming
  if (type === 'staking') {
    const to = deduplicateAddresses(
      walletOutputs.map(o => ({
        address: publicKeyHexToAddress(o.key)
      }))
    );
    return { from: undefined, to };
  }

  // For outgoing transactions
  const walletAddressesSet = new Set(getWalletAddresses());
  const rawOutputs = rawTransactionOutputs.get(txHash);

  // If we don't have raw outputs (saved state), we can't show recipients
  if (!rawOutputs || rawOutputs.length === 0) {
    // Still show from as our wallet addresses
    const from = deduplicateAddresses(
      Array.from(walletAddressesSet).map(addr => ({ address: addr }))
    );
    return { from: from.length > 0 ? from : undefined, to: undefined };
  }

  // Find external outputs by checking if the address belongs to our wallet
  const externalAddresses = new Set<string>();
  for (const output of rawOutputs) {
    const address = publicKeyHexToAddress(output.key);
    if (!walletAddressesSet.has(address)) {
      externalAddresses.add(address);
    }
  }

  const to = deduplicateAddresses(
    Array.from(externalAddresses).map(addr => ({ address: addr }))
  );

  // from = our wallet addresses (unique)
  const from = deduplicateAddresses(
    Array.from(walletAddressesSet).map(addr => ({ address: addr }))
  );

  return { from: from.length > 0 ? from : undefined, to: to.length > 0 ? to : undefined };
}

/**
 * Helper to create a WalletDisplayTransaction
 */
export function createDisplayTransaction(
  hash: string,
  type: 'incoming' | 'outgoing' | 'staking' | 'coinbase',
  amount: number,
  blockHeight: number,
  timestamp: number,
  currentHeight: number,
  walletOutputs: WalletOutput[] = [],
  ctx: TransactionContext
): WalletDisplayTransaction {
  // Use max(0) to avoid negative confirmations during real-time processing
  const confirmations = Math.max(0, currentHeight - blockHeight);
  const status: 'confirmed' | 'pending' = confirmations >= MATURITY_BLOCKS ? 'confirmed' : 'pending';

  // Extract from/to addresses
  const { from, to } = extractFromToAddresses(hash, type, walletOutputs, ctx);

  return {
    hash,
    type,
    amount,
    timestamp: timestamp * 1000, // Convert to milliseconds for JS Date
    status,
    blockHeight,
    confirmations,
    from,
    to,
  };
}

/**
 * Get transactions with proper classification
 * Returns an array of wallet transactions sorted by block height (newest first)
 */
export function getTransactions(
  allOutputs: WalletOutput[],
  allSpends: WalletSpend[],
  stakingTxHashes: Set<string>,
  publicKeys: Set<string>,
  currentHeight: number,
  rawTransactionOutputs: Map<string, KeyOutput[]>,
  limit: number = Number.MAX_SAFE_INTEGER
): WalletDisplayTransaction[] {
  const ctx: TransactionContext = {
    publicKeys,
    currentHeight,
    rawTransactionOutputs,
    stakingTxHashes,
  };

  // Map to store transaction data: txHash -> { outputs, spends, blockHeight, timestamp, isCoinbase, isStaking }
  const txMap = new Map<string, {
    outputs: WalletOutput[];
    spends: WalletSpend[];
    blockHeight: number;
    timestamp: number;
    isCoinbase: boolean;
    isStaking: boolean;
  }>();

  // Group outputs by transaction hash
  for (const output of allOutputs) {
    const key = output.transactionHash;
    if (!txMap.has(key)) {
      const isStaking = stakingTxHashes.has(key) || output.isStaking;
      txMap.set(key, {
        outputs: [],
        spends: [],
        blockHeight: output.blockHeight,
        timestamp: output.timestamp,
        isCoinbase: output.transactionIndex === 0,
        isStaking,
      });
    }
    txMap.get(key)!.outputs.push(output);
  }

  // Group spends by the transaction where they happened (spendingTxHash)
  for (const spend of allSpends) {
    const key = spend.spendingTxHash || spend.parentTransactionHash;

    if (!txMap.has(key)) {
      const isStaking = stakingTxHashes.has(key);
      txMap.set(key, {
        outputs: [],
        spends: [],
        blockHeight: spend.blockHeight,
        timestamp: spend.timestamp,
        isCoinbase: false,
        isStaking,
      });
    }
    txMap.get(key)!.spends.push(spend);
  }

  // Reconstruct transactions with proper classification
  const transactions: WalletDisplayTransaction[] = [];

  for (const [txHash, data] of txMap) {
    const totalIncoming = data.outputs.reduce((sum, o) => sum + o.amount, 0);
    const totalOutgoing = data.spends.reduce((sum, s) => sum + s.amount, 0);

    // Special handling for coinbase with staking rewards
    if (data.isCoinbase && data.outputs.length === 2) {
      const amount0 = data.outputs[0].amount;
      const amount1 = data.outputs[1].amount;

      // Old denomination splitting: one very small (fee), one large (block reward)
      if (amount0 < 1000000 && amount1 >= 100000000) {
        transactions.push(createDisplayTransaction(
          txHash,
          'coinbase',
          totalIncoming,
          data.blockHeight,
          data.timestamp,
          currentHeight,
          data.outputs,
          ctx
        ));
      }
      // New structure with staking: large block reward + smaller staking reward
      else if (amount0 >= 100000000 && amount1 < amount0) {
        // Split into two separate entries: mining and staking
        transactions.push(createDisplayTransaction(
          `${txHash}_mining`,
          'coinbase',
          amount0,
          data.blockHeight,
          data.timestamp,
          currentHeight,
          [data.outputs[0]],
          ctx
        ));
        transactions.push(createDisplayTransaction(
          `${txHash}_staking`,
          'staking',
          amount1,
          data.blockHeight,
          data.timestamp,
          currentHeight,
          [data.outputs[1]],
          ctx
        ));
      }
      else {
        transactions.push(createDisplayTransaction(
          txHash,
          'coinbase',
          totalIncoming,
          data.blockHeight,
          data.timestamp,
          currentHeight,
          data.outputs,
          ctx
        ));
      }
      continue;
    }

    // Regular transaction classification
    const classified = classifyTransaction(txHash, data, ctx);
    if (classified) {
      transactions.push(classified);
    }
  }

  // Sort by blockHeight (highest first) and limit
  return transactions
    .sort((a, b) => b.blockHeight - a.blockHeight)
    .slice(0, limit);
}
