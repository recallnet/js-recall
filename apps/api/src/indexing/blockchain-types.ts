// Raw log from blockchain
export type RawLog = {
  address: `0x${string}`;
  blockNumber?: string | number;
  blockHash?: string;
  blockTimestamp?: string | number;
  transactionHash?: string;
  logIndex?: number;
  topics: [signature: `0x${string}`, ...args: `0x${string}`[]];
  data: `0x${string}`;
};

// Raw event data structure (new model)
export type EventData = {
  // Blockchain metadata (stored immediately during indexing)
  blockNumber: bigint;
  blockHash: string;
  blockTimestamp: Date;
  transactionHash: string;
  logIndex: number;
  // Raw event payload (stored without parsing)
  raw: {
    topics: [signature: `0x${string}`, ...args: `0x${string}`[]];
    data: `0x${string}`;
    address: `0x${string}`;
  };
  type: EventType;
  // Indexer metadata
  createdAt: Date;
};

// Blockchain event types
export type EventType = "stake" | "unstake" | "relock" | "withdraw" | "unknown";
