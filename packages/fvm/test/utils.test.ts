import { expect } from "chai";
import { bytesToHex, hexToBytes } from "viem";

import * as base32 from "../src/utils/base32.js";
import * as cbor from "../src/utils/cbor.js";
import { base32ToHex, hexToBase32 } from "../src/utils/convert.js";
import { Stream } from "../src/utils/leb128/common.js";
import { signed, unsigned } from "../src/utils/leb128/index.js";

describe("utils", async () => {
  describe("base32", async () => {
    it("should decode base32 to bytes", async () => {
      let value = "o4gsdesxam4qui3pnd4e54ouglffoqwecfnrdzq";
      let bytes = new Uint8Array(base32.decode(value));
      expect(bytesToHex(bytes)).to.equal(
        "0x770d21925703390a236f68f84ef1d432ca5742c4115b11e6",
      );
      value = "4wx2ocgzy2p42egwp5cwiyjhwzz6wt4elwwrrgoujx7ady5oxm7a";
      bytes = new Uint8Array(base32.decode(value));
      expect(bytesToHex(bytes)).to.equal(
        "0xe5afa708d9c69fcd10d67f45646127b673eb4f845dad1899d44dfe01e3aebb3e",
      );
    });

    it("should decode base32 to bytes with hex prefix", async () => {
      const value = "sdjva4z54t65hor2rgwv4goy5zyfx6rdctz55ltjet7gdwdwktoq";
      const hex = base32ToHex(value);
      expect(hex).to.equal(
        "0x90d350733de4fdd3ba3a89ad5e19d8ee705bfa2314f3deae6924fe61d87654dd",
      );
    });

    it("should encode bytes to base32", async () => {
      const value = hexToBytes(
        "0x770d21925703390a236f68f84ef1d432ca5742c4115b11e6",
      );
      const encoded = base32.encode(value);
      expect(encoded).to.equal("o4gsdesxam4qui3pnd4e54ouglffoqwecfnrdzq");
    });

    it("should encode hex to base32", async () => {
      const value =
        "0x90d350733de4fdd3ba3a89ad5e19d8ee705bfa2314f3deae6924fe61d87654dd";
      const encoded = hexToBase32(value);
      expect(encoded).to.equal(
        "sdjva4z54t65hor2rgwv4goy5zyfx6rdctz55ltjet7gdwdwktoq",
      );
    });
  });

  describe("cbor", async () => {
    it("should encode and decode cbor", async () => {
      const data = ["hello", "world"];
      const encoded = cbor.encode(data);
      expect(bytesToHex(encoded)).to.equal("0x826568656c6c6f65776f726c64");
      const decoded = cbor.decode(encoded);
      expect(decoded).to.deep.equal(data);
    });
  });

  // See source: https://gitlab.com/mjbecze/leb128
  describe("leb128", async () => {
    it("should encode and decode leb128", async () => {
      let buf = unsigned.encode(8);
      expect(bytesToHex(buf)).to.equal("0x08");
      expect(unsigned.decode(buf)).to.equal("8");

      buf = unsigned.encode("2141192192");
      expect(bytesToHex(buf)).to.equal("0x808080fd07");
      expect(unsigned.decode(buf)).to.equal("2141192192");
    });

    it("should operate over stream", async () => {
      const stream = new Stream();

      unsigned.write(8, stream);
      expect(bytesToHex(stream.buffer)).to.equal("0x08");
      expect(unsigned.read(stream)).to.equal("8");

      signed.write("-9223372036854775808", stream);
      expect(bytesToHex(stream.buffer)).to.equal("0x8080808080808080807f");
      expect(signed.read(stream)).to.equal("-9223372036854775808");

      signed.write("-100", stream);
      expect(bytesToHex(stream.buffer)).to.equal("0x9c7f");
      expect(signed.read(stream)).to.equal("-100");

      signed.write("100", stream);
      expect(bytesToHex(stream.buffer)).to.equal("0xe400");
      expect(signed.read(stream)).to.equal("100");

      signed.write("10", stream);
      expect(bytesToHex(stream.buffer)).to.equal("0x0a");
      expect(signed.read(stream)).to.equal("10");

      signed.write("2141192192", stream);
      expect(bytesToHex(stream.buffer)).to.equal("0x808080fd07");
      expect(signed.read(stream)).to.equal("2141192192");
    });
  });
});
