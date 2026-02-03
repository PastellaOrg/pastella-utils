/**
 * Pastella Wallet Types
 *
 * Type definitions for the Pastella wallet library
 */
export var WalletTransactionState;
(function (WalletTransactionState) {
    WalletTransactionState[WalletTransactionState["CREATED"] = 0] = "CREATED";
    WalletTransactionState[WalletTransactionState["DELETED"] = 1] = "DELETED";
    WalletTransactionState[WalletTransactionState["SENDING"] = 2] = "SENDING";
    WalletTransactionState[WalletTransactionState["SENT"] = 3] = "SENT";
})(WalletTransactionState || (WalletTransactionState = {}));
export var WalletTransactionType;
(function (WalletTransactionType) {
    WalletTransactionType[WalletTransactionType["INVALID"] = 0] = "INVALID";
    WalletTransactionType[WalletTransactionType["INPUT"] = 1] = "INPUT";
    WalletTransactionType[WalletTransactionType["OUTPUT"] = 2] = "OUTPUT";
    WalletTransactionType[WalletTransactionType["MINING"] = 3] = "MINING";
})(WalletTransactionType || (WalletTransactionType = {}));
// ============================================================================
// PENDING STAKE TYPES
// ============================================================================
/**
 * States for pending stakes during the multi-step creation process
 */
export var PendingStakeState;
(function (PendingStakeState) {
    /** Preparation transaction sent, waiting for outputs to become available */
    PendingStakeState["PREPARING"] = "preparing";
    /** Outputs available, waiting for user to finalize staking transaction */
    PendingStakeState["AWAITING_FINALIZATION"] = "awaiting_finalization";
    /** Staking transaction sent, waiting for network confirmation */
    PendingStakeState["PENDING"] = "pending";
})(PendingStakeState || (PendingStakeState = {}));
