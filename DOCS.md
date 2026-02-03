# Documentation

This document shows short usage examples for common tasks with `pastella-utils`.

## Quick start
Install dependencies at the repository root:

```bash
npm install
```

## Create and sync a wallet
```ts
import { Wallet } from './src/Wallet'; // or 'pastella-utils' when published

const wallet = new Wallet({
  ip: '127.0.0.1',
  port: 19735,
  ssl: false,
  publicKey: 'YOUR_PUBLIC_KEY',
});

// Start a sync (fills internal outputs & balances)
await wallet.performSync();
console.log('Available balance:', wallet.getAvailableBalance());
```

## Send a transaction
```ts
const result = await wallet.sendTransaction({
  mnemonic: 'word1 word2 ... word25', // never store raw mnemonics in source
  destinations: [
    { address: 'P...recipientAddress', amount: 1000 },
  ],
  fee: 2000,
});

console.log('Sent tx hash:', result.hash);
```

## Use `utils` helpers
```ts
import { formatAmount, validateAddress } from './src/utils'; // or from package

console.log(formatAmount(123456, 2)); // -> "1234.56"
console.log(validateAddress('N...')); // -> true/false
```

## Use `WalletSync` directly (advanced)
```ts
import { WalletSync } from './src/walletSync';

const sync = new WalletSync({
  node: { ip: '127.0.0.1', port: 19735 },
  publicKeys: ['YOUR_PUBLIC_KEY'],
  onSyncProgress: (state) => console.log('sync state:', state),
  onTransactionFound: (output) => console.log('tx output found:', output),
});

await sync.start();
// later
sync.stop();
```

## Notes
- Examples use relative imports for local development. When this package is published, import paths will be package-based (e.g., `pastella-utils`).
- Replace placeholder values (node host, public key, mnemonic) with real values before running.
- This documentation is not final. It's a work in progress and improvements are underway.
