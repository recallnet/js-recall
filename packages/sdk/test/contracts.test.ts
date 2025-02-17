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
import {
  AccountManager,
  BlobManager,
  BucketManager,
  CreditManager,
} from "../src/entities/index.js";

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
      strictEqual(result.owner, account.address);
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

    it("should override default contract address", async () => {
      const bucketManagerAddr = client.bucketManager().getContract().address;
      const overrideBucketManager = client.bucketManager(bucketManagerAddr);
      const { result: buckets } = await overrideBucketManager.list(
        account.address,
      );
      expect(buckets).to.be.an("array");
      strictEqual(buckets[0]?.kind, 0);
    });

    describe("objects", function () {
      let bucket: Address; // Note: FVM uses all lowercase, but viem returns the checksummed address (may include uppercase)
      const key = "hello/world";
      const fileContents = "hello\n";
      const blobHash = "rzghyg4z3p6vbz5jkgc75lk64fci7kieul65o6hk6xznx7lctkmq";

      before(async () => {
        ({
          result: { bucket },
        } = await bucketManager.create());
      });

      it("should add object from file", async () => {
        const path = await temporaryWrite(fileContents);
        const opts = {
          metadata: {
            foo: "bar",
          },
        };
        const { meta, result } = await bucketManager.add(
          bucket,
          key,
          path,
          opts,
        );
        strictEqual(isHash(meta!.tx!.transactionHash), true);
        strictEqual(result.owner, account.address);
        strictEqual(result.bucket.toLowerCase(), bucket);
        strictEqual(result.key, key);
      });

      it("should add file from File object", async () => {
        const content = new TextEncoder().encode(fileContents);
        const file = new File([content], "test.txt", {
          type: "text/plain",
        });
        const { meta, result } = await bucketManager.add(
          bucket,
          "hello/test",
          file,
        );
        strictEqual(isHash(meta!.tx!.transactionHash), true);
        strictEqual(result.owner, account.address);
        strictEqual(result.bucket.toLowerCase(), bucket);
        strictEqual(result.key, "hello/test");
      });

      it("should get object value without downloading", async () => {
        let { result: object } = await bucketManager.getObjectValue(
          bucket,
          key,
        );
        strictEqual(object.blobHash, blobHash);
        strictEqual(object.size, 6n);

        // at a specific block number
        const latestBlock = await client.publicClient.getBlockNumber();
        ({ result: object } = await bucketManager.getObjectValue(
          bucket,
          key,
          latestBlock,
        ));
        strictEqual(object.blobHash, blobHash);
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

      it("should query objects", async () => {
        let {
          result: { objects, commonPrefixes },
        } = await bucketManager.query(bucket, { prefix: "hello/" });
        expect(objects.length).to.be.greaterThan(0);
        strictEqual(objects[0]?.key, key);
        strictEqual(objects[0]?.state?.size, 6n);
        strictEqual(objects[0]?.state?.blobHash, blobHash);
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
        const { meta, result } = await bucketManager.delete(bucket, deletedKey);
        strictEqual(isHash(meta!.tx!.transactionHash), true);
        strictEqual(result.owner, account.address);
        strictEqual(result.bucket.toLowerCase(), bucket);
        strictEqual(result.key, deletedKey);
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
    let caller: Address;

    before(async () => {
      credits = client.creditManager(
        (CREDIT_MANAGER_ADDRESS as Address) ?? undefined,
      );
      to = getAddress("0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc");
      caller = getAddress("0x976ea74026e726554db657fa54763abd0c3a0aa9");
    });

    it("should buy credits", async () => {
      const amount = parseEther("1");
      let { meta, result } = await credits.buy(amount);
      strictEqual(isHash(meta!.tx!.transactionHash), true);
      strictEqual(result.addr, account.address);
      strictEqual(result.amount, amount);

      // buy for another account
      ({ meta, result } = await credits.buy(amount, to));
      strictEqual(isHash(meta!.tx!.transactionHash), true);
      strictEqual(result.addr, to);
      strictEqual(result.amount, amount);
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
      const { meta, result } = await credits.approve(to);
      strictEqual(isHash(meta!.tx!.transactionHash), true);
      strictEqual(result.from, account.address);
      strictEqual(result.to, to);
      strictEqual(result.caller.length, 0);
    });

    it("should approve credit spending with 'to' and 'caller'", async () => {
      // also use a required caller
      const { meta, result } = await credits.approve(to, [caller]);
      strictEqual(isHash(meta!.tx!.transactionHash), true);
      strictEqual(result.from, account.address);
      strictEqual(result.to, to);
      strictEqual(result.caller[0], caller);
    });

    it("should approve credit spending with all explicit params", async () => {
      // explicitly set all parameters
      const amount = parseEther("1");
      const { meta, result } = await credits.approve(
        to,
        [caller],
        amount,
        0n,
        3600n,
        account.address,
      );
      strictEqual(isHash(meta!.tx!.transactionHash), true);
      strictEqual(result.from, account.address);
      strictEqual(result.to, to);
      strictEqual(result.caller[0], caller);
      strictEqual(result.creditLimit, amount);
      strictEqual(result.gasFeeLimit, 0n);
      strictEqual(result.ttl, 3600n);
    });

    it("should revoke credit approval", async () => {
      // revoke with just to
      await credits.approve(to);
      let { meta, result } = await credits.revoke(to);
      strictEqual(isHash(meta!.tx!.transactionHash), true);
      strictEqual(result.from, account.address);
      strictEqual(result.to, to);

      // revoke to and required caller
      await credits.approve(to, [caller]);
      ({ meta, result } = await credits.revoke(to, caller));
      strictEqual(isHash(meta!.tx!.transactionHash), true);
      strictEqual(result.from, account.address);
      strictEqual(result.to, to);
      strictEqual(result.caller, caller);

      // revoke with explicit caller
      await credits.approve(to);
      ({ meta, result } = await credits.revoke(to, undefined, account.address));
      strictEqual(isHash(meta!.tx!.transactionHash), true);
      strictEqual(result.from, account.address);
      strictEqual(result.to, to);
    });

    it("should fail to revoke with invalid 'from' address", async () => {
      await rejects(credits.revoke(to, undefined, to), (err) => {
        strictEqual(
          (err as Error).message,
          `'from' address '${to}' does not match origin or caller '${account.address}'`,
        );
        return true;
      });
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
    const blobHash = "rzghyg4z3p6vbz5jkgc75lk64fci7kieul65o6hk6xznx7lctkmq";

    before(async () => {
      blobs = client.blobManager(
        (BLOB_MANAGER_ADDRESS as Address) ?? undefined,
      );
    });

    it("should get added blobs", async () => {
      const { result } = await blobs.getAddedBlobs(10);
      expect(result).to.be.an("array");
      expect(result.length).to.be.greaterThanOrEqual(0);
    });

    it("should get pending blobs", async () => {
      const { result } = await blobs.getPendingBlobs(10);
      expect(result).to.be.an("array");
      expect(result.length).to.be.greaterThanOrEqual(0);
    });

    it("should get pending blobs count", async () => {
      const { result } = await blobs.getPendingBlobsCount();
      expect(Number(result)).to.be.greaterThanOrEqual(0);
    });

    it("should get pending bytes count", async () => {
      const { result } = await blobs.getPendingBytesCount();
      expect(result).to.be.a("bigint");
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
      const { meta, result } = await blobs.addBlob(
        blobHash,
        subscriptionId,
        size,
      );
      strictEqual(isHash(meta!.tx!.transactionHash), true);
      strictEqual(result.blobHash, blobHash);
    });

    it("should get blob", async () => {
      const { result } = await blobs.getBlob(blobHash);
      expect(result.size).to.be.equal(size);
      expect(result.subscribers.length).to.be.greaterThan(0);
      expect(result.status).to.be.equal(2); // resolved
    });

    it("should get blob status", async () => {
      const { result } = await blobs.getBlobStatus(
        account.address,
        blobHash,
        subscriptionId,
      );
      expect(result).to.be.equal(2); // resolved
    });

    // TODO: this assumes the new blob already exists on the network / iroh node
    it("should overwrite blob", async () => {
      const { meta, result } = await blobs.overwriteBlob(
        blobHash,
        blobHash,
        subscriptionId,
        size,
      );
      strictEqual(isHash(meta!.tx!.transactionHash), true);
      strictEqual(result.newHash, blobHash);
    });

    it("should delete blob", async () => {
      const { meta, result } = await blobs.deleteBlob(blobHash, subscriptionId);
      strictEqual(isHash(meta!.tx!.transactionHash), true);
      strictEqual(result.blobHash, blobHash);
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
      const { meta, result } = await accountManager.deposit(amount);
      strictEqual(isHash(meta!.tx!.transactionHash), true);
      strictEqual(result, true);
    });

    it("should withdraw from subnet", async () => {
      const amount = parseEther("1");
      const { meta, result } = await accountManager.withdraw(amount);
      strictEqual(isHash(meta!.tx!.transactionHash), true);
      strictEqual(result, true);
    });

    it("should transfer within subnet", async () => {
      const amount = parseEther("1");
      const to = getAddress("0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc");
      const { result: toBalanceBefore } = await accountManager.balance(to);
      const { meta, result } = await accountManager.transfer(to, amount);
      strictEqual(isHash(meta!.tx!.transactionHash), true);
      strictEqual(result, true);
      const { result: toBalanceAfter } = await accountManager.balance(to);
      strictEqual(toBalanceBefore + amount, toBalanceAfter);
    });
  });
});
