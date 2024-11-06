// Forked & converted to use `bigint` & `Uint8Array`
// Source: https://github.com/Zondax/izari-filecoin/blob/master/src/address/index.ts
import { compare as u8aCompare } from "uint8arrays/compare";
import { concat as u8aConcat } from "uint8arrays/concat";
import { fromString as u8aFromString } from "uint8arrays/from-string";
import { toString as u8aToString } from "uint8arrays/to-string";

import {
  ACTOR_ID_ETHEREUM_MASK,
  ACTOR_ID_ETHEREUM_MASK_LEN,
  ACTOR_PAYLOAD_LEN,
  BLS_PAYLOAD_LEN,
  DelegatedNamespace,
  ETH_ADDRESS_LEN,
  ID_PAYLOAD_MAX_NUM,
  NetworkPrefix,
  ProtocolIndicator,
  SECP256K1_PAYLOAD_LEN,
  SUB_ADDRESS_MAX_LEN,
} from "../artifacts/address.js";
import {
  getChecksum,
  getLeb128Length,
  isMaskedIdEthAddress,
  validateNetworkPrefix,
} from "../utils/address.js";
import { decode as base32Decode, encode as base32Encode } from "../utils/base32.js";
import { bigintToUint8Array } from "../utils/convert.js";
import { unsigned } from "../utils/leb128/index.js";
import {
  InvalidChecksumAddress,
  InvalidId,
  InvalidNamespace,
  InvalidNetwork,
  InvalidPayloadLength,
  InvalidProtocolIndicator,
  InvalidSubAddress,
  UnknownProtocolIndicator,
} from "./errors.js";

/**
 * Address is an abstract class that holds fundamental fields that a filecoin address is composed by.
 * Concrete class types will inherit from it, adding specific methods for each type. It will serve as a factory
 * for parsing addresses from string and bytes as well.
 */
export abstract class Address {
  /**
   *
   * @param protocol - indicates the address types.
   * @param networkPrefix - indicates which network the address belongs.
   */
  protected constructor(
    protected protocol: ProtocolIndicator,
    protected networkPrefix: NetworkPrefix
  ) {}

  /**
   * Each address is composed by a payload
   * For more information about payloads, please refer to this {@link https://spec.filecoin.io/appendix/address/#section-appendix.address.payload|link}.
   */
  protected abstract payload: Uint8Array;

  /**
   * Getter for payload
   */
  getPayload = (): Uint8Array => this.payload;

  /**
   * Getter for network type
   */
  getNetworkPrefix = (): NetworkPrefix => this.networkPrefix;

  /**
   * Getter for protocol indicator
   */
  getProtocol = (): ProtocolIndicator => this.protocol;

  /**
   * Addresses need to implement a method to generate the bytes format of an address.
   * For more information about bytes format, please refer to this {@link https://spec.filecoin.io/appendix/address/#section-appendix.address.bytes|link}.
   * @returns address in bytes format (buffer)
   */
  abstract toBytes: () => Uint8Array;

  /**
   * Addresses need to implement a method to generate the string format of an address.
   * For more information about string format, please refer to this {@link https://spec.filecoin.io/appendix/address/#section-appendix.address.string|link}.
   * @returns address in string format
   */
  abstract toString: () => string;

  /**
   * Allows to generate the checksum related to the address.
   * For more information about string format, please refer to this {@link https://spec.filecoin.io/appendix/address/#section-appendix.address.checksum|link}.
   * @returns a buffer containing the calculated checksum
   */
  getChecksum = (): Uint8Array => getChecksum(this.toBytes());

