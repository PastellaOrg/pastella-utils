/**
 * Pastella Transaction Builder
 *
 * Handles transaction creation with proper binary serialization
 */

import {
  WalletOutput,
  NodeConfig,
} from './types';
import { DaemonApi } from './api';
import { keccak256 } from 'js-sha3';
import { generateSchnorrSignature } from './crypto';
import { MATURITY_BLOCKS, UNLOCK_TIME_TIMESTAMP_THRESHOLD, WALLET_ADDRESS_PREFIX, WALLET_ADDRESS_PREFIX_STRING } from './config';
import { deriveKeysFromMnemonic } from './index';

// ============================================================================
// TYPES
// ============================================================================

export interface SelectedInput {
  output: WalletOutput;
  transactionHash: string;  // Hash of transaction that created the UTXO
  outputIndex: number;      // Index of the output in that transaction
  publicKey: string;        // Public key of the UTXO owner (for signing)
  privateKey: string;       // Private key of the UTXO owner (for signing)
}

export interface TransactionDestination {
  address: string;  // Public key as hex string (64 chars)
  amount: number;   // Amount in atomic units
}

export interface TransactionPickResult {
  inputs: SelectedInput[];
  totalInput: number;
  fee: number;
  change: number;
  destinations: TransactionDestination[];
}

export interface BuiltTransaction {
  txHex: string;
  hash: string;
  inputs: SerializedKeyInput[];
  outputs: SerializedKeyOutput[];
  fee: number;
}

export interface SerializedKeyInput {
  amount: number;
  outputIndexes: number[];  // Single index for transparent system
  transactionHash: string;  // 32 bytes hex
  outputIndex: number;      // Index in the transaction
  publicKey: string;        // Public key of the UTXO owner (for signing)
  privateKey: string;       // Private key of the UTXO owner (for signing)
}

export interface SerializedKeyOutput {
  key: string;   // 32 bytes hex
  amount: number;
}

