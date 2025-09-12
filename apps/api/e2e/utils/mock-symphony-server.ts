import express, { Express, Request, Response } from "express";
import { Server } from "http";

/**
 * Mock Symphony API server for E2E testing
 * Mimics the actual Symphony API endpoints and response structure
 */
export class MockSymphonyServer {
  private app: Express;
  private server: Server | null = null;
  private port: number;

  // Store mock data for different wallet addresses
  private mockData: Map<string, MockAgentData> = new Map();

  constructor(port: number = 4567) {
    this.port = port;
    this.app = express();
    this.setupRoutes();
    this.initializeDefaultMockData();
  }

  /**
   * Initialize default mock data for test agents
   */
  private initializeDefaultMockData(): void {
    // Default data for new agents - initial state with $500
    this.setDefaultAgentData("default", {
      initialCapital: 500,
      totalEquity: 500,
      availableBalance: 500,
      marginUsed: 0,
      totalVolume: 0,
      totalTrades: 0,
      openPositions: [],
      transfers: [],
    });
  }

  /**
   * Set mock data for a specific agent
   */
  public setAgentData(walletAddress: string, data: MockAgentData): void {
    this.mockData.set(walletAddress.toLowerCase(), data);
  }

  /**
   * Set default data template for new agents
   */
  public setDefaultAgentData(key: string, data: MockAgentData): void {
    this.mockData.set(key, data);
  }

  /**
   * Get or create mock data for an agent
   */
  private getAgentData(walletAddress: string): MockAgentData {
    const address = walletAddress.toLowerCase();
    if (!this.mockData.has(address)) {
      // Clone default data for new agent
      const defaultData = this.mockData.get("default")!;
      this.mockData.set(address, { ...defaultData });
    }
    return this.mockData.get(address)!;
  }