  /**
   * Allows to parse any address from string format to its corresponding type
   * @param address - address to parse in string format
   * @returns a new instance of a particular address type.
   */
  static fromString(address: string): Address {
    const type = parseInt(address[1]);

    switch (type) {
      case ProtocolIndicator.ID:
        return AddressId.fromString(address);
      case ProtocolIndicator.ACTOR:
        return AddressActor.fromString(address);
      case ProtocolIndicator.SECP256K1:
        return AddressSecp256k1.fromString(address);
      case ProtocolIndicator.BLS:
        return AddressBls.fromString(address);
      case ProtocolIndicator.DELEGATED: {
        const addr = AddressDelegated.fromString(address);
        if (Address.isFilEthAddress(addr))
          return new FilEthAddress(addr.getSubAddress(), addr.getNetworkPrefix());

        return addr;
      }
      default:
        throw new UnknownProtocolIndicator(type);
    }
  }

  /**
   * Allows to parse any address from bytes format to its corresponding type
   * @param address - address to parse in bytes format (buffer)
   * @param networkPrefix - indicates which network the address belongs, as the bytes format does not hold the network the address corresponds
   * @returns a new instance of a particular address type.
   */
  static fromBytes = (
    address: Uint8Array,
    networkPrefix: NetworkPrefix = NetworkPrefix.Testnet
  ): Address => {
    const type = address[0];

    switch (type) {
      case ProtocolIndicator.ID:
        return AddressId.fromBytes(address, networkPrefix);
      case ProtocolIndicator.ACTOR:
        return AddressActor.fromBytes(address, networkPrefix);
      case ProtocolIndicator.SECP256K1:
        return AddressSecp256k1.fromBytes(address, networkPrefix);
      case ProtocolIndicator.BLS:
        return AddressBls.fromBytes(address, networkPrefix);
      case ProtocolIndicator.DELEGATED: {
        const addr = AddressDelegated.fromBytes(address, networkPrefix);
        if (Address.isFilEthAddress(addr))
          return new FilEthAddress(addr.getSubAddress(), addr.getNetworkPrefix());

        return addr;
      }
      default:
        throw new UnknownProtocolIndicator(type);
    }
  };

  /**
   * Allows to create a new instance of an Address from an ethereum address.
   * It is based on {@link https://github.com/filecoin-project/lotus/blob/80aa6d1d646c9984761c77dcb7cf63be094b9407/chain/types/ethtypes/eth_types.go#L370|this code}
   * @param ethAddr - ethereum address to parse (buffer or hex string, with or without prefix)
   * @param networkPrefix - indicates which network the address belongs, as the bytes format does not hold the network the address corresponds
   * @returns a new instance of a particular address type.
   */
  static fromEthAddress = (
    ethAddr: Uint8Array | string,
    networkPrefix: NetworkPrefix = NetworkPrefix.Testnet
  ): AddressId | FilEthAddress => {
    let addr: Uint8Array;

    if (typeof ethAddr === "string") {
      const tmp = ethAddr.startsWith("0x") ? ethAddr.substring(2) : ethAddr;
      if (tmp.length % 2 !== 0) {
        throw new Error("invalid eth address");
      }
      addr = u8aFromString(tmp.toLowerCase(), "hex");
    } else {
      addr = ethAddr;
    }

    if (isMaskedIdEthAddress(addr)) {
      let i = ACTOR_ID_ETHEREUM_MASK_LEN;
      while (addr[i] == 0) i += 1;

      const payload = unsigned.encode("0x" + u8aToString(addr.subarray(i), "hex"));
      return new AddressId(payload, networkPrefix);
    }

    return new FilEthAddress(addr, networkPrefix);
  };

  /**
   * Allows to check if true value of an address instance is AddressId
   * @param address - instance to check its actual type
   * @returns whether the instance is AddressId or not
   */
  static isAddressId = (address: Address): address is AddressId =>
    address.protocol == ProtocolIndicator.ID;

  /**
   * Allows to check if true value of an address instance is AddressBls
   * @param address - instance to check its actual type
   * @returns whether the instance is AddressId or not
   */
  static isAddressBls = (address: Address): address is AddressBls =>
    address.protocol == ProtocolIndicator.BLS;

