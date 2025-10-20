import express, { Express, Request, Response } from "express";
import { Server } from "http";

import { createLogger } from "../logger.js";

/**
 * Mock Hyperliquid API server for E2E testing
 * Mimics the actual Hyperliquid API endpoints and response structure
 */
export class MockHyperliquidServer {
  private app: Express;
  private server: Server | null = null;
  private port: number;
  private logger = createLogger("MockHyperliquidServer");

  // Store mock data for different wallet addresses
  private mockData: Map<string, MockHyperliquidAgentData> = new Map();

  // Track API calls for testing progression
  private callIndex: Map<string, number> = new Map();

  constructor(port: number = 4568) {
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
      totalEquity: 500,
      availableBalance: 500,
      marginUsed: 0,
      totalNtlPos: 0,
      openPositions: [],
      recentFills: [],
      transfers: [],
    });

    // Pre-configured test wallet with BTC position (positive PnL)
    this.setAgentData("0x5555555555555555555555555555555555555555", {
      totalEquity: 1250,
      availableBalance: 450,
      marginUsed: 800,
      totalNtlPos: 22500,
      openPositions: [
        {
          coin: "BTC",
          szi: "0.5", // Positive for long
          entryPx: "45000",
          leverage: { type: "cross", value: 2 },
          marginUsed: "500",
          maxLeverage: 20,
          liquidationPx: "22500",
          positionValue: "23500",
          returnOnEquity: "4.44",
          unrealizedPnl: "1000",
          cumFunding: {
            allTime: "-50",
            sinceOpen: "-30",
            sinceChange: "-10",
          },
        },
      ],
      recentFills: [
        {
          coin: "BTC",
          px: "45000",
          sz: "0.5",
          side: "B",
          time: Date.now() - 86400000,
          startPosition: "0",
          dir: "Open Long",
          closedPnl: "0",
          hash: "0xmock_fill_1",
          oid: 1001,
          crossed: false,
          fee: "10",
          tid: 2001,
          feeToken: "USDC",
          builderFee: null,
          cloid: null,
        },
      ],
      transfers: [],
    });

    // Pre-configured test wallet with ETH position (negative PnL)
    this.setAgentData("0x6666666666666666666666666666666666666666", {
      totalEquity: 950,
      availableBalance: 750,
      marginUsed: 200,
      totalNtlPos: 6300,
      openPositions: [
        {
          coin: "ETH",
          szi: "-2", // Negative for short
          entryPx: "3200",
          leverage: { type: "isolated", value: 5 },
          marginUsed: "200",
          maxLeverage: 50,
          liquidationPx: "3360",
          positionValue: "6300",
          returnOnEquity: "-25",
          unrealizedPnl: "-50",
          cumFunding: {
            allTime: "20",
            sinceOpen: "15",
            sinceChange: "5",
          },
        },
      ],
      recentFills: [
        {
          coin: "ETH",
          px: "3200",
          sz: "2",
          side: "A",
          time: Date.now() - 172800000,
          startPosition: "0",
          dir: "Open Short",
          closedPnl: "0",
          hash: "0xmock_fill_2",
          oid: 1002,
          crossed: true,
          fee: "5",
          tid: 2002,
          feeToken: "USDC",
          builderFee: "1",
          cloid: "client_order_1",
        },
      ],
      transfers: [],
    });

    // Pre-configured test wallet with no positions but has traded
    this.setAgentData("0x7777777777777777777777777777777777777777", {
      totalEquity: 1100,
      availableBalance: 1100,
      marginUsed: 0,
      totalNtlPos: 0,
      openPositions: [],
      recentFills: [
        {
          coin: "SOL",
          px: "100",
          sz: "10",
          side: "B",
          time: Date.now() - 259200000,
          startPosition: "0",
          dir: "Open Long",
          closedPnl: "0",
          hash: "0xmock_fill_3",
          oid: 1003,
          crossed: false,
          fee: "2",
          tid: 2003,
          feeToken: "USDC",
          builderFee: null,
          cloid: null,
        },
        {
          coin: "SOL",
          px: "110",
          sz: "10",
          side: "A",
          time: Date.now() - 86400000,
          startPosition: "10",
          dir: "Close Long",
          closedPnl: "100",
          hash: "0xmock_fill_4",
          oid: 1004,
          crossed: false,
          fee: "2.2",
          tid: 2004,
          feeToken: "USDC",
          builderFee: null,
          cloid: null,
        },
      ],
      transfers: [],
    });

    // Pre-configured test wallet for Calmar ratio testing
    // Shows volatility pattern for max drawdown calculation
    this.setAgentData("0x8888888888888888888888888888888888888888", {
      totalEquity: 1550, // Will vary based on call index
      availableBalance: 1550,
      marginUsed: 0,
      totalNtlPos: 0,
      openPositions: [],
      recentFills: [],
      transfers: [
        // Test transfers for violation detection (like Symphony mock)
        // These need to be returned as recent transfers when queried
        {
          type: "deposit",
          usdc: "1050", // Explains the $1550 balance ($500 initial + $1050 deposit)
          hash: "0xmock_transfer_deposit",
          time: Date.now() - 3600000, // 1 hour ago
        },
      ],
    });

    // Pre-configured test wallet with multiple positions (BTC, ETH, SOL)
    this.setAgentData("0x9999999999999999999999999999999999999999", {
      totalEquity: 1500,
      availableBalance: 300,
      marginUsed: 1200,
      totalNtlPos: 3500,
      openPositions: [
        {
          coin: "BTC",
          szi: "0.02", // 0.02 BTC
          entryPx: "45000",
          positionValue: "940",
          unrealizedPnl: "40",
          leverage: {
            type: "cross",
            value: 5,
          },
          marginUsed: "188",
          maxLeverage: 20,
          liquidationPx: "42000",
          returnOnEquity: "0.0426",
          cumFunding: {
            allTime: "2.50",
            sinceChange: "0.50",
            sinceOpen: "1.00",
          },
        },
        {
          coin: "ETH",
          szi: "-0.5", // Short 0.5 ETH
          entryPx: "3200",
          positionValue: "1600",
          unrealizedPnl: "-50",
          leverage: {
            type: "cross",
            value: 5,
          },
          marginUsed: "320",
          maxLeverage: 20,
          liquidationPx: "3400",
          returnOnEquity: "-0.0312",
          cumFunding: {
            allTime: "-3.20",
            sinceChange: "-0.80",
            sinceOpen: "-1.60",
          },
        },
        {
          coin: "SOL",
          szi: "10", // 10 SOL
          entryPx: "95",
          positionValue: "960",
          unrealizedPnl: "10",
          leverage: {
            type: "cross",
            value: 3,
          },
          marginUsed: "320",
          maxLeverage: 20,
          liquidationPx: "85",
          returnOnEquity: "0.0104",
          cumFunding: {
            allTime: "0.95",
            sinceChange: "0.20",
            sinceOpen: "0.48",
          },
        },
      ],
      recentFills: [
        // BTC: Open 0.5 BTC long
        {
          coin: "BTC",
          px: "45000",
          sz: "0.5",
          side: "B",
          time: Date.now() - 86400000,
          startPosition: "0",
          dir: "Open Long",
          closedPnl: "0",
          hash: "0xbtc999a",
          oid: 9991,
          crossed: true,
          fee: "22.5",
          tid: 9991,
          feeToken: "USDC",
          cloid: null,
          builderFee: null,
        },
        // BTC: Close 0.48 BTC (reducing to 0.02)
        {
          coin: "BTC",
          px: "46000",
          sz: "0.48",
          side: "A",
          time: Date.now() - 43200000,
          startPosition: "0.5",
          dir: "Close Long",
          closedPnl: "480", // Made $480 profit ($1000 * 0.48)
          hash: "0xbtc999b",
          oid: 9992,
          crossed: true,
          fee: "22.08",
          tid: 9992,
          feeToken: "USDC",
          cloid: null,
          builderFee: null,
        },
        // ETH: Open 3 ETH short
        {
          coin: "ETH",
          px: "3200",
          sz: "3",
          side: "A",
          time: Date.now() - 86400000,
          startPosition: "0",
          dir: "Open Short",
          closedPnl: "0",
          hash: "0xeth999a",
          oid: 9993,
          crossed: true,
          fee: "9.6",
          tid: 9993,
          feeToken: "USDC",
          cloid: null,
          builderFee: null,
        },
        // ETH: Close 2.5 ETH short (reducing to -0.5)
        {
          coin: "ETH",
          px: "3100",
          sz: "2.5",
          side: "B",
          time: Date.now() - 43200000,
          startPosition: "-3",
          dir: "Close Short",
          closedPnl: "250", // Made $250 profit ($100 * 2.5)
          hash: "0xeth999b",
          oid: 9994,
          crossed: true,
          fee: "7.75",
          tid: 9994,
          feeToken: "USDC",
          cloid: null,
          builderFee: null,
        },
        // SOL: Open 30 SOL long
        {
          coin: "SOL",
          px: "95",
          sz: "30",
          side: "B",
          time: Date.now() - 43200000,
          startPosition: "0",
          dir: "Open Long",
          closedPnl: "0",
          hash: "0xsol999a",
          oid: 9995,
          crossed: true,
          fee: "2.85",
          tid: 9995,
          feeToken: "USDC",
          cloid: null,
          builderFee: null,
        },
        // SOL: Close 20 SOL (reducing to 10)
        {
          coin: "SOL",
          px: "96",
          sz: "20",
          side: "A",
          time: Date.now() - 21600000,
          startPosition: "30",
          dir: "Close Long",
          closedPnl: "20", // Made $20 profit ($1 * 20)
          hash: "0xsol999b",
          oid: 9996,
          crossed: true,
          fee: "1.92",
          tid: 9996,
          feeToken: "USDC",
          cloid: null,
          builderFee: null,
        },
      ],
      transfers: [],
    });

    // Test wallets for minFundingThreshold testing
    // Agent with exactly $250 (typical threshold amount)
    this.setAgentData("0xaaaa222222222222222222222222222222222222", {
      totalEquity: 250,
      availableBalance: 250,
      marginUsed: 0,
      totalNtlPos: 0,
      openPositions: [],
      recentFills: [],
      transfers: [],
    });

    // Agent with $100 (below typical threshold)
    this.setAgentData("0xbbbb222222222222222222222222222222222222", {
      totalEquity: 100,
      availableBalance: 100,
      marginUsed: 0,
      totalNtlPos: 0,
      openPositions: [],
      recentFills: [],
      transfers: [],
    });

    // Agent with $500 (above typical threshold)
    this.setAgentData("0xcccc222222222222222222222222222222222222", {
      totalEquity: 500,
      availableBalance: 500,
      marginUsed: 0,
      totalNtlPos: 0,
      openPositions: [],
      recentFills: [],
      transfers: [],
    });

    // Agent with $249.99 (just below typical threshold)
    this.setAgentData("0xdddd222222222222222222222222222222222222", {
      totalEquity: 249.99,
      availableBalance: 249.99,
      marginUsed: 0,
      totalNtlPos: 0,
      openPositions: [],
      recentFills: [],
      transfers: [],
    });
  }

  /**
   * Set mock data for a specific agent
   */
  public setAgentData(
    walletAddress: string,
    data: MockHyperliquidAgentData,
  ): void {
    this.mockData.set(walletAddress.toLowerCase(), data);
  }

  /**
   * Set default data template for new agents
   */
  public setDefaultAgentData(
    key: string,
    data: MockHyperliquidAgentData,
  ): void {
    this.mockData.set(key, data);
  }

  /**
   * Get or create mock data for an agent
   */
  private getAgentData(walletAddress: string): MockHyperliquidAgentData {
    const address = walletAddress.toLowerCase();
    if (!this.mockData.has(address)) {
      // Clone default data for new agent
      const defaultData = this.mockData.get("default")!;
      this.mockData.set(address, { ...defaultData });
    }
    return this.mockData.get(address)!;
  }

  /**
   * Setup Express routes to mimic Hyperliquid API
   */
  private setupRoutes(): void {
    this.app.use(express.json());

    // Main info endpoint - handles multiple request types
    this.app.post("/info", (req: Request, res: Response) => {
      const { type, user, startTime } = req.body;

      switch (type) {
        case "clearinghouseState":
          return this.handleClearinghouseState(user, res);
        case "userFillsByTime":
          return this.handleUserFills(user, startTime, res);
        case "userNonFundingLedgerUpdates":
          return this.handleLedgerUpdates(user, startTime, res);
        case "allMids":
          return this.handleAllMids(res);
        default:
          return res.status(400).json({
            error: `Unknown request type: ${type}`,
          });
      }
    });

    // 404 for unknown endpoints
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: `No handler for ${req.method} ${req.path}`,
      });
    });
  }

  /**
   * Handle clearinghouseState request
   */
  private handleClearinghouseState(user: string, res: Response): Response {
    if (!user) {
      return res.status(400).json({
        error: "User address required",
      });
    }

    const data = this.getAgentData(user);
    const lowerAddress = user.toLowerCase();

    // Handle Calmar test wallet with equity progression
    let currentEquity = data.totalEquity;
    if (lowerAddress === "0x8888888888888888888888888888888888888888") {
      const callIdx = this.callIndex.get(lowerAddress) || 0;

      // Equity progression for max drawdown testing
      // NOTE: First pair consumed by startup sync in startCompetition
      const equityProgression = [
        1700,
        1700, // Calls 1-2: STARTUP SYNC (consumed during competition start)
        1700,
        1700, // Calls 3-4: First test snapshot - Peak
        1200,
        1200, // Calls 5-6: Second test snapshot - Trough (max drawdown)
        1550,
        1550, // Calls 7-8: Third test snapshot - Recovery
        1550,
        1550, // Calls 9+: Stable
      ];

      currentEquity =
        equityProgression[Math.min(callIdx, equityProgression.length - 1)] ??
        1550;

      this.callIndex.set(lowerAddress, callIdx + 1);

      const phase =
        callIdx <= 1
          ? "peak"
          : callIdx <= 3
            ? "trough"
            : callIdx <= 5
              ? "recovery"
              : "stable";

      this.logger.info(
        `[MockHyperliquid] Calmar wallet call #${callIdx + 1}, equity=$${currentEquity} (${phase})`,
      );
    }

    // Build asset positions from mock data
    const assetPositions = data.openPositions.map((pos) => ({
      position: pos,
      type: "oneWay" as const,
    }));

    return res.json({
      assetPositions,
      marginSummary: {
        accountValue: currentEquity.toString(),
        totalMarginUsed: data.marginUsed.toString(),
        totalNtlPos: data.totalNtlPos.toString(),
        totalRawUsd: data.availableBalance.toString(),
      },
      crossMarginSummary: {
        accountValue: currentEquity.toString(),
        totalMarginUsed: data.marginUsed.toString(),
        totalNtlPos: data.totalNtlPos.toString(),
        totalRawUsd: data.availableBalance.toString(),
      },
      crossMaintenanceMarginUsed: "0",
      withdrawable: data.availableBalance.toString(),
      time: Date.now(),
    });
  }

  /**
   * Handle userFillsByTime request
   */
  private handleUserFills(
    user: string,
    startTime: number | undefined,
    res: Response,
  ): Response {
    if (!user) {
      return res.status(400).json({
        error: "User address required",
      });
    }

    const data = this.getAgentData(user);

    // Filter fills by start time if provided
    let fills = data.recentFills;
    if (startTime) {
      fills = fills.filter((fill) => fill.time >= startTime);
    }

    return res.json(fills);
  }

  /**
   * Handle userNonFundingLedgerUpdates request
   */
  private handleLedgerUpdates(
    user: string,
    startTime: number | undefined,
    res: Response,
  ): Response {
    if (!user) {
      return res.status(400).json({
        error: "User address required",
      });
    }

    const data = this.getAgentData(user);

    // For the agent with transfers, generate them dynamically
    // to ensure they happen after the competition starts
    let transfers = data.transfers;
    if (user.toLowerCase() === "0x8888888888888888888888888888888888888888") {
      // This agent should have transfers that violate the rules
      // If a startTime is provided, make transfers happen just after it
      if (startTime) {
        transfers = [
          {
            type: "deposit",
            usdc: "1050",
            hash: "0xmock_transfer_deposit",
            time: startTime + 1000, // 1 second after the startTime (competition start)
          },
        ];
      }
    }

    // Filter transfers by start time if provided
    if (startTime) {
      transfers = transfers.filter((t) => t.time >= startTime);
    }

    // Transform to Hyperliquid format with delta object
    const ledgerUpdates = transfers.map((t) => ({
      time: t.time,
      hash: t.hash,
      delta: {
        type: t.type,
        ...(t.usdc && { usdc: t.usdc }),
        ...(t.amount && { amount: t.amount }),
        ...(t.token && { token: t.token }),
        ...(t.nonce && { nonce: t.nonce }),
        ...(t.fee && { fee: t.fee }),
      },
    }));

    return res.json(ledgerUpdates);
  }

  /**
   * Handle allMids request (market prices)
   */
  private handleAllMids(res: Response): Response {
    // Return current market prices for common assets
    return res.json({
      BTC: "47000",
      ETH: "3150",
      SOL: "110",
      AVAX: "35",
      ARB: "1.2",
      OP: "2.5",
      MATIC: "0.8",
    });
  }

  /**
   * Start the mock server
   */
  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        this.logger.info(
          `Mock Hyperliquid server running on port ${this.port}`,
        );
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
  public addPosition(
    walletAddress: string,
    position: MockHyperliquidPosition,
  ): void {
    const data = this.getAgentData(walletAddress);
    data.openPositions.push(position);

    // Update account summary
    const marginUsed = parseFloat(position.marginUsed);
    data.marginUsed += marginUsed;
    data.availableBalance = Math.max(0, data.totalEquity - data.marginUsed);
    data.totalNtlPos += parseFloat(position.positionValue);

    // Update equity if there's unrealized PnL
    const unrealizedPnl = parseFloat(position.unrealizedPnl);
    data.totalEquity += unrealizedPnl;

    this.mockData.set(walletAddress.toLowerCase(), data);
  }

  /**
   * Add a fill (trade) for an agent
   */
  public addFill(walletAddress: string, fill: MockHyperliquidFill): void {
    const data = this.getAgentData(walletAddress);
    data.recentFills.push(fill);
    this.mockData.set(walletAddress.toLowerCase(), data);
  }

  /**
   * Add a transfer for an agent (for violation testing)
   * Note: Mid-competition transfers are prohibited
   */
  public addTransfer(
    walletAddress: string,
    transfer: MockHyperliquidTransfer,
  ): void {
    const data = this.getAgentData(walletAddress);
    data.transfers.push(transfer);

    // Update balance if it's a deposit
    if (transfer.type === "deposit" && transfer.usdc) {
      const amount = parseFloat(transfer.usdc);
      data.totalEquity += amount;
      data.availableBalance += amount;
    }

    this.mockData.set(walletAddress.toLowerCase(), data);
  }

  /**
   * Reset all mock data
   */
  public reset(): void {
    this.mockData.clear();
    this.callIndex.clear();
    this.initializeDefaultMockData();
  }
}

