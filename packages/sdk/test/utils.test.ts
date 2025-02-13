import { describe, it } from "mocha";
import { strictEqual } from "node:assert";

import { cbor } from "@recallnet/fvm";

import { actorIdToMaskedEvmAddress } from "../src/entities/utils.js";

describe("utils", function () {
  it("should convert actor ID to masked EVM address", () => {
    const eventCborData =
      "0x821901e05502aabe93b4fca68fafdce9c66c5615b3dd5b8420ba";
    const decoded = cbor.decode(eventCborData);
    const actorId = decoded[0] as number;
    const maskedAddr = actorIdToMaskedEvmAddress(actorId);
    strictEqual(actorId, 480);
    strictEqual(maskedAddr, "0xff000000000000000000000000000000000001e0");
  });
});