  /**
   * Allows to check if true value of an address instance is AddressSecp256k1
   * @param address - instance to check its actual type
   * @returns whether the instance is AddressSecp256k1 or not
   */
  static isAddressSecp256k1 = (address: Address): address is AddressSecp256k1 =>
    address.protocol == ProtocolIndicator.SECP256K1;

  /**
   * Allows to check if true value of an address instance is AddressDelegated
   * @param address - instance to check its actual type
   * @returns whether the instance is AddressDelegated or not
   */
  static isAddressDelegated = (address: Address): address is AddressDelegated =>
    address.protocol == ProtocolIndicator.DELEGATED;

  /**
   * Allows to check if true value of an address instance is FilEthAddress
   * @param address - instance to check its actual type
   * @returns whether the instance is FilEthAddress or not
   */
  static isFilEthAddress = (address: Address): address is FilEthAddress =>
    address.protocol == ProtocolIndicator.DELEGATED &&
    "namespace" in address &&
    address.namespace == DelegatedNamespace.ETH;

  /**
   * Allows to check if true value of an address instance is AddressActor
   * @param address - instance to check its actual type
   * @returns whether the instance is AddressActor or not
   */
  static isAddressActor = (address: Address): address is AddressActor =>
    address.protocol == ProtocolIndicator.ACTOR;
}

/**
 * AddressBls is a concrete address type 3 on filecoin blockchain (f3/t3)
 * For more information about bls addresses, please refer to this {@link https://spec.filecoin.io/appendix/address/#section-appendix.address.protocol-3-bls|link}.
 */
export class AddressBls extends Address {
  /**
   * Contains BLS public key, base32 encoded
   * For more information about payloads, please refer to this {@link https://spec.filecoin.io/appendix/address/#section-appendix.address.payload|link}.
   */
  protected payload: Uint8Array;

  /**
   * Allows to create a new instance of bls address
   * @param payload - current address payload (buffer)
   * @param networkPrefix - indicates which network the address belongs.
   */
  constructor(payload: Uint8Array, networkPrefix: NetworkPrefix = NetworkPrefix.Testnet) {
    super(ProtocolIndicator.BLS, networkPrefix);

    if (payload.byteLength !== BLS_PAYLOAD_LEN) throw new InvalidPayloadLength(payload.byteLength);
    this.payload = payload;
  }

  /**
   * Allows to get the bytes format of this address
   * @returns bls address in bytes format
   */
  toBytes = (): Uint8Array => u8aConcat([new Uint8Array([this.protocol]), this.payload]);

  /**
   * Allows to get the string format of this address
   * @returns bls address in string format
   */
  toString = (): string => {
    const checksum = this.getChecksum();
    return (
      this.networkPrefix +
      this.protocol.toString() +
      base32Encode(u8aConcat([this.payload, checksum])).toLowerCase()
    );
  };

  /**
   * Allows to create a new AddressBls instance from a string
   * @param address - address in string format
   * @returns a new instance of AddressBls
   */
  static fromString(address: string): AddressBls {
    const networkPrefix = address[0];
    const protocolIndicator = address[1];

    if (!validateNetworkPrefix(networkPrefix)) throw new InvalidNetwork(networkPrefix);
    if (parseInt(protocolIndicator) != ProtocolIndicator.BLS)
      throw new InvalidProtocolIndicator(parseInt(protocolIndicator));

    const decodedData = new Uint8Array(base32Decode(address.substring(2).toUpperCase()));
    const payload = decodedData.subarray(0, -4);
    const checksum = decodedData.subarray(-4);

    const newAddress = new AddressBls(payload, networkPrefix);
    const addressChecksum = u8aToString(newAddress.getChecksum(), "hex");
    const originalChecksum = u8aToString(checksum, "hex");
    if (addressChecksum !== originalChecksum)
      throw new InvalidChecksumAddress(addressChecksum, originalChecksum);

    return newAddress;
  }

