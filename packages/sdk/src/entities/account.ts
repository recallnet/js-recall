// `Account` class wrapper around `GatewayManager`
import {
  AbiStateMutability,
  Account,
  Address,
  Chain,
  Client,
  ContractFunctionArgs,
  GetBalanceReturnType,
  GetContractReturnType,
  getContract,
} from "viem";

import { getParentChain } from "@recallnet/chains";
import {
  gatewayManagerFacetConfig,
  recallErc20Abi,
  recallErc20Address,
} from "@recallnet/contracts";

import { RecallClient } from "../client.js";
import { InvalidValue } from "../errors.js";
import { GatewayManager } from "../ipc/gateway.js";
import { Result } from "../utils.js";

// Type for account info
export type AccountInfo = {
  address: Address;
  nonce: number;
  balance: bigint;
  parentBalance?: bigint;
};

// Type for approve params
export type ApproveParams = ContractFunctionArgs<
  typeof recallErc20Abi,
  AbiStateMutability,
  "approve"
>;

// AccountManager class wrapper around `GatewayManager`
export class AccountManager {
  client: RecallClient;
  gatewayManager: GatewayManager;

  constructor(client: RecallClient) {
    this.client = client;
    this.gatewayManager = new GatewayManager();
  }

  // Get the gateway manager class and underlying contract
  // TODO: the logic for getting the gateway manager is a bit convoluted at the moment wrt
  // contract overrides.
  getGatewayManager(): GatewayManager {
    return this.gatewayManager;
  }

  // Switch between parent and child subnet
  async switchSubnet(
    from: Chain,
    to: Chain,
  ): Promise<{ change: () => Promise<void>; reset: () => Promise<void> }> {
    return {
      change: async () => await this.client.switchChain(to),
      reset: async () => await this.client.switchChain(from),
    };
  }

  // Get the supply source contract
  getSupplySource(
    chain: Chain,
    contractAddress?: Address,
  ): GetContractReturnType<typeof recallErc20Abi, Client, Address> {
    const chainId = chain.id;
    const deployedSupplySourceAddress = (
      recallErc20Address as Record<number, Address>
    )[chainId];
    const overrideConfig =
      this.client.contractOverrides.accountManager?.recallErc20;
    const overrideSupplySourceAddress = overrideConfig
      ? overrideConfig[chainId]
      : undefined;
    const override =
      contractAddress ??
      overrideSupplySourceAddress ??
      deployedSupplySourceAddress;
    if (!override) {
      throw new Error(`No contract address found for chain ID ${chainId}}`);
    }
    return getContract({
      abi: recallErc20Abi,
      address: override,
      client: {
        public: this.client.publicClient,
        wallet: this.client.walletClient!,
      },
    });
  }

  // Get account balance
  async balance(address?: Address): Promise<Result<GetBalanceReturnType>> {
    const addr = address || this.client.walletClient?.account?.address;
    if (!addr) {
      throw new InvalidValue(
        "Must provide an address or connect a wallet client",
      );
    }
    return {
      result: await this.client.publicClient.getBalance({ address: addr }),
    };
  }

  // Get account info
  async info(address?: Address): Promise<Result<AccountInfo>> {
    const addr = address || this.client.walletClient?.account?.address;
    if (!addr) {
      throw new InvalidValue(
        "Must provide an address or connect a wallet client",
      );
    }
    const balance = await this.balance(addr);
    const nonce = await this.client.publicClient.getTransactionCount({
      address: addr,
    });
    const currentChain = this.client.publicClient.chain;
    const parentChain = getParentChain(currentChain);
    if (!parentChain) {
      return { result: { address: addr, nonce, balance: balance.result } };
    }
    const { change, reset } = await this.switchSubnet(
      currentChain,
      parentChain,
    );
    await change();
    const args = [addr] as const;
    const parentBalance = await this.getSupplySource(
      this.client.publicClient.chain,
    ).read.balanceOf(args);
    await reset();
    return {
      result: { address: addr, nonce, balance: balance.result, parentBalance },
    };
  }

