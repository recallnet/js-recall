export interface StakeInfoWithId {
  tokenId: bigint;
  amount: bigint;
  startTime: bigint;
  lockupEndTime: bigint;
  withdrawAllowedTime: bigint;
}
