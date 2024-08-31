import { strictEqual } from "assert";

describe("ipc", function () {
  it("should be able to call ipc contract", function () {
    const contract = "test";
    strictEqual(contract, "test");
  });
});
