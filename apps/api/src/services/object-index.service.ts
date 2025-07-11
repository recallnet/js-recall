import { v4 as uuidv4 } from "uuid";

import * as agentScoreRepository from "@/database/repositories/agentscore-repository.js";
import * as competitionRepository from "@/database/repositories/competition-repository.js";
import { objectIndexRepository } from "@/database/repositories/object-index.repository.js";
import * as tradeRepository from "@/database/repositories/trade-repository.js";

export class ObjectIndexService {
  /**
   * Populate object_index with trade data
   */
  async populateTrades(competitionId?: string) {
    console.log(
      `Populating trades${competitionId ? ` for competition ${competitionId}` : ""}`,
    );

    // Use trade repository to fetch trades
    const tradesToSync = await tradeRepository.getAllTrades(competitionId);

    if (tradesToSync.length === 0) {
      console.log("No trades to sync");
      return;
    }

    const entries = tradesToSync.map((trade) => ({
      id: uuidv4(),
      competitionId: trade.competitionId,
      agentId: trade.agentId,
      dataType: "trade" as const,
      data: JSON.stringify(trade),
      sizeBytes: Buffer.byteLength(JSON.stringify(trade)),
      metadata: {
        success: trade.success,
        tokenPair: `${trade.fromTokenSymbol}/${trade.toTokenSymbol}`,
        hasReason: !!trade.reason,
        chains: {
          from: trade.fromChain,
          to: trade.toChain,
        },
      },
      eventTimestamp: trade.timestamp || new Date(),
      createdAt: new Date(),
    }));

    await objectIndexRepository.insertObjectIndexEntries(entries);
    console.log(`Inserted ${entries.length} trade entries`);
  }

  /**
   * Populate object_index with agent rank history
   */
  async populateAgentScoreHistory(competitionId?: string) {
    console.log(
      `Populating agent rank history${competitionId ? ` for competition ${competitionId}` : ""}`,
    );

    // Use agent rank repository to fetch history
    const rankHistory =
      await agentScoreRepository.getAllAgentRankHistory(competitionId);

    if (rankHistory.length === 0) {
      console.log("No agent rank history to sync");
      return;
    }

    const entries = rankHistory.map((rank) => ({
      id: uuidv4(),
      competitionId: rank.competitionId,
      agentId: rank.agentId,
      dataType: "agent_score_history" as const,
      data: JSON.stringify(rank),
      sizeBytes: Buffer.byteLength(JSON.stringify(rank)),
      metadata: {
        mu: rank.mu,
        sigma: rank.sigma,
        ordinal: rank.ordinal,
      },
      eventTimestamp: rank.createdAt,
      createdAt: new Date(),
    }));

    await objectIndexRepository.insertObjectIndexEntries(entries);
    console.log(`Inserted ${entries.length} agent rank history entries`);
  }

  /**
   * Populate object_index with competitions leaderboard
   */
  async populateCompetitionsLeaderboard(competitionId?: string) {
    console.log(
      `Populating competitions leaderboard${competitionId ? ` for competition ${competitionId}` : ""}`,
    );

    // Use competition repository to fetch leaderboard
    const leaderboard =
      await competitionRepository.getAllCompetitionsLeaderboard(competitionId);

    if (leaderboard.length === 0) {
      console.log("No leaderboard entries to sync");
      return;
    }

    const entries = leaderboard.map((entry) => ({
      id: uuidv4(),
      competitionId: entry.competitionId,
      agentId: entry.agentId,
      dataType: "competitions_leaderboard" as const,
      data: JSON.stringify(entry),
      sizeBytes: Buffer.byteLength(JSON.stringify(entry)),
      metadata: {
        rank: entry.rank,
        score: entry.score,
      },
      eventTimestamp: entry.createdAt,
      createdAt: new Date(),
    }));

    await objectIndexRepository.insertObjectIndexEntries(entries);
    console.log(`Inserted ${entries.length} leaderboard entries`);
  }

