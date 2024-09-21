// Forked from: https://github.com/Zondax/izari-filecoin/blob/master/tests/jest/logic/address.test.ts
import { readFileSync } from "fs";
import { expect } from "chai";
import * as u8a from "uint8arrays";

import { InvalidId, InvalidProtocolIndicator } from "../src/address/errors.js";
import { NetworkPrefix, ProtocolIndicator } from "../src/artifacts/address.js";
import {
  Address,
  AddressActor,
  AddressBls,
  AddressDelegated,
  AddressId,
  AddressSecp256k1,
  FilEthAddress,
} from "../src/index.js";

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

describe.only("Address", function () {
  this.timeout(60_000);
  describe("Vectors", async () => {
    describe("From string", async () => {
      const vectors = JSON.parse(
        readFileSync(new URL(ADDRESSES_VECTOR, import.meta.url), "utf-8")
      ) as AddressTestCase[];

      vectors.forEach(
        async ({ string, payload, bytes, protocol, network, eth }, index) => {
          it(`Test case ${index}: ${string}`, async () => {
            const addr = Address.fromString(string);

            expect(addr.toString()).to.equal(string);
            expect(u8a.toString(addr.toBytes(), "hex")).to.equal(bytes);
            expect(addr.getProtocol()).to.equal(protocol);
            expect(addr.getNetworkPrefix()).to.equal(network);
            expect(u8a.toString(addr.getPayload(), "hex")).to.equal(payload);

            if (Address.isAddressId(addr)) {
              expect(addr.getId()).to.equal(string.substring(2));
              expect(addr.toEthAddressHex(true)).to.equal(eth);
            }
            if (Address.isAddressDelegated(addr))
              expect(addr.getNamespace()).to.equal(
                string.substring(2, string.indexOf(network, 1))
              );
          });
        }
      );
    });

    describe("From bytes", () => {
      const vectors = JSON.parse(
        readFileSync(new URL(ADDRESSES_VECTOR, import.meta.url), "utf-8")
      ) as AddressTestCase[];

      vectors.forEach(
        ({ string, payload, bytes, protocol, network }, index) => {
          it(`Test case ${index}: 0x${bytes}`, () => {
            const addr = Address.fromBytes(
              network as NetworkPrefix,
              u8a.fromString(bytes, "hex")
            );

            expect(addr.toString()).to.equal(string);
            expect(u8a.toString(addr.toBytes(), "hex")).to.equal(bytes);

            expect(addr.getProtocol()).to.equal(protocol);
            expect(addr.getNetworkPrefix()).to.equal(network);
            expect(u8a.toString(addr.getPayload(), "hex")).to.equal(payload);

            if (Address.isAddressId(addr))
              expect(addr.getId()).to.equal(string.substring(2));
            if (Address.isAddressDelegated(addr))
              expect(addr.getNamespace()).to.equal(
                string.substring(2, string.indexOf(network, 1))
              );
          });
        }
      );
    });

    describe("Eth <-> Id Address ", () => {
      const vectors = JSON.parse(
        readFileSync(new URL(ADDRESSES_ETH_VECTOR, import.meta.url), "utf-8")
      ) as AddressEthTestCase[];

      vectors.forEach(async ({ string, eth }) => {
        it(`Test case ${string}: 0x${eth}`, async () => {
          const addrId1 = Address.fromEthAddress(NetworkPrefix.Mainnet, eth);
          expect(addrId1.toString()).to.equal(string);
          expect(addrId1.toEthAddressHex(true)).to.equal(eth);

          const addrId2 = Address.fromString(string);

          expect(addrId2.toString()).to.equal(string);
          expect(Address.isAddressId(addrId2) === true);
          if (Address.isAddressId(addrId2)) {
            expect(addrId2.toEthAddressHex(true)).to.equal(eth);
          }
        });
      });
    });
  });

  describe("Manual", () => {
    describe("Type ID", () => {
      describe("From string", () => {
        it("Testnet", async () => {
          const addr = Address.fromString("t08666");
          expect(addr.toString()).to.equal("t08666");
          expect(u8a.toString(addr.toBytes(), "hex")).to.equal("00da43");
          expect(addr.getProtocol()).to.equal(ProtocolIndicator.ID);
          expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Testnet);
          expect(Address.isAddressId(addr) === true);
          if (Address.isAddressId(addr)) expect(addr.getId()).to.equal("8666");
        });

        it("Mainnet", async () => {
          const addr = Address.fromString("f08666");
          expect(addr.toString()).to.equal("f08666");
          expect(u8a.toString(addr.toBytes(), "hex")).to.equal("00da43");
          expect(addr.getProtocol()).to.equal(ProtocolIndicator.ID);
          expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Mainnet);
          expect(Address.isAddressId(addr) === true);
          if (Address.isAddressId(addr)) expect(addr.getId()).to.equal("8666");
        });

        it("Exceed max id (super big)", async () => {
          expect(() => {
            Address.fromString("t0111111111111111111111111");
          }).to.throw();
        });

        it("Exceed max value", async () => {
          const aboveMax = BigInt(2) ** BigInt(63);
          const addrStr = "f0" + aboveMax.toString();

          expect(() => {
            Address.fromString(addrStr);
          }).to.throw(InvalidId);

          expect(() => {
            new AddressId(NetworkPrefix.Mainnet, aboveMax.toString());
          }).to.throw(InvalidId);
        });

        it("Max allowed value", async () => {
          const max = BigInt(2) ** BigInt(63) - BigInt(1);
          const addrStr = "f0" + max.toString();

          const addr = Address.fromString(addrStr);
          expect(addr.toString()).to.equal(addrStr);
          expect(u8a.toString(addr.toBytes(), "hex")).to.equal(
            "00ffffffffffffffff7f"
          );
          expect(addr.getProtocol()).to.equal(ProtocolIndicator.ID);
          expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Mainnet);
        });
      });

      describe("From bytes", () => {
        it("Testnet", async () => {
          const addr = Address.fromBytes(
            NetworkPrefix.Testnet,
            Buffer.from("00da43", "hex")
          );
          expect(addr.toString()).to.equal("t08666");
          expect(u8a.toString(addr.toBytes(), "hex")).to.equal("00da43");
          expect(addr.getProtocol()).to.equal(ProtocolIndicator.ID);
          expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Testnet);
        });

        it("Mainnet", async () => {
          const addr = Address.fromBytes(
            NetworkPrefix.Mainnet,
            Buffer.from("00da43", "hex")
          );
          expect(addr.toString()).to.equal("f08666");
          expect(u8a.toString(addr.toBytes(), "hex")).to.equal("00da43");
          expect(addr.getProtocol()).to.equal(ProtocolIndicator.ID);
          expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Mainnet);
        });

        it("Exceed max value", async () => {
          expect(() => {
            Address.fromBytes(
              NetworkPrefix.Mainnet,
              Buffer.from("0080808080808080808001", "hex")
            );
          }).to.throw(InvalidId);
        });

        it("Max allowed value", async () => {
          const addr = Address.fromBytes(
            NetworkPrefix.Mainnet,
            Buffer.from("00ffffffffffffffff7f", "hex")
          );
          expect(addr.toString()).to.equal("f09223372036854775807");
          expect(u8a.toString(addr.toBytes(), "hex")).to.equal(
            "00ffffffffffffffff7f"
          );
          expect(addr.getProtocol()).to.equal(ProtocolIndicator.ID);
          expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Mainnet);
        });
      });

      it("Wrong protocol", async () => {
        expect(() => {
          AddressId.fromString("f18666");
        }).to.throw(InvalidProtocolIndicator);
      });
    });

    describe("Type BLS", () => {
      it("Wrong protocol", async () => {
        expect(() => {
          AddressBls.fromString("f48666");
        }).to.throw(InvalidProtocolIndicator);
      });
    });

    describe("Type SECP256K1", () => {
      it("Wrong protocol", async () => {
        expect(() => {
          AddressSecp256k1.fromString("f08666");
        }).to.throw(InvalidProtocolIndicator);
      });
    });

    describe("Type Actor", () => {
      it("Wrong protocol", async () => {
        expect(() => {
          AddressActor.fromString("f08666");
        }).to.throw(InvalidProtocolIndicator);
      });
    });

    describe("Type Delegated", () => {
      it("Wrong protocol", async () => {
        expect(() => {
          AddressDelegated.fromString("f08666");
        }).to.throw(InvalidProtocolIndicator);
      });

      it("Masked-id eth address", async () => {
        expect(() => {
          new AddressDelegated(
            NetworkPrefix.Mainnet,
            "10",
            Buffer.from("ff00000000000000000000000000000000000001", "hex")
          );
        }).to.throw("masked-id eth addresses not allowed");
      });
    });

    describe("Type Filecoin Ethereum", () => {
      it("Wrong protocol", async () => {
        expect(() => {
          FilEthAddress.fromString("f08666");
        }).to.throw(InvalidProtocolIndicator);
      });

      it("Wrong namespace", async () => {
        expect(() => {
          const addr = new AddressDelegated(
            NetworkPrefix.Mainnet,
            "11",
            Buffer.from("111111", "hex")
          );
          FilEthAddress.fromString(addr.toString());
        }).to.throw();
      });

      it("Wrong eth address", async () => {
        expect(() => {
          const addr = new AddressDelegated(
            NetworkPrefix.Mainnet,
            "10",
            Buffer.from("111111", "hex")
          );
          FilEthAddress.fromString(addr.toString());
        }).to.throw();
      });

      it("Masked-id eth address", async () => {
        expect(() => {
          new FilEthAddress(
            NetworkPrefix.Mainnet,
            Buffer.from("ff00000000000000000000000000000000000001", "hex")
          );
        }).to.throw("masked-id eth addresses not allowed");
      });

      it("Correct eth address", async () => {
        const addr = Address.fromString(
          "f410feot7hrogmplrcupubsdbbqarkdewmb4vkwc5qqq"
        );

        expect(Address.isFilEthAddress(addr) === true);
        if (Address.isFilEthAddress(addr)) {
          expect(addr.getNamespace()).to.equal("10");
          expect(u8a.toString(addr.getSubAddress(), "hex")).to.equal(
            "23a7f3c5c663d71151f40c8610c01150c9660795"
          );
        }
      });
    });

    describe("Ethereum conversion", () => {
      it("From ethereum address (ID)", async () => {
        const addr = Address.fromEthAddress(
          NetworkPrefix.Testnet,
          "0xff00000000000000000000000000000000000001"
        );

        expect(addr.getProtocol()).to.equal(ProtocolIndicator.ID);
        expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Testnet);
        expect(addr.toString()).to.equal("t01");
      });

      it("From ethereum address (ID) 2", async () => {
        const addr = Address.fromEthAddress(
          NetworkPrefix.Testnet,
          "0xff00000000000000000000000000000000000065"
        );

        expect(addr.getProtocol()).to.equal(ProtocolIndicator.ID);
        expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Testnet);
        expect(addr.toString()).to.equal("t0101");
      });

      it("From ethereum address (ID) 3", async () => {
        const addr = Address.fromEthAddress(
          NetworkPrefix.Testnet,
          "0xff0000000000000000000000000000000000da43"
        );

        expect(addr.getProtocol()).to.equal(ProtocolIndicator.ID);
        expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Testnet);
        expect(addr.toString()).to.equal("t055875");
      });

      it("From ethereum address (ID) 4", async () => {
        const addr = Address.fromEthAddress(
          NetworkPrefix.Testnet,
          "0xff00000000000000000000000000000000000a43"
        );

        expect(addr.getProtocol()).to.equal(ProtocolIndicator.ID);
        expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Testnet);
        expect(addr.toString()).to.equal("t02627");
      });

      it("From ethereum address (ID) 5", async () => {
        const addr = Address.fromEthAddress(
          NetworkPrefix.Testnet,
          "0xff000000000000000000000000000000002ec8fa"
        );

        expect(addr.getProtocol()).to.equal(ProtocolIndicator.ID);
        expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Testnet);
        expect(addr.toString()).to.equal("t03066106");
      });

      it("From ethereum address (ID) 6", async () => {
        const addr = Address.fromEthAddress(
          NetworkPrefix.Testnet,
          "0xff00000000000000000000000000000000002694"
        );

        expect(addr.getProtocol()).to.equal(ProtocolIndicator.ID);
        expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Testnet);
        expect(addr.toString()).to.equal("t09876");
      });

      it("From ethereum address (ID) 7", async () => {
        expect(() => {
          Address.fromEthAddress(
            NetworkPrefix.Testnet,
            "0xff00000000000000000000007ffffffffffffff"
          );
        }).to.throw();
      });

      it("From ethereum address (ID) 8", async () => {
        expect(() => {
          Address.fromEthAddress(
            NetworkPrefix.Testnet,
            "0xff0000000000000000000000ffffffffffffffff11"
          );
        }).to.throw();
      });

      it("From ethereum address (ID) 9", async () => {
        expect(() => {
          Address.fromEthAddress(
            NetworkPrefix.Testnet,
            "0xff0000000000000000000000ffffffffffffffff1"
          );
        }).to.throw();
      });

      it("From ethereum address (ID) 10", async () => {
        expect(() => {
          Address.fromEthAddress(
            NetworkPrefix.Testnet,
            "0xff00000000000000000000008FFFFFFFFFFFFFFF"
          );
        }).to.throw();
      });

      it("From ethereum address (ID) - max value", () => {
        const addr = Address.fromEthAddress(
          NetworkPrefix.Testnet,
          "0xff00000000000000000000007FFFFFFFFFFFFFFF"
        );

        expect(addr.getProtocol()).to.equal(ProtocolIndicator.ID);
        expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Testnet);
        expect(addr.toString()).to.equal("t09223372036854775807");
      });

      it("To ethereum address (ID)", async () => {
        const addr = Address.fromString("f0101");

        expect(Address.isAddressId(addr) === true);
        if (Address.isAddressId(addr)) {
          expect(addr.toEthAddressHex(true)).to.equal(
            "0xff00000000000000000000000000000000000065"
          );
          expect(addr.toEthAddressHex(false)).to.equal(
            "ff00000000000000000000000000000000000065"
          );
        }
      });

      it("To ethereum address (ID) - 2", async () => {
        const addr = Address.fromString("f0101");

        expect(Address.isAddressId(addr) === true);
        if (Address.isAddressId(addr)) {
          expect(addr.toEthAddressHex(true)).to.equal(
            "0xff00000000000000000000000000000000000065"
          );
          expect(addr.toEthAddressHex(false)).to.equal(
            "ff00000000000000000000000000000000000065"
          );
        }
      });

      it("To ethereum address (ID) - 3", async () => {
        const addr = Address.fromString("f0101");

        expect(Address.isAddressId(addr) === true);
        if (Address.isAddressId(addr)) {
          expect(addr.toEthAddressHex(true)).to.equal(
            "0xff00000000000000000000000000000000000065"
          );
          expect(addr.toEthAddressHex(false)).to.equal(
            "ff00000000000000000000000000000000000065"
          );
        }
      });

      it("From ethereum address (EthFilAddress)", async () => {
        const addr = Address.fromEthAddress(
          NetworkPrefix.Mainnet,
          "0xd4c5fb16488aa48081296299d54b0c648c9333da"
        );

        expect(addr.getProtocol()).to.equal(ProtocolIndicator.DELEGATED);
        expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Mainnet);
        expect(addr.toString()).to.equal(
          "f410f2tc7wfsirksibajjmkm5ksymmsgjgm62hjnomwa"
        );
      });

      it("From ethereum address (EthFilAddress) - 2", async () => {
        expect(() => {
          Address.fromEthAddress(
            NetworkPrefix.Mainnet,
            "0xd4c5fb16488aa48081296299d54b0c648c9333da00"
          );
        }).to.throw("invalid ethereum address: length should be 20 bytes");
      });

      it("To ethereum address (EthFilAddress)", async () => {
        const addr = Address.fromString(
          "f410f2tc7wfsirksibajjmkm5ksymmsgjgm62hjnomwa"
        );

        expect(addr.getNetworkPrefix()).to.equal(NetworkPrefix.Mainnet);
        expect(Address.isFilEthAddress(addr) === true);
        expect(Address.isAddressDelegated(addr) === true);
        if (Address.isFilEthAddress(addr)) {
          expect(addr.toEthAddressHex(true)).to.equal(
            "0xd4c5fb16488aa48081296299d54b0c648c9333da"
          );
          expect(addr.toEthAddressHex()).to.equal(
            "d4c5fb16488aa48081296299d54b0c648c9333da"
          );
        }
      });
    });
  });
});
