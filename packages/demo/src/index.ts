import { parseEther } from "viem";

import { HokuClient, testnet, walletClientFromPrivateKey } from "@recall/sdk";

// Set up wallet and client
const privateKey =
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"; // Anvil pk
const wallet = walletClientFromPrivateKey(privateKey, testnet);
const client = new HokuClient({ walletClient: wallet });

// Create bucket
console.log("Creating bucket...");
const {
  result: { bucket },
} = await client.bucketManager().create({
  metadata: {
    alias: "my-bucket",
  },
});
console.log(bucket);

// List buckets
console.log("Listing buckets...");
const { result: buckets } = await client.bucketManager().list();
console.log(buckets);

// Buy credits
console.log("Buying credits...");
const amount = parseEther("0.1");
const { result: credit } = await client.creditManager().buy(amount);
console.log(credit);

// Add object to bucket
console.log("Adding object to bucket...");
const { result } = await client
  .bucketManager()
  .add(bucket, "test", new File(["test"], "test.txt"));
console.log(result);

// Query bucket
console.log("Querying bucket...");
const { result: objects } = await client.bucketManager().query(bucket);
objects.objects.forEach((object) => {
  console.log(object);
});