export interface SendTransactionResult {
  hash: string;
  fee: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_FEE = 1000;  // Minimum transaction fee in atomic units

// Type tags for variant serialization
const TAG_KEY_INPUT = 0x02;     // KeyInput variant tag
const TAG_KEY_OUTPUT = 0x02;    // KeyOutput variant tag
const TAG_BASE_INPUT = 0xff;    // BaseInput variant tag (coinbase)

// ============================================================================
// BINARY SERIALIZATION UTILITIES
// ============================================================================

/**
 * Varint encode a number (uses BigInt to avoid precision loss with large values)
 */
function writeVarint(value: number): Uint8Array {
  // Use BigInt to avoid precision loss with numbers > 2^53
  const bigValue = BigInt(value);
  const bytes: number[] = [];

  const mask = 0x7fn;  // BigInt mask
  const continuation = 0x80n;
  const threshold = 0x80n;

  let remaining = bigValue;
  while (remaining >= threshold) {
    const byte = Number((remaining & mask) | continuation);
    bytes.push(byte);
    remaining >>= 7n;
  }

  const lastByte = Number(remaining & mask);
  bytes.push(lastByte);

  const result = new Uint8Array(bytes);
  return result;
}

/**
 * Write a 64-bit unsigned integer as 8-byte little-endian
 */
function writeUint64LE(value: number | bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  const bigValue = BigInt(value);

  for (let i = 0; i < 8; i++) {
    bytes[i] = Number((bigValue >> (BigInt(i) * 8n)) & 0xffn);
  }

  return bytes;
}

/**
 * Write a single byte
 */
function writeByte(value: number): Uint8Array {
  return new Uint8Array([value & 0xff]);
}

/**
 * Write raw bytes
 */
function writeBytes(data: string | Uint8Array): Uint8Array {
  if (typeof data === 'string') {
    // Convert hex string to bytes
    const bytes = new Uint8Array(data.length / 2);
    for (let i = 0; i < data.length; i += 2) {
      bytes[i / 2] = parseInt(data.substr(i, 2), 16);
    }
    return bytes;
  }
  return data;
}

/**
 * Concatenate multiple byte arrays
 */
function concatBytes(...arrays: Uint8Array[]): Uint8Array {
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
 * Convert bytes to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to bytes
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// ============================================================================
// BASE58 ENCODING/DECODING
// ============================================================================

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_MAP: {[key: string]: number} = {};
for (let i = 0; i < BASE58_ALPHABET.length; i++) {
  BASE58_MAP[BASE58_ALPHABET[i]] = i;
}

/**
 * Decode a Base58 string to bytes
 */
function base58Decode(input: string): Uint8Array {
  const ENCODED_BLOCK_SIZES = [0, 2, 3, 5, 6, 7, 9, 10, 11];
  const FULL_BLOCK_SIZE = 8;
  const FULL_ENCODED_BLOCK_SIZE = 11;

  // Build decoded_block_sizes lookup: maps encoded size → decoded size
  const DECODED_BLOCK_SIZES: Record<number, number> = {};
  for (let i = 0; i <= FULL_BLOCK_SIZE; i++) {
    DECODED_BLOCK_SIZES[ENCODED_BLOCK_SIZES[i]] = i;
  }

  if (input.length === 0) {
    return new Uint8Array(0);
  }

  const fullBlockCount = Math.floor(input.length / FULL_ENCODED_BLOCK_SIZE);
  const lastBlockSize = input.length % FULL_ENCODED_BLOCK_SIZE;

  // Calculate total decoded size
  let totalDecodedSize = fullBlockCount * FULL_BLOCK_SIZE;
  if (lastBlockSize > 0) {
    const lastDecodedSize = DECODED_BLOCK_SIZES[lastBlockSize];
    if (lastDecodedSize === undefined) {
      throw new Error(`Invalid Base58 input length (partial block size ${lastBlockSize} not valid)`);
    }
    totalDecodedSize += lastDecodedSize;
  }

  const result = new Uint8Array(totalDecodedSize);
  let offset = 0;

  // Decode full blocks (11 chars → 8 bytes)
  for (let i = 0; i < fullBlockCount; i++) {
    const blockStart = i * FULL_ENCODED_BLOCK_SIZE;
    const block = input.slice(blockStart, blockStart + FULL_ENCODED_BLOCK_SIZE);

    // Convert block from Base58 (process right to left like C++ implementation)
    let num = 0n;
    let order = 1n;
    for (let j = block.length - 1; j >= 0; j--) {
      const digit = BigInt(BASE58_MAP[block[j]]);
      num = num + (order * digit);
      order = order * 58n;
    }

    // Convert to bytes (big-endian)
    for (let j = FULL_BLOCK_SIZE - 1; j >= 0; j--) {
      result[offset + j] = Number(num & 0xffn);
      num = num >> 8n;
    }

    offset += FULL_BLOCK_SIZE;
  }

  // Decode last partial block
  if (lastBlockSize > 0) {
    const blockStart = fullBlockCount * FULL_ENCODED_BLOCK_SIZE;
    const block = input.slice(blockStart);
    const decodedSize = DECODED_BLOCK_SIZES[lastBlockSize];

    // Convert block from Base58 (process right to left)
    let num = 0n;
    let order = 1n;
    for (let j = block.length - 1; j >= 0; j--) {
      const digit = BigInt(BASE58_MAP[block[j]]);
      num = num + (order * digit);
      order = order * 58n;
    }

    // Convert to bytes (big-endian)
    for (let j = decodedSize - 1; j >= 0; j--) {
      result[offset + j] = Number(num & 0xffn);
      num = num >> 8n;
    }
  }

  return result;
}

/**
 * Encode bytes to Base58 string
 */
function base58Encode(buffer: Uint8Array): string {
  const ENCODED_BLOCK_SIZES = [0, 2, 3, 5, 6, 7, 9, 10, 11];
  const FULL_BLOCK_SIZE = 8;
  const FULL_ENCODED_BLOCK_SIZE = 11;

  if (buffer.length === 0) {
    return '';
  }

  const fullBlockCount = Math.floor(buffer.length / FULL_BLOCK_SIZE);
  const lastBlockSize = buffer.length % FULL_BLOCK_SIZE;

  const resultSize = fullBlockCount * FULL_ENCODED_BLOCK_SIZE + ENCODED_BLOCK_SIZES[lastBlockSize];
  let result = new Array(resultSize).fill(BASE58_ALPHABET[0]);

  for (let i = 0; i < fullBlockCount; i++) {
    const blockStart = i * FULL_BLOCK_SIZE;
    const resultStart = i * FULL_ENCODED_BLOCK_SIZE;

    // Read 8 bytes as big-endian number
    let num = 0n;
    for (let j = 0; j < FULL_BLOCK_SIZE; j++) {
      num = (num << 8n) | BigInt(buffer[blockStart + j]);
    }

    // Encode to Base58
    let k = FULL_ENCODED_BLOCK_SIZE - 1;
    while (num > 0n) {
      const remainder = num % 58n;
      num = num / 58n;
      result[resultStart + k] = BASE58_ALPHABET[Number(remainder)];
      k--;
    }
  }

  if (lastBlockSize > 0) {
    const blockStart = fullBlockCount * FULL_BLOCK_SIZE;
    const resultStart = fullBlockCount * FULL_ENCODED_BLOCK_SIZE;

    // Read last block as big-endian number
    let num = 0n;
    for (let j = 0; j < lastBlockSize; j++) {
      num = (num << 8n) | BigInt(buffer[blockStart + j]);
    }

    // Encode to Base58
    let k = ENCODED_BLOCK_SIZES[lastBlockSize] - 1;
    while (num > 0n) {
      const remainder = num % 58n;
      num = num / 58n;
      result[resultStart + k] = BASE58_ALPHABET[Number(remainder)];
      k--;
    }
  }

  return result.join('');
}

/**
 * Decode a varint from bytes
 */
function decodeVarint(bytes: Uint8Array, offset: number = 0): {value: number, bytesRead: number} {
  let value = 0;
  let shift = 0;
  let bytesRead = 0;

  for (let i = offset; i < bytes.length; i++) {
    const byte = bytes[i];
    value |= (byte & 0x7f) << shift;
    bytesRead++;
    if ((byte & 0x80) === 0) {
      break;
    }
    shift += 7;
  }

  return { value, bytesRead };
}

/**
 * Extract public key from a readable address
 * Address format: [prefix varint] + [publicKey 32 bytes] + [checksum 4 bytes]
 * All Base58 encoded
 */
function addressToPublicKey(address: string): string {
  // Decode Base58 address
  const decoded = base58Decode(address);

  // The last 4 bytes are the checksum, which we can skip for extraction
  // We need to decode the varint prefix first
  const { value: prefixValue, bytesRead: prefixLength } = decodeVarint(decoded);

  // Skip prefix and checksum, extract public key
  // Format: [prefix varint] + [publicKey 32 bytes] + [checksum 4 bytes]
  const publicKeyBytes = decoded.slice(prefixLength, prefixLength + 32);

  const publicKeyHex = bytesToHex(publicKeyBytes);

  return publicKeyHex;
}

// ============================================================================
// TRANSACTION PICKER
// ============================================================================

/**
 * Transaction Picker - Selects inputs using minimal number of UTXOs
 * Priority: Use as few inputs as possible to minimize transaction size and fees
 */
export class TransactionPicker {
  private outputs: WalletOutput[];
  private currentHeight: number;
  private maturityBlocks: number;
  private walletPublicKey: string;
  private walletPrivateKey: string;

  constructor(
    outputs: WalletOutput[],
    currentHeight: number,
    maturityBlocks: number = MATURITY_BLOCKS,
    walletPublicKey: string = '',
    walletPrivateKey: string = ''
  ) {
    this.outputs = outputs;
    this.currentHeight = currentHeight;
    this.maturityBlocks = maturityBlocks;
    this.walletPublicKey = walletPublicKey;
    this.walletPrivateKey = walletPrivateKey;
  }

  /**
   * Check if an output's unlock time has been met
   */
  private isUnlockTimeMet(unlockTime: number): boolean {
    if (unlockTime === 0) {
      return true; // No explicit unlock time
    }

    // If unlockTime < threshold, it's a block height
    if (unlockTime < UNLOCK_TIME_TIMESTAMP_THRESHOLD) {
      return this.currentHeight >= unlockTime;
    }

    // Otherwise, unlockTime is a Unix timestamp
    const currentTimestamp = Math.floor(Date.now() / 1000);
    return currentTimestamp >= unlockTime;
  }

  /**
   * Get spendable outputs (unspent and matured)
   */
  private getSpendableOutputs(): WalletOutput[] {
    const matureHeight = this.currentHeight - this.maturityBlocks;

    const spendable = this.outputs.filter(o => {
      const isUnspent = !o.spentHeight;
      const isMature = o.blockHeight <= matureHeight;
      const unlockTimeMet = this.isUnlockTimeMet(o.unlockTime);
      const result = isUnspent && isMature && unlockTimeMet;
      return result;
    });

    return spendable;
  }

  /**
   * Pick inputs using greedy algorithm with minimal count
   * Sorts outputs by amount descending and picks largest first
   */
  pickInputs(targetAmount: number, fee: number = DEFAULT_FEE): TransactionPickResult | null {
    const spendable = this.getSpendableOutputs();

    if (spendable.length === 0) {
      return null;
    }

    // Sort by amount descending (pick largest outputs first for minimal count)
    const sorted = [...spendable].sort((a, b) => b.amount - a.amount);

    const selected: SelectedInput[] = [];
    let totalInput = 0;

    // Greedy pick: select largest outputs until we have enough
    for (const output of sorted) {
      // Ensure outputIndex is available
      const outputIndex = output.outputIndex ?? 0;
      selected.push({
        output,
        transactionHash: output.transactionHash,
        outputIndex: outputIndex,
        publicKey: this.walletPublicKey,      // Add wallet public key
        privateKey: this.walletPrivateKey,    // Add wallet private key
      });
      totalInput += output.amount;

      // Check if we have enough (target + fee)
      if (totalInput >= targetAmount + fee) {
        break;
      }
    }

    // Check if we have enough total input
    const needed = targetAmount + fee;
    if (totalInput < needed) {
      return null;  // Insufficient funds
    }

    // Calculate change
    const change = totalInput - targetAmount - fee;

    const result = {
      inputs: selected,
      totalInput,
      fee,
      change,
      destinations: []  // Will be filled by caller
    };
    return result;
  }

  /**
   * Pick inputs for multiple destinations
   */
  pickInputsForDestinations(
    destinations: TransactionDestination[],
    fee: number = DEFAULT_FEE
  ): TransactionPickResult | null {
    const totalOutput = destinations.reduce((sum, d) => sum + d.amount, 0);
    const result = this.pickInputs(totalOutput, fee);

    if (result) {
      result.destinations = destinations;
    }

    return result;
  }
}

// ============================================================================
// TRANSACTION SERIALIZER
// ============================================================================

/**
 * Binary Transaction Serializer
 * Implements proper CryptoNote binary format with transparent system modifications
 */
export class TransactionSerializer {
  /**
   * Serialize a KeyInput to binary format
   *
   * C++ reference:
   * void serialize(KeyInput &key, ISerializer &serializer)
   * {
   *     serializer(key.amount, "amount");
   *     serializeVarintVector(key.outputIndexes, serializer, "key_offsets");
   *     serializer(key.transactionHash, "transaction_hash");
   *     serializer(key.outputIndex, "output_index");
   * }
   */
  static serializeKeyInput(input: SerializedKeyInput): Uint8Array {
    const parts: Uint8Array[] = [];

    // NOTE: Variant tag is written by caller (serializeTransactionInput)
    // NOT here - this matches C++ implementation where serialize(KeyInput) doesn't write tag

    // amount (varint encoded uint64_t)
    // Must match C++: readVarint(stream, value) in operator()(uint64_t &value)
    const amountVarint = writeVarint(input.amount);
    parts.push(amountVarint);

    // outputIndexes count (varint)
    const countVarint = writeVarint(input.outputIndexes.length);
    parts.push(countVarint);

    // outputIndexes (varint encoded uint32_t)
    // Must match C++: readVarint(stream, value) in operator()(uint32_t &value)
    for (const index of input.outputIndexes) {
      const indexVarint = writeVarint(index);
      parts.push(indexVarint);
    }

    // transactionHash (32 bytes, raw binary)
    const hashBytes = writeBytes(input.transactionHash);
    if (hashBytes.length !== 32) {
      throw new Error(`transactionHash must be 32 bytes, got ${hashBytes.length}`);
    }
    parts.push(hashBytes);

    // outputIndex (varint encoded uint32_t)
    // Must match C++: readVarint(stream, value) in operator()(uint32_t &value)
    const outputIndexVarint = writeVarint(input.outputIndex);
    parts.push(outputIndexVarint);

    const result = concatBytes(...parts);
    return result;
  }

  /**
   * Serialize a KeyOutput to binary format
   */
  static serializeKeyOutput(output: SerializedKeyOutput): Uint8Array {
    const parts: Uint8Array[] = [];

    // key (32 bytes, raw binary)
    const keyBytes = writeBytes(output.key);
    if (keyBytes.length !== 32) {
      throw new Error(`Output key must be 32 bytes, got ${keyBytes.length}`);
    }
    parts.push(keyBytes);

    const result = concatBytes(...parts);
    return result;
  }

  /**
   * Serialize a transaction output (amount + KeyOutput)
   */
  static serializeTransactionOutput(output: SerializedKeyOutput): Uint8Array {
    const parts: Uint8Array[] = [];

    // amount (varint encoded uint64_t)
    // Must match C++: readVarint(stream, value) in operator()(uint64_t &value)
    const amountVarint = writeVarint(output.amount);
    parts.push(amountVarint);

    // target (KeyOutput variant) - write variant tag BEFORE KeyOutput data
    parts.push(writeByte(TAG_KEY_OUTPUT));
    const keyOutput = this.serializeKeyOutput(output);
    parts.push(keyOutput);

    const result = concatBytes(...parts);
    return result;
  }

  /**
   * Serialize transaction extra field
   *
   * The extra field contains only the transaction public key (tag 0x01)
   *
   * Format: [0x01][32 bytes publicKey]
   *
   * @param publicKey - Transaction public key as hex string
   */
  static serializeExtra(publicKey: string): Uint8Array {
    const parts: Uint8Array[] = [];

    // TX_EXTRA_TAG_PUBKEY (0x01) + publicKey
    parts.push(writeByte(0x01)); // Tag
    const keyBytes = writeBytes(publicKey);
    if (keyBytes.length !== 32) {
      throw new Error(`Public key must be 32 bytes (64 hex chars), got ${keyBytes.length}`);
    }
    parts.push(keyBytes);

    const result = concatBytes(...parts);
    return result;
  }

  /**
   * Serialize transaction prefix (everything before signatures)
   * This is needed to compute the hash for signing
   */
  static serializeTransactionPrefix(
    inputs: SerializedKeyInput[],
    outputs: SerializedKeyOutput[],
    publicKey: string,
    unlockTime: number = 0,
    version: number = 1
  ): Uint8Array {
    const parts: Uint8Array[] = [];

    // version (varint)
    const versionVarint = writeVarint(version);
    parts.push(versionVarint);

    // unlockTime (varint encoded uint64_t)
    // Must match C++: readVarint(stream, value) in operator()(uint64_t &value)
    const unlockVarint = writeVarint(unlockTime);
    parts.push(unlockVarint);

    // inputs (varint count + inputs)
    const inputCountVarint = writeVarint(inputs.length);
    parts.push(inputCountVarint);

    for (let i = 0; i < inputs.length; i++) {
      // Write variant tag BEFORE KeyInput data (matches C++ serialize(TransactionInput& in))
      parts.push(writeByte(TAG_KEY_INPUT));
      parts.push(this.serializeKeyInput(inputs[i]));
    }

    // outputs (varint count + outputs)
    const outputCountVarint = writeVarint(outputs.length);
    parts.push(outputCountVarint);

    for (let i = 0; i < outputs.length; i++) {
      parts.push(this.serializeTransactionOutput(outputs[i]));
    }

    // extra (only transaction public key)
    const extraData = this.serializeExtra(publicKey);
    const extraLenVarint = writeVarint(extraData.length);
    parts.push(extraLenVarint);  // Extra field length (varint) - REQUIRED!
    parts.push(extraData);

    const result = concatBytes(...parts);
    return result;
  }

  /**
   * Compute Keccak-256 hash of data (matches cn_fast_hash from pastella-core)
   */
  static computeHash(data: Uint8Array): Uint8Array {
    // Use Keccak-256 (cn_fast_hash in pastella-core uses Keccak)
    const hash = keccak256(data);
    const result = writeBytes(hash);
    if (result.length !== 32) {
      throw new Error(`Hash is not 32 bytes! Got ${result.length}`);
    }
    return result;
  }

  /**
   * Generate Schnorr-style signature for transaction input
   *
   * Each input requires one Schnorr signature.
   * The signature is computed by signing the transaction prefix hash
   * with the private key using the algorithm from pastella-core.
   *
   * Algorithm:
   * 1. Generate random nonce k
   * 2. Compute commitment R = k*G
   * 3. Hash (prefix_hash || public_key || R) using Keccak-256
   * 4. Reduce hash to scalar to get c
   * 5. Compute s = k - c*sec
   * 6. Signature is (c || s)
   *
   * @param prefixHash - Hash of the transaction prefix (32 bytes)
   * @param publicKey - Public key as hex string (64 chars)
   * @param privateKey - Private key as hex string (64 chars)
   * @returns 64-byte Schnorr signature
   */
  static generateSignature(
    prefixHash: Uint8Array,
    publicKey: string,
    privateKey: string
  ): Uint8Array {
    // Use the Schnorr signature implementation from crypto.ts
    const signature = generateSchnorrSignature(prefixHash, publicKey, privateKey);

    return signature;
  }

  /**
   * Serialize a complete transaction to binary format
   */
  static serializeTransaction(
    inputs: SerializedKeyInput[],
    outputs: SerializedKeyOutput[],
    publicKey: string,
    unlockTime: number = 0,
    version: number = 1
  ): Uint8Array {
    // Serialize the transaction prefix (without signatures)
    const prefixBytes = this.serializeTransactionPrefix(inputs, outputs, publicKey, unlockTime, version);

    // Compute hash of the prefix for signing
    const prefixHash = this.computeHash(prefixBytes);

    const parts: Uint8Array[] = [];
    parts.push(prefixBytes);

    // Generate signatures (one 64-byte signature per input for transparent system)
    for (let i = 0; i < inputs.length; i++) {
      // Use the specific private key for this input (UTXO owner's key)
      const signature = this.generateSignature(prefixHash, inputs[i].publicKey, inputs[i].privateKey);
      parts.push(signature);
    }

    const result = concatBytes(...parts);
    return result;
  }
}

// ============================================================================
// TRANSACTION BUILDER
// ============================================================================

export class TransactionBuilder {
  /**
   * Build a transaction from selected inputs and destinations
   */
  buildTransaction(
    pickResult: TransactionPickResult,
    publicKey: string
  ): BuiltTransaction {
    // Build KeyInput array from selected inputs
    const inputs: SerializedKeyInput[] = pickResult.inputs.map((selected) => {
      const input: SerializedKeyInput = {
        amount: selected.output.amount,
        outputIndexes: [selected.outputIndex],  // Use actual output index from UTXO
        transactionHash: selected.transactionHash,
        outputIndex: selected.outputIndex,  // The actual output index being spent
        publicKey: selected.publicKey,    // Add the public key
        privateKey: selected.privateKey,  // Add the private key
      };

      return input;
    });

    // Build KeyOutput array
    const outputs: SerializedKeyOutput[] = [];

    // Add destination outputs
    for (let i = 0; i < pickResult.destinations.length; i++) {
      const dest = pickResult.destinations[i];

      // Convert address to hex public key for serialization
      let key: string;
      // Check if address starts with the wallet prefix string (e.g., "PAS1")
      if (dest.address.startsWith(WALLET_ADDRESS_PREFIX_STRING)) {
        key = addressToPublicKey(dest.address);
      } else {
        key = dest.address;
      }

      outputs.push({
        key: key,
        amount: dest.amount,
      });
    }

    // Add change output if needed
    if (pickResult.change > 0) {
      // Change goes back to sender (use publicKey)
      outputs.push({
        key: publicKey,
        amount: pickResult.change,
      });
    }

    // Serialize transaction to binary (no recipient addresses in extra field)
    const txBytes = TransactionSerializer.serializeTransaction(
      inputs,
      outputs,
      publicKey,
      0,  // unlockTime
      1   // version
    );

    // Convert to hex string
    const txHex = bytesToHex(txBytes);

    // Calculate transaction hash (simplified - should use proper hash in production)
    const hash = this.calculateHash(txHex);

    return {
      txHex,
      hash,
      inputs,
      outputs,
      fee: pickResult.fee,
    };
  }

  /**
   * Calculate transaction hash (placeholder)
   * In production, this should use Keccak-256 or similar
   */
  private calculateHash(data: string): string {
    // Simplified hash function
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }
}

// ============================================================================
// TRANSACTION SENDER
// ============================================================================

export class TransactionSender {
  private api: DaemonApi;

  constructor(node: NodeConfig) {
    this.api = new DaemonApi(node);
  }

  /**
   * Send a raw transaction to the network
   */
  async sendTransaction(txHex: string): Promise<SendTransactionResult> {
    const response = await this.api.sendRawTransaction(txHex);

    if (response.status !== 'OK') {
      throw new Error(`Failed to send transaction: ${response.error || response.status}`);
    }

    // Use the actual transaction hash from the API response
    if (!response.transactionHash) {
      throw new Error('API response missing transactionHash');
    }

    const result = {
      hash: response.transactionHash,
      fee: DEFAULT_FEE,
    };
    return result;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Pick inputs and build transaction in one step
 */
export function createTransaction(
  outputs: WalletOutput[],
  destinations: TransactionDestination[],
  publicKey: string,
  privateKey: string,
  currentHeight: number,
  node: NodeConfig,
  maturityBlocks: number = MATURITY_BLOCKS,
  fee: number = DEFAULT_FEE
): BuiltTransaction | null {
  // Use transaction picker to select inputs (with wallet keys)
  const picker = new TransactionPicker(outputs, currentHeight, maturityBlocks, publicKey, privateKey);
  const pickResult = picker.pickInputsForDestinations(destinations, fee);

  if (!pickResult) {
    return null;
  }

  // Build the transaction
  const builder = new TransactionBuilder();
  const builtTx = builder.buildTransaction(pickResult, publicKey);
  return builtTx;
}

/**
 * Send a transaction to the network
 */
export async function sendTransaction(
  txHex: string,
  node: NodeConfig
): Promise<SendTransactionResult> {
  const sender = new TransactionSender(node);
  return await sender.sendTransaction(txHex);
}

/**
 * Simple transaction interface for sending from mnemonic
 */
export interface SimpleSendRequest {
  mnemonic: string;
  destinations: TransactionDestination[];
  outputs: WalletOutput[];
  currentHeight: number;
  node: NodeConfig;
  fee?: number;
  maturityBlocks?: number;
}

/**
 * Simple send result
 */
export interface SimpleSendResult {
  hash: string;
  fee: number;
  inputsUsed: number;
  change: number;
  txHex: string;
}

/**
 * Send a transaction from mnemonic - simplified interface
 * Handles key derivation, transaction creation, and sending internally
 */
export async function sendFromMnemonic(request: SimpleSendRequest): Promise<SimpleSendResult> {
  // Derive keys from mnemonic
  const { publicKey, privateKey } = deriveKeysFromMnemonic(request.mnemonic);

  // Create transaction
  const builtTx = createTransaction(
    request.outputs,
    request.destinations,
    publicKey,
    privateKey,
    request.currentHeight,
    request.node,
    request.maturityBlocks ?? MATURITY_BLOCKS,
    request.fee ?? DEFAULT_FEE
  );

  if (!builtTx) {
    throw new Error('Failed to create transaction - insufficient funds or other error');
  }

  // Send transaction
  const result = await sendTransaction(builtTx.txHex, request.node);

  return {
    hash: result.hash,
    fee: result.fee,
    inputsUsed: builtTx.inputs.length,
    change: builtTx.outputs[builtTx.outputs.length - 1].amount,
    txHex: builtTx.txHex,
  };
}

// Export Base58 decode function and addressToPublicKey for testing
export { base58Decode, addressToPublicKey };

export default {
  TransactionPicker,
  TransactionBuilder,
  TransactionSender,
  TransactionSerializer,
  createTransaction,
  sendTransaction,
};
