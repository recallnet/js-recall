import { AddressDelegated } from "@hokunet/fvm";
import {
  AbiStateMutability,
  Address,
  Client,
  ContractFunctionArgs,
  ContractFunctionExecutionError,
  getContract,
  GetContractReturnType,
  toHex,
} from "viem";
import { gatewayManagerFacetABI } from "../abis.js";
import { HokuClient } from "../client.js";
import { gatewayManagerFacetAddress } from "../constants.js";
import { InsufficientFunds, UnhandledGatewayError } from "../entities/errors.js";
import { DeepMutable, type Result } from "../entities/utils.js";
import { SubnetId } from "./subnet.js";

type FundWithTokenParams = ContractFunctionArgs<
  typeof gatewayManagerFacetABI,
  AbiStateMutability,
  "fundWithToken"
>;

export type SubnetIdTyped = DeepMutable<FundWithTokenParams[0]>;
export type FvmAddressTyped = DeepMutable<FundWithTokenParams[1]>;

type ReleaseParams = ContractFunctionArgs<
  typeof gatewayManagerFacetABI,
  AbiStateMutability,
  "release"
>;

function addressToFvmAddressTyped(address: Address): FvmAddressTyped {
  const addr = AddressDelegated.fromEthAddress(address);
  return { addrType: addr.getProtocol(), payload: toHex(addr.getPayload()) };
}

function fundParamsToTyped(
  address: Address,
  subnetId: SubnetId,
  amount: bigint
): FundWithTokenParams {
  const fvmAddress = addressToFvmAddressTyped(address);
  const subnet = subnetId.evm as SubnetIdTyped;
  return [subnet, fvmAddress, amount];
}

function releaseParamsToTyped(address: Address): ReleaseParams {
  const fvmAddress = addressToFvmAddressTyped(address);
  return [fvmAddress];
}

export class GatewayManager {
  getContract(
    client: HokuClient,
    contractAddress?: Address
  ): GetContractReturnType<typeof gatewayManagerFacetABI, Client, Address> {
    const chainId = client.publicClient?.chain?.id;
    if (!chainId) {
      throw new Error("Client chain ID not found");
    }
    const deployedGatewayManagerFacetAddress = (
      gatewayManagerFacetAddress as Record<number, Address>
    )[chainId];
    if (!deployedGatewayManagerFacetAddress) {
      throw new Error(`No contract address found for chain ID ${chainId}}`);
    }
    return getContract({
      abi: gatewayManagerFacetABI,
      address: contractAddress || deployedGatewayManagerFacetAddress,
      client: {
        public: client.publicClient,
        wallet: client.walletClient!,
      },
    });
  }

  // Fund gateway with tokens
  async fundWithToken(
    client: HokuClient,
    amount: bigint,
    recipient?: Address,
    contractAddress?: Address
  ): Promise<Result<boolean>> {
    if (!client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for funding gateway");
    }
    try {
      const recipientAddress = recipient || client.walletClient.account.address;
      const args = fundParamsToTyped(recipientAddress, client.network.subnetId(), amount);
      const { request } = await client.publicClient.simulateContract({
        address: this.getContract(client, contractAddress).address,
        abi: this.getContract(client, contractAddress).abi,
        functionName: "fundWithToken",
        args,
        account: client.walletClient.account,
      });
      const hash = await client.walletClient.writeContract(request);
      const tx = await client.publicClient.waitForTransactionReceipt({ hash });
      return { meta: { tx }, result: true };
    } catch (error) {
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
    client: HokuClient,
    amount: bigint,
    recipient?: Address,
    contractAddress?: Address
  ): Promise<Result<boolean>> {
    if (!client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for releasing funds");
    }
    try {
      const address = recipient || client.walletClient.account.address;
      const args = releaseParamsToTyped(address);
      const { request } = await client.publicClient.simulateContract({
        address: this.getContract(client, contractAddress).address,
        abi: this.getContract(client, contractAddress).abi,
        functionName: "release",
        args,
        value: amount,
        account: client.walletClient.account,
      });
      const hash = await client.walletClient.writeContract(request);
      const tx = await client.publicClient.waitForTransactionReceipt({ hash });
      return { meta: { tx }, result: true };
    } catch (error) {
      throw new UnhandledGatewayError(`Failed to release funds: ${error}`);
    }
  }
}
