import {
  AbiStateMutability,
  Account,
  Address,
  Chain,
  Client,
  ContractFunctionArgs,
  ContractFunctionExecutionError,
  GetContractReturnType,
  PublicClient,
  WalletClient,
  getContract,
  toHex,
} from "viem";

import { gatewayManagerFacetAbi } from "@recallnet/contracts";
import { AddressDelegated } from "@recallnet/fvm/address";

import { InsufficientFunds, UnhandledGatewayError } from "../errors.js";
import { type Result } from "../utils.js";
import { SubnetId } from "./subnet.js";

// Params for `fundWithToken()` (fund an account in a child subnet)
export type FundWithTokenParams = ContractFunctionArgs<
  typeof gatewayManagerFacetAbi,
  AbiStateMutability,
  "fundWithToken"
>;

// A Solidity-style subnet ID struct
export type SubnetIdTyped = FundWithTokenParams[0];

// A Solidity-style FVM address struct
export type FvmAddressTyped = FundWithTokenParams[1];

// Params for `release()` (withdraw funds from a child subnet)
export type ReleaseParams = ContractFunctionArgs<
  typeof gatewayManagerFacetAbi,
  AbiStateMutability,
  "release"
>;

// Convert an EVM address to a Solidity-style FVM address struct
function addressToFvmAddressTyped(address: Address): FvmAddressTyped {
  const addr = AddressDelegated.fromEthAddress(address);
  return { addrType: addr.getProtocol(), payload: toHex(addr.getPayload()) };
}

// Convert an address and a subnet ID to a Solidity-style `fundWithToken()` params struct
function fundParamsToTyped(
  address: Address,
  subnetId: SubnetId,
  amount: bigint,
): FundWithTokenParams {
  const fvmAddress = addressToFvmAddressTyped(address);
  const subnet: SubnetIdTyped = {
    root: BigInt(subnetId.evm.root),
    route: subnetId.evm.route as Address[],
  };
  return [subnet, fvmAddress, amount];
}

// Convert an address to a Solidity-style `release()` params struct
function releaseParamsToTyped(address: Address): ReleaseParams {
  const fvmAddress = addressToFvmAddressTyped(address);
  return [fvmAddress];
}

// Gateway manager facet for managing gateway funding and releasing
export class GatewayManager {
  getContract(
    publicClient: PublicClient,
    walletClient: WalletClient,
    contractAddress: Address,
  ): GetContractReturnType<typeof gatewayManagerFacetAbi, Client, Address> {
    const chainId = publicClient?.chain?.id;
    if (!chainId) {
      throw new Error("Client chain ID not found");
    }
    return getContract({
      abi: gatewayManagerFacetAbi,
      address: contractAddress,
      client: {
        public: publicClient,
        wallet: walletClient!,
      },
    });
  }

  // Fund gateway with tokens. Assumes the request is coming from the parent chain for a specific
  // child chain (identified by the subnet ID).
  async fundWithToken(
    publicClient: PublicClient,
    walletClient: WalletClient,
    contractAddress: Address,
    forSubnet: SubnetId,
    amount: bigint,
    recipient?: Address,
  ): Promise<Result> {
    if (!walletClient.account) {
      throw new Error("Wallet client is not initialized for funding gateway");
    }
    try {
      const recipientAddress = recipient || walletClient.account.address;
      const args = fundParamsToTyped(recipientAddress, forSubnet, amount);
      const gasPrice = await publicClient.getGasPrice();
      const { request } = await this.getContract(
        publicClient,
        walletClient,
        contractAddress,
      ).simulate.fundWithToken<Chain, Account>(args, {
        account: walletClient.account,
        gasPrice,
      });
      // TODO: calling `this.getContract(client, contractAddress).write.fundWithToken(...)` doesn't work, for some reason
      const hash = await walletClient.writeContract(request);
      const tx = await publicClient.waitForTransactionReceipt({ hash });
      return { meta: { tx }, result: {} };
    } catch (error: unknown) {
      if (error instanceof ContractFunctionExecutionError) {
        if (error.message.includes("insufficient funds")) {
          throw new InsufficientFunds(amount);
        }
      }
      throw new UnhandledGatewayError(`Failed to fund gateway: ${error}`);
    }
  }

  // Release funds from gateway (child chain to parent chain)
  async release(
    publicClient: PublicClient,
    walletClient: WalletClient,
    contractAddress: Address,
    amount: bigint,
    recipient?: Address,
  ): Promise<Result> {
    if (!walletClient.account) {
      throw new Error("Wallet client is not initialized for releasing funds");
    }
    try {
      const address = recipient || walletClient.account.address;
      const args = releaseParamsToTyped(address);
      const gasPrice = await publicClient.getGasPrice();
      const { request } = await this.getContract(
        publicClient,
        walletClient,
        contractAddress,
      ).simulate.release<Chain, Account>(args, {
        account: walletClient.account,
        value: amount,
        gasPrice,
      });
      // TODO: calling `this.getContract(client, contractAddress).write.release(...)` doesn't work, for some reason
      const hash = await walletClient.writeContract(request);
      const tx = await publicClient.waitForTransactionReceipt({ hash });
      return { meta: { tx }, result: {} };
    } catch (error: unknown) {
      throw new UnhandledGatewayError(`Failed to release funds: ${error}`);
    }
  }
}
