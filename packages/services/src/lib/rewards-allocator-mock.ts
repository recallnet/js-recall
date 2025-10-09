/**
 * Mock implementation of RewardsAllocator for testing
 * This module provides mock implementations that bypass blockchain interactions
 */

/**
 * Mock implementation of RewardsAllocator for testing.
 * Provides the same interface as the real RewardsAllocator but without blockchain interactions.
 */
export class MockRewardsAllocator {
  /**
   * Mock allocate method that simulates blockchain allocation without actual transactions
   * @param root The Merkle root hash
   * @param totalAmount The total amount to allocate
   * @param startTimestamp The timestamp from which rewards can be claimed
   * @returns Mock allocation result with fake transaction details
   */
  async allocate(
    root: string, // eslint-disable-line @typescript-eslint/no-unused-vars
    totalAmount: bigint, // eslint-disable-line @typescript-eslint/no-unused-vars
    startTimestamp: number, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<{
    transactionHash: string;
    blockNumber: bigint;
    gasUsed: bigint;
  }> {
    // Return mock transaction details
    return {
      transactionHash: `0x${"0".repeat(64)}`, // Mock transaction hash
      blockNumber: 12345n, // Mock block number
      gasUsed: 21000n, // Mock gas used
    };
  }
}
