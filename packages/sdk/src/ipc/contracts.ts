import { Address as FvmAddress } from "@hokunet/fvm";
import {
  // GatewayGetterFacet__factory as GatewayGetterFacetFactory,
  GatewayManagerFacet,
  GatewayManagerFacet__factory as GatewayManagerFacetFactory,
  // SubnetActorGetterFacet__factory as SubnetActorGetterFacetFactory,
  // SubnetGetterFacet__factory as SubnetGetterFacetFactory,
} from "@hokunet/ipc-contracts";
import { AddressLike, BigNumberish, BytesLike, Result } from "ethers";

export { GatewayManagerFacetFactory };
export { GatewayManagerFacet };

/**
 * Converts an ethers contract `Result` to a type-safe object.
 * @param result The response from a typechain generated contract method.
 * @returns
 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function resultToType<T>(result: any): T {
  const data = (result as Result).toObject(true);

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  function transformObject(input: any): any {
    if (typeof input !== "object" || input === null) {
      return input;
    }
    if (Array.isArray(input)) {
      return input.map(transformObject);
    }
    if ("_" in input && Object.keys(input).length === 1) {
      return [input._];
    }
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      result[key] = transformObject(value);
    }
    return result;
  }
  return transformObject(data);
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function resultArrayToType<T>(results: any[]): T[] {
  return results.map((result) => resultToType<T>(result));
}

/**
 * Converts a `SubnetId` class to a contract-compatible struct.
 *
 * TODO: test this wrt eth vs fvm addresses
 */
export function ethAddressToFvmAddressStruct(
  address: string
): FvmAddressStruct {
  const fvmAddress = FvmAddress.fromEthAddress(address);
  return {
    addrType: fvmAddress.getProtocol(),
    payload: fvmAddress.getPayload(),
  };
}

// TODO: all of the types below are from typechain, but they are not exposed
// directly and are embedded within the contract bindings

export type SubnetIdStruct = {
  root: BigNumberish;
  route: string[];
};

export type SubnetStruct = {
  stake: BigNumberish;
  genesisEpoch: BigNumberish;
  circSupply: BigNumberish;
  topDownNonce: BigNumberish;
  appliedBottomUpNonce: BigNumberish;
  id: SubnetIdStruct;
};

export type SupplySourceStruct = {
  kind: BigNumberish;
  tokenAddress: AddressLike;
};

export type ValidatorStruct = {
  weight: BigNumberish;
  addr: AddressLike;
  metadata: BytesLike;
};

export type BottomUpCheckpointStruct = {
  subnetId: SubnetIdStruct;
  blockHeight: BigNumberish;
  blockHash: BytesLike;
  nextConfigurationNumber: BigNumberish;
  msgs: IpcEnvelopeStruct[];
};

export type BottomUpMsgBatchStruct = {
  subnetID: SubnetIdStruct;
  blockHeight: BigNumberish;
  msgs: IpcEnvelopeStruct[];
};

export type IpcEnvelopeStruct = {
  kind: BigNumberish;
  to: IPCAddressStruct;
  from: IPCAddressStruct;
  nonce: BigNumberish;
  value: BigNumberish;
  message: BytesLike;
};

export type IPCAddressStruct = {
  subnetId: SubnetIdStruct;
  rawAddress: FvmAddressStruct;
};

export type FvmAddressStruct = { addrType: BigNumberish; payload: BytesLike };

export type ValidatorInfoStruct = {
  federatedPower: BigNumberish;
  confirmedCollateral: BigNumberish;
  totalCollateral: BigNumberish;
  metadata: BytesLike;
};

export type MembershipStruct = {
  validators: ValidatorStruct[];
  configurationNumber: BigNumberish;
};

export type QuorumInfoStruct = {
  hash: BytesLike;
  rootHash: BytesLike;
  threshold: BigNumberish;
  currentWeight: BigNumberish;
  reached: boolean;
};

export type ParentFinalityStruct = {
  height: BigNumberish;
  blockHash: BytesLike;
};

export type StakingChangeStruct = {
  op: BigNumberish;
  payload: BytesLike;
  validator: AddressLike;
};

export type StakingChangeRequestStruct = {
  change: StakingChangeStruct;
  configurationNumber: BigNumberish;
};
