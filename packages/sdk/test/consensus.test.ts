import { ok, rejects, strictEqual } from "assert";
import { fromHex } from "@cosmjs/encoding";
import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { describe, it } from "mocha";
import { ConsensusClient } from "../src/consensus.js";
import { LOCALNET_RPC_URL, LOCALNET_SUBNET_ID } from "../src/network.js";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("consensus", function () {
  let consensus: ConsensusClient;

  before(async function () {
    consensus = await ConsensusClient.connect(LOCALNET_RPC_URL);
  });

  it("should be able to get abci info", async function () {
    const { data } = await consensus.abciInfo();
    strictEqual(data, "fendermint");
  });

  it("should be able to make abci query", async function () {
    const data = new Uint8Array();
    const info = await consensus.abciQuery({
      path: "/nonexistent",
      data,
      height: 1,
    });
    strictEqual(info.height, 1);
  });

  it("should be able to get a block", async function () {
    const { block } = await consensus.block(1);
    const { chainId } = block.header;
    strictEqual(chainId, "2022913529944675");
  });

  it("should be able to get block results", async function () {
    const { height } = await consensus.blockResults(1);
    strictEqual(height, 1);
  });

  it("should be able to get block search", async function () {
    const { totalCount } = await consensus.blockSearch({
      query: "block.height = 1",
    });
    strictEqual(totalCount, 1);
  });

  it("should be able to get block search all", async function () {
    const { totalCount } = await consensus.blockSearch({
      query: "block.height = 1",
    });
    strictEqual(totalCount, 1);
  });

  it("should be able to get blockchain", async function () {
    const { blockMetas } = await consensus.blockchain();
    // get all keys from deeply nested object
    const count = blockMetas[0].blockId.parts.total;
    strictEqual(count, 1);
  });

  it("should be able to broadcast tx commit", async function () {
    const tx = fromHex(
      "a1665369676e6564838a0042001156040a5903da8cc38e05c4e51db26f789ed7bbe1304b241819401a002dc6c040400258260171a0e4022045756169cfa14ad7a9a6a823c54618a3b2dcb16f6d6281849bee5f59d9520a91f6584201809a862f2828499715078f67d8c7d22786241b2cffe47a59ec8ed80d993003132997791141feae64be358d03a309509eabc575a9a9c351096ee6cec30cc2a36300"
    );
    const { deliverTx } = await consensus.broadcastTxCommit({ tx });
    strictEqual(deliverTx!.code, 0);
  });

  it("should be able to broadcast tx sync", async function () {
    const tx = fromHex(
      "a1665369676e6564838a0042001156040a5903da8cc38e05c4e51db26f789ed7bbe1304b241819401a002dc6c040400258260171a0e4022045756169cfa14ad7a9a6a823c54618a3b2dcb16f6d6281849bee5f59d9520a91f6584201809a862f2828499715078f67d8c7d22786241b2cffe47a59ec8ed80d993003132997791141feae64be358d03a309509eabc575a9a9c351096ee6cec30cc2a36300"
    );
    const { codespace } = await consensus.broadcastTxSync({ tx });
    strictEqual(codespace, "");
  });

  it("should be able to broadcast tx async", async function () {
    const tx = fromHex(
      "a1665369676e6564838a0042001156040a5903da8cc38e05c4e51db26f789ed7bbe1304b241819401a002dc6c040400258260171a0e4022045756169cfa14ad7a9a6a823c54618a3b2dcb16f6d6281849bee5f59d9520a91f6584201809a862f2828499715078f67d8c7d22786241b2cffe47a59ec8ed80d993003132997791141feae64be358d03a309509eabc575a9a9c351096ee6cec30cc2a36300"
    );
    const res = await consensus.broadcastTxAsync({ tx });
    ok(res);
  });

  it("should be able to get commit", async function () {
    const { canonical } = await consensus.commit(1);
    strictEqual(canonical, true);
  });

  it("should be able to get genesis", async function () {
    const { appState } = await consensus.genesis();
    strictEqual(appState!.chain_name, LOCALNET_SUBNET_ID);
  });

  it("should be able to get health", async function () {
    const health = await consensus.health();
    strictEqual(health, null);
  });

  it("should be able to get num unconfirmed txs", async function () {
    const { total } = await consensus.numUnconfirmedTxs();
    strictEqual(typeof total, "number");
  });

  it("should be able to get status", async function () {
    const { nodeInfo } = await consensus.status();
    strictEqual(nodeInfo.network, "2022913529944675");
  });

  it("should be able to get tx", async function () {
    const str = "abcdef0123456789";
    const hash = fromHex(str);
    rejects(
      async () => {
        await consensus.tx({ hash });
      },
      {
        code: -32603,
        message: "Internal error",
        data: "tx (ABCDEF0123456789) not found",
      }
    );
  });

  it("should be able to get tx search", async function () {
    const { totalCount } = await consensus.txSearch({
      query: "block.height = 1",
    });
    strictEqual(totalCount, 0);
  });

  it("should be able to get tx search all", async function () {
    const { totalCount } = await consensus.txSearchAll({
      query: "block.height = 1",
    });
    strictEqual(totalCount, 0);
  });

  it("should be able to get validators", async function () {
    const { count } = await consensus.validators({ height: 1 });
    expect(count).to.be.greaterThan(0);
  });

  it("should be able to get validators all", async function () {
    const { count } = await consensus.validatorsAll();
    expect(count).to.be.greaterThan(0);
  });
});
