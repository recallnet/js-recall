import express, { Express, Request, Response } from "express";
import { Server } from "http";

import { createLogger } from "@/lib/logger.js";

/**
 * Mock Symphony API server for E2E testing
 * Mimics the actual Symphony API endpoints and response structure
 */
export class MockSymphonyServer {
  private app: Express;
  private server: Server | null = null;
  private port: number;
  private logger = createLogger("MockSymphonyServer");

  // Store mock data for different wallet addresses
  private mockData: Map<string, MockAgentData> = new Map();

  // Track portfolio snapshots for Calmar ratio test wallet simulation
  private snapshotIndex: Map<string, number> = new Map();

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

    // Pre-configured test wallet with BTC and ETH positions
    this.setAgentData("0x1111111111111111111111111111111111111111", {
      initialCapital: 1000,
      totalEquity: 1250,
      availableBalance: 450,
      marginUsed: 800,
      totalVolume: 25000,
      totalTrades: 15,
      totalUnrealizedPnl: 250,
      totalRealizedPnl: 0,
      totalFeesPaid: 50,
      openPositions: [
        {
          isLong: true,
          leverage: 2,
          positionSize: 0.5,
          entryPrice: 45000,
          currentPrice: 47000,
          collateralAmount: 500,
          pnlPercentage: 4.44,
          pnlUSDValue: 1000,
          asset: "BTC",
          createdTimeStamp: new Date().toISOString(),
        },
        {
          isLong: false,
          leverage: 2,
          positionSize: 2,
          entryPrice: 3200,
          currentPrice: 3150,
          collateralAmount: 300,
          pnlPercentage: 1.56,
          pnlUSDValue: 100,
          asset: "ETH",
          createdTimeStamp: new Date().toISOString(),
        },
      ],
      transfers: [],
    });

    // Pre-configured test wallet with SOL position (negative PnL)
    this.setAgentData("0x2222222222222222222222222222222222222222", {
      initialCapital: 1000,
      totalEquity: 950,
      availableBalance: 750,
      marginUsed: 200,
      totalVolume: 5000,
      totalTrades: 3,
      totalUnrealizedPnl: -50,
      totalRealizedPnl: 0,
      totalFeesPaid: 10,
      openPositions: [
        {
          isLong: true,
          leverage: 5,
          positionSize: 10,
          entryPrice: 100,
          currentPrice: 95,
          collateralAmount: 200,
          pnlPercentage: -5,
          pnlUSDValue: -50,
          asset: "SOL",
          createdTimeStamp: new Date().toISOString(),
        },
      ],
      transfers: [],
    });

    // Pre-configured test wallet with no positions but has traded
    this.setAgentData("0x3333333333333333333333333333333333333333", {
      initialCapital: 1000,
      totalEquity: 1100,
      availableBalance: 1100,
      marginUsed: 0,
      totalVolume: 10000,
      totalTrades: 20,
      totalUnrealizedPnl: 0,
      totalRealizedPnl: 100,
      totalFeesPaid: 25,
      openPositions: [],
      transfers: [],
    });