  /**
   * Allows to create a new AddressBls instance from bytes (buffer)
   * @param bytes - address to parse in bytes format (buffer)
   * @param networkPrefix - indicates which network the address belongs, as the bytes format does not hold the network the address corresponds
   * @returns a new instance of AddressBls
   */
  static fromBytes(
    bytes: Uint8Array,
    networkPrefix: NetworkPrefix = NetworkPrefix.Testnet
  ): AddressBls {
    if (bytes[0] != ProtocolIndicator.BLS) throw new InvalidProtocolIndicator(bytes[0]);

    const payload = bytes.subarray(1);
    return new AddressBls(payload, networkPrefix);
  }
}

/**
 * AddressId is a concrete address type 0 on filecoin blockchain (f0/t0)
 * For more information about bls addresses, please refer to this {@link https://spec.filecoin.io/appendix/address/#section-appendix.address.protocol-0-ids|link}.
 */
export class AddressId extends Address {
  /**
   * Contains the id in decimal
   */
  protected id: string;

  /**
   * Contains leb128 encoded id
   * For more information about payloads, please refer to this {@link https://spec.filecoin.io/appendix/address/#section-appendix.address.payload|link}.
   */
  protected payload: Uint8Array;

  /**
   * Allows to create a new instance of id address
   * @param payload - current address payload. It can be string (id in decimal) or buffer (leb128 encoded id)
   * @param networkPrefix - indicates which network the address belongs.
   */
  constructor(payload: string | Uint8Array, networkPrefix: NetworkPrefix = NetworkPrefix.Testnet) {
    super(ProtocolIndicator.ID, networkPrefix);

    let payloadBuff: Uint8Array;
    if (typeof payload === "string") {
      payloadBuff = unsigned.encode(payload);
    } else {
      payloadBuff = unsigned.encode(unsigned.decode(payload));
      if (u8aCompare(payloadBuff, payload) !== 0) {
        throw new Error("invalid leb128 encoded payload");
      }
    }

    const idNum = BigInt(unsigned.decode(payloadBuff));
    if (idNum > ID_PAYLOAD_MAX_NUM) throw new InvalidId(idNum.toString());

    this.payload = payloadBuff;
    this.id = this.toString().substring(2);
  }

  /**
   * Allows to get the bytes format of this address
   * @returns id address in bytes format
   */
  toBytes = (): Uint8Array => {
    return u8aConcat([new Uint8Array([this.protocol]), this.payload]);
  };

  /**
   * Allows to get the string format of this address
   * @returns id address in string format
   */
  toString = (): string =>
    this.networkPrefix + this.protocol.toString() + unsigned.decode(this.payload);

  /**
   * Getter for actor id
   */
  getId = (): string => this.id;

  /**
   * Allows to create a new AddressId instance from a string
   * @param address - address in string format
   * @returns a new instance of AddressId
   */
  static fromString(address: string): AddressId {
    const networkPrefix = address[0];
    const protocolIndicator = address[1];

    if (!validateNetworkPrefix(networkPrefix)) throw new InvalidNetwork(networkPrefix);
    if (parseInt(protocolIndicator) != ProtocolIndicator.ID)
      throw new InvalidProtocolIndicator(parseInt(protocolIndicator));

    const payload = unsigned.encode(address.substring(2));
    return new AddressId(payload, networkPrefix);
  }

  /**
   * Allows to create a new AddressId instance from bytes (buffer)
   * @param bytes - address to parse in bytes format (buffer)
   * @param networkPrefix - indicates which network the address belongs, as the bytes format does not hold the network the address corresponds
   * @returns a new instance of AddressId
   */
  static fromBytes(
    bytes: Uint8Array,
    networkPrefix: NetworkPrefix = NetworkPrefix.Testnet
  ): AddressId {
    if (bytes[0] != ProtocolIndicator.ID) throw new InvalidProtocolIndicator(bytes[0]);

    const payload = bytes.subarray(1);
    return new AddressId(payload, networkPrefix);
  }

