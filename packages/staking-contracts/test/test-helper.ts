import "@nomicfoundation/hardhat-toolbox-viem";
import { network } from "hardhat";
import { ChildProcess, spawn } from "node:child_process";
import { Address } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

/**
 * Helper class for deploying and setting up a RewardAllocation contract
 * with a proxy pattern.
 */
export class RewardAllocationTestHelper {
  /**
   * Deploy and set up the RewardAllocation contract with a proxy pattern.
   * @returns A Promise that resolves to a NetworkManager instance with deployment info
   */
  public static async initializeNetwork(): Promise<
    NetworkManager & {
      rewardAllocatorPrivateKey: `0x${string}`;
      rewardsContractAddress: Address;
      mockTokenAddress: Address;
    }
  > {
    // Start hardhat node
    const networkManager = await NetworkManager.startHardhatNode();

    // Wait a bit for the node to be fully ready
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Connect to the network using hardhat's viem integration
    const { viem } = await network.connect({ network: "hardhat" });

    // Get wallet clients for testing
    const [admin] = await viem.getWalletClients();
    const rewardAllocatorPrivateKey = generatePrivateKey();
    const rewardAllocator = privateKeyToAccount(rewardAllocatorPrivateKey);
    if (!admin) {
      throw new Error("Admin account not found");
    }

    // Transfer some funds to the rewardAllocator account so it can pay for gas
    const publicClient = await viem.getPublicClient();
    const adminBalance = await publicClient.getBalance({
      address: admin.account.address,
    });
    const transferAmount = adminBalance / 10n; // Transfer 10% of admin's balance

    await admin.sendTransaction({
      to: rewardAllocator.address,
      value: transferAmount,
    });

    // Deploy mock ERC20 token
    const mockToken = await viem.deployContract("ERC20Mock");
    const rewardsAllocationImpl = await viem.deployContract("RewardAllocation");

    // This is the bytecode for a minimal proxy that delegates all calls to the implementation
    // It's based on EIP-1167: https://eips.ethereum.org/EIPS/eip-1167
    const proxyBytecode =
      `0x3d602d80600a3d3981f3363d3d373d3d3d363d73${rewardsAllocationImpl.address.slice(2).toLowerCase()}5af43d82803e903d91602b57fd5bf3` as `0x${string}`;

    // Deploy the proxy contract
    const proxyTx = await admin.sendTransaction({
      to: undefined, // Creating a new contract
      data: proxyBytecode,
      gasLimit: 1000000n,
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: proxyTx,
    });

    const proxyAddress = receipt.contractAddress;
    // This error condition is very rare - only occurs if blockchain deployment
    // transaction succeeds but returns undefined contractAddress (infrastructure failure)
    if (!proxyAddress) {
      throw new Error(
        "Failed to deploy proxy contract: contractAddress is undefined",
      );
    }

    const rewardsAllocationProxy = await viem.getContractAt(
      "RewardAllocation",
      proxyAddress,
    );

    await rewardsAllocationProxy.write.initialize([admin.account.address]);

    const REWARD_ALLOCATOR_ROLE =
      await rewardsAllocationProxy.read.REWARD_ALLOCATOR_ROLE();

    await rewardsAllocationProxy.write.grantRole([
      REWARD_ALLOCATOR_ROLE,
      rewardAllocator.address,
    ]);

    const hasRole = await rewardsAllocationProxy.read.hasRole([
      REWARD_ALLOCATOR_ROLE,
      rewardAllocator.address,
    ]);

    // This error condition is very rare - only occurs if role granting appears to
    // succeed but verification fails (smart contract logic error or blockchain inconsistency)
    if (!hasRole) {
      throw new Error("Failed to grant REWARD_ALLOCATOR_ROLE to the account");
    }

    // Mint tokens to the contract for testing
    const mockTokenContract = await viem.getContractAt(
      "ERC20Mock",
      mockToken.address,
    );
    const mintAmount = 1000000n * 10n ** 18n; // 1 million tokens with 18 decimals
    await mockTokenContract.write.mint([mintAmount]);

    // Transfer tokens to the rewards contract
    await mockTokenContract.write.transfer([proxyAddress, mintAmount]);

    // Return the network manager with additional deployment info
    return Object.assign(networkManager, {
      rewardAllocatorPrivateKey: rewardAllocatorPrivateKey,
      rewardsContractAddress: proxyAddress,
      mockTokenAddress: mockToken.address,
    });
  }
}