  /**
   * Populate object_index with portfolio snapshots
   */
  async populatePortfolioSnapshots(competitionId?: string) {
    console.log(
      `Populating portfolio snapshots${competitionId ? ` for competition ${competitionId}` : ""}`,
    );

    // Use competition repository to fetch snapshots
    const snapshots =
      await competitionRepository.getAllPortfolioSnapshots(competitionId);

    if (snapshots.length === 0) {
      console.log("No portfolio snapshots to sync");
      return;
    }

    // Fetch token values for all snapshots using the new batch method
    const snapshotIds = snapshots.map((s) => s.id);
    const allTokenValues =
      await competitionRepository.getPortfolioTokenValuesByIds(snapshotIds);

    // Group token values by snapshot ID
    const tokenValuesBySnapshot = allTokenValues.reduce(
      (acc, tv) => {
        if (!acc[tv.portfolioSnapshotId]) {
          acc[tv.portfolioSnapshotId] = [];
        }
        acc[tv.portfolioSnapshotId]!.push(tv);
        return acc;
      },
      {} as Record<number, typeof allTokenValues>,
    );

    const entries = snapshots.map((snapshot) => {
      const tokenValues = tokenValuesBySnapshot[snapshot.id] || [];
      const snapshotData = {
        ...snapshot,
        tokenValues,
      };

      return {
        id: uuidv4(),
        competitionId: snapshot.competitionId,
        agentId: snapshot.agentId,
        dataType: "portfolio_snapshot" as const,
        data: JSON.stringify(snapshotData),
        sizeBytes: Buffer.byteLength(JSON.stringify(snapshotData)),
        metadata: {
          totalValue: snapshot.totalValue,
          tokenCount: tokenValues.length,
          snapshotId: snapshot.id,
        },
        eventTimestamp: snapshot.timestamp || new Date(),
        createdAt: new Date(),
      };
    });

    await objectIndexRepository.insertObjectIndexEntries(entries);
    console.log(`Inserted ${entries.length} portfolio snapshot entries`);
  }

  /**
   * Populate object_index with current agent scores
   */
  async populateAgentScore() {
    console.log("Populating current agent scores");

    // Use agent rank repository to fetch raw ranks
    const ranks = await agentScoreRepository.getAllRawAgentRanks();

    if (ranks.length === 0) {
      console.log("No agent ranks to sync");
      return;
    }

    const entries = ranks.map((rank) => ({
      id: uuidv4(),
      competitionId: null, // No competition association
      agentId: rank.agentId,
      dataType: "agent_score" as const,
      data: JSON.stringify(rank),
      sizeBytes: Buffer.byteLength(JSON.stringify(rank)),
      metadata: {
        mu: rank.mu,
        sigma: rank.sigma,
        ordinal: rank.ordinal,
      },
      eventTimestamp: rank.updatedAt,
      createdAt: new Date(),
    }));

    await objectIndexRepository.insertObjectIndexEntries(entries);
    console.log(`Inserted ${entries.length} agent rank entries`);
  }

  /**
   * Add a single trade to the index (for real-time updates)
   */
  async addTradeToIndex(trade: {
    competitionId: string | null;
    agentId: string;
    fromTokenSymbol: string;
    toTokenSymbol: string;
    fromChain: string;
    toChain: string;
    success: boolean;
    reason?: string;
    timestamp?: Date;
    transactionDate?: Date;
    createdAt?: Date;
    [key: string]: unknown;
  }) {
    const entry = {
      id: uuidv4(),
      competitionId: trade.competitionId as string | null,
      agentId: trade.agentId as string,
      dataType: "trade" as const,
      data: JSON.stringify(trade),
      sizeBytes: Buffer.byteLength(JSON.stringify(trade)),
      metadata: {
        success: trade.success,
        tokenPair: `${trade.fromTokenSymbol}/${trade.toTokenSymbol}`,
        hasReason: !!trade.reason,
        chains: {
          from: trade.fromChain,
          to: trade.toChain,
        },
      },
      eventTimestamp: (trade.timestamp || new Date()) as Date,
      createdAt: new Date(),
    };

    await objectIndexRepository.insertObjectIndexEntry(entry);
  }

  /**
   * Add agent rank to index
   */
  async addAgentScoreToIndex(rank: {
    agentId: string;
    mu: number;
    sigma: number;
    ordinal: number;
    updatedAt?: Date;
    [key: string]: unknown;
  }) {
    const entry = {
      id: uuidv4(),
      competitionId: null,
      agentId: rank.agentId as string,
      dataType: "agent_score" as const,
      data: JSON.stringify(rank),
      sizeBytes: Buffer.byteLength(JSON.stringify(rank)),
      metadata: {
        mu: rank.mu,
        sigma: rank.sigma,
        ordinal: rank.ordinal,
      },
      eventTimestamp: (rank.updatedAt || new Date()) as Date,
      createdAt: new Date(),
    };

    await objectIndexRepository.insertObjectIndexEntry(entry);
  }
}

export const objectIndexService = new ObjectIndexService();