  /**
   * Allows to get an ethereum address that holds the actor id
   * @param hexPrefix - add the 0x prefix or not
   * @returns ethereum address
   */
  toEthAddressHex = (hexPrefix = true): string => {
    const buf = new Uint8Array(ETH_ADDRESS_LEN);
    buf[0] = ACTOR_ID_ETHEREUM_MASK;

    const decodedPayload = bigintToUint8Array(unsigned.decode(this.payload));
    buf.set(decodedPayload, ETH_ADDRESS_LEN - decodedPayload.byteLength);

    return `${hexPrefix ? "0x" : ""}${u8aToString(buf, "hex")}`;
  };
}

/**
 * AddressSecp256k1 is a concrete address type 1 on filecoin blockchain (f1/t1)
 * For more information about secp256k1 addresses, please refer to this {@link https://spec.filecoin.io/appendix/address/#section-appendix.address.protocol-1-libsecpk1-elliptic-curve-public-keys|link}.
 */
export class AddressSecp256k1 extends Address {
  /**
   * Contains the Blake2b 160 hash of the uncompressed public key (65 bytes).
   * For more information about payloads, please refer to this {@link https://spec.filecoin.io/appendix/address/#section-appendix.address.payload|link}.
   */
  protected payload: Uint8Array;

  /**
   * Allows to create a new instance of secp256k1 address
   * @param payload - current address payload (buffer)
   * @param networkPrefix - indicates which network the address belongs.
   */
  constructor(payload: Uint8Array, networkPrefix: NetworkPrefix = NetworkPrefix.Testnet) {
    super(ProtocolIndicator.SECP256K1, networkPrefix);
    if (payload.byteLength !== SECP256K1_PAYLOAD_LEN)
      throw new InvalidPayloadLength(payload.byteLength);
    this.payload = payload;
  }

  /**
   * Allows to get the bytes format of this address
   * @returns secp256k1 address in bytes format
   */
  toBytes = (): Uint8Array => u8aConcat([new Uint8Array([this.protocol]), this.payload]);

  /**
   * Allows to get the string format of this address
   * @returns secp256k1 address in string format
   */
  toString = (): string => {
    const checksum = this.getChecksum();
    return (
      this.networkPrefix +
      this.protocol.toString() +
      base32Encode(u8aConcat([this.payload, checksum])).toLowerCase()
    );
  };

  /**
   * Allows to create a new AddressSecp256k1 instance from a string
   * @param address - address in string format
   * @returns a new instance of AddressSecp256k1
   */
  static fromString(address: string): AddressSecp256k1 {
    const networkPrefix = address[0];
    const protocolIndicator = address[1];

    if (!validateNetworkPrefix(networkPrefix)) throw new InvalidNetwork(networkPrefix);
    if (parseInt(protocolIndicator) != ProtocolIndicator.SECP256K1)
      throw new InvalidProtocolIndicator(parseInt(protocolIndicator));

    const decodedData = new Uint8Array(base32Decode(address.substring(2).toUpperCase()));
    const payload = decodedData.subarray(0, -4);
    const checksum = decodedData.subarray(-4);

    const newAddress = new AddressSecp256k1(payload, networkPrefix);
    const addressChecksum = u8aToString(newAddress.getChecksum(), "hex");
    const originalChecksum = u8aToString(checksum, "hex");
    if (addressChecksum !== originalChecksum)
      throw new InvalidChecksumAddress(addressChecksum, originalChecksum);

    return newAddress;
  }

  /**
   * Allows to create a new AddressSecp256k1 instance from bytes (buffer)
   * @param bytes - address to parse in bytes format (buffer)
   * @param networkPrefix - indicates which network the address belongs, as the bytes format does not hold the network the address corresponds
   * @returns a new instance of AddressSecp256k1
   */
  static fromBytes(
    bytes: Uint8Array,
    networkPrefix: NetworkPrefix = NetworkPrefix.Testnet
  ): AddressSecp256k1 {
    if (bytes[0] != ProtocolIndicator.SECP256K1) throw new InvalidProtocolIndicator(bytes[0]);

    const payload = bytes.subarray(1);
    return new AddressSecp256k1(payload, networkPrefix);
  }
}

