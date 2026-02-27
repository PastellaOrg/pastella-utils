/**
 * Pastella Utils
 */
/**
 * Decode a Base58 string to bytes
 * Block-based approach that matches the C++ implementation in pastella-core
 */
declare function base58Decode(input: string): Uint8Array;
declare function base58Encode(buffer: Uint8Array): string;
export declare class PastellaWallet {
    static generateWallet(): Promise<{
        mnemonic: string;
        address: string;
    }>;
    static importFromMnemonic(mnemonic: string): Promise<{
        address: string;
    }>;
    static importFromPrivateKey(privateKeyHex: string): Promise<{
        address: string;
    }>;
}
/**
 * Convert a hex string public key to a readable address
 */
export declare function publicKeyHexToAddress(publicKeyHex: string): string;
/**
 * Derive the public spend key from a mnemonic phrase
 * Returns the public key as a hex string for wallet sync
 */
export declare function derivePublicKeyFromMnemonic(mnemonic: string): string;
/**
 * Derive the private key from a mnemonic phrase
 * Returns the private key as a hex string for signing transactions
 */
export declare function derivePrivateKeyFromMnemonic(mnemonic: string): string;
/**
 * Derive the public key from a private key hex string
 * Returns the public key as a hex string for wallet sync
 */
export declare function derivePublicKeyFromPrivateKey(privateKeyHex: string): string;
/**
 * Derive both public and private keys from a mnemonic phrase
 * Returns both keys as hex strings for transaction signing
 */
export declare function deriveKeysFromMnemonic(mnemonic: string): {
    publicKey: string;
    privateKey: string;
};
/**
 * Helper to convert atomic units to human-readable format
 * @param atomic - Amount in atomic units
 * @returns Formatted string with ticker
 */
export declare function formatAtomic(atomic: number): string;
/**
 * Helper to convert human-readable amount to atomic units
 * @param coins - Amount in coins
 * @returns Amount in atomic units
 */
export declare function coinsToAtomic(coins: number): number;
/**
 * Helper to convert atomic units to coins
 * @param atomic - Amount in atomic units
 * @returns Amount in coins
 */
export declare function atomicToCoins(atomic: number): number;
export { DaemonApi } from './api';
export { WalletSync, WalletSyncConfig } from './walletSync';
export { Wallet } from './Wallet';
export * from './types';
export * from './transaction';
export * from './config';
export * from './staking';
export { base58Encode, base58Decode };
//# sourceMappingURL=index.d.ts.map