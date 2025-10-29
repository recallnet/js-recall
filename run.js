#!/usr/bin/env node

/**
 * Hyperliquid Transfer Monitoring Script
 *
 * Monitors legitimate agents for transfers (deposits/withdrawals) after competition start
 * Competition ID: 51cee080-b5de-445d-a532-d1d474a67a30
 * Competition Name: Recall Agents vs. Alpha Arena Models
 * Competition Start: 2025-10-27 13:00:08.378+00
 */

const COMPETITION_START = new Date("2025-10-27T13:00:08.378Z");
const COMPETITION_ID = "51cee080-b5de-445d-a532-d1d474a67a30";

// Legitimate agents with wallet addresses and valid starting balances
const LEGITIMATE_AGENTS = [
  {
    wallet: "0xbf0a8c4f34e91f17aa33dc790c2c3f2c58537be3",
    name: "Bull vs. Bear",
    agentId: "b8243b30-27c2-4e47-9809-29445029a74f",
  },
  {
    wallet: "0x3c8120d5eafca181da83d4a1e17b2751d4a16023",
    name: "cassh",
    agentId: "07ce800d-ab19-4d31-92e1-3789aad12406",
  },
  {
    wallet: "0x59fa085d106541a834017b97060bcbbb0aa82869",
    name: "Claude Sonnet",
    agentId: "ad77de46-86a3-41dd-97ef-b30aa3d7b150",
  },
  {
    wallet: "0x60b90debc95b2576659aad57d7d435d8eee9cbde",
    name: "Cryptoeights",
    agentId: "47534b24-ae20-4b4c-8ebc-a772e0a23378",
  },
  {
    wallet: "0xc20ac4dc4188660cbf555448af52694ca62b0734",
    name: "DeepSeek Chat",
    agentId: "db1e1798-97c1-4613-962b-c95e19c2bbb7",
  },
  {
    wallet: "0xd20bc84b528d03d7702a0d6457d74ad97190b898",
    name: "Eigen Agent",
    agentId: "cd910169-fea3-4d37-8887-9954e3fdb364",
  },
  {
    wallet: "0x1b7a7d099a670256207a30dd0ae13d35f278010f",
    name: "Gemini Pro",
    agentId: "b656119a-2d28-4b91-9914-44a8506625ab",
  },
  {
    wallet: "0x67293d914eafb26878534571add81f6bd2d9fe06",
    name: "GPT 5",
    agentId: "a3cd2e8d-ecfe-4c13-a825-4fde06b0f65c",
  },
  {
    wallet: "0x56d652e62998251b56c8398fb11fcfe464c08f84",
    name: "Grok",
    agentId: "b6418f67-a922-418e-a1db-34483141a5e2",
  },
  {
    wallet: "0x113583affc47ca292e39fe690d4b08912a666e91",
    name: "GTrader",
    agentId: "00532621-0fd4-4c3b-8c26-87523df128b2",
  },
  {
    wallet: "0xb5beba84d50738ece778a1116eeb2b1f459a4ea4",
    name: "hunger agent",
    agentId: "f4f80665-4f34-4395-943f-96372568dbf5",
  },
  {
    wallet: "0x7a8fd8bba33e37361ca6b0cb4518a44681bad2f3",
    name: "Qwen3 Max",
    agentId: "36e5fa9b-151a-4a62-95d4-620f610e0273",
  },
];

/**
 * Fetches transfer history from Hyperliquid API
 * @param {string} walletAddress - Wallet address to check
 * @returns {Promise<Array>} Array of transfers
 */
async function fetchTransferHistory(walletAddress) {
  try {
    const response = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "userNonFundingLedgerUpdates",
        user: walletAddress,
        startTime: COMPETITION_START.getTime(),
        endTime: Date.now(),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      return [];
    }

    // Filter for deposits and withdrawals only (exclude subAccountTransfer, liquidation, etc.)
    return data.filter((update) => {
      const hash = update.hash;
      // Deposits have format: 0x{txHash}:deposit
      // Withdrawals have format: 0x{txHash}:withdraw
      // SubAccount transfers have format: 0x0000...0000:{walletAddress}
      return (
        (hash.includes(":deposit") || hash.includes(":withdraw")) &&
        !hash.includes(
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        )
      );
    });
  } catch (error) {
    console.error(
      `Error fetching transfers for ${walletAddress}:`,
      error.message,
    );
    return [];
  }
}

/**
 * Check account summary for current equity
 */
async function fetchAccountSummary(walletAddress) {
  try {
    const response = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "clearinghouseState",
        user: walletAddress,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      accountValue: parseFloat(data.marginSummary?.accountValue || 0),
      withdrawable: parseFloat(data.marginSummary?.withdrawable || 0),
      positionsCount: data.assetPositions?.length || 0,
    };
  } catch (error) {
    console.error(
      `Error fetching account for ${walletAddress}:`,
      error.message,
    );
    return { accountValue: 0, withdrawable: 0, positionsCount: 0 };
  }
}