/**
 * AddressActor is a concrete address type 2 on filecoin blockchain (f2/t2)
 * For more information about actor addresses, please refer to this {@link https://spec.filecoin.io/appendix/address/#section-appendix.address.protocol-2-actor|link}.
 */
export class AddressActor extends Address {
  /**
   * Contains the SHA256 hash of meaningful data produced as a result of creating the actor
   * For more information about payloads, please refer to this {@link https://spec.filecoin.io/appendix/address/#section-appendix.address.payload|link}.
   */
  protected payload: Uint8Array;

  /**
   * Allows to create a new instance of actor address
   * @param payload - current address payload (buffer)
   * @param networkPrefix - indicates which network the address belongs.
   */
  constructor(payload: Uint8Array, networkPrefix: NetworkPrefix = NetworkPrefix.Testnet) {
    super(ProtocolIndicator.ACTOR, networkPrefix);
    if (payload.byteLength !== ACTOR_PAYLOAD_LEN)
      throw new InvalidPayloadLength(payload.byteLength);

    this.payload = payload;
  }

  /**
   * Allows to get the bytes format of this address
   * @returns actor address in bytes format
   */
  toBytes = (): Uint8Array => u8aConcat([new Uint8Array([this.protocol]), this.payload]);

  /**
   * Allows to get the string format of this address
   * @returns actor address in string format
   */
  toString = (): string => {
    const checksum = this.getChecksum();
    return (
      this.networkPrefix +
      this.protocol.toString() +
      base32Encode(u8aConcat([this.payload, checksum])).toLowerCase()
    );
  };

  /**
   * Allows to create a new AddressActor instance from a string
   * @param address - address in string format
   * @returns a new instance of AddressActor
   */
  static fromString(address: string): AddressActor {
    const networkPrefix = address[0];
    const protocolIndicator = address[1];

    if (!validateNetworkPrefix(networkPrefix)) throw new InvalidNetwork(networkPrefix);
    if (parseInt(protocolIndicator) != ProtocolIndicator.ACTOR)
      throw new InvalidProtocolIndicator(parseInt(protocolIndicator));
    const decodedData = new Uint8Array(base32Decode(address.substring(2).toUpperCase()));
    const payload = decodedData.subarray(0, -4);
    const checksum = decodedData.subarray(-4);

    const newAddress = new AddressActor(payload, networkPrefix);
    const addressChecksum = u8aToString(newAddress.getChecksum(), "hex");
    const originalChecksum = u8aToString(checksum, "hex");
    if (addressChecksum !== originalChecksum)
      throw new InvalidChecksumAddress(addressChecksum, originalChecksum);

    return newAddress;
  }

  /**
   * Allows to create a new AddressActor instance from bytes (buffer)
   * @param bytes - address to parse in bytes format (buffer)
   * @param networkPrefix - indicates which network the address belongs, as the bytes format does not hold the network the address corresponds
   * @returns a new instance of AddressActor
   */
  static fromBytes(
    bytes: Uint8Array,
    networkPrefix: NetworkPrefix = NetworkPrefix.Testnet
  ): AddressActor {
    if (bytes[0] != ProtocolIndicator.ACTOR) throw new InvalidProtocolIndicator(bytes[0]);

    const payload = bytes.subarray(1);
    return new AddressActor(payload, networkPrefix);
  }
}

/**
 * AddressDelegated is a concrete address type 4 on filecoin blockchain (f4/t4)
 * For more information about delegated addresses, please refer to this {@link https://docs.filecoin.io/developers/smart-contracts/concepts/accounts-and-assets/#extensible-user-defined-actor-addresses-f4|link}.
 * The filecoin improvement proposal (FIP) for this address type is {@link https://github.com/filecoin-project/FIPs/blob/master/FIPS/fip-0048.md|here}
 */