    // Pre-configured test wallet for Calmar testing AND transfer violation testing
    // Portfolio shows volatility: $1700 → $1200 → $1550
    // Simple return: (1550/1700) - 1 = -8.8%
    // Max drawdown: (1200/1700) - 1 = -29.4%
    // Also includes test transfers for violation detection
    this.setAgentData("0x4444444444444444444444444444444444444444", {
      initialCapital: 1700,
      totalEquity: 1550,
      availableBalance: 1550,
      marginUsed: 0,
      totalVolume: 15000,
      totalTrades: 25,
      totalUnrealizedPnl: 0,
      totalRealizedPnl: -150,
      totalFeesPaid: 30,
      openPositions: [],
      transfers: [
        // Test transfers for violation detection
        // Using dynamic timestamps to occur after competition start
        {
          type: "deposit",
          amount: 200,
          asset: "USDC",
          from: "0xdeadbeef111111111111111111111111111111111",
          to: "0x4444444444444444444444444444444444444444",
          timestamp: "dynamic:0.5", // 0.5 seconds after request (after competition start)
          txHash: "0xtransfer_violation_deposit_1",
          chainId: 42161,
        },
        {
          type: "withdraw",
          amount: 50,
          asset: "USDC",
          from: "0x4444444444444444444444444444444444444444",
          to: "0xdeadbeef222222222222222222222222222222222",
          timestamp: "dynamic:1.0", // 1 second after request (after competition start)
          txHash: "0xtransfer_violation_withdraw_1",
          chainId: 42161,
        },
      ],
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
    this.app.get("/agent/user-performance", (req: Request, res: Response) => {
      const userAddress = req.query.userAddress as string;

      if (!userAddress) {
        return res.status(400).json({
          status: "error",
          error: {
            message: "Invalid or missing parameters",
            details: "userAddress is required",
          },
        });
      }

      const data = this.getAgentData(userAddress);
      // Symphony uses timestamps with milliseconds: "2025-09-12T20:49:15.000Z"
      const now = new Date().toISOString();

      // Return Symphony-formatted response
      // For the volatility test wallet (0x4444...), simulate equity changes
      // to demonstrate max drawdown and Calmar ratio calculations
      let currentEquity = data.totalEquity;
      const lowerAddress = userAddress.toLowerCase();

      // Debug logging
      if (lowerAddress.includes("4444")) {
        this.logger.info(
          `[MockSymphony] Calmar test wallet ${lowerAddress} detected`,
        );
      }

      if (lowerAddress === "0x4444444444444444444444444444444444444444") {
        // Track snapshot creation for Calmar ratio test wallet
        // The test makes 3 processPerpsCompetition calls, each making 2 API calls
        const callIdx = this.snapshotIndex.get(lowerAddress) || 0;

        // Simple progression: Return different values on each pair of calls
        // This ensures consistent equity values regardless of setup calls
        const equityProgression = [
          1700,
          1700, // Calls 1-2: First snapshot - PEAK
          1200,
          1200, // Calls 3-4: Second snapshot - TROUGH (max drawdown)
          1550,
          1550, // Calls 5-6: Third snapshot - RECOVERY
          1700,
          1700, // Calls 7-8: For subsequent tests
          1700,
          1700, // Calls 9-10: For subsequent tests
          1700,
          1700, // Calls 11-12: For subsequent tests
          1700,
          1700, // Calls 13+: Default for any additional tests
        ];

        currentEquity =
          equityProgression[Math.min(callIdx, equityProgression.length - 1)] ??
          1550;

        // Increment counter for next call
        this.snapshotIndex.set(lowerAddress, callIdx + 1);

        // Determine phase for logging based on new progression
        let phase = "other";
        if (callIdx <= 1) phase = "peak";
        else if (callIdx >= 2 && callIdx <= 3) phase = "trough";
        else if (callIdx >= 4 && callIdx <= 5) phase = "recovery";

        this.logger.info(
          `[MockSymphony] Calmar wallet call #${callIdx + 1}, equity=$${currentEquity} (${phase})`,
        );
      }

      res.json({
        success: true,
        data: {
          userAddress,
          accountSummary: {
            totalEquity: currentEquity,
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
          status: "error",
          error: {
            message: "Invalid or missing parameters",
            details: "walletAddress is required",
          },
        });
      }

      const data = this.getAgentData(walletAddress);
      const sinceDate = since ? new Date(since) : new Date(0);

      // Filter transfers by date
      const transfers = (data.transfers || []).filter((t) => {
        let transferTimestamp: Date;
        if (t.timestamp.startsWith("dynamic:")) {
          const secondsOffset = parseFloat(t.timestamp.replace("dynamic:", ""));
          transferTimestamp = new Date(Date.now() + secondsOffset * 1000);
        } else {
          transferTimestamp = new Date(t.timestamp);
        }
        return transferTimestamp >= sinceDate;
      });

      res.json({
        success: true,
        count: transfers.length,
        successful: transfers.map((_, i) => 42161 + i), // Mock chain IDs
        failed: [],
        transfers: transfers.map((t) => {
          // Calculate dynamic timestamps relative to "now" for test transfers
          let transferTimestamp: string;
          if (t.timestamp.startsWith("dynamic:")) {
            // Dynamic timestamp - calculate relative to current time
            // Format: "dynamic:-0.5" means 0.5 seconds ago
            const secondsOffset = parseFloat(
              t.timestamp.replace("dynamic:", ""),
            );
            transferTimestamp = new Date(
              Date.now() + secondsOffset * 1000,
            ).toISOString();
          } else {
            transferTimestamp = t.timestamp;
          }

          return {
            type: t.type,
            amount: t.amount,
            asset: t.asset || "USDC",
            from: t.from || walletAddress,
            to: t.to || walletAddress,
            timestamp: transferTimestamp,
            txHash: t.txHash || `0xtx_${Date.now()}_${Math.random()}`,
            chainId: t.chainId || 42161, // Default to Arbitrum
            // No equity snapshots - mid-competition transfers are now prohibited
          };
        }),
      });
    });

    // 404 for unknown endpoints
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        status: "error",
        error: {
          message: "Endpoint not found",
          details: `No handler for ${req.method} ${req.path}`,
        },
      });
    });
  }

  /**
   * Start the mock server
   */
  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        this.logger.info(`Mock Symphony server running on port ${this.port}`);
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
   * Add a transfer for an agent (for violation testing only)
   *
   * NOTE: Mid-competition transfers are now PROHIBITED by competition rules.
   * This method should only be used to test violation detection.
   *
   * Any transfer during an active competition should trigger:
   * - Self-funding alert with severity: critical
   * - Potential agent disqualification
   *
   * The system uses simple returns
   * are not allowed during competitions.
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
    this.snapshotIndex.clear(); // Reset the snapshot index between tests
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
  // Note: Mid-competition transfers are now prohibited by competition rules
}
