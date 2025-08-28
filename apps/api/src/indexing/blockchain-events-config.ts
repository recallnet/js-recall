import {
  BlockField,
  JoinMode,
  LogField,
  TransactionField,
} from "@envio-dev/hypersync-client";
import { encodeEventTopics } from "viem";

import config from "@/config/index.js";

export const EVENTS = {
  Stake: {
    name: "Stake",
    type: "stake",
    abi: [
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "address",
            name: "staker",
            type: "address",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "tokenId",
            type: "uint256",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "amount",
            type: "uint256",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "startTime",
            type: "uint256",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "lockupEndTime",
            type: "uint256",
          },
        ],
        name: "Stake",
        type: "event",
      },
    ] as const,
  },
  Unstake: {
    name: "Unstake",
    type: "unstake",
    abi: [
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "address",
            name: "staker",
            type: "address",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "tokenId",
            type: "uint256",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "amountToUnstake",
            type: "uint256",
          },
          {
            indexed: false,
            internalType: "uint64",
            name: "withdrawAllowedTime",
            type: "uint64",
          },
        ],
        name: "Unstake",
        type: "event",
      },
    ] as const,
  },
  Relock: {
    name: "Relock",
    type: "relock",
    abi: [
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "address",
            name: "staker",
            type: "address",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "tokenId",
            type: "uint256",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "updatedOldStakeAmount",
            type: "uint256",
          },
        ],
        name: "Relock",
        type: "event",
      },
    ],
  },
  Withdraw: {
    name: "Withdraw",
    type: "withdraw",
    abi: [
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "address",
            name: "staker",
            type: "address",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "tokenId",
            type: "uint256",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "amount",
            type: "uint256",
          },
        ],
        name: "Withdraw",
        type: "event",
      },
    ],
  },
} as const;

// Create mapping from topic0 (event hash) to event name
export const EVENT_HASH_NAMES: Record<string, string> = Object.fromEntries(
  Object.values(EVENTS).map((event) => {
    const topic0 = encodeEventTopics({
      abi: event.abi,
      eventName: event.name,
    });
    return [topic0, event.name];
  }),
);

// Configuration for Hypersync query
export type HypersyncQuery = {
  fromBlock: number;
  logs: Array<{
    address: string[];
    topics: string[][];
  }>;
  fieldSelection: {
    block: BlockField[];
    log: LogField[];
    transaction: TransactionField[];
  };
  joinMode: JoinMode;
  delayMs: number;
};

let query_: HypersyncQuery | undefined = undefined;
const isIndexingEnabled = config.stakingIndex.isEnabled;
if (isIndexingEnabled) {
  const fromBlock = config.stakingIndex.startBlock;
  if (!fromBlock) {
    throw new Error("startBlock is not set for indexing");
  }
  const contractAddress = config.stakingIndex.recallContract;
  if (!contractAddress) {
    throw new Error("contractAddress is not set for indexing");
  }
  query_ = {
    fromBlock: fromBlock,
    logs: [
      {
        address: [contractAddress],
        topics: [Object.keys(EVENT_HASH_NAMES)],
      },
    ],
    fieldSelection: {
      block: [BlockField.Number, BlockField.Hash, BlockField.Timestamp],
      log: [
        LogField.BlockNumber,
        LogField.BlockHash,
        LogField.LogIndex,
        LogField.TransactionHash,
        LogField.Data,
        LogField.Address,
        LogField.Topic0,
        LogField.Topic1,
        LogField.Topic2,
        LogField.Topic3,
      ],
      transaction: [
        TransactionField.From,
        TransactionField.To,
        TransactionField.Hash,
      ],
    },
    joinMode: JoinMode.JoinAll,
    delayMs: config.stakingIndex.delayMs,
  };
}

// Hypersync Query
export const INDEXING_HYPERSYNC_QUERY: HypersyncQuery | undefined = query_;