export class AddressDelegated extends Address {
  /**
   * Contains the address manager actor id (leb128 encoded) and the subaddress (plain)
   * For more information about payloads, please refer to this {@link https://github.com/filecoin-project/FIPs/blob/master/FIPS/fip-0048.md#the-f4-address-class|link}.
   */
  protected payload: Uint8Array;

  /**
   * Contains the address manager actor id (decimal)
   */
  protected namespace: string;

  /**
   * Contains the sub address (plain)
   */
  protected subAddress: Uint8Array;

  /**
   * Allows to create a new instance of delegated address
   * @param namespace - account manager actor id
   * @param subAddress - user-defined address the account manager will know and administrate (buffer)
   * @param networkPrefix - indicates which network the address belongs.
   */
  constructor(
    namespace: string,
    subAddress: Uint8Array,
    networkPrefix: NetworkPrefix = NetworkPrefix.Testnet
  ) {
    super(ProtocolIndicator.DELEGATED, networkPrefix);

    if (BigInt(namespace) > ID_PAYLOAD_MAX_NUM) throw new InvalidNamespace(namespace);
    if (subAddress.length === 0 || subAddress.length > SUB_ADDRESS_MAX_LEN)
      throw new InvalidSubAddress();

    // Special check to prevent users from using DelegatedAddress with ETH namespace, and masked-id addresses
    if (namespace === DelegatedNamespace.ETH && isMaskedIdEthAddress(subAddress)) {
      throw new Error("masked-id eth addresses not allowed");
    }

    this.namespace = namespace;
    this.subAddress = subAddress;
    this.payload = this.toBytes().subarray(1);
  }

  /**
   * Getter for namespace
   */
  getNamespace = (): string => this.namespace;

  /**
   * Getter for sub address
   */
  getSubAddress = (): Uint8Array => this.subAddress;

  /**
   * Allows to get the bytes format of this address
   * @returns delegated address in bytes format
   */
  toBytes = (): Uint8Array => {
    const namespaceBytes = unsigned.encode(this.namespace);
    const protocolBytes = unsigned.encode(this.protocol);

    return u8aConcat([protocolBytes, namespaceBytes, this.subAddress]);
  };

  /**
   * Allows to get the string format of this address
   * @returns delegated address in string format
   */
  toString = (): string => {
    const checksum = this.getChecksum();

    return (
      this.networkPrefix +
      this.protocol.toString() +
      this.namespace +
      "f" +
      base32Encode(u8aConcat([this.subAddress, checksum])).toLowerCase()
    );
  };

  /**
   * Allows to create a new AddressDelegated instance from a string
   * @param address - address in string format
   * @returns a new instance of AddressDelegated
   */
  static fromString(address: string): AddressDelegated {
    const networkPrefix = address[0];
    const protocolIndicator = address[1];

    if (!validateNetworkPrefix(networkPrefix)) throw new InvalidNetwork(networkPrefix);
    if (parseInt(protocolIndicator) != ProtocolIndicator.DELEGATED)
      throw new InvalidProtocolIndicator(parseInt(protocolIndicator));

    const namespace = address.substring(2, address.indexOf("f", 2));
    const dataEncoded = address.substring(address.indexOf("f", 2) + 1);
    const dataDecoded = new Uint8Array(base32Decode(dataEncoded.toUpperCase()));

    const subAddress = dataDecoded.subarray(0, -4);
    const checksum = dataDecoded.subarray(-4);
    const newAddress = new AddressDelegated(namespace, subAddress, networkPrefix);

    const addressChecksum = u8aToString(newAddress.getChecksum(), "hex");
    const originalChecksum = u8aToString(checksum, "hex");
    if (addressChecksum !== originalChecksum)
      throw new InvalidChecksumAddress(addressChecksum, originalChecksum);

    return newAddress;
  }