  // Approve a spender to transfer funds from the account. Assumes the wallet client is on the
  // correct chain (i.e., should be connected to the parent chain, where the ERC20 exists).
  async approve(
    spender: Address,
    amount: bigint,
    contractAddress?: Address,
  ): Promise<Result> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for approving");
    }
    const args = [spender, amount] as ApproveParams;
    const supplySource = this.getSupplySource(
      this.client.walletClient.chain,
      contractAddress,
    );
    const { request } = await supplySource.simulate.approve<Chain, Account>(
      args,
      {
        account: this.client.walletClient.account,
      },
    );
    // TODO: calling `supplySource.write.approve(...)` doesn't work, for some reason
    const hash = await this.client.walletClient.writeContract(request);
    const tx = await this.client.publicClient.waitForTransactionReceipt({
      hash,
    });
    return { meta: { tx }, result: {} };
  }

  // Deposit funds from parent to child subnet. Assumes the wallet client is on the child chain,
  // and chain switching is handled automatically.
  async deposit(
    amount: bigint,
    recipient?: Address,
    contractAddress?: Address,
  ): Promise<Result> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for approving");
    }
    const currentChain = this.client.publicClient.chain;
    const subnetId = this.client.getSubnetId();
    const parentChain = getParentChain(currentChain);
    if (!parentChain) {
      throw new InvalidValue("No parent chain found");
    }
    const { change, reset } = await this.switchSubnet(
      currentChain,
      parentChain,
    );
    await change();
    const chainId = this.client.walletClient?.chain.id;
    const deployedGatewayManagerFacetAddress = (
      gatewayManagerFacetConfig.address as Record<number, Address>
    )[chainId];
    const overrideConfig =
      this.client.contractOverrides.accountManager?.gatewayManager;
    const overrideGatewayAddress = overrideConfig
      ? overrideConfig[chainId]
      : undefined;
    const override =
      contractAddress ??
      overrideGatewayAddress ??
      deployedGatewayManagerFacetAddress;
    if (!override) {
      throw new Error(`No contract address found for chain ID ${chainId}}`);
    }
    await this.approve(override, amount);
    const result = await this.getGatewayManager().fundWithToken(
      this.client.publicClient,
      this.client.walletClient,
      override,
      subnetId,
      amount,
      recipient,
    );
    await reset();
    return result;
  }

  // Withdraw funds from child subnet to parent
  async withdraw(
    amount: bigint,
    recipient?: Address,
    contractAddress?: Address,
  ): Promise<Result> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for withdrawing");
    }
    const chainId = this.client.walletClient?.chain.id;
    const deployedGatewayManagerFacetAddress = (
      gatewayManagerFacetConfig.address as Record<number, Address>
    )[chainId];
    const overrideConfig =
      this.client.contractOverrides.accountManager?.gatewayManager;
    const overrideGatewayAddress = overrideConfig
      ? overrideConfig[chainId]
      : undefined;
    const override =
      contractAddress ??
      overrideGatewayAddress ??
      deployedGatewayManagerFacetAddress;
    if (!override) {
      throw new Error(`No contract address found for chain ID ${chainId}}`);
    }
    const result = await this.getGatewayManager().release(
      this.client.publicClient,
      this.client.walletClient,
      override,
      amount,
      recipient,
    );
    return result;
  }

  // Transfer funds between accounts within the same subnet
  async transfer(recipient: Address, amount: bigint): Promise<Result> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for transfers");
    }
    const hash = await this.client.walletClient?.sendTransaction({
      account: this.client.walletClient.account,
      chain: this.client.walletClient.chain,
      to: recipient,
      value: amount,
    });
    const tx = await this.client.publicClient.waitForTransactionReceipt({
      hash,
    });
    return { meta: { tx }, result: {} };
  }
}
