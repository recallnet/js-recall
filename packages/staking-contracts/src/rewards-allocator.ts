/* eslint-disable @typescript-eslint/no-unused-vars */
export interface AllocationResult {
  transactionHash: string | null;
}

export interface RewardsAllocator {
  allocate(
    root: string,
    totalAmount: bigint,
    startTimestamp: number,
  ): Promise<AllocationResult>;
}

export class NoopRewardsAllocator implements RewardsAllocator {
  async allocate(
    root: string,
    totalAmount: bigint,
    startTimestamp: number,
  ): Promise<AllocationResult> {
    return {
      transactionHash: null,
    };
  }
}