// Type definitions for mock data
interface MockHyperliquidAgentData {
  totalEquity: number;
  availableBalance: number;
  marginUsed: number;
  totalNtlPos: number;
  openPositions: MockHyperliquidPosition[];
  recentFills: MockHyperliquidFill[];
  transfers: MockHyperliquidTransfer[];
}

interface MockHyperliquidPosition {
  coin: string;
  szi: string; // Signed size (negative for short)
  entryPx: string;
  leverage: {
    type: "isolated" | "cross";
    value: number;
  };
  marginUsed: string;
  maxLeverage: number;
  liquidationPx: string | null;
  positionValue: string;
  returnOnEquity: string;
  unrealizedPnl: string;
  cumFunding: {
    allTime: string;
    sinceOpen: string;
    sinceChange: string;
  };
}

interface MockHyperliquidFill {
  coin: string;
  px: string;
  sz: string;
  side: "B" | "A";
  time: number;
  startPosition: string;
  dir: string;
  closedPnl: string;
  hash: string;
  oid: number;
  crossed: boolean;
  fee: string;
  tid: number;
  feeToken: string;
  builderFee: string | null;
  cloid: string | null;
  twapId?: string | null;
}

interface MockHyperliquidTransfer {
  type: "deposit" | "withdraw" | "subAccountTransfer";
  usdc?: string; // For USDC transfers
  amount?: string; // For non-USDC assets
  token?: string; // Asset name for non-USDC
  nonce?: number; // For withdrawals
  fee?: string; // For withdrawals
  hash: string;
  time: number;
}
