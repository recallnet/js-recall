# `@recallnet/sdk`

> Official JavaScript/TypeScript SDK for the Recall Network.

## Table of Contents

- [Background](#background)
- [Usage](#usage)
  - [Recall client \& wallet setup](#recall-client--wallet-setup)
  - [Bucket operations](#bucket-operations)
  - [Credit operations](#credit-operations)
  - [Account operations](#account-operations)
  - [Blob operations](#blob-operations)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Background

This package is a JS/TS SDK for the Recall Network. It is built on top of [viem](https://viem.sh/) interfaces with Recall subnets for various operations, including managing:

- **Buckets**: create buckets, add objects, get objects, delete objects, etc.
- **Credit**: buy credit, approve credit usage, get credit balance, etc.
- **Accounts**: get token balance, deposit funds, withdraw funds, etc.
- **Blobs**: create blob manager, add blob manager, delete blob manager, etc. (note: experimental)

## Usage

First, install the package:

```bash
# Note: this package is not published to NPM yet, so you need to install it from the source
pnpm add @recallnet/sdk
```

### Recall client & wallet setup

Create a wallet client from a private key:

```ts
import { createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { testnet } from "@recallnet/chains";
import { RecallClient } from "@recallnet/sdk/client";

// Create a wallet client from a private key
const privateKey =
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6";
const walletClient = createWalletClient({
  account: privateKeyToAccount(privateKey),
  chain: testnet,
  transport: http(),
});

// Create a client from the wallet client
const recall = new RecallClient({ walletClient });
```

### Bucket operations

```ts
// Create a bucket
const bucketManager = client.bucketManager();
const {
  result: { bucket },
} = await bucketManager.create();
console.log("Bucket created:", bucket); // 0xff00...9d

// List buckets
const { result: buckets } = await bucketManager.list();
console.log("Buckets:", buckets);

// Add an object to a bucket
const key = "hello/world";
const path = fs.readFileSync("path/to/file.txt");
const { meta } = await bucketManager.add(bucket, key, path);
console.log("Object added at:", meta?.tx?.transactionHash);

// Get an object from a bucket
const { result: object } = await bucketManager.get(bucket, key);
const contents = new TextDecoder().decode(object);
console.log("Object:", contents);
```

### Credit operations

```ts
// Set up credit manager
const creditManager = client.creditManager();

// Buy credit
const { meta } = await creditManager.buy(parseEther("1"));
console.log("Credit bought:", meta?.tx?.transactionHash);

// Approve credit usage
const to = "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65";
const { meta: approveMeta } = await creditManager.approve(to);
console.log("Credit approved:", approveMeta?.tx?.transactionHash);

// Revoke credit approval
const { meta: revokeMeta } = await creditManager.revoke(to);
console.log("Credit revoked:", revokeMeta?.tx?.transactionHash);

// Set account sponsor
const sponsor = "0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc";
const { meta: sponsorMeta } = await creditManager.setAccountSponsor(sponsor);
console.log("Account sponsor set:", sponsorMeta?.tx?.transactionHash);

// Get account details
const { result: account } = await creditManager.getAccount();
console.log("Account details:", account);

// Get credit approvals
const { result: approvals } = await creditManager.getCreditApprovals();
console.log("Credit approvals:", approvals);

// Get credit balance
const { result: balance } = await creditManager.getBalance();
console.log("Credit balance:", balance);

// Get credit stats
const { result: stats } = await creditManager.getCreditStats();
console.log("Credit stats:", stats);
```

### Account operations

```ts
// Set up account manager
const accountManager = client.accountManager();

// Get account balance for token amount
const { result: balance } = await accountManager.balance();
console.log("Account balance:", balance);

// Get account info
const { result: info } = await accountManager.info();
console.log("Account info:", info);

// Deposit funds
const { meta } = await accountManager.deposit(parseEther("1"));
console.log("Funds deposited:", meta?.tx?.transactionHash);

// Withdraw funds
const { meta: withdrawMeta } = await accountManager.withdraw(parseEther("1"));
console.log("Funds withdrawn:", withdrawMeta?.tx?.transactionHash);
```

### Blob operations

```ts
// Set up blob manager
const blobManager = client.blobManager();

// Get storage stats
const { result: storageStats } = await blobManager.getStorageStats();
console.log("Storage stats:", storageStats);

// Get storage usage
const { result: storageUsage } = await blobManager.getStorageUsage();
console.log("Storage usage:", storageUsage);

// Get subnet stats
const { result: subnetStats } = await blobManager.getSubnetStats();
console.log("Subnet stats:", subnetStats);

// Get blob status
const subscriber = "0x90f79bf6eb2c4f870365e785982e1f101e93b906";
const blobHash = "rzghyg4z3p6vbz5jkgc75lk64fci7kieul65o6hk6xznx7lctkmq";
const subscriptionId = "foobar";
const { result: blobStatus } = await blobManager.getBlobStatus(
  subscriber,
  blobHash,
  subscriptionId,
);
console.log("Blob status:", blobStatus);
```

Note: although there are other blob-specific operations (like adding or deleting blobs), they are experimental. The bucket manager is the best way to interact with blobs on the network.

## Development

Install dependencies:

```bash
pnpm install
```

Run the tests:

```bash
pnpm run test
```

Build the package:

```bash
pnpm run build
```

## Contributing

PRs accepted.

Small note: If editing the README, please conform to
the [standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## License

MIT OR Apache-2.0, © 2025 Recall Network Corporation
