// Forked from: https://github.com/Zondax/izari-filecoin/blob/master/tests/jest/logic/address.test.ts
import { expect } from "chai";
import { describe, it } from "mocha";
import { readFileSync } from "node:fs";
import { bytesToHex, hexToBytes } from "viem";

import { InvalidId, InvalidProtocolIndicator } from "../src/address/errors.js";
import {
  Address,
  AddressActor,
  AddressBls,
  AddressDelegated,
  AddressId,
  AddressSecp256k1,
  FilEthAddress,
} from "../src/address/index.js";
import { NetworkPrefix, ProtocolIndicator } from "../src/artifacts/address.js";

const ADDRESSES_VECTOR = "./vectors/addresses.json";
const ADDRESSES_ETH_VECTOR = "./vectors/addresses_eth.json";

type AddressTestCase = {
  string: string;
  bytes: string;
  network: string;
  protocol: number;
  payload: string;
  eth?: string;
};

type AddressEthTestCase = {
  string: string;
  eth: string;
};

describe("address", function () {
  this.timeout(60_000);
  // Note: we run all test vectors in a single test to avoid excessive logging
  describe("vectors", () => {
    describe("from string", () => {
      const vectors = JSON.parse(
        readFileSync(new URL(ADDRESSES_VECTOR, import.meta.url), "utf-8"),
      ) as AddressTestCase[];

      it(`should handle ${vectors.length} address string vectors`, () => {
        vectors.forEach(
          ({ string, payload, bytes, protocol, network, eth }, index) => {
            try {
              const addr = Address.fromString(string);

              expect(addr.toString()).to.equal(string);
              expect(bytesToHex(addr.toBytes()).slice(2)).to.equal(bytes);
              expect(addr.getProtocol()).to.equal(protocol);
              expect(addr.getNetworkPrefix()).to.equal(network);
              expect(bytesToHex(addr.getPayload()).slice(2)).to.equal(payload);

              if (Address.isAddressId(addr)) {
                expect(addr.getId()).to.equal(string.substring(2));
                expect(addr.toEthAddressHex()).to.equal(eth);
              }
              if (Address.isAddressDelegated(addr)) {
                expect(addr.getNamespace()).to.equal(
                  string.substring(2, string.indexOf(network, 1)),
                );
              }
            } catch (error: unknown) {
              if (error instanceof Error) {
                throw new Error(
                  `Vector ${index} failed with string "${string}": ${error.message}`,
                );
              }
              throw new Error(
                `Vector ${index} failed with string "${string}": ${error}`,
              );
            }
          },
        );
      });
    });

    describe("from bytes", () => {
      const vectors = JSON.parse(
        readFileSync(new URL(ADDRESSES_VECTOR, import.meta.url), "utf-8"),
      ) as AddressTestCase[];

      it(`should handle ${vectors.length} address bytes vectors`, () => {
        vectors.forEach(
          ({ string, payload, bytes, protocol, network }, index) => {
            try {
              const addr = Address.fromBytes(
                hexToBytes(`0x${bytes}`),
                network as NetworkPrefix,
              );

              expect(addr.toString()).to.equal(string);
              expect(bytesToHex(addr.toBytes()).slice(2)).to.equal(bytes);
              expect(addr.getProtocol()).to.equal(protocol);
              expect(addr.getNetworkPrefix()).to.equal(network);
              expect(bytesToHex(addr.getPayload()).slice(2)).to.equal(payload);

              if (Address.isAddressId(addr))
                expect(addr.getId()).to.equal(string.substring(2));
              if (Address.isAddressDelegated(addr))
                expect(addr.getNamespace()).to.equal(
                  string.substring(2, string.indexOf(network, 1)),
                );
            } catch (error: unknown) {
              if (error instanceof Error) {
                throw new Error(
                  `Vector ${index} failed with bytes "0x${bytes}": ${error.message}`,
                );
              }
              throw new Error(
                `Vector ${index} failed with bytes "0x${bytes}": ${error}`,
              );
            }
          },
        );
      });
    });

    describe("eth <-> ID address", () => {
      const vectors = JSON.parse(
        readFileSync(new URL(ADDRESSES_ETH_VECTOR, import.meta.url), "utf-8"),
      ) as AddressEthTestCase[];

      it(`should handle ${vectors.length} ETH address vectors`, () => {
        vectors.forEach(({ string, eth }, index) => {
          try {
            const addrId1 = Address.fromEthAddress(eth, NetworkPrefix.Mainnet);
            expect(addrId1.toString()).to.equal(string);
            expect(addrId1.toEthAddressHex(true)).to.equal(eth);

            const addrId2 = Address.fromString(string);
            expect(addrId2.toString()).to.equal(string);
            expect(Address.isAddressId(addrId2) === true);
            if (Address.isAddressId(addrId2)) {
              expect(addrId2.toEthAddressHex(true)).to.equal(eth);
            }
          } catch (error: unknown) {
            if (error instanceof Error) {
              throw new Error(
                `Vector ${index} failed with ETH "${eth}": ${error.message}`,
              );
            }
            throw new Error(
              `Vector ${index} failed with ETH "${eth}": ${error}`,
            );
          }
        });
      });
    });
  });

  describe("manual", () => {
    describe("type ID", () => {
      describe("from string", () => {
        it("testnet ID", async () => {
          const addr = Address.fromString("t08666");
          expect(addr.toString()).to.equal("t08666");
          expect(bytesToHex(addr.toBytes())).to.equal("0x00da43");
          expect(addr.getProtocol()).to.equal(ProtocolIndicator.ID);
          expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Testnet);
          expect(Address.isAddressId(addr)).to.equal(true);
        });

        it("testnet actor", async () => {
          const addr = Address.fromString(
            "t2o4gsdesxam4qui3pnd4e54ouglffoqwecfnrdzq",
          );
          expect(addr.toString()).to.equal(
            "t2o4gsdesxam4qui3pnd4e54ouglffoqwecfnrdzq",
          );
          expect(bytesToHex(addr.toBytes())).to.equal(
            "0x02770d21925703390a236f68f84ef1d432ca5742c4",
          );
          expect(addr.getProtocol()).to.equal(ProtocolIndicator.ACTOR);
          expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Testnet);
          expect(Address.isAddressActor(addr)).to.equal(true);
          const addrFromBytes = Address.fromBytes(
            hexToBytes(`0x${"02770d21925703390a236f68f84ef1d432ca5742c4"}`),
            NetworkPrefix.Testnet,
          );
          expect(addrFromBytes.toString()).to.equal(
            "t2o4gsdesxam4qui3pnd4e54ouglffoqwecfnrdzq",
          );
        });

        it("mainnet", async () => {
          const addr = Address.fromString("f08666");
          expect(addr.toString()).to.equal("f08666");
          expect(bytesToHex(addr.toBytes())).to.equal("0x00da43");
          expect(addr.getProtocol()).to.equal(ProtocolIndicator.ID);
          expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Mainnet);
          expect(Address.isAddressId(addr)).to.equal(true);
          if (Address.isAddressId(addr)) expect(addr.getId()).to.equal("8666");
        });

        it("exceed max id (super big)", async () => {
          expect(() => {
            Address.fromString("t0111111111111111111111111");
          }).to.throw();
        });

        it("exceed max value", async () => {
          const aboveMax = BigInt(2) ** BigInt(63);
          const addrStr = "f0" + aboveMax.toString();

          expect(() => {
            Address.fromString(addrStr);
          }).to.throw(InvalidId);

          expect(() => {
            new AddressId(aboveMax.toString(), NetworkPrefix.Mainnet);
          }).to.throw(InvalidId);
        });

        it("max allowed value", async () => {
          const max = BigInt(2) ** BigInt(63) - BigInt(1);
          const addrStr = "f0" + max.toString();

          const addr = Address.fromString(addrStr);
          expect(addr.toString()).to.equal(addrStr);
          expect(bytesToHex(addr.toBytes())).to.equal("0x00ffffffffffffffff7f");
          expect(addr.getProtocol()).to.equal(ProtocolIndicator.ID);
          expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Mainnet);
        });
      });

      describe("from bytes", () => {
        it("testnet", async () => {
          const addr = Address.fromBytes(
            hexToBytes(`0x${"00da43"}`),
            NetworkPrefix.Testnet,
          );
          expect(addr.toString()).to.equal("t08666");
          expect(bytesToHex(addr.toBytes())).to.equal("0x00da43");
          expect(addr.getProtocol()).to.equal(ProtocolIndicator.ID);
          expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Testnet);
        });

        it("mainnet", async () => {
          const addr = Address.fromBytes(
            hexToBytes(`0x${"00da43"}`),
            NetworkPrefix.Mainnet,
          );
          expect(addr.toString()).to.equal("f08666");
          expect(bytesToHex(addr.toBytes())).to.equal("0x00da43");
          expect(addr.getProtocol()).to.equal(ProtocolIndicator.ID);
          expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Mainnet);
        });

        it("exceed max value", async () => {
          expect(() => {
            Address.fromBytes(
              hexToBytes(`0x${"0080808080808080808001"}`),
              NetworkPrefix.Mainnet,
            );
          }).to.throw(InvalidId);
        });

        it("max allowed value", async () => {
          const addr = Address.fromBytes(
            hexToBytes(`0x${"00ffffffffffffffff7f"}`),
            NetworkPrefix.Mainnet,
          );
          expect(addr.toString()).to.equal("f09223372036854775807");
          expect(bytesToHex(addr.toBytes())).to.equal("0x00ffffffffffffffff7f");
          expect(addr.getProtocol()).to.equal(ProtocolIndicator.ID);
          expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Mainnet);
        });
      });

      it("wrong protocol", async () => {
        expect(() => {
          AddressId.fromString("f18666");
        }).to.throw(InvalidProtocolIndicator);
      });
    });

    describe("type BLS", () => {
      it("wrong protocol", async () => {
        expect(() => {
          AddressBls.fromString("f48666");
        }).to.throw(InvalidProtocolIndicator);
      });
    });

    describe("type SECP256K1", () => {
      it("wrong protocol", async () => {
        expect(() => {
          AddressSecp256k1.fromString("f08666");
        }).to.throw(InvalidProtocolIndicator);
      });
    });

    describe("type actor", () => {
      it("wrong protocol", async () => {
        expect(() => {
          AddressActor.fromString("f08666");
        }).to.throw(InvalidProtocolIndicator);
      });
    });

    describe("type delegated", () => {
      it("wrong protocol", async () => {
        expect(() => {
          AddressDelegated.fromString("f08666");
        }).to.throw(InvalidProtocolIndicator);
      });

      it("Masked-id eth address", async () => {
        expect(() => {
          new AddressDelegated(
            "10",
            hexToBytes(`0xff00000000000000000000000000000000000001`),
            NetworkPrefix.Mainnet,
          );
        }).to.throw("masked-id eth addresses not allowed");
      });
    });

    describe("type filecoin ethereum", () => {
      it("wrong protocol", async () => {
        expect(() => {
          FilEthAddress.fromString("f08666");
        }).to.throw(InvalidProtocolIndicator);
      });

      it("wrong namespace", async () => {
        expect(() => {
          const addr = new AddressDelegated(
            "11",
            hexToBytes("0x111111"),
            NetworkPrefix.Mainnet,
          );
          FilEthAddress.fromString(addr.toString());
        }).to.throw();
      });

      it("wrong eth address", async () => {
        expect(() => {
          const addr = new AddressDelegated(
            "10",
            hexToBytes("0x111111"),
            NetworkPrefix.Mainnet,
          );
          FilEthAddress.fromString(addr.toString());
        }).to.throw();
      });

      it("masked-id eth address", async () => {
        expect(() => {
          new FilEthAddress(
            hexToBytes("0xff00000000000000000000000000000000000001"),
            NetworkPrefix.Mainnet,
          );
        }).to.throw("masked-id eth addresses not allowed");
      });

      it("correct eth address", async () => {
        const addr = Address.fromString(
          "f410feot7hrogmplrcupubsdbbqarkdewmb4vkwc5qqq",
        );

        expect(Address.isFilEthAddress(addr) === true);
        if (Address.isFilEthAddress(addr)) {
          expect(addr.getNamespace()).to.equal("10");
          expect(bytesToHex(addr.getSubAddress())).to.equal(
            "0x23a7f3c5c663d71151f40c8610c01150c9660795",
          );
        }
      });
    });

    describe("ethereum conversion", () => {
      it("from ethereum address (ID)", async () => {
        const addr = Address.fromEthAddress(
          "0xff00000000000000000000000000000000000001",
          NetworkPrefix.Testnet,
        );

        expect(addr.getProtocol()).to.equal(ProtocolIndicator.ID);
        expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Testnet);
        expect(addr.toString()).to.equal("t01");
      });

      it("from ethereum address (ID) 2", async () => {
        const addr = Address.fromEthAddress(
          "0xff00000000000000000000000000000000000065",
          NetworkPrefix.Testnet,
        );

        expect(addr.getProtocol()).to.equal(ProtocolIndicator.ID);
        expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Testnet);
        expect(addr.toString()).to.equal("t0101");
      });

      it("from ethereum address (ID) 3", async () => {
        const addr = Address.fromEthAddress(
          "0xff0000000000000000000000000000000000da43",
          NetworkPrefix.Testnet,
        );

        expect(addr.getProtocol()).to.equal(ProtocolIndicator.ID);
        expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Testnet);
        expect(addr.toString()).to.equal("t055875");
      });

      it("from ethereum address (ID) 4", async () => {
        const addr = Address.fromEthAddress(
          "0xff00000000000000000000000000000000000a43",
          NetworkPrefix.Testnet,
        );

        expect(addr.getProtocol()).to.equal(ProtocolIndicator.ID);
        expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Testnet);
        expect(addr.toString()).to.equal("t02627");
      });

      it("from ethereum address (ID) 5", async () => {
        const addr = Address.fromEthAddress(
          "0xff000000000000000000000000000000002ec8fa",
          NetworkPrefix.Testnet,
        );

        expect(addr.getProtocol()).to.equal(ProtocolIndicator.ID);
        expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Testnet);
        expect(addr.toString()).to.equal("t03066106");
      });

      it("from ethereum address (ID) 6", async () => {
        const addr = Address.fromEthAddress(
          "0xff00000000000000000000000000000000002694",
          NetworkPrefix.Testnet,
        );

        expect(addr.getProtocol()).to.equal(ProtocolIndicator.ID);
        expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Testnet);
        expect(addr.toString()).to.equal("t09876");
      });

      it("from ethereum address (ID) 7", async () => {
        expect(() => {
          Address.fromEthAddress(
            "0xff00000000000000000000007ffffffffffffff",
            NetworkPrefix.Testnet,
          );
        }).to.throw();
      });

      it("from ethereum address (ID) 8", async () => {
        expect(() => {
          Address.fromEthAddress(
            "0xff0000000000000000000000ffffffffffffffff11",
            NetworkPrefix.Testnet,
          );
        }).to.throw();
      });

      it("from ethereum address (ID) 9", async () => {
        expect(() => {
          Address.fromEthAddress(
            "0xff0000000000000000000000ffffffffffffffff1",
            NetworkPrefix.Testnet,
          );
        }).to.throw();
      });

      it("from ethereum address (ID) 10", async () => {
        expect(() => {
          Address.fromEthAddress(
            "0xff00000000000000000000008FFFFFFFFFFFFFFF",
            NetworkPrefix.Testnet,
          );
        }).to.throw();
      });

      it("from ethereum address (ID) - max value", () => {
        const addr = Address.fromEthAddress(
          "0xff00000000000000000000007FFFFFFFFFFFFFFF",
          NetworkPrefix.Testnet,
        );

        expect(addr.getProtocol()).to.equal(ProtocolIndicator.ID);
        expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Testnet);
        expect(addr.toString()).to.equal("t09223372036854775807");
      });

      it("to ethereum address (ID)", async () => {
        const addr = Address.fromString("f0101");

        expect(Address.isAddressId(addr)).to.equal(true);
        if (Address.isAddressId(addr)) {
          expect(addr.toEthAddressHex(true)).to.equal(
            "0xff00000000000000000000000000000000000065",
          );
          expect(addr.toEthAddressHex(false)).to.equal(
            "ff00000000000000000000000000000000000065",
          );
        }
      });

      it("to ethereum address (ID) - 2", async () => {
        const addr = Address.fromString("f0101");

        expect(Address.isAddressId(addr)).to.equal(true);
        if (Address.isAddressId(addr)) {
          expect(addr.toEthAddressHex(true)).to.equal(
            "0xff00000000000000000000000000000000000065",
          );
          expect(addr.toEthAddressHex(false)).to.equal(
            "ff00000000000000000000000000000000000065",
          );
        }
      });

      it("to ethereum address (ID) - 3", async () => {
        const addr = Address.fromString("f0101");

        expect(Address.isAddressId(addr)).to.equal(true);
        if (Address.isAddressId(addr)) {
          expect(addr.toEthAddressHex(true)).to.equal(
            "0xff00000000000000000000000000000000000065",
          );
          expect(addr.toEthAddressHex(false)).to.equal(
            "ff00000000000000000000000000000000000065",
          );
        }
      });

      it("from ethereum address (EthFilAddress)", async () => {
        const addr = Address.fromEthAddress(
          "0xd4c5fb16488aa48081296299d54b0c648c9333da",
          NetworkPrefix.Mainnet,
        );

        expect(addr.getProtocol()).to.equal(ProtocolIndicator.DELEGATED);
        expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Mainnet);
        expect(addr.toString()).to.equal(
          "f410f2tc7wfsirksibajjmkm5ksymmsgjgm62hjnomwa",
        );
      });

      it("from ethereum address (EthFilAddress) - 2", async () => {
        expect(() => {
          Address.fromEthAddress(
            "0xd4c5fb16488aa48081296299d54b0c648c9333da00",
            NetworkPrefix.Mainnet,
          );
        }).to.throw("invalid ethereum address: length should be 20 bytes");
      });

      it("to ethereum address (EthFilAddress)", async () => {
        const addr = Address.fromString(
          "f410f2tc7wfsirksibajjmkm5ksymmsgjgm62hjnomwa",
        );

        expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Mainnet);
        expect(Address.isFilEthAddress(addr) === true);
        expect(Address.isAddressDelegated(addr) === true);
        if (Address.isFilEthAddress(addr)) {
          expect(addr.toEthAddressHex(true)).to.equal(
            "0xd4c5fb16488aa48081296299d54b0c648c9333da",
          );
          expect(addr.toEthAddressHex(false)).to.equal(
            "d4c5fb16488aa48081296299d54b0c648c9333da",
          );
        }
      });
    });
  });
});
