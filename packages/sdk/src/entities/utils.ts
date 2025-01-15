import { AddressId, leb128 } from "@recall/fvm";
import {
  Abi,
  Address,
  GetEventArgs,
  Hash,
  parseEventLogs,
  PublicClient,
  TransactionReceipt,
} from "viem";

/**
 * Metadata for read or write operations (currently only `tx` is used, via write operations)
 * @param hash Transaction hash, if the operation was a write
 */
export interface Metadata {
  tx?: TransactionReceipt;
}

// Generic type for read operations, returns the data
export type Result<T = unknown> = {
  result: T;
  meta?: Metadata;
};

// Parse event from transaction
export async function parseEventFromTransaction<T extends GetEventArgs<Abi, string>>(
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

// Convert object to solidity `Metadata` struct abi params
export function convertMetadataToAbiParams(
  value: Record<string, string>
): { key: string; value: string }[] {
  return Object.entries(value).map(([key, value]) => ({ key, value }));
}

// Convert solidity `Metadata` struct to normal javascript object
export function convertAbiMetadataToObject(
  metadata: readonly { key: string; value: string }[]
): Record<string, string> {
  return metadata.reduce(
    (acc, { key, value }) => {
      acc[key] = value;
      return acc;
    },
    {} as Record<string, string>
  );
}

// Convert actor ID to masked EVM address
export function actorIdToMaskedEvmAddress(actorId: number): Address {
  const actorIdBytes = new Uint8Array([0x00, ...leb128.unsigned.encode(actorId)]);
  // Note: `fromBytes` assumes the network prefix is Testnet, but we'll need to handle Mainnet, too
  return AddressId.fromBytes(actorIdBytes).toEthAddressHex() as Address;
}
