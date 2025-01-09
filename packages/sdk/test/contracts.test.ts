import { match, rejects, strictEqual } from "assert";
import { expect } from "chai";
import { describe, it } from "mocha";
import { temporaryWrite } from "tempy";
import { Account, Address, getAddress, parseEther } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { localnet } from "../src/chains.js";
import { HokuClient, walletClientFromPrivateKey } from "../src/client.js";
import { AccountManager } from "../src/entities/account.js";
import { BlobManager } from "../src/entities/blob.js";
import { BucketManager } from "../src/entities/bucket.js";
import { CreditManager } from "../src/entities/credit.js";

// TODO: these tests are somewhat dependent on one another, so we should refactor to be independent
describe.only("contracts", function () {
  this.timeout(60000);
  let client: HokuClient;
  let account: Account;

  before(async () => {
    const walletClient = walletClientFromPrivateKey(
      "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
      localnet
    );
    account = walletClient.account;
    client = new HokuClient({ walletClient });
  });

  describe("bucket manager", function () {
    let bucketManager: BucketManager;

    before(async () => {
      bucketManager = client.bucketManager();
    });

    it("should create a bucket", async () => {
      const { meta, result } = await bucketManager.create(account.address);
      expect(meta?.tx?.transactionHash).to.be.a("string");
      strictEqual(result.owner, account.address);
      match(result.bucket, /0x[a-f0-9]{40}/);
    });

    it("should list buckets", async () => {
      let { result: buckets } = await bucketManager.list(account.address);
      expect(buckets).to.be.an("array");
      strictEqual(buckets[0].kind, 0);

      // at a specific block number
      const latestBlock = await client.publicClient.getBlockNumber();
      ({ result: buckets } = await bucketManager.list(account.address, latestBlock));
      expect(buckets).to.be.an("array");
      strictEqual(buckets[0].kind, 0);

      // "non-existent" account in FVM world, and it has not created any buckets
      const randomAccount = privateKeyToAccount(generatePrivateKey());
      ({ result: buckets } = await bucketManager.list(randomAccount.address));
      expect(buckets).to.be.an("array");
      strictEqual(buckets.length, 0);
    });

    it("should override default contract address", async () => {
      const bucketManagerAddr = client.bucketManager().getContract().address;
      const overrideBucketManager = client.bucketManager(bucketManagerAddr);
      const { result: buckets } = await overrideBucketManager.list(account.address);
      expect(buckets).to.be.an("array");
      strictEqual(buckets[0].kind, 0);
    });

    describe("objects", function () {
      let bucket: Address; // Note: FVM uses all lowercase, but viem returns the checksummed address (may include uppercase)
      const key = "hello/world";
      const blobHash = "rzghyg4z3p6vbz5jkgc75lk64fci7kieul65o6hk6xznx7lctkmq";

      before(async () => {
        ({
          result: { bucket },
        } = await bucketManager.create());
      });

      it("should add object from file", async () => {
        const path = await temporaryWrite("hello\n");
        const { meta, result } = await bucketManager.addFile(bucket, key, path);
        expect(meta?.tx?.transactionHash).to.be.a("string");
        strictEqual(result.owner, account.address);
        strictEqual(result.bucket.toLowerCase(), bucket);
        strictEqual(result.key, key);
      });

      it("should add file from File object", async () => {
        const content = new TextEncoder().encode("hello\n");
        const file = new File([content], "test.txt", {
          type: "text/plain",
        });

        // TODO: there's latency in the object being available when overwriting.
        // this should be fixed elsewhere, but for now, we'll use a different key
        // and *not* overwrite. latency is still around 5-10 seconds, though, if
        // an object is added with the same data as another in the bucket...
        const { meta, result } = await bucketManager.addFile(bucket, "hello/test", file);
        expect(meta?.tx?.transactionHash).to.be.a("string");
        strictEqual(result.owner, account.address);
        strictEqual(result.bucket.toLowerCase(), bucket);
        strictEqual(result.key, "hello/test");
        await new Promise((resolve) => setTimeout(resolve, 15000));
      });

      it("should get object", async () => {
        let { result: object } = await bucketManager.get(bucket, key);
        strictEqual(object.blobHash, blobHash);
        strictEqual(object.size, 6n);

        // at a specific block number
        const latestBlock = await client.publicClient.getBlockNumber();
        ({ result: object } = await bucketManager.get(bucket, key, latestBlock));
        strictEqual(object.blobHash, blobHash);
        strictEqual(object.size, 6n);
      });

      it("should fail to get object at non-existent bucket", async () => {
        const missingBucket = "0xff00999999999999999999999999999999999999";
        const object = bucketManager.get(missingBucket, key);
        await rejects(object, (err) => {
          strictEqual((err as Error).message, `Bucket not found: '${missingBucket}'`);
          return true;
        });
      });

      it("should download object", async () => {
        const object = await bucketManager.download(bucket, key);
        const contents = new TextDecoder().decode(object);
        strictEqual(contents, "hello\n");
      });

      it("should download object from stream", async () => {
        const stream = await bucketManager.downloadStream(bucket, key);
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
        strictEqual(contents, "hello\n");
      });

      it("should download object with range", async () => {
        let range: { start?: number; end?: number } = { start: 1, end: 3 };
        let object = await bucketManager.download(bucket, key, range);
        let contents = new TextDecoder().decode(object);
        strictEqual(contents, "ell");

        range = { start: 1, end: 1 };
        object = await bucketManager.download(bucket, key, range);
        contents = new TextDecoder().decode(object);
        strictEqual(contents, "e");

        range = { start: 5, end: 11 };
        object = await bucketManager.download(bucket, key, range);
        contents = new TextDecoder().decode(object);
        strictEqual(contents, "\n");

        range = { start: 1, end: undefined };
        object = await bucketManager.download(bucket, key, range);
        contents = new TextDecoder().decode(object);
        strictEqual(contents, "ello\n");

        range = { start: undefined, end: 2 };
        object = await bucketManager.download(bucket, key, range);
        contents = new TextDecoder().decode(object);
        strictEqual(contents, "o\n");

        range = { start: undefined, end: 11 };
        object = await bucketManager.download(bucket, key, range);
        contents = new TextDecoder().decode(object);
        strictEqual(contents, "hello\n");

        range = { start: undefined, end: undefined };
        object = await bucketManager.download(bucket, key, range);
        contents = new TextDecoder().decode(object);
        strictEqual(contents, "hello\n");
      });

      it("should fail to download object with invalid range", async () => {
        let range: { start?: number; end?: number } = { start: 5, end: 2 };
        let object = bucketManager.download(bucket, key, range);
        await rejects(object, (err) => {
          strictEqual((err as Error).message, `Invalid range: ${range.start}-${range.end}`);
          return true;
        });

        range = { start: 6, end: undefined };
        object = bucketManager.download(bucket, key, range);
        await rejects(object, (err) => {
          strictEqual((err as Error).message, `Invalid range: ${range.start}-`);
          return true;
        });
      });

      // TODO: mock objects API returning 400 error: {"code":400,"message":"object rzghyg4z3p6vbz5jkgc75lk64fci7kieul65o6hk6xznx7lctkmq is not available"}
      it.skip("should fail to download unrecoverable object", async () => {
        const object = bucketManager.download(bucket, key);
        await rejects(object, (err) => {
          strictEqual(
            (err as Error).message,
            `Object not available: unrecoverable key '${key}' with blob hash '${blobHash}'`
          );
          return true;
        });
      });

      it("should fail to get non-existent object", async () => {
        const missingKey = "hello/foo";
        const object = bucketManager.get(bucket, missingKey);
        await rejects(object, (err) => {
          strictEqual(
            (err as Error).message,
            `Object not found: no key '${missingKey}' in bucket '${bucket}'`
          );
          return true;
        });
      });

      it("should query objects", async () => {
        let {
          result: { objects, commonPrefixes },
        } = await bucketManager.query(bucket, "hello/");
        expect(objects.length).to.be.greaterThan(0);
        strictEqual(objects[0].key, key);
        strictEqual(objects[0].state.size, 6n);
        strictEqual(objects[0].state.blobHash, blobHash);
        strictEqual(commonPrefixes.length, 0);

        // no objects with prefix
        ({
          result: { objects, commonPrefixes },
        } = await bucketManager.query(bucket, "foo/"));
        strictEqual(objects.length, 0);
        strictEqual(commonPrefixes.length, 0);

        // with all possible parameters
        const latestBlock = await client.publicClient.getBlockNumber();
        ({
          result: { objects, commonPrefixes },
        } = await bucketManager.query(bucket, "hello/", "/", "", 1, latestBlock));
        strictEqual(objects.length, 1);
        strictEqual(objects[0].key, key);
        strictEqual(commonPrefixes.length, 0);
      });

      it("should fail to query non-existent bucket", async () => {
        const missingBucket = "0xff00999999999999999999999999999999999999";
        const query = bucketManager.query(missingBucket, "hello/");
        await rejects(query, (err) => {
          strictEqual((err as Error).message, `Bucket not found: '${missingBucket}'`);
          return true;
        });
      });

      // TODO: although this test passes in isolation, it leads to weird behavior wrt object
      // availability on the network, causing later tests fail for get/download objects with the same contents
      it.skip("should delete object", async () => {
        const deletedKey = "hello/deleted";
        const path = await temporaryWrite("hello\n");
        await bucketManager.addFile(bucket, deletedKey, path);
        await new Promise((resolve) => setTimeout(resolve, 15000));
        const { meta, result } = await bucketManager.delete(bucket, deletedKey);
        expect(meta?.tx?.transactionHash).to.be.a("string");
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
            `Object not found: no key '${missingKey}' in bucket '${bucket}'`
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
      credits = client.creditManager();
      to = getAddress("0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc");
      caller = getAddress("0x976ea74026e726554db657fa54763abd0c3a0aa9");
    });

    it("should buy credits", async () => {
      const amount = parseEther("1");
      let { meta, result } = await credits.buy(amount);
      expect(meta?.tx?.transactionHash).to.be.a("string");
      strictEqual(result.addr, account.address);
      strictEqual(result.amount, amount);

      // buy for another account
      ({ meta, result } = await credits.buy(amount, to));
      expect(meta?.tx?.transactionHash).to.be.a("string");
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
          `Insufficient funds: balance less than amount '${amount}'`
        );
        return true;
      });
    });

    it("should override default contract address", async () => {
      const creditManagerAddr = credits.getContract().address;
      const overrideCreditManager = client.creditManager(creditManagerAddr);
      const { result } = await overrideCreditManager.getBalance(to);
      expect(result.creditFree).to.not.equal(0n);
      expect(result.creditCommitted).to.be.a("bigint");
      expect(result.lastDebitEpoch).to.be.a("bigint");
    });

    it("should approve credit spending with 'to'", async () => {
      // use only to
      const { meta, result } = await credits.approve(to);
      expect(meta?.tx?.transactionHash).to.be.a("string");
      strictEqual(result.from, account.address);
      strictEqual(result.to, to);
      strictEqual(result.caller.length, 0);
    });

    it("should approve credit spending with 'to' and 'caller'", async () => {
      // also use a required caller
      const { meta, result } = await credits.approve(to, [caller]);
      expect(meta?.tx?.transactionHash).to.be.a("string");
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
        account.address
      );
      expect(meta?.tx?.transactionHash).to.be.a("string");
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
      expect(meta?.tx?.transactionHash).to.be.a("string");
      strictEqual(result.from, account.address);
      strictEqual(result.to, to);

      // revoke to and required caller
      await credits.approve(to, [caller]);
      ({ meta, result } = await credits.revoke(to, caller));
      expect(meta?.tx?.transactionHash).to.be.a("string");
      strictEqual(result.from, account.address);
      strictEqual(result.to, to);
      strictEqual(result.caller, caller);

      // revoke with explicit caller
      await credits.approve(to);
      ({ meta, result } = await credits.revoke(to, undefined, account.address));
      expect(meta?.tx?.transactionHash).to.be.a("string");
      strictEqual(result.from, account.address);
      strictEqual(result.to, to);
    });

    it("should fail to revoke with invalid 'from' address", async () => {
      await rejects(credits.revoke(to, undefined, to), (err) => {
        strictEqual(
          (err as Error).message,
          `'from' address '${to}' does not match origin or caller '${account.address}'`
        );
        return true;
      });
    });

    it("should get account details", async () => {
      const { result } = await credits.getAccount(to);
      expect(result.capacityUsed).to.be.a("bigint");
      expect(result.creditFree).to.not.equal(0n);
      expect(result.creditCommitted).to.be.a("bigint");
      match(result.creditSponsor, /0x[a-f0-9]{40}/);
      expect(result.lastDebitEpoch).to.not.equal(0n);
      expect(result.approvals).to.be.an("array");
    });

    it("should get credit approvals with no filter", async () => {
      await credits.approve(to);
      const {
        result: { approvals },
      } = await credits.getCreditApprovals(account.address);
      expect(approvals).to.be.an("array");
      expect(approvals.length).to.be.greaterThan(0);
      match(approvals[0].to, /0x[a-f0-9]{40}/);
      await credits.revoke(to);
    });

    // TODO: see the comment in the CreditManager `getAccount` method
    // TL;DR—the `to` field that you pass is an EVM address, but the `to`
    // field in returned value is a masked ID address, so filtering doesn't
    // work because these are different hex addresses
    it.skip("should get credit approvals with 'to' filter", async () => {
      await credits.approve(to);
      const {
        result: { approvals },
      } = await credits.getCreditApprovals(account.address, to);
      expect(approvals).to.be.an("array");
      expect(approvals.length).to.be.greaterThan(0);
      match(approvals[0].to, /^f0/);
      await credits.revoke(to);
    });

    it("should get credit stats", async () => {
      const { result: stats } = await credits.getCreditStats();
      expect(Number(stats.balance)).to.be.greaterThan(0);
      expect(Number(stats.creditCommitted)).to.be.greaterThan(0);
      expect(Number(stats.creditSold)).to.be.greaterThan(0);
      expect(Number(stats.creditDebited)).to.be.greaterThan(0);
      strictEqual(stats.tokenCreditRate, 1000000000000000000000000000000000000n);
      expect(Number(stats.numAccounts)).to.be.greaterThan(0);
    });
  });

  // TODO: some of these tests just check types because we don't have a great CI flow,
  // but we can change that in the future and make them more explicit
  describe("blob manager", function () {
    let blobs: BlobManager;
    let to: Address;

    before(async () => {
      blobs = client.blobManager();
      to = getAddress("0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc");
    });

    it("should get storage usage", async () => {
      const { result } = await blobs.getStorageUsage(to);
      expect(result).to.be.a("bigint");
    });

    it("should get storage stats", async () => {
      const { result: stats } = await blobs.getStorageStats();
      expect(Number(stats.capacityFree)).to.be.greaterThan(0);
      expect(Number(stats.capacityUsed)).to.be.greaterThan(0);
      expect(stats.numBlobs).to.be.a("bigint");
      expect(stats.numResolving).to.be.a("bigint");
    });

    it("should get subnet stats", async () => {
      const { result: stats } = await blobs.getSubnetStats();
      expect(Number(stats.balance)).to.be.greaterThan(0);
      expect(Number(stats.capacityFree)).to.be.greaterThan(0);
      expect(Number(stats.capacityUsed)).to.be.greaterThan(0);
      expect(Number(stats.creditSold)).to.be.greaterThan(0);
      expect(Number(stats.creditCommitted)).to.be.greaterThan(0);
      expect(Number(stats.creditDebited)).to.be.greaterThan(0);
      strictEqual(stats.tokenCreditRate, 1000000000000000000000000000000000000n);
      expect(Number(stats.numAccounts)).to.be.greaterThan(0);
      expect(stats.numBlobs).to.be.a("bigint");
      expect(stats.numResolving).to.be.a("bigint");
    });
  });

  describe.skip("account manager", function () {
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
      expect(meta?.tx?.transactionHash).to.be.a("string");
      strictEqual(result, true);
    });

    it("should withdraw from subnet", async () => {
      const amount = parseEther("1");
      const { meta, result } = await accountManager.withdraw(amount);
      expect(meta?.tx?.transactionHash).to.be.a("string");
      strictEqual(result, true);
    });

    it("should transfer within subnet", async () => {
      const amount = parseEther("1");
      const to = getAddress("0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc");
      const { result: toBalanceBefore } = await accountManager.balance(to);
      const { meta, result } = await accountManager.transfer(to, amount);
      expect(meta?.tx?.transactionHash).to.be.a("string");
      strictEqual(result, true);
      const { result: toBalanceAfter } = await accountManager.balance(to);
      strictEqual(toBalanceBefore + amount, toBalanceAfter);
    });
  });
});
