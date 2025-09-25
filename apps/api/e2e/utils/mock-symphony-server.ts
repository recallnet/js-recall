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

  // Track portfolio snapshots for TWR test wallet simulation
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

    // Pre-configured test wallet WITH transfers for TWR/Calmar testing
    //
    // The key is that TWR should calculate pure trading performance
    // independent of deposits/withdrawals
    //
    // Portfolio snapshots will show: $1700 → $1200 → $1550
    // With NO transfers, this would be -8.8% return
    // With transfers, TWR should STILL show -8.8% by excluding their impact
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
        // Transfer happens between first and second snapshots
        // Snapshot 1: $1700 (peak)
        // Transfer: occurs when equity has dropped to $1400
        // Snapshot 2: $1200 (trough)
        // Snapshot 3: $1550 (recovery)
        //
        // This creates TWR periods:
        // Period 1: $1700 → $1400 = -17.65% (before transfer)
        // Deposit $1: $1400 → $1401
        // Period 2: $1401 → $1550 = +10.64% (after transfer to recovery)
        // Chain-linked: 0.8235 × 1.1064 = 0.9114 ≈ -8.86%
        {
          type: "deposit" as const,
          amount: 1,
          asset: "USDC",
          from: "0xExternal",
          to: "0x4444444444444444444444444444444444444444",
          timestamp: "dynamic:-0.03", // Between first and second processPerpsCompetition
          txHash: "0xtx_deposit_1",
          chainId: 42161,
          equityBefore: 1400,
          equityAfter: 1401,
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
      // For the TWR test wallet (0x4444...), simulate equity changes
      // between calls to match our transfer history timeline
      let currentEquity = data.totalEquity;
      const lowerAddress = userAddress.toLowerCase();

      // Debug logging
      if (lowerAddress.includes("4444")) {
        this.logger.info(`[MockSymphony] TWR wallet ${lowerAddress} detected`);
      }

      if (lowerAddress === "0x4444444444444444444444444444444444444444") {
        // Track snapshot creation for TWR test wallet
        // The test makes 3 processPerpsCompetition calls, each making 2 API calls
        const callIdx = this.snapshotIndex.get(lowerAddress) || 0;

        // Simple progression: Return different values on each pair of calls
        // This ensures consistent equity values regardless of setup calls
        const equityProgression = [
          1700,
          1700, // Calls 1-2: First snapshot - PEAK (TWR test)
          1200,
          1200, // Calls 3-4: Second snapshot - TROUGH (TWR test)
          1550,
          1550, // Calls 5-6: Third snapshot - RECOVERY (TWR test)
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
          `[MockSymphony] TWR wallet call #${callIdx + 1}, equity=$${currentEquity} (${phase})`,
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
        transfers: transfers.map((t, index) => {
          // For mock data, simulate equity changes including trading P&L
          const mockTransfer = t as MockTransfer & {
            equityBefore?: number;
            equityAfter?: number;
          };

          let equityBefore: number;
          let equityAfter: number;

          if (
            mockTransfer.equityBefore !== undefined &&
            mockTransfer.equityAfter !== undefined
          ) {
            // Use explicitly set values for testing specific scenarios
            equityBefore = mockTransfer.equityBefore;
            equityAfter = mockTransfer.equityAfter;
          } else {
            // FALLBACK: Simple calculation when explicit values not provided
            // WARNING: This is NOT realistic for TWR testing! It's just a placeholder.
            // Real TWR tests MUST provide explicit equityBefore/equityAfter that include trading P&L.
            //
            // The whole point of TWR is to separate trading performance from deposits/withdrawals.
            // Symphony provides actual equity snapshots at transfer time, which capture trading gains/losses.
            const currentAccountEquity = data.totalEquity;

            // Simplified simulation - tests should always use explicit values

            if (index === transfers.length - 1) {
              // Most recent transfer - use current account state
              if (t.type === "deposit") {
                // Before this deposit, equity was less by the deposit amount
                // BUT also account for any trading P&L since the deposit
                equityBefore = currentAccountEquity - t.amount;
                equityAfter = currentAccountEquity;
              } else {
                // Before this withdrawal, equity was more by the withdrawal amount
                equityBefore = currentAccountEquity + t.amount;
                equityAfter = currentAccountEquity;
              }
            } else {
              // For older transfers, use a simple simulation
              // In real tests, always use explicit equity values for accurate TWR testing
              const baseEquity = data.initialCapital;

              // Simulate some trading P&L (10% gain as example)
              const tradingMultiplier = 1.1;

              if (t.type === "deposit") {
                equityBefore = baseEquity * tradingMultiplier;
                equityAfter = equityBefore + t.amount;
              } else {
                equityBefore = baseEquity * tradingMultiplier;
                equityAfter = equityBefore - t.amount;
              }
            }
          }

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

          const timestamp = new Date(transferTimestamp);
          const beforeTimestamp = new Date(timestamp.getTime() - 1000); // 1 second before
          const afterTimestamp = new Date(timestamp.getTime() + 1000); // 1 second after

          return {
            type: t.type,
            amount: t.amount,
            asset: t.asset || "USDC",
            from: t.from || walletAddress,
            to: t.to || walletAddress,
            timestamp: transferTimestamp,
            txHash: t.txHash || `0xtx_${Date.now()}_${Math.random()}`,
            chainId: t.chainId || 42161, // Default to Arbitrum
            // Add equity snapshots for TWR calculation
            accountSnapshotBefore: {
              totalEquity: equityBefore,
              timestamp: beforeTimestamp.toISOString(),
            },
            accountSnapshotAfter: {
              totalEquity: equityAfter,
              timestamp: afterTimestamp.toISOString(),
            },
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
   * Add a transfer for an agent with equity snapshots for TWR calculations
   *
   * IMPORTANT: For accurate TWR testing, always provide explicit equityBefore and equityAfter values!
   * These represent the ACTUAL account equity at transfer time, including trading P&L.
   *
   * Example for testing TWR with trading gains:
   * - Initial capital: $1000
   * - After trading, equity grows to $1200 (20% gain)
   * - User deposits $500
   * - equityBefore should be $1200 (includes trading gains)
   * - equityAfter should be $1700 ($1200 + $500)
   *
   * The TWR calculation will correctly identify the 20% trading return,
   * excluding the impact of the $500 deposit.
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
  // Optional equity snapshots for testing TWR calculations
  equityBefore?: number;
  equityAfter?: number;
}
