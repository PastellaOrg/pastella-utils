/**
 * Pastella Transaction Builder
 *
 * Handles transaction creation with proper binary serialization
 * Based on CryptoNote format with transparent system modifications
 */
import { WalletOutput, NodeConfig } from './types';
export interface SelectedInput {
    output: WalletOutput;
    transactionHash: string;
    outputIndex: number;
    publicKey: string;
    privateKey: string;
}
export interface TransactionDestination {
    address: string;
    amount: number;
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
    outputIndexes: number[];
    transactionHash: string;
    outputIndex: number;
    publicKey: string;
    privateKey: string;
}
export interface SerializedKeyOutput {
    key: string;
    amount: number;
}
export interface SendTransactionResult {
    hash: string;
    fee: number;
}
/**
 * Decode a Base58 string to bytes
 * Block-based approach that matches the C++ implementation in pastella-core
 */
declare function base58Decode(input: string): Uint8Array;
/**
 * Extract public key from a Na1 address
 * Address format: [prefix varint] + [publicKey 32 bytes] + [checksum 4 bytes]
 * All Base58 encoded
 */
declare function addressToPublicKey(address: string): string;
/**
 * Transaction Picker - Selects inputs using minimal number of UTXOs
 * Priority: Use as few inputs as possible to minimize transaction size and fees
 */
export declare class TransactionPicker {
    private outputs;
    private currentHeight;
    private maturityBlocks;
    private walletPublicKey;
    private walletPrivateKey;
    constructor(outputs: WalletOutput[], currentHeight: number, maturityBlocks?: number, walletPublicKey?: string, walletPrivateKey?: string);
    /**
     * Check if an output's unlock time has been met
     */
    private isUnlockTimeMet;
    /**
     * Get spendable outputs (unspent and matured)
     */
    private getSpendableOutputs;
    /**
     * Pick inputs using greedy algorithm with minimal count
     * Sorts outputs by amount descending and picks largest first
     */
    pickInputs(targetAmount: number, fee?: number): TransactionPickResult | null;
    /**
     * Pick inputs for multiple destinations
     */
    pickInputsForDestinations(destinations: TransactionDestination[], fee?: number): TransactionPickResult | null;
}
/**
 * Binary Transaction Serializer
 * Implements proper CryptoNote binary format with transparent system modifications
 */
export declare class TransactionSerializer {
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
    static serializeKeyInput(input: SerializedKeyInput): Uint8Array;
    /**
     * Serialize a KeyOutput to binary format
     *
     * C++ reference:
     * void serialize(KeyOutput &key, ISerializer &serializer)
     * {
     *     serializer(key.key, "key");
     * }
     */
    static serializeKeyOutput(output: SerializedKeyOutput): Uint8Array;
    /**
     * Serialize a transaction output (amount + KeyOutput)
     *
     * C++ reference:
     * void serialize(TransactionOutput &output, ISerializer &serializer)
     * {
     *     serializer(output.amount, "amount");
     *     serializer(output.target, "target");
     * }
     */
    static serializeTransactionOutput(output: SerializedKeyOutput): Uint8Array;
    /**
     * Serialize transaction extra field
     *
     * The extra field contains only the transaction public key (tag 0x01)
     *
     * Format: [0x01][32 bytes publicKey]
     *
     * @param publicKey - Transaction public key as hex string
     */
    static serializeExtra(publicKey: string): Uint8Array;
    /**
     * Serialize transaction prefix (everything before signatures)
     * This is needed to compute the hash for signing
     */
    static serializeTransactionPrefix(inputs: SerializedKeyInput[], outputs: SerializedKeyOutput[], publicKey: string, unlockTime?: number, version?: number): Uint8Array;
    /**
     * Compute Keccak-256 hash of data (matches cn_fast_hash from pastella-core)
     */
    static computeHash(data: Uint8Array): Uint8Array;
    /**
     * Generate Schnorr-style signature for transaction input
     *
     * In transparent mode, each input requires one Schnorr signature.
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
    static generateSignature(prefixHash: Uint8Array, publicKey: string, privateKey: string): Uint8Array;
    /**
     * Serialize a complete transaction to binary format
     *
     * C++ reference:
     * void serialize(TransactionPrefix &txP, ISerializer &serializer)
     * {
     *     serializer(txP.version, "version");
     *     serializer(txP.unlockTime, "unlock_time");
     *     serializer(txP.inputs, "vin");
     *     serializer(txP.outputs, "vout");
     *     serializeAsBinary(txP.extra, "extra", serializer);
     * }
     *
     * And then signatures:
     * for (uint64_t i = 0; i < tx.inputs.size(); ++i)
     * {
     *     for (Crypto::Signature &sig : tx.signatures[i])
     *     {
     *         serializePod(sig, "", serializer);
     *     }
     * }
     */
    static serializeTransaction(inputs: SerializedKeyInput[], outputs: SerializedKeyOutput[], publicKey: string, unlockTime?: number, version?: number): Uint8Array;
}
export declare class TransactionBuilder {
    /**
     * Build a transaction from selected inputs and destinations
     */
    buildTransaction(pickResult: TransactionPickResult, publicKey: string): BuiltTransaction;
    /**
     * Calculate transaction hash (placeholder)
     * In production, this should use Keccak-256 or similar
     */
    private calculateHash;
}
export declare class TransactionSender {
    private api;
    constructor(node: NodeConfig);
    /**
     * Send a raw transaction to the network
     */
    sendTransaction(txHex: string): Promise<SendTransactionResult>;
}
/**
 * Pick inputs and build transaction in one step
 */
export declare function createTransaction(outputs: WalletOutput[], destinations: TransactionDestination[], publicKey: string, privateKey: string, currentHeight: number, node: NodeConfig, maturityBlocks?: number, fee?: number): BuiltTransaction | null;
/**
 * Send a transaction to the network
 */
export declare function sendTransaction(txHex: string, node: NodeConfig): Promise<SendTransactionResult>;
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
export declare function sendFromMnemonic(request: SimpleSendRequest): Promise<SimpleSendResult>;
export { base58Decode, addressToPublicKey };
declare const _default: {
    TransactionPicker: typeof TransactionPicker;
    TransactionBuilder: typeof TransactionBuilder;
    TransactionSender: typeof TransactionSender;
    TransactionSerializer: typeof TransactionSerializer;
    createTransaction: typeof createTransaction;
    sendTransaction: typeof sendTransaction;
};
export default _default;
//# sourceMappingURL=transaction.d.ts.map