/**
 * Format transfer for display
 */
function formatTransfer(transfer) {
  const timestamp = new Date(transfer.time);
  const amount = parseFloat(transfer.delta.usd);
  const type = transfer.hash.includes(":deposit") ? "DEPOSIT" : "WITHDRAW";
  const fee = parseFloat(transfer.fee || 0);

  return {
    type,
    amount: amount.toFixed(2),
    fee: fee.toFixed(2),
    netAmount: (amount - fee).toFixed(2),
    timestamp: timestamp.toISOString(),
    hash: transfer.hash,
  };
}

/**
 * Main monitoring function
 */
async function monitorAgents() {
  console.log("==================================================");
  console.log("Hyperliquid Transfer Monitoring Report");
  console.log(`Competition: ${COMPETITION_ID}`);
  console.log(`Competition Start: ${COMPETITION_START.toISOString()}`);
  console.log(`Current Time: ${new Date().toISOString()}`);
  console.log(`Monitoring ${LEGITIMATE_AGENTS.length} agents`);
  console.log("==================================================\\n");

  let totalViolations = 0;
  const violatingAgents = [];

  for (const agent of LEGITIMATE_AGENTS) {
    console.log(`\\nChecking: ${agent.name} (${agent.wallet})`);

    // Fetch account summary
    const summary = await fetchAccountSummary(agent.wallet);
    console.log(
      `  Current equity: $${summary.accountValue.toFixed(2)}, Positions: ${summary.positionsCount}`,
    );

    // Fetch transfers
    const transfers = await fetchTransferHistory(agent.wallet);

    if (transfers.length > 0) {
      console.log(
        `  ⚠️  VIOLATION DETECTED: ${transfers.length} transfer(s) after competition start`,
      );
      totalViolations++;
      violatingAgents.push({
        ...agent,
        transfers: transfers.map(formatTransfer),
        currentEquity: summary.accountValue,
      });

      // Display transfer details
      transfers.forEach((transfer) => {
        const formatted = formatTransfer(transfer);
        console.log(
          `     - ${formatted.type}: $${formatted.amount} at ${formatted.timestamp}`,
        );
      });
    } else {
      console.log(`  ✓ No violations detected`);
    }

    // Rate limiting - wait 200ms between API calls
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log("\\n==================================================");
  console.log("SUMMARY");
  console.log("==================================================");
  console.log(`Total agents monitored: ${LEGITIMATE_AGENTS.length}`);
  console.log(`Violations found: ${totalViolations}`);

  if (violatingAgents.length > 0) {
    console.log("\\nViolating Agents:");
    violatingAgents.forEach((agent) => {
      const totalDeposits = agent.transfers
        .filter((t) => t.type === "DEPOSIT")
        .reduce((sum, t) => sum + parseFloat(t.netAmount), 0);
      const totalWithdrawals = agent.transfers
        .filter((t) => t.type === "WITHDRAW")
        .reduce((sum, t) => sum + parseFloat(t.netAmount), 0);

      console.log(`  - ${agent.name} (${agent.agentId})`);
      console.log(
        `    Deposits: $${totalDeposits.toFixed(2)}, Withdrawals: $${totalWithdrawals.toFixed(2)}`,
      );
      console.log(`    Current Equity: $${agent.currentEquity.toFixed(2)}`);
    });
  }

  // Save violations to file for further processing
  if (violatingAgents.length > 0) {
    const fs = require("fs");
    const reportFile = `transfer-violations-${Date.now()}.json`;
    fs.writeFileSync(
      reportFile,
      JSON.stringify(
        {
          competitionId: COMPETITION_ID,
          competitionStart: COMPETITION_START,
          reportTime: new Date(),
          violations: violatingAgents,
        },
        null,
        2,
      ),
    );
    console.log(`\\nDetailed report saved to: ${reportFile}`);
  }

  console.log("\\n==================================================\\n");
}

// Run monitoring
if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const continuous = args.includes("--continuous") || args.includes("-c");
  const interval = parseInt(
    args.find((arg) => arg.startsWith("--interval="))?.split("=")[1] || "300",
  ); // Default 5 minutes

  if (continuous) {
    console.log(
      `Running in continuous mode, checking every ${interval} seconds\\n`,
    );
    monitorAgents(); // Run immediately
    setInterval(monitorAgents, interval * 1000);
  } else {
    monitorAgents()
      .then(() => {
        console.log("Monitoring complete");
      })
      .catch((error) => {
        console.error("Error during monitoring:", error);
        process.exit(1);
      });
  }
}

module.exports = { monitorAgents, fetchTransferHistory, fetchAccountSummary };
