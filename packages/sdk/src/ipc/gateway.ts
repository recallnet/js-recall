import {
  AbiStateMutability,
  Account,
  Address,
  Chain,
  Client,
  ContractFunctionArgs,
  ContractFunctionExecutionError,
  GetContractReturnType,
  getContract,
  toHex,
} from "viem";

import {
  gatewayManagerFacetAbi,
  gatewayManagerFacetConfig,
} from "@recall/contracts";
import { AddressDelegated } from "@recall/fvm";

import { RecallClient } from "../client.js";
import {
  InsufficientFunds,
  UnhandledGatewayError,
} from "../entities/errors.js";
import { type Result } from "../entities/utils.js";
import { SubnetId } from "./subnet.js";

// Params for `fundWithToken()` (fund an account in a child subnet)
type FundWithTokenParams = ContractFunctionArgs<
  typeof gatewayManagerFacetAbi,
  AbiStateMutability,
  "fundWithToken"
>;

// A Solidity-style subnet ID struct
export type SubnetIdTyped = FundWithTokenParams[0];

// A Solidity-style FVM address struct
export type FvmAddressTyped = FundWithTokenParams[1];

// Params for `release()` (withdraw funds from a child subnet)
type ReleaseParams = ContractFunctionArgs<
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
    client: RecallClient,
    contractAddress?: Address,
  ): GetContractReturnType<typeof gatewayManagerFacetAbi, Client, Address> {
    const chainId = client.publicClient?.chain?.id;
    if (!chainId) {
      throw new Error("Client chain ID not found");
    }
    const deployedGatewayManagerFacetAddress = (
      gatewayManagerFacetConfig.address as Record<number, Address>
    )[chainId];
    if (!deployedGatewayManagerFacetAddress) {
      throw new Error(`No contract address found for chain ID ${chainId}}`);
    }
    return getContract({
      abi: gatewayManagerFacetAbi,
      address: contractAddress || deployedGatewayManagerFacetAddress,
      client: {
        public: client.publicClient,
        wallet: client.walletClient!,
      },
    });
  }

  // Fund gateway with tokens
  async fundWithToken(
    client: RecallClient,
    amount: bigint,
    recipient?: Address,
    contractAddress?: Address,
  ): Promise<Result<boolean>> {
    if (!client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for funding gateway");
    }
    try {
      const recipientAddress = recipient || client.walletClient.account.address;
      const args = fundParamsToTyped(
        recipientAddress,
        client.network.subnetId(),
        amount,
      );
      const { request } = await this.getContract(
        client,
        contractAddress,
      ).simulate.fundWithToken<Chain, Account>(args, {
        account: client.walletClient.account,
      });
      // TODO: calling `this.getContract(client, contractAddress).write.fundWithToken(...)` doesn't work, for some reason
      const hash = await client.walletClient.writeContract(request);
      const tx = await client.publicClient.waitForTransactionReceipt({ hash });
      return { meta: { tx }, result: true };
    } catch (error: unknown) {
      if (error instanceof ContractFunctionExecutionError) {
        if (error.message.includes("insufficient funds")) {
          throw new InsufficientFunds(amount);
        }
      }
      throw new UnhandledGatewayError(`Failed to fund gateway: ${error}`);
    }
  }

  // Release funds from gateway
  async release(
    client: RecallClient,
    amount: bigint,
    recipient?: Address,
    contractAddress?: Address,
  ): Promise<Result<boolean>> {
    if (!client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for releasing funds");
    }
    try {
      const address = recipient || client.walletClient.account.address;
      const args = releaseParamsToTyped(address);
      const { request } = await this.getContract(
        client,
        contractAddress,
      ).simulate.release<Chain, Account>(args, {
        account: client.walletClient.account,
        value: amount,
      });
      // TODO: calling `this.getContract(client, contractAddress).write.release(...)` doesn't work, for some reason
      const hash = await client.walletClient.writeContract(request);
      const tx = await client.publicClient.waitForTransactionReceipt({ hash });
      return { meta: { tx }, result: true };
    } catch (error: unknown) {
      throw new UnhandledGatewayError(`Failed to release funds: ${error}`);
    }
  }
}
