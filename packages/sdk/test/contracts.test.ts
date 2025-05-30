import { expect } from "chai";
import { describe, it } from "mocha";
import { rejects, strictEqual } from "node:assert";
import { temporaryWrite } from "tempy";
import {
  Account,
  Address,
  getAddress,
  isAddress,
  isHash,
  parseEther,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import { localnet } from "@recallnet/chains";

import { RecallClient, walletClientFromPrivateKey } from "../src/client.js";
import { AccountManager } from "../src/entities/account.js";
import { BlobManager } from "../src/entities/blob.js";
import { BucketManager } from "../src/entities/bucket.js";
import { CreditManager } from "../src/entities/credit.js";

// Optionally, set these addresses to override the default addresses
const BLOB_MANAGER_ADDRESS = "";
const BUCKET_MANAGER_ADDRESS = "";
const CREDIT_MANAGER_ADDRESS = "";

// TODO: these tests are somewhat dependent on one another, so we should refactor to be independent
describe("contracts", function () {
  this.timeout(60000);
  let client: RecallClient;
  let account: Account;

  before(async () => {
    const walletClient = walletClientFromPrivateKey(
      "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
      localnet,
    );
    account = walletClient.account;
    client = new RecallClient({ walletClient });
  });

  describe("bucket manager", function () {
    let bucketManager: BucketManager;

    before(async () => {
      bucketManager = client.bucketManager(
        (BUCKET_MANAGER_ADDRESS as Address) ?? undefined,
      );
    });

    it("should create a bucket", async () => {
      const { meta, result } = await bucketManager.create();
      strictEqual(isHash(meta!.tx!.transactionHash), true);
      strictEqual(isAddress(result.bucket), true);
    });

    it("should list buckets", async () => {
      let { result: buckets } = await bucketManager.list(account.address);
      expect(buckets).to.be.an("array");
      strictEqual(buckets[0]?.kind, 0);

      ({ result: buckets } = await bucketManager.list());
      expect(buckets).to.be.an("array");
      strictEqual(buckets[0]?.kind, 0);

      // at a specific block number
      const latestBlock = await client.publicClient.getBlockNumber();
      ({ result: buckets } = await bucketManager.list(
        account.address,
        latestBlock,
      ));
      expect(buckets).to.be.an("array");
      strictEqual(buckets[0]?.kind, 0);

      // "non-existent" account in FVM world, and it has not created any buckets
      const randomAccount = privateKeyToAccount(generatePrivateKey());
      ({ result: buckets } = await bucketManager.list(randomAccount.address));
      expect(buckets).to.be.an("array");
      strictEqual(buckets.length, 0);
    });

    describe("objects", function () {
      let bucket: Address; // Note: FVM uses all lowercase, but viem returns the checksummed address (may include uppercase)
      const key = "hello/world";
      const fileContents = "hello\n";

      before(async () => {
        ({
          result: { bucket },
        } = await bucketManager.create());
      });

      it("should add object from file with metadata and overwrite", async () => {
        const path = await temporaryWrite(fileContents);
        const opts = {
          metadata: {
            foo: "bar",
          },
          overwrite: true,
        };
        const { meta } = await bucketManager.add(bucket, key, path, opts);
        strictEqual(isHash(meta!.tx!.transactionHash), true);
      });

      it("should add file from File object", async () => {
        const content = new TextEncoder().encode(fileContents);
        const file = new File([content], "test.txt", {
          type: "text/plain",
        });
        const { meta } = await bucketManager.add(bucket, "hello/test", file);
        strictEqual(isHash(meta!.tx!.transactionHash), true);
      });

      it("should get object value without downloading", async () => {
        let { result: object } = await bucketManager.getObjectValue(
          bucket,
          key,
        );
        expect(object.blobHash).to.be.a("string");
        strictEqual(object.size, 6n);

        // at a specific block number
        const latestBlock = await client.publicClient.getBlockNumber();
        ({ result: object } = await bucketManager.getObjectValue(
          bucket,
          key,
          latestBlock,
        ));
        expect(object.blobHash).to.be.a("string");
        strictEqual(object.size, 6n);
      });

      it("should fail to get object at non-existent bucket", async () => {
        const missingBucket = "0xff00999999999999999999999999999999999999";
        const object = bucketManager.getObjectValue(missingBucket, key);
        await rejects(object, (err) => {
          strictEqual(
            (err as Error).message,
            `Bucket not found: '${missingBucket}'`,
          );
          return true;
        });
      });

      it("should get and download object as Uint8Array", async () => {
        const { result: object } = await bucketManager.get(bucket, key);
        const contents = new TextDecoder().decode(object);
        strictEqual(contents, fileContents);
      });

      it("should get and download object as stream", async () => {
        const { result: stream } = await bucketManager.getStream(bucket, key);
        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const contents = chunks.reduce((acc, chunk) => {
          return acc + new TextDecoder().decode(chunk);
        }, "");
        strictEqual(contents, fileContents);
      });

      it("should download object with range", async () => {
        let range: { start?: number; end?: number } = { start: 1, end: 3 };
        let { result: object } = await bucketManager.get(bucket, key, {
          range,
        });
        let contents = new TextDecoder().decode(object);
        strictEqual(contents, "ell");

        range = { start: 1, end: 1 };
        ({ result: object } = await bucketManager.get(bucket, key, {
          range,
        }));
        contents = new TextDecoder().decode(object);
        strictEqual(contents, "e");

        range = { start: 5, end: 11 };
        ({ result: object } = await bucketManager.get(bucket, key, {
          range,
        }));
        contents = new TextDecoder().decode(object);
        strictEqual(contents, "\n");

        range = { start: 1, end: undefined };
        ({ result: object } = await bucketManager.get(bucket, key, {
          range,
        }));
        contents = new TextDecoder().decode(object);
        strictEqual(contents, "ello\n");

        range = { start: undefined, end: 2 };
        ({ result: object } = await bucketManager.get(bucket, key, {
          range,
        }));
        contents = new TextDecoder().decode(object);
        strictEqual(contents, "o\n");

        range = { start: undefined, end: 11 };
        ({ result: object } = await bucketManager.get(bucket, key, {
          range,
        }));
        contents = new TextDecoder().decode(object);
        strictEqual(contents, fileContents);

        range = { start: undefined, end: undefined };
        ({ result: object } = await bucketManager.get(bucket, key, {
          range,
        }));
        contents = new TextDecoder().decode(object);
        strictEqual(contents, fileContents);
      });

      it("should fail to download object with invalid range", async () => {
        let range: { start?: number; end?: number } = { start: 5, end: 2 };
        let object = bucketManager.get(bucket, key, { range });
        await rejects(object, (err) => {
          strictEqual(
            (err as Error).message,
            `Invalid range: ${range.start}-${range.end}`,
          );
          return true;
        });

        range = { start: 6, end: undefined };
        object = bucketManager.get(bucket, key, { range });
        await rejects(object, (err) => {
          strictEqual((err as Error).message, `Invalid range: ${range.start}-`);
          return true;
        });
      });

      it("should fail to get non-existent object", async () => {
        const missingKey = "hello/foo";
        const object = bucketManager.getObjectValue(bucket, missingKey);
        await rejects(object, (err) => {
          strictEqual(
            (err as Error).message,
            `Object not found: no key '${missingKey}' in bucket '${bucket}'`,
          );
          return true;
        });
      });

      // TODO: the facades do not work with the `query` method
      it("should query objects", async () => {
        let {
          result: { objects, commonPrefixes },
        } = await bucketManager.query(bucket, { prefix: "hello/" });
        expect(objects.length).to.be.greaterThan(0);
        strictEqual(objects[0]?.key, key);
        strictEqual(objects[0]?.state?.size, 6n);
        expect(Number(objects[0]?.state?.expiry)).to.be.greaterThan(0);
        expect(objects[0]?.state?.blobHash).to.be.a("string");
        strictEqual(commonPrefixes.length, 0);

        // no objects with prefix
        ({
          result: { objects, commonPrefixes },
        } = await bucketManager.query(bucket, { prefix: "foo/" }));
        strictEqual(objects.length, 0);
        strictEqual(commonPrefixes.length, 0);

        // with all possible parameters
        const latestBlock = await client.publicClient.getBlockNumber();
        ({
          result: { objects, commonPrefixes },
        } = await bucketManager.query(bucket, {
          prefix: "hello/",
          delimiter: "/",
          startKey: "",
          limit: 1,
          blockNumber: latestBlock,
        }));
        strictEqual(objects.length, 1);
        strictEqual(objects[0]?.key, key);
        strictEqual(commonPrefixes.length, 0);
      });

      it("should fail to query non-existent bucket", async () => {
        const missingBucket = "0xff00999999999999999999999999999999999999";
        const query = bucketManager.query(missingBucket, {
          prefix: "hello/",
        });
        await rejects(query, (err) => {
          strictEqual(
            (err as Error).message,
            `Bucket not found: '${missingBucket}'`,
          );
          return true;
        });
      });

      it("should delete object", async () => {
        const deletedKey = "hello/deleted";
        const path = await temporaryWrite(fileContents);
        await bucketManager.add(bucket, deletedKey, path);
        const { meta } = await bucketManager.delete(bucket, deletedKey);
        strictEqual(isHash(meta!.tx!.transactionHash), true);
      });

      it("should fail to delete non-existent object", async () => {
        const missingKey = "hello/foo";
        const remove = bucketManager.delete(bucket, missingKey);
        await rejects(remove, (err) => {
          strictEqual(
            (err as Error).message,
            `Object not found: no key '${missingKey}' in bucket '${bucket}'`,
          );
          return true;
        });
      });
    });
  });

  describe("credit manager", function () {
    let credits: CreditManager;
    let to: Address;

    before(async () => {
      credits = client.creditManager(
        (CREDIT_MANAGER_ADDRESS as Address) ?? undefined,
      );
      to = getAddress("0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc");
    });

    it("should buy credits", async () => {
      const amount = parseEther("1");
      let { meta } = await credits.buy(amount);
      strictEqual(isHash(meta!.tx!.transactionHash), true);

      // buy for another account
      ({ meta } = await credits.buy(amount, to));
      strictEqual(isHash(meta!.tx!.transactionHash), true);
    });

    it("should fail to buy with insufficient balance", async () => {
      // Try with value exceeding balance
      const balance = await client.publicClient.getBalance({
        address: account.address,
      });
      const amount = balance + 1n;
      await rejects(credits.buy(amount, to), (err) => {
        strictEqual(
          (err as Error).message,
          `Insufficient funds: balance less than amount '${amount}'`,
        );
        return true;
      });
    });

    it("should override default contract address", async () => {
      const creditManagerAddr = credits.getContract().address;
      const overrideCreditManager = client.creditManager(creditManagerAddr);
      const { result } = await overrideCreditManager.getCreditBalance(to);
      expect(result.creditFree).to.not.equal(0n);
      expect(result.creditCommitted).to.be.a("bigint");
      expect(result.lastDebitEpoch).to.be.a("bigint");
    });

    it("should approve credit spending with 'to'", async () => {
      // use only to
      const { meta } = await credits.approve(to);
      strictEqual(isHash(meta!.tx!.transactionHash), true);
    });

    it("should approve credit spending with all explicit params", async () => {
      // explicitly set all parameters
      const amount = parseEther("1");
      const { meta } = await credits.approve(to, {
        creditLimit: amount,
        gasFeeLimit: 0n,
        ttl: 3600n,
      });
      strictEqual(isHash(meta!.tx!.transactionHash), true);
    });

    it("should revoke credit approval", async () => {
      // revoke with just to
      await credits.approve(to);
      const { meta } = await credits.revoke(to);
      strictEqual(isHash(meta!.tx!.transactionHash), true);
    });

    it("should get account details", async () => {
      const { result } = await credits.getAccount(to);
      expect(result.capacityUsed).to.be.a("bigint");
      expect(result.creditFree).to.not.equal(0n);
      expect(result.creditCommitted).to.be.a("bigint");
      strictEqual(isAddress(result.creditSponsor), true);
      expect(result.lastDebitEpoch).to.not.equal(0n);
      expect(result.approvalsTo).to.be.an("array");
      expect(result.approvalsFrom).to.be.an("array");
    });

    it("should get credit balance", async () => {
      const { result } = await credits.getCreditBalance(to);
      expect(result.creditFree).to.not.equal(0n);
      expect(result.creditCommitted).to.be.a("bigint");
      expect(result.lastDebitEpoch).to.be.a("bigint");
    });

    it("should get credit approvals with no filter", async () => {
      await credits.approve(to);
      const {
        result: { approvalsTo, approvalsFrom },
      } = await credits.getCreditApprovals(account.address);
      expect(approvalsTo).to.be.an("array");
      expect(approvalsTo.length).to.be.greaterThan(0);
      strictEqual(isAddress(approvalsTo[0]!.addr), true);
      expect(approvalsFrom).to.be.an("array");
      await credits.revoke(to);
    });

    it("should get credit approvals with 'to' filter", async () => {
      await credits.approve(to);
      const {
        result: { approvalsTo },
      } = await credits.getCreditApprovals(account.address, {
        filterTo: to,
      });
      expect(approvalsTo).to.be.an("array");
      expect(approvalsTo.length).to.be.greaterThan(0);
      strictEqual(isAddress(approvalsTo[0]!.addr), true);
    });

    it("should get credit approvals with 'from' filter", async () => {
      const approver = walletClientFromPrivateKey(
        "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6",
        localnet,
      );
      const approverClient = new RecallClient({ walletClient: approver });
      const approverCredits = approverClient.creditManager(
        (CREDIT_MANAGER_ADDRESS as Address) ?? undefined,
      );
      await approverCredits.approve(account.address);
      const {
        result: { approvalsFrom },
      } = await credits.getCreditApprovals(account.address, {
        filterFrom: approver.account.address,
      });
      expect(approvalsFrom).to.be.an("array");
      expect(approvalsFrom.length).to.be.greaterThan(0);
      strictEqual(isAddress(approvalsFrom[0]!.addr), true);
      strictEqual(approvalsFrom[0]!.addr, approver.account.address);
      await approverCredits.revoke(account.address);
    });

    it("should get credit stats", async () => {
      const { result: stats } = await credits.getCreditStats();
      expect(Number(stats.balance)).to.be.greaterThan(0);
      expect(Number(stats.creditCommitted)).to.be.greaterThan(0);
      expect(Number(stats.creditSold)).to.be.greaterThan(0);
      expect(Number(stats.creditDebited)).to.be.greaterThan(0);
      strictEqual(
        stats.tokenCreditRate,
        1000000000000000000000000000000000000n,
      );
      expect(Number(stats.numAccounts)).to.be.greaterThan(0);
    });
  });

  // TODO: some of these tests just check types because we don't have a great CI flow,
  // but we can change that in the future and make them more explicit
  describe("blob manager", function () {
    let blobs: BlobManager;
    const to = getAddress("0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc");
    const subscriptionId = "foobar";
    const size = 6n;
    let blobHash: string;

    before(async () => {
      blobs = client.blobManager(
        (BLOB_MANAGER_ADDRESS as Address) ?? undefined,
      );
      const bucketManager = client.bucketManager(
        (BUCKET_MANAGER_ADDRESS as Address) ?? undefined,
      );
      const fileContents = "hello\n";
      const key = "hello/world";
      const {
        result: { bucket },
      } = await bucketManager.create();
      const path = await temporaryWrite(fileContents);
      await bucketManager.add(bucket, key, path);
      const { result } = await bucketManager.getObjectValue(bucket, key);
      blobHash = result.blobHash;
    });

    it("should get storage stats", async () => {
      const { result: stats } = await blobs.getStorageStats();
      expect(Number(stats.capacityFree)).to.be.greaterThan(0);
      expect(Number(stats.capacityUsed)).to.be.greaterThan(0);
      expect(Number(stats.numBlobs)).to.be.greaterThanOrEqual(0);
      expect(Number(stats.numResolving)).to.be.greaterThanOrEqual(0);
    });

    it("should get storage usage", async () => {
      const { result } = await blobs.getStorageUsage(to);
      expect(result).to.be.a("bigint");
    });

    it("should get subnet stats", async () => {
      const { result: stats } = await blobs.getSubnetStats();
      expect(Number(stats.balance)).to.be.greaterThan(0);
      expect(Number(stats.capacityFree)).to.be.greaterThan(0);
      expect(Number(stats.capacityUsed)).to.be.greaterThan(0);
      expect(Number(stats.creditSold)).to.be.greaterThan(0);
      expect(Number(stats.creditCommitted)).to.be.greaterThan(0);
      expect(Number(stats.creditDebited)).to.be.greaterThan(0);
      strictEqual(
        stats.tokenCreditRate,
        1000000000000000000000000000000000000n,
      );
      expect(Number(stats.numAccounts)).to.be.greaterThan(0);
      expect(stats.numBlobs).to.be.a("bigint");
      expect(stats.numResolving).to.be.a("bigint");
    });

    // TODO: this assumes the blob already exists on the network since the objects API has no way
    // to add a blob. Thus, we're taking advantage of its pre-existence on the network to "add" it.
    it("should add blob", async () => {
      const { meta } = await blobs.addBlob(blobHash, subscriptionId, size);
      strictEqual(isHash(meta!.tx!.transactionHash), true);
    });

    it("should get blob", async () => {
      const { result } = await blobs.getBlob(blobHash);
      expect(result.size).to.be.equal(size);
      expect(result.subscriptions.length).to.be.greaterThan(0);
      expect(result.status).to.be.equal(2); // resolved
    });

    // TODO: this assumes the new blob already exists on the network / iroh node
    it("should overwrite blob", async () => {
      const { meta } = await blobs.overwriteBlob(
        blobHash,
        blobHash,
        subscriptionId,
        size,
      );
      strictEqual(isHash(meta!.tx!.transactionHash), true);
    });

    it("should delete blob", async () => {
      const { meta } = await blobs.deleteBlob(blobHash, subscriptionId);
      strictEqual(isHash(meta!.tx!.transactionHash), true);
    });
  });

  describe("account manager", function () {
    let accountManager: AccountManager;

    before(async () => {
      accountManager = client.accountManager();
    });

    it("should get account balance", async () => {
      const { result } = await accountManager.balance();
      expect(Number(result)).to.be.greaterThan(0);
    });

    it("should get account info", async () => {
      const { result } = await accountManager.info();
      strictEqual(result.address, account.address);
      expect(result.nonce).to.be.greaterThan(0);
      expect(Number(result.balance)).to.be.greaterThan(0);
      expect(Number(result.parentBalance)).to.be.greaterThan(0);
    });

    it("should deposit into subnet", async () => {
      const amount = parseEther("1");
      const { meta } = await accountManager.deposit(amount);
      strictEqual(isHash(meta!.tx!.transactionHash), true);
    });

    it("should withdraw from subnet", async () => {
      const amount = parseEther("1");
      const { meta } = await accountManager.withdraw(amount);
      strictEqual(isHash(meta!.tx!.transactionHash), true);
    });

    it("should transfer within subnet", async () => {
      const amount = parseEther("1");
      const to = getAddress("0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc");
      const { result: toBalanceBefore } = await accountManager.balance(to);
      const { meta } = await accountManager.transfer(to, amount);
      strictEqual(isHash(meta!.tx!.transactionHash), true);
      const { result: toBalanceAfter } = await accountManager.balance(to);
      strictEqual(toBalanceBefore + amount, toBalanceAfter);
    });
  });
});
