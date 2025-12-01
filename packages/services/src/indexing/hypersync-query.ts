import {
  BlockField,
  JoinMode,
  LogField,
  TransactionField,
} from "@envio-dev/hypersync-client";
import { encodeEventTopics } from "viem";

/**
 * EVENT ABIs we care about from the Recall staking contract.
 *
 * Each entry:
 * - `name` = canonical Solidity event name.
 * - `type` = internal discriminator we use in DB (`stake`, `unstake`, …).
 * - `abi` = ABI fragment for viem / Hypersync decoding.
 *
 * Covered events:
 * - Stake(staker, tokenId, amount, startTime, lockupEndTime)
 * - Unstake(staker, tokenId, amountToUnstake, withdrawAllowedTime)
 * - Relock(staker, tokenId, updatedOldStakeAmount)
 * - Withdraw(staker, tokenId, amount)
 *
 * NOTE: These are the only on-chain events that drive the off-chain
 *       `stakes` / `stake_changes` state machine and subsequent Boost awards.
 */
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
  RewardClaimed: {
    name: "RewardClaimed",
    type: "rewardClaimed",
    abi: [
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "bytes32",
            name: "root",
            type: "bytes32",
          },
          {
            indexed: true,
            internalType: "address",
            name: "user",
            type: "address",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "amount",
            type: "uint256",
          },
        ],
        name: "RewardClaimed",
        type: "event",
      },
    ],
  },
  AllocationAdded: {
    name: "AllocationAdded",
    type: "allocationAdded",
    abi: [
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "bytes32",
            name: "root",
            type: "bytes32",
          },
          {
            indexed: true,
            internalType: "address",
            name: "token",
            type: "address",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "allocatedAmount",
            type: "uint256",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "startTimestamp",
            type: "uint256",
          },
        ],
        name: "AllocationAdded",
        type: "event",
      },
    ],
  },
} as const;

/**
 * Mapping from event `topic0` → event name.
 *
 * Used so Hypersync log filters can be specified by topic hash,
 * and later decoded back to the event name.
 *
 * Example:
 *   EVENT_HASH_NAMES["0xddf252..."] === "Stake"
 */
export const EVENT_HASH_NAMES: Record<string, string> = Object.fromEntries(
  Object.values(EVENTS).map((event) => {
    const topic0 = encodeEventTopics({
      abi: event.abi,
      eventName: event.name,
    });
    return [topic0, event.name];
  }),
);

/**
 * Type definition for a Hypersync query config.
 *
 * Fields:
 * - fromBlock: block height to start indexing from.
 * - logs: array of { address[], topics[][] } filters.
 * - fieldSelection:
 *     * block: which block fields Hypersync should fetch.
 *     * log: which log fields.
 *     * transaction: which tx fields.
 * - joinMode: how Hypersync joins block/log/tx payloads (JoinAll here).
 * - delayMs: backoff delay between polling iterations.
 */
export type HypersyncQuery = {
  fromBlock: number;
  logs: Array<{
    address: string[];
    topics: string[][];
  }>;
  transactions?: Array<{
    to: string[];
    sighash: string[];
    status: number;
  }>;
  fieldSelection: {
    block: BlockField[];
    log: LogField[];
    transaction: TransactionField[];
  };
  joinMode: JoinMode;
  delayMs: number;
};

export interface IndexingConfig {
  stakingContract: string;
  rewardsContract: string;
  convictionClaimsContract: string;
  eventStartBlock: number;
  transactionsStartBlock: number;
  hypersyncUrl: string;
  hypersyncBearerToken: string;
  delayMs: number;
}

export const HypersyncQueryProvider = class {
  /**
   * Hypersync query definition for Recall staking events.
   *
   * Purpose:
   * - Retrieve staking-related events from the Recall staking contract.
   *
   * Built from config:
   * - eventStartBlock (`config.stakingIndex.eventStartBlock`) — required
   * - stakingContract (`config.stakingIndex.stakingContract`) — required
   * - rewardsContract (`config.stakingIndex.rewardsContract`) — required
   * - delayMs (`config.stakingIndex.delayMs`) — polling backoff
   *
   * Filters:
   * - Logs only from the Recall staking contract.
   * - topic0 must match one of the known `EVENT_HASH_NAMES`.
   *
   * Field selection:
   * - Block: number, hash, timestamp
   * - Log: blockNumber, blockHash, logIndex, txHash, data, address, topic0–3
   * - Tx: from, to, hash
   *
   * Join mode:
   * - JoinAll → block + tx metadata attached to each log row.
   *
   * Disabled case:
   * - If `config.stakingIndex.isEnabled` is false, this is `undefined`.
   */
  static getEventsQuery(config: IndexingConfig): HypersyncQuery {
    const fromBlock = config.eventStartBlock;
    if (!fromBlock) {
      throw new Error("eventStartBlock is not set for indexing");
    }
    const stakingContractAddress = config.stakingContract;
    if (!stakingContractAddress) {
      throw new Error("stakingContractAddress is not set for indexing");
    }
    const rewardsContractAddress = config.rewardsContract;
    if (!rewardsContractAddress) {
      throw new Error("rewardsContractAddress is not set for indexing");
    }

    return {
      fromBlock: fromBlock,
      logs: [
        {
          address: [stakingContractAddress, rewardsContractAddress],
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
      delayMs: config.delayMs,
    };
  }

  /**
   * Hypersync query definition for conviction claims transactions.
   *
   * Purpose:
   * - Retrieve claim transactions from the conviction claims contract.
   * - Decode transaction input to extract stake duration information.
   *
   * Configuration:
   * - Contract: 0x6A3044c1Cf077F386c9345eF84f2518A2682Dfff
   * - Function: claim() with sighash 0x2ac96e2a
   * - Start block: 36871780 (no relevant transactions before this)
   *
   * Field selection:
   * - Block: number, timestamp, hash
   * - Transaction: blockNumber, transactionIndex, hash, from, to, input
   * - Log: none (transaction-only query)
   *
   * Join mode:
   * - JoinAll → block metadata attached to each transaction row.
   *
   * Disabled case:
   * - If `config.stakingIndex.isEnabled` is false, this is `undefined`.
   */
  static getTransactionsQuery(config: IndexingConfig): HypersyncQuery {
    const convictionClaimsContractAddress = config.convictionClaimsContract;
    if (!convictionClaimsContractAddress) {
      throw new Error(
        "convictionClaimsContractAddress is not set for indexing",
      );
    }
    const claimFunctionSighash = "0x2ac96e2a"; // claim function signature hash
    const transactionsStartBlock = config.transactionsStartBlock;
    if (!transactionsStartBlock) {
      throw new Error("transactionsStartBlock is not set for indexing");
    }

    return {
      fromBlock: transactionsStartBlock,
      logs: [], // No logs needed for transaction queries
      transactions: [
        {
          to: [convictionClaimsContractAddress],
          sighash: [claimFunctionSighash],
          status: 1,
        },
      ],
      fieldSelection: {
        block: [BlockField.Number, BlockField.Timestamp, BlockField.Hash],
        log: [], // No log fields needed
        transaction: [
          TransactionField.BlockNumber,
          TransactionField.TransactionIndex,
          TransactionField.Hash,
          TransactionField.From,
          TransactionField.To,
          TransactionField.Input,
        ],
      },
      joinMode: JoinMode.JoinAll,
      delayMs: config.delayMs,
    };
  }
};