/**
 * Network manager for handling hardhat node lifecycle
 */
export class NetworkManager {
  private hardhatProcess: ChildProcess | null = null;
  private jsonRpcUrl: string;

  constructor() {
    this.jsonRpcUrl = "http://127.0.0.1:8545";
  }

  /**
   * Start a hardhat node for the specified network
   * @returns Promise that resolves when the node is ready
   */
  public static async startHardhatNode(): Promise<NetworkManager> {
    const manager = new NetworkManager();
    await manager.start();
    return manager;
  }

  /**
   * Start the hardhat node
   * @returns Promise that resolves when the node is ready
   */
  private async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Start hardhat node from the root directory where viem plugin is configured
      this.hardhatProcess = spawn("pnpm", ["hardhat", "node"], {
        stdio: "pipe",
        cwd: ".", // Start from the current directory (package root)
      });

      let isReady = false;
      let hasError = false;

      // Listen for output to detect when the node is ready
      this.hardhatProcess.stdout?.on("data", (data) => {
        const output = data.toString();

        // Check if the node is ready (listening on port)
        if (
          output.includes("Started HTTP and WebSocket JSON-RPC server") &&
          !isReady
        ) {
          isReady = true;
          resolve();
        }
      });

      this.hardhatProcess.stderr?.on("data", (data) => {
        // This error handling is defensive programming for process stderr parsing.
        // It only triggers if Hardhat outputs specific "Error:" messages to stderr
        // during startup, which is rare and hard to reproduce reliably in tests.
        const output = data.toString();

        // Don't treat stderr as fatal error - hardhat often logs warnings there
        if (output.includes("Error:") && !isReady && !hasError) {
          hasError = true;
          reject(new Error(`Hardhat node error: ${output}`));
        }
      });

      // Handle process exit
      this.hardhatProcess.on("exit", (code) => {
        // This handles the rare case where Hardhat process exits with non-zero code
        // before becoming ready. Would require infrastructure failures or system
        // resource issues that are impractical to simulate reliably in tests.
        if (code !== 0 && !isReady && !hasError) {
          hasError = true;
          reject(new Error(`Hardhat node exited with code ${code}`));
        }
      });

      // Handle process errors
      this.hardhatProcess.on("error", (error) => {
        // This handles process-level errors during Hardhat startup (e.g., spawn failures,
        // permission issues, missing executables). These are system-level failures
        // that are difficult to simulate without modifying the test environment.
        if (!isReady && !hasError) {
          hasError = true;
          reject(new Error(`Hardhat node process error: ${error.message}`));
        }
      });
    });
  }

  /**
   * Close the hardhat node
   */
  public async close(): Promise<void> {
    if (this.hardhatProcess) {
      // Kill the process
      this.hardhatProcess.kill("SIGTERM");

      // Wait for the process to exit
      return new Promise((resolve) => {
        if (this.hardhatProcess) {
          this.hardhatProcess.on("exit", () => {
            this.hardhatProcess = null;
            resolve();
          });
          // This handles the edge case where close() is called but hardhatProcess
          // is already null (double cleanup). This is defensive programming for
          // race conditions that are difficult to reproduce reliably in tests.
        } else {
          resolve();
        }
      });
    }
  }

  /**
   * Get the JSON-RPC URL for this network
   */
  public getJsonRpcUrl(): string {
    return this.jsonRpcUrl;
  }
}
