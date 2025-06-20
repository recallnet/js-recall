import { eq } from "drizzle-orm";
import { db } from "@/database/db.js";
import { objectIndex } from "@/database/schema/syncing/defs.js";
import { trades } from "@/database/schema/trading/defs.js";
import { agentRankHistory } from "@/database/schema/ranking/defs.js";
import { competitionsLeaderboard } from "@/database/schema/core/defs.js";
import { portfolioSnapshots } from "@/database/schema/trading/defs.js";

export class ObjectIndexService {
  /**
   * Populate object_index with trade data
   */
  async populateTrades(competitionId?: string) {
    console.log(`Populating trades${competitionId ? ` for competition ${competitionId}` : ''}`);
    
    const query = competitionId 
      ? db.query.trades.findMany({ 
          where: eq(trades.competitionId, competitionId),
          orderBy: (trades, { desc }) => [desc(trades.timestamp)]
        })
      : db.query.trades.findMany({
          orderBy: (trades, { desc }) => [desc(trades.timestamp)]
        });

    const tradesToSync = await query;
    
    if (tradesToSync.length === 0) {
      console.log('No trades to sync');
      return;
    }

    const entries = tradesToSync.map(trade => ({
      id: crypto.randomUUID(),
      competitionId: trade.competitionId,
      agentId: trade.agentId,
      dataType: 'trade',
      data: JSON.stringify(trade),
      sizeBytes: Buffer.byteLength(JSON.stringify(trade)),
      metadata: {
        success: trade.success,
        tokenPair: `${trade.fromTokenSymbol}/${trade.toTokenSymbol}`,
        hasReason: !!trade.reason,
        chains: {
          from: trade.fromChain,
          to: trade.toChain
        }
      },
      eventTimestamp: trade.timestamp,
      createdAt: new Date()
    }));

    await db.insert(objectIndex).values(entries);
    console.log(`Inserted ${entries.length} trade entries`);
  }

  /**
   * Populate object_index with agent rank history
   */
  async populateAgentRankHistory(competitionId?: string) {
    console.log(`Populating agent rank history${competitionId ? ` for competition ${competitionId}` : ''}`);
    
    const query = competitionId
      ? db.query.agentRankHistory.findMany({
          where: eq(agentRankHistory.competitionId, competitionId),
          orderBy: (agentRankHistory, { desc }) => [desc(agentRankHistory.createdAt)]
        })
      : db.query.agentRankHistory.findMany({
          orderBy: (agentRankHistory, { desc }) => [desc(agentRankHistory.createdAt)]
        });

    const rankHistory = await query;
    
    if (rankHistory.length === 0) {
      console.log('No agent rank history to sync');
      return;
    }

    const entries = rankHistory.map(rank => ({
      id: crypto.randomUUID(),
      competitionId: rank.competitionId,
      agentId: rank.agentId,
      dataType: 'agent_rank_history',
      data: JSON.stringify(rank),
      sizeBytes: Buffer.byteLength(JSON.stringify(rank)),
      metadata: {
        mu: rank.mu,
        sigma: rank.sigma,
        ordinal: rank.ordinal
      },
      eventTimestamp: rank.createdAt,
      createdAt: new Date()
    }));

    await db.insert(objectIndex).values(entries);
    console.log(`Inserted ${entries.length} agent rank history entries`);
  }

  /**
   * Populate object_index with competitions leaderboard
   */
  async populateCompetitionsLeaderboard(competitionId?: string) {
    console.log(`Populating competitions leaderboard${competitionId ? ` for competition ${competitionId}` : ''}`);
    
    const query = competitionId
      ? db.query.competitionsLeaderboard.findMany({
          where: eq(competitionsLeaderboard.competitionId, competitionId),
          orderBy: (competitionsLeaderboard, { asc }) => [asc(competitionsLeaderboard.rank)]
        })
      : db.query.competitionsLeaderboard.findMany({
          orderBy: (competitionsLeaderboard, { desc }) => [desc(competitionsLeaderboard.createdAt)]
        });

    const leaderboard = await query;
    
    if (leaderboard.length === 0) {
      console.log('No leaderboard entries to sync');
      return;
    }

    const entries = leaderboard.map(entry => ({
      id: crypto.randomUUID(),
      competitionId: entry.competitionId,
      agentId: entry.agentId,
      dataType: 'competitions_leaderboard',
      data: JSON.stringify(entry),
      sizeBytes: Buffer.byteLength(JSON.stringify(entry)),
      metadata: {
        rank: entry.rank,
        score: entry.score
      },
      eventTimestamp: entry.createdAt,
      createdAt: new Date()
    }));

    await db.insert(objectIndex).values(entries);
    console.log(`Inserted ${entries.length} leaderboard entries`);
  }

