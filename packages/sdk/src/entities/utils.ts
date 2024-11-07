import { Abi, Hash, parseEventLogs, PublicClient } from "viem";

// Generic type for write operations, returns the transaction hash and the data
export type WriteResult<T> = {
  tx: Hash;
  result: T;
};

// Remove `readonly` from all properties of an object (via viem contract types)
export type DeepMutable<T> = T extends readonly (infer U)[]
  ? DeepMutable<U>[]
  : T extends object
    ? { -readonly [P in keyof T]: DeepMutable<T[P]> }
    : T;

export async function parseEventFromTransaction<T>(
  client: PublicClient,
  abi: Abi,
  eventName: string,
  hash: Hash
): Promise<T> {
  const receipt = await client.waitForTransactionReceipt({
    hash,
  });
  const logs = parseEventLogs({
    abi,
    logs: receipt.logs,
  });
  const log = logs.find((log) => log.eventName === eventName);
  if (!log) {
    throw new Error(`Event ${eventName} not found`);
  }
  return log.args as T;
}