  /**
   * Allows to create a new AddressDelegated instance from bytes (buffer)
   * @param bytes - address to parse in bytes format (buffer)
   * @param networkPrefix - indicates which network the address belongs, as the bytes format does not hold the network the address corresponds
   * @returns a new instance of AddressDelegated
   */
  static fromBytes(
    bytes: Uint8Array,
    networkPrefix: NetworkPrefix = NetworkPrefix.Testnet
  ): AddressDelegated {
    if (bytes[0] != ProtocolIndicator.DELEGATED) throw new InvalidProtocolIndicator(bytes[0]);

    const namespaceLength = getLeb128Length(bytes.subarray(1));
    const namespace = unsigned.decode(bytes.subarray(1, 1 + namespaceLength));
    const subAddress = bytes.subarray(namespaceLength + 1);

    return new AddressDelegated(namespace, subAddress, networkPrefix);
  }
}

/**
 * EthereumAddress is a concrete implementation for the ethereum addresses in the filecoin blockchain.
 * For more information about ethereum addresses, please refer to this {@link https://docs.filecoin.io/intro/intro-to-filecoin/blockchain/#addresses|link}.
 */
export class FilEthAddress extends AddressDelegated {
  /**
   * Allows to create a new instance of EthereumAddress
   * @param ethAddress - valid ethereum address to wrap (as buffer)
   * @param networkPrefix - indicates which network the address belongs.
   */

  constructor(ethAddress: Uint8Array, networkPrefix: NetworkPrefix = NetworkPrefix.Testnet) {
    super(DelegatedNamespace.ETH, ethAddress, networkPrefix);

    if (ethAddress.length !== ETH_ADDRESS_LEN)
      throw new Error(`invalid ethereum address: length should be ${ETH_ADDRESS_LEN} bytes`);
    if (isMaskedIdEthAddress(ethAddress)) throw new Error("masked-id eth addresses not allowed");
  }

  /**
   * Allows to create a new EthereumAddress instance from filecoin address in bytes format (buffer)
   * @example networkPrefix: 'f' - bytesFilAddress: 040a23a7f3c5c663d71151f40c8610c01150c9660795
   * @param bytesFilAddress - address to parse in bytes format (buffer)
   * @param networkPrefix - indicates which network the address belongs, as the bytes format does not hold the network the address corresponds
   * @returns a new instance of EthereumAddress
   */
  static fromBytes(
    bytesFilAddress: Uint8Array,
    networkPrefix: NetworkPrefix = NetworkPrefix.Testnet
  ): FilEthAddress {
    const addr = AddressDelegated.fromBytes(bytesFilAddress, networkPrefix);
    if (addr.getNamespace() !== DelegatedNamespace.ETH)
      throw new Error("invalid filecoin address for ethereum space");

    return new FilEthAddress(addr.getSubAddress(), addr.getNetworkPrefix());
  }

  /**
   * Allows to create a new EthereumAddress instance from filecoin address in string format
   * @param strFilAddress - address to parse in string format (buffer)
   * @example strFilAddress: f410feot7hrogmplrcupubsdbbqarkdewmb4vkwc5qqq
   * @returns a new instance of EthereumAddress
   */
  static fromString(strFilAddress: string): FilEthAddress {
    const addr = AddressDelegated.fromString(strFilAddress);
    if (addr.getNamespace() !== DelegatedNamespace.ETH)
      throw new Error("invalid filecoin address for ethereum space");

    return new FilEthAddress(addr.getSubAddress(), addr.getNetworkPrefix());
  }

  /**
   * Allows to get the ethereum address in hex format of this address
   * @param hexPrefix - add the 0x prefix or not. Defaults to true.
   * @returns ethereum address in hex string format
   */
  toEthAddressHex = (hexPrefix = true): string =>
    `${hexPrefix ? "0x" : ""}${u8aToString(this.subAddress, "hex")}`;
}
