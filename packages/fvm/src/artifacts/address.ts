// Forked from https://github.com/Zondax/izari-filecoin/blob/master/src/artifacts/address.ts

/**
 * Well-known address manager in the filecoin network. An address manager is an actor that can create new actors and assign a f4 address to the new actor.
 * For more information, please refer to this {@link https://docs.filecoin.io/developers/smart-contracts/concepts/accounts-and-assets/#extensible-user-defined-actor-addresses-f4|link}.
 */
export enum DelegatedNamespace {
  ETH = "10",
}

/**
 * Actor ids can be converted to a special ethereum address in the filecoin blockchain. This is the prefix in ethereum addresses that indicates that
 * it holds an actor id.
 */
export const ACTOR_ID_ETHEREUM_MASK = 0xff;

/**
 * Actor ids can be converted to a special ethereum address in the filecoin blockchain. This is the prefix len in ethereum addresses that indicates that
 * it holds an actor id.
 */
export const ACTOR_ID_ETHEREUM_MASK_LEN = 12;

/**
 * Indicates the type of address.
 * For more information, please refer to this {@link https://spec.filecoin.io/appendix/address/#section-appendix.address.protocol-indicator|link}.
 */
export enum ProtocolIndicator {
  ID = 0,
  SECP256K1 = 1,
  ACTOR = 2,
  BLS = 3,
  DELEGATED = 4,
}

/**
 * Different Filecoin networks.
 * For more information, please refer to this {@link https://docs.filecoin.io/basics/what-is-filecoin/networks/|link}.
 */
export enum Network {
  Mainnet = "mainnet",
  Testnet = "testnet",
}

/**
 * Prefix that indicates what network the address corresponds.
 * For more information, please refer to this {@link https://spec.filecoin.io/appendix/address/#section-appendix.address.network-prefix|link}.
 */
export enum NetworkPrefix {
  Mainnet = "f",
  Testnet = "t",
}

/**
 *  Payload length for ethereum addresses
 */
export const ETH_ADDRESS_LEN = 20;

/**
 * Maximum sub address length for type four (f4/t4) addresses
 */
export const SUB_ADDRESS_MAX_LEN = 54;

/**
 *  Payload length for type three (f3/t3) addresses
 */
export const BLS_PAYLOAD_LEN = 48;

/**
 * Payload length for type two (f2/t2) addresses
 */
export const ACTOR_PAYLOAD_LEN = 20;

/**
 *  Payload length for type one (f1/t1) addresses
 */
export const SECP256K1_PAYLOAD_LEN = 20;

/**
 *  Maximum actor id (decimal) for type one (f0/t0) addresses
 */
export const ID_PAYLOAD_MAX_NUM = 2n ** 63n - 1n;
