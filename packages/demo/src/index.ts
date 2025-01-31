import { parseEther } from "viem";

import { HokuClient, testnet, walletClientFromPrivateKey } from "@recall/sdk";

// Set up wallet and client
const privateKey =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
const wallet = walletClientFromPrivateKey(privateKey, testnet);
const client = new HokuClient({ walletClient: wallet });

// Create bucket
const {
  result: { bucket },
} = await client.bucketManager().create({
  metadata: {
    alias: "my-bucket",
  },
});
console.log(bucket);

// List buckets
const { result: buckets } = await client.bucketManager().list();
console.log(buckets);

// Buy credits
const amount = parseEther("0.1");
const { result: credit } = await client.creditManager().buy(amount);
console.log(credit);

// Add object to bucket
const { result } = await client
  .bucketManager()
  .add(bucket, "test", new File(["test"], "test.txt"));
console.log(result);

// Query bucket
const { result: objects } = await client.bucketManager().query(bucket);
console.log(objects);