  /**
   * Populate object_index with portfolio snapshots
   */
  async populatePortfolioSnapshots(competitionId?: string) {
    console.log(`Populating portfolio snapshots${competitionId ? ` for competition ${competitionId}` : ''}`);
    
    const query = competitionId
      ? db.query.portfolioSnapshots.findMany({
          where: eq(portfolioSnapshots.competitionId, competitionId),
          with: {
            portfolioTokenValues: true
          },
          orderBy: (portfolioSnapshots, { desc }) => [desc(portfolioSnapshots.timestamp)]
        })
      : db.query.portfolioSnapshots.findMany({
          with: {
            portfolioTokenValues: true
          },
          orderBy: (portfolioSnapshots, { desc }) => [desc(portfolioSnapshots.timestamp)]
        });

    const snapshots = await query;
    
    if (snapshots.length === 0) {
      console.log('No portfolio snapshots to sync');
      return;
    }

    const entries = snapshots.map(snapshot => {
      const snapshotData = {
        ...snapshot,
        tokenValues: snapshot.portfolioTokenValues
      };
      delete (snapshotData as Record<string, unknown>).portfolioTokenValues;

      return {
        id: crypto.randomUUID(),
        competitionId: snapshot.competitionId,
        agentId: snapshot.agentId,
        dataType: 'portfolio_snapshot',
        data: JSON.stringify(snapshotData),
        sizeBytes: Buffer.byteLength(JSON.stringify(snapshotData)),
        metadata: {
          totalValue: snapshot.totalValue,
          tokenCount: snapshot.portfolioTokenValues.length,
          snapshotId: snapshot.id
        },
        eventTimestamp: snapshot.timestamp,
        createdAt: new Date()
      };
    });

    await db.insert(objectIndex).values(entries);
    console.log(`Inserted ${entries.length} portfolio snapshot entries`);
  }

  /**
   * Populate object_index with current agent ranks
   */
  async populateAgentRank() {
    console.log('Populating current agent ranks');
    
    const ranks = await db.query.agentRank.findMany({
      orderBy: (agentRank, { desc }) => [desc(agentRank.ordinal)]
    });
    
    if (ranks.length === 0) {
      console.log('No agent ranks to sync');
      return;
    }

    const entries = ranks.map(rank => ({
      id: crypto.randomUUID(),
      competitionId: null, // No competition association
      agentId: rank.agentId,
      dataType: 'agent_rank',
      data: JSON.stringify(rank),
      sizeBytes: Buffer.byteLength(JSON.stringify(rank)),
      metadata: {
        mu: rank.mu,
        sigma: rank.sigma,
        ordinal: rank.ordinal
      },
      eventTimestamp: rank.updatedAt,
      createdAt: new Date()
    }));

    await db.insert(objectIndex).values(entries);
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
      id: crypto.randomUUID(),
      competitionId: trade.competitionId as string | null,
      agentId: trade.agentId as string,
      dataType: 'trade',
      data: JSON.stringify(trade),
      sizeBytes: Buffer.byteLength(JSON.stringify(trade)),
      metadata: {
        success: trade.success,
        tokenPair: `${trade.fromTokenSymbol}/${trade.toTokenSymbol}`,
        hasReason: !!trade.reason,
        chains: {
          from: trade.fromChain,
          to: trade.toChain
        }
      },
      eventTimestamp: (trade.timestamp || new Date()) as Date,
      createdAt: new Date()
    };

    await db.insert(objectIndex).values(entry);
  }

  /**
   * Add agent rank to index
   */
  async addAgentRankToIndex(rank: {
    agentId: string;
    mu: number;
    sigma: number;
    ordinal: number;
    updatedAt?: Date;
    [key: string]: unknown;
  }) {
    const entry = {
      id: crypto.randomUUID(),
      competitionId: null,
      agentId: rank.agentId as string,
      dataType: 'agent_rank',
      data: JSON.stringify(rank),
      sizeBytes: Buffer.byteLength(JSON.stringify(rank)),
      metadata: {
        mu: rank.mu,
        sigma: rank.sigma,
        ordinal: rank.ordinal
      },
      eventTimestamp: (rank.updatedAt || new Date()) as Date,
      createdAt: new Date()
    };

    await db.insert(objectIndex).values(entry);
  }
}

export const objectIndexService = new ObjectIndexService();