  /**
   * Setup Express routes to mimic Symphony API
   */
  private setupRoutes(): void {
    this.app.use(express.json());

    // Health check endpoint
    this.app.get("/agent/all-positions", (req: Request, res: Response) => {
      const userAddress = req.query.userAddress as string;

      if (!userAddress) {
        return res.status(400).json({
          success: false,
          error: "userAddress is required",
        });
      }

      const data = this.getAgentData(userAddress);
      const now = new Date().toISOString();

      // Return Symphony-formatted response
      res.json({
        success: true,
        data: {
          userAddress,
          accountSummary: {
            totalEquity: data.totalEquity,
            initialCapital: data.initialCapital,
            totalUnrealizedPnl: data.totalUnrealizedPnl || 0,
            totalRealizedPnl: data.totalRealizedPnl || 0,
            totalPnl:
              (data.totalUnrealizedPnl || 0) + (data.totalRealizedPnl || 0),
            totalFeesPaid: data.totalFeesPaid || 0,
            availableBalance: data.availableBalance,
            marginUsed: data.marginUsed,
            totalVolume: data.totalVolume,
            totalTrades: data.totalTrades,
            accountStatus: "active",
            openPositionsCount: data.openPositions.length,
            closedPositionsCount: data.closedPositionsCount || 0,
            liquidatedPositionsCount: data.liquidatedPositionsCount || 0,
            performance: {
              roi:
                ((data.totalEquity - data.initialCapital) /
                  data.initialCapital) *
                100,
              roiPercent:
                ((data.totalEquity - data.initialCapital) /
                  data.initialCapital) *
                100,
              totalTrades: data.totalTrades,
              averageTradeSize:
                data.totalTrades > 0 ? data.totalVolume / data.totalTrades : 0,
            },
          },
          openPositions: data.openPositions.map((pos, index) => ({
            protocolPositionHash: `0xprotocol_${userAddress}_${index}`,
            symphonyPositionHash: `0xsymphony_${userAddress}_${index}`,
            userAddress,
            isLong: pos.isLong,
            leverage: pos.leverage,
            positionSize: pos.positionSize,
            entryPrice: pos.entryPrice,
            tpPrice: pos.tpPrice || null,
            slPrice: pos.slPrice || null,
            currentPrice: pos.currentPrice || pos.entryPrice,
            liquidationPrice: pos.liquidationPrice || null,
            collateralAmount: pos.collateralAmount,
            pnlPercentage: pos.pnlPercentage || 0,
            pnlUSDValue: pos.pnlUSDValue || 0,
            asset: pos.asset,
            createdTimeStamp: pos.createdTimeStamp || now,
            lastUpdatedTimestamp: now,
            status: "Open",
          })),
          lastUpdated: now,
          cacheExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
        },
        processingTime: 50,
      });
    });

    // Transfer history endpoint
    this.app.get("/utils/transfers", (req: Request, res: Response) => {
      const walletAddress = req.query.walletAddress as string;
      const since = req.query.since as string;

      if (!walletAddress) {
        return res.status(400).json({
          success: false,
          error: "walletAddress is required",
        });
      }

      const data = this.getAgentData(walletAddress);
      const sinceDate = since ? new Date(since) : new Date(0);

      // Filter transfers by date
      const transfers = (data.transfers || []).filter(
        (t) => new Date(t.timestamp) >= sinceDate,
      );

      res.json({
        success: true,
        count: transfers.length,
        successful: transfers.map((_, i) => 42161 + i), // Mock chain IDs
        failed: [],
        transfers: transfers.map((t) => ({
          type: t.type,
          amount: t.amount,
          asset: t.asset || "USDC",
          from: t.from || walletAddress,
          to: t.to || walletAddress,
          timestamp: t.timestamp,
          txHash: t.txHash || `0xtx_${Date.now()}_${Math.random()}`,
          chainId: t.chainId || 42161, // Default to Arbitrum
        })),
      });
    });

    // 404 for unknown endpoints
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: "Endpoint not found",
      });
    });
  }

  /**
   * Start the mock server
   */
  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`Mock Symphony server running on port ${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the mock server
   */
  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Add a position for an agent
   */
  public addPosition(walletAddress: string, position: MockPosition): void {
    const data = this.getAgentData(walletAddress);
    data.openPositions.push(position);

    // Update account summary
    const positionMargin = position.collateralAmount;
    data.marginUsed += positionMargin;
    data.availableBalance = Math.max(0, data.totalEquity - data.marginUsed);

    // Update PnL if provided
    if (position.pnlUSDValue) {
      data.totalUnrealizedPnl =
        (data.totalUnrealizedPnl || 0) + position.pnlUSDValue;
      data.totalEquity =
        data.initialCapital +
        (data.totalUnrealizedPnl || 0) +
        (data.totalRealizedPnl || 0);
    }

    this.mockData.set(walletAddress.toLowerCase(), data);
  }

  /**
   * Add a transfer for an agent (for self-funding tests)
   */
  public addTransfer(walletAddress: string, transfer: MockTransfer): void {
    const data = this.getAgentData(walletAddress);
    if (!data.transfers) {
      data.transfers = [];
    }
    data.transfers.push(transfer);

    // Update balance if it's a deposit
    if (transfer.type === "deposit") {
      data.totalEquity += transfer.amount;
      data.availableBalance += transfer.amount;
    }

    this.mockData.set(walletAddress.toLowerCase(), data);
  }

  /**
   * Reset all mock data
   */
  public reset(): void {
    this.mockData.clear();
    this.initializeDefaultMockData();
  }
}

// Type definitions for mock data
export interface MockAgentData {
  initialCapital: number;
  totalEquity: number;
  availableBalance: number;
  marginUsed: number;
  totalVolume: number;
  totalTrades: number;
  openPositions: MockPosition[];
  transfers?: MockTransfer[];
  totalUnrealizedPnl?: number;
  totalRealizedPnl?: number;
  totalFeesPaid?: number;
  closedPositionsCount?: number;
  liquidatedPositionsCount?: number;
}

export interface MockPosition {
  isLong: boolean;
  leverage: number;
  positionSize: number;
  entryPrice: number;
  currentPrice?: number;
  tpPrice?: number;
  slPrice?: number;
  liquidationPrice?: number;
  collateralAmount: number;
  pnlPercentage?: number;
  pnlUSDValue?: number;
  asset: string;
  createdTimeStamp?: string;
}

export interface MockTransfer {
  type: "deposit" | "withdraw";
  amount: number;
  asset?: string;
  from?: string;
  to?: string;
  timestamp: string;
  txHash?: string;
  chainId?: number;
}
