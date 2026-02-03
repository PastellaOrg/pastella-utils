/**
 * Pastella Wallet Class
 *
 * Simple wallet interface for sending transactions
 * Handles syncing and transaction creation internally
 */

import { WalletSync } from './walletSync';
import { DaemonApi } from './api';
import { NodeConfig, WalletOutput } from './types';
import { TransactionDestination } from './transaction';
import { deriveKeysFromMnemonic } from './index';
import { createTransaction, sendTransaction as sendTx } from './transaction';
import { MATURITY_BLOCKS } from './config';

export interface WalletConfig {
  ip: string;
  port: number;
  ssl?: boolean;
  publicKey: string;
  startHeight?: number;
}

export interface SendRequest {
  mnemonic: string;
  destinations: TransactionDestination[];
  fee?: number;
  maturityBlocks?: number;
}

export interface SendResult {
  hash: string;
  fee: number;
  inputsUsed: number;
  change: number;
  txHex: string;
}

export class Wallet {
  private walletSync: WalletSync;
  private publicKey: string;
  private node: NodeConfig;

  constructor(config: WalletConfig) {
    this.publicKey = config.publicKey;
    this.node = {
      ip: config.ip,
      port: config.port,
      ssl: config.ssl ?? false,
    };

    // Initialize WalletSync with proper config
    this.walletSync = new WalletSync({
      node: this.node,
      publicKeys: [this.publicKey],
      startHeight: config.startHeight ?? 0,
    });
  }

  /**
   * Get current wallet sync state
   */
  getSyncState() {
    return this.walletSync.getState();
  }

  /**
   * Get available outputs for spending
   */
  getAvailableOutputs(): WalletOutput[] {
    return this.walletSync.getAvailableOutputs();
  }

  /**
   * Get available balance
   */
  getAvailableBalance(): number {
    return this.walletSync.getAvailableBalance();
  }

  /**
   * Sync wallet with blockchain
   */
  async performSync(): Promise<void> {
    await this.walletSync.start();
  }

  /**
   * Stop wallet sync
   */
  stopSync(): void {
    this.walletSync.stop();
  }

  /**
   * Resync from a specific height
   * Creates a new WalletSync instance and starts syncing from the given height
   */
  async resyncFromHeight(height: number): Promise<void> {
    // Stop existing sync
    this.walletSync.stop();

    // Create new WalletSync instance with the specified start height
    this.walletSync = new WalletSync({
      node: this.node,
      publicKeys: [this.publicKey],
      startHeight: height,
    });

    // Start syncing from the new height
    await this.walletSync.start();
  }

  /**
   * Send a transaction
   * Handles key derivation, transaction creation, and sending internally
   */
  async sendTransaction(request: SendRequest): Promise<SendResult> {
    const { mnemonic, destinations, fee, maturityBlocks } = request;

    // Derive keys from mnemonic
    const { publicKey, privateKey } = deriveKeysFromMnemonic(mnemonic);

    // Get current height and available outputs
    const syncState = this.walletSync.getState();
    const currentHeight = syncState.currentHeight;
    const availableOutputs = this.walletSync.getAvailableOutputs();

    if (availableOutputs.length === 0) {
      throw new Error('No spendable outputs available. Wait for balance to mature.');
    }

    // Create transaction
    const builtTx = createTransaction(
      availableOutputs,
      destinations,
      publicKey,
      privateKey,
      currentHeight,
      this.node,
      maturityBlocks ?? MATURITY_BLOCKS,
      fee ?? 1000
    );

    if (!builtTx) {
      throw new Error('Failed to create transaction - insufficient funds or other error');
    }

    // Send transaction
    const result = await sendTx(builtTx.txHex, this.node);

    return {
      hash: result.hash,
      fee: result.fee,
      inputsUsed: builtTx.inputs.length,
      change: builtTx.outputs[builtTx.outputs.length - 1].amount,
      txHex: builtTx.txHex,
    };
  }
}
