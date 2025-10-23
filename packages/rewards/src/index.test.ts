import { describe, expect, it } from "vitest";

import {
  calculateRewardsForCompetitors,
  calculateRewardsForUsers,
} from "./index.js";
import type {
  BoostAllocation,
  BoostAllocationWindow,
  Leaderboard,
} from "./types.js";

describe("calculate rewards for users", () => {
  it("should calculate rewards correctly for 1000 ETH prize pool with 3 users and 3 competitors over 4-day window", () => {
    // Test parameters from testcase.md
    const prizePool = 1000n * 10n ** 18n; // 1000 ETH in WEI
    const leaderBoard: Leaderboard = [
      {
        competitor: "Competitor A",
        wallet: "0x1234567890123456789012345678901234567890",
        rank: 1,
        owner: "owner-a",
      },
      {
        competitor: "Competitor B",
        wallet: "0x2345678901234567890123456789012345678901",
        rank: 2,
        owner: "owner-b",
      },
      {
        competitor: "Competitor C",
        wallet: "0x3456789012345678901234567890123456789012",
        rank: 3,
        owner: "owner-c",
      },
    ];
    const window: BoostAllocationWindow = {
      start: new Date("2024-01-01T00:00:00Z"),
      end: new Date("2024-01-05T00:00:00Z"),
    };

    // Boost allocations from testcase.md
    const boostAllocations: BoostAllocation[] = [
      // Alice's allocations
      {
        user_id: "alice-id",
        user_wallet: "Alice",
        competitor: "Competitor A",
        boost: 100n,
        timestamp: new Date("2024-01-01T12:00:00Z"), // Day 1: decay factor 1.0
      },
      {
        user_id: "alice-id",
        user_wallet: "Alice",
        competitor: "Competitor B",
        boost: 50n,
        timestamp: new Date("2024-01-02T18:00:00Z"), // Day 2: decay factor 0.5
      },
      {
        user_id: "alice-id",
        user_wallet: "Alice",
        competitor: "Competitor C",
        boost: 75n,
        timestamp: new Date("2024-01-03T09:00:00Z"), // Day 3: decay factor 0.25
      },

      // Bob's allocations
      {
        user_id: "bob-id",
        user_wallet: "Bob",
        competitor: "Competitor A",
        boost: 80n,
        timestamp: new Date("2024-01-01T15:00:00Z"), // Day 1: decay factor 1.0
      },
      {
        user_id: "bob-id",
        user_wallet: "Bob",
        competitor: "Competitor A",
        boost: 40n,
        timestamp: new Date("2024-01-02T10:00:00Z"), // Day 2: decay factor 0.5
      },
      {
        user_id: "bob-id",
        user_wallet: "Bob",
        competitor: "Competitor B",
        boost: 120n,
        timestamp: new Date("2024-01-01T20:00:00Z"), // Day 1: decay factor 1.0
      },
      {
        user_id: "bob-id",
        user_wallet: "Bob",
        competitor: "Competitor C",
        boost: 60n,
        timestamp: new Date("2024-01-04T14:00:00Z"), // Day 4: decay factor 0.125
      },

      // Charlie's allocations
      {
        user_id: "charlie-id",
        user_wallet: "Charlie",
        competitor: "Competitor B",
        boost: 90n,
        timestamp: new Date("2024-01-02T12:00:00Z"), // Day 2: decay factor 0.5
      },
      {
        user_id: "charlie-id",
        user_wallet: "Charlie",
        competitor: "Competitor C",
        boost: 200n,
        timestamp: new Date("2024-01-01T08:00:00Z"), // Day 1: decay factor 1.0
      },
      {
        user_id: "charlie-id",
        user_wallet: "Charlie",
        competitor: "Competitor C",
        boost: 30n,
        timestamp: new Date("2024-01-03T16:00:00Z"), // Day 3: decay factor 0.25
      },
    ];

    // Calculate rewards
    const rewards = calculateRewardsForUsers(
      prizePool,
      boostAllocations,
      leaderBoard,
      window,
      0.5,
      0.5,
    );

    // Verify the results structure
    expect(rewards).toHaveLength(3);

    // Sort by address to ensure consistent ordering for comparison
    const sortedRewards = rewards.sort((a, b) =>
      a.address.localeCompare(b.address),
    );

    // Verify all users are present
    const addresses = sortedRewards.map((r) => r.address);
    expect(addresses).toContain("Alice");
    expect(addresses).toContain("Bob");
    expect(addresses).toContain("Charlie");

    // Verify that rewards were distributed (total should be positive)
    const totalDistributed = rewards.reduce(
      (sum, reward) => sum + reward.amount,
      0n,
    );
    expect(totalDistributed).toBeGreaterThan(0n);
    expect(totalDistributed).toBeLessThanOrEqual(prizePool);

    // Verify all rewards are positive
    rewards.forEach((reward) => {
      expect(reward.amount).toBeGreaterThan(0n);
    });

    // Verify Bob gets the highest reward (he has the most effective boost)
    const bobReward = rewards.find((r) => r.address === "Bob")!;
    const aliceReward = rewards.find((r) => r.address === "Alice")!;
    const charlieReward = rewards.find((r) => r.address === "Charlie")!;

    expect(aliceReward.amount).eq(294551339071887017092n);
    expect(aliceReward.owner).eq("alice-id");
    expect(bobReward.amount).eq(394543812352031530113n);
    expect(bobReward.owner).eq("bob-id");
    expect(charlieReward.amount).eq(130663856691253951527n);
    expect(charlieReward.owner).eq("charlie-id");
  });

  it("should calculate rewards correctly for 1000 ETH prize pool with 3 users and 3 competitors over 4-day window with no decay", () => {
    // Test parameters from testcase.md
    const prizePool = 1000n * 10n ** 18n; // 1000 ETH in WEI
    const leaderBoard: Leaderboard = [
      {
        competitor: "Competitor A",
        wallet: "0x1234567890123456789012345678901234567890",
        rank: 1,
        owner: "owner-a",
      },
      {
        competitor: "Competitor B",
        wallet: "0x2345678901234567890123456789012345678901",
        rank: 2,
        owner: "owner-b",
      },
      {
        competitor: "Competitor C",
        wallet: "0x3456789012345678901234567890123456789012",
        rank: 3,
        owner: "owner-c",
      },
    ];
    const window: BoostAllocationWindow = {
      start: new Date("2024-01-01T00:00:00Z"),
      end: new Date("2024-01-05T00:00:00Z"),
    };

    // Boost allocations from testcase.md
    const boostAllocations: BoostAllocation[] = [
      // Alice's allocations
      {
        user_id: "alice-id",
        user_wallet: "Alice",
        competitor: "Competitor A",
        boost: 100n,
        timestamp: new Date("2024-01-01T12:00:00Z"), // Day 1: decay factor 1.0
      },
      {
        user_id: "alice-id",
        user_wallet: "Alice",
        competitor: "Competitor B",
        boost: 50n,
        timestamp: new Date("2024-01-02T18:00:00Z"), // Day 2: decay factor 0.5
      },
      {
        user_id: "alice-id",
        user_wallet: "Alice",
        competitor: "Competitor C",
        boost: 75n,
        timestamp: new Date("2024-01-03T09:00:00Z"), // Day 3: decay factor 0.25
      },

      // Bob's allocations
      {
        user_id: "bob-id",
        user_wallet: "Bob",
        competitor: "Competitor A",
        boost: 80n,
        timestamp: new Date("2024-01-01T15:00:00Z"), // Day 1: decay factor 1.0
      },
      {
        user_id: "bob-id",
        user_wallet: "Bob",
        competitor: "Competitor A",
        boost: 40n,
        timestamp: new Date("2024-01-02T10:00:00Z"), // Day 2: decay factor 0.5
      },
      {
        user_id: "bob-id",
        user_wallet: "Bob",
        competitor: "Competitor B",
        boost: 120n,
        timestamp: new Date("2024-01-01T20:00:00Z"), // Day 1: decay factor 1.0
      },
      {
        user_id: "bob-id",
        user_wallet: "Bob",
        competitor: "Competitor C",
        boost: 60n,
        timestamp: new Date("2024-01-04T14:00:00Z"), // Day 4: decay factor 0.125
      },

      // Charlie's allocations
      {
        user_id: "charlie-id",
        user_wallet: "Charlie",
        competitor: "Competitor B",
        boost: 90n,
        timestamp: new Date("2024-01-02T12:00:00Z"), // Day 2: decay factor 0.5
      },
      {
        user_id: "charlie-id",
        user_wallet: "Charlie",
        competitor: "Competitor C",
        boost: 200n,
        timestamp: new Date("2024-01-01T08:00:00Z"), // Day 1: decay factor 1.0
      },
      {
        user_id: "charlie-id",
        user_wallet: "Charlie",
        competitor: "Competitor C",
        boost: 30n,
        timestamp: new Date("2024-01-03T16:00:00Z"), // Day 3: decay factor 0.25
      },
    ];

    // Calculate rewards
    const rewards = calculateRewardsForUsers(
      prizePool,
      boostAllocations,
      leaderBoard,
      window,
    );

    // Verify the results structure
    expect(rewards).toHaveLength(3);

    // Sort by address to ensure consistent ordering for comparison
    const sortedRewards = rewards.sort((a, b) =>
      a.address.localeCompare(b.address),
    );

    // Verify all users are present
    const addresses = sortedRewards.map((r) => r.address);
    expect(addresses).toContain("Alice");
    expect(addresses).toContain("Bob");
    expect(addresses).toContain("Charlie");

    // Verify that rewards were distributed (total should be positive)
    const totalDistributed = rewards.reduce(
      (sum, reward) => sum + reward.amount,
      0n,
    );
    expect(totalDistributed).toBeGreaterThan(0n);
    expect(totalDistributed).toBeLessThanOrEqual(prizePool);

    // Verify all rewards are positive
    rewards.forEach((reward) => {
      expect(reward.amount).toBeGreaterThan(0n);
    });

    // Verify Bob gets the highest reward (he has the most effective boost)
    const bobReward = rewards.find((r) => r.address === "Bob")!;
    const aliceReward = rewards.find((r) => r.address === "Alice")!;
    const charlieReward = rewards.find((r) => r.address === "Charlie")!;

    expect(aliceReward.amount).eq(344039522121713902535n);
    expect(aliceReward.owner).eq("alice-id");
    expect(bobReward.amount).eq(467039809505562930220n);
    expect(bobReward.owner).eq("bob-id");
    expect(charlieReward.amount).eq(188920668372723167243n);
    expect(charlieReward.owner).eq("charlie-id");
  });
});

describe("calculate rewards for users", () => {
  // Add edge case tests to improve branch coverage
  it("should return empty array when leaderBoard is empty", () => {
    const prizePool = 1000n * 10n ** 18n;
    const boostAllocations = [
      {
        user_id: "alice-id",
        user_wallet: "Alice",
        competitor: "A",
        boost: 100n,
        timestamp: new Date(),
      },
    ];
    const window = {
      start: new Date("2024-01-01T00:00:00Z"),
      end: new Date("2024-01-05T00:00:00Z"),
    };

    const rewards = calculateRewardsForUsers(
      prizePool,
      boostAllocations,
      [],
      window,
    );
    expect(rewards).toEqual([]);
  });

  it("should return empty array when boostAllocations is empty", () => {
    const prizePool = 1000n * 10n ** 18n;
    const leaderBoard = [
      {
        competitor: "A",
        wallet: "0x1234567890123456789012345678901234567890",
        rank: 1,
        owner: "owner-a",
      },
    ];
    const window = {
      start: new Date("2024-01-01T00:00:00Z"),
      end: new Date("2024-01-05T00:00:00Z"),
    };

    const rewards = calculateRewardsForUsers(
      prizePool,
      [],
      leaderBoard,
      window,
    );
    expect(rewards).toEqual([]);
  });

  it("should throw error when window end is before start", () => {
    const prizePool = 1000n * 10n ** 18n;
    const boostAllocations = [
      {
        user_id: "alice-id",
        user_wallet: "Alice",
        competitor: "A",
        boost: 100n,
        timestamp: new Date(),
      },
    ];
    const leaderBoard = [
      {
        competitor: "A",
        wallet: "0x1234567890123456789012345678901234567890",
        rank: 1,
        owner: "owner-a",
      },
    ];
    const window = {
      start: new Date("2024-01-05T00:00:00Z"),
      end: new Date("2024-01-01T00:00:00Z"), // end before start
    };

    expect(() =>
      calculateRewardsForUsers(
        prizePool,
        boostAllocations,
        leaderBoard,
        window,
      ),
    ).toThrow("Invalid boost allocation window");
  });

  it("should throw error when prizePoolDecayRate is too low", () => {
    const prizePool = 1000n * 10n ** 18n;
    const boostAllocations = [
      {
        user_id: "alice-id",
        user_wallet: "Alice",
        competitor: "A",
        boost: 100n,
        timestamp: new Date(),
      },
    ];
    const leaderBoard = [
      {
        competitor: "A",
        wallet: "0x1234567890123456789012345678901234567890",
        rank: 1,
        owner: "owner-a",
      },
    ];
    const window = {
      start: new Date("2024-01-01T00:00:00Z"),
      end: new Date("2024-01-05T00:00:00Z"),
    };

    expect(() =>
      calculateRewardsForUsers(
        prizePool,
        boostAllocations,
        leaderBoard,
        window,
        0.05,
      ),
    ).toThrow("Invalid prize pool decay rate");
  });

  it("should throw error when prizePoolDecayRate is too high", () => {
    const prizePool = 1000n * 10n ** 18n;
    const boostAllocations = [
      {
        user_id: "alice-id",
        user_wallet: "Alice",
        competitor: "A",
        boost: 100n,
        timestamp: new Date(),
      },
    ];
    const leaderBoard = [
      {
        competitor: "A",
        wallet: "0x1234567890123456789012345678901234567890",
        rank: 1,
        owner: "owner-a",
      },
    ];
    const window = {
      start: new Date("2024-01-01T00:00:00Z"),
      end: new Date("2024-01-05T00:00:00Z"),
    };

    expect(() =>
      calculateRewardsForUsers(
        prizePool,
        boostAllocations,
        leaderBoard,
        window,
        0.95,
      ),
    ).toThrow("Invalid prize pool decay rate");
  });

  it("should throw error when boostTimeDecayRate is too low", () => {
    const prizePool = 1000n * 10n ** 18n;
    const boostAllocations = [
      {
        user_id: "alice-id",
        user_wallet: "Alice",
        competitor: "A",
        boost: 100n,
        timestamp: new Date(),
      },
    ];
    const leaderBoard = [
      {
        competitor: "A",
        wallet: "0x1234567890123456789012345678901234567890",
        rank: 1,
        owner: "owner-a",
      },
    ];
    const window = {
      start: new Date("2024-01-01T00:00:00Z"),
      end: new Date("2024-01-05T00:00:00Z"),
    };

    expect(() =>
      calculateRewardsForUsers(
        prizePool,
        boostAllocations,
        leaderBoard,
        window,
        0.5,
        0.05,
      ),
    ).toThrow("Invalid boost time decay rate");
  });

  it("should throw error when boostTimeDecayRate is too high", () => {
    const prizePool = 1000n * 10n ** 18n;
    const boostAllocations = [
      {
        user_id: "alice-id",
        user_wallet: "Alice",
        competitor: "A",
        boost: 100n,
        timestamp: new Date(),
      },
    ];
    const leaderBoard = [
      {
        competitor: "A",
        wallet: "0x1234567890123456789012345678901234567890",
        rank: 1,
        owner: "owner-a",
      },
    ];
    const window = {
      start: new Date("2024-01-01T00:00:00Z"),
      end: new Date("2024-01-05T00:00:00Z"),
    };

    expect(() =>
      calculateRewardsForUsers(
        prizePool,
        boostAllocations,
        leaderBoard,
        window,
        0.5,
        0.95,
      ),
    ).toThrow("Invalid boost time decay rate");
  });

  it("should handle users who boosted for competitors not in leaderboard (disqualified/removed)", () => {
    const prizePool = 1000n * 10n ** 18n; // 1000 ETH in WEI
    const leaderBoard: Leaderboard = [
      {
        competitor: "Competitor A",
        wallet: "0x1234567890123456789012345678901234567890",
        rank: 1,
        owner: "owner-a",
      },
      {
        competitor: "Competitor B",
        wallet: "0x2345678901234567890123456789012345678901",
        rank: 2,
        owner: "owner-b",
      },
    ];
    const window: BoostAllocationWindow = {
      start: new Date("2024-01-01T00:00:00Z"),
      end: new Date("2024-01-05T00:00:00Z"),
    };

    // Boost allocations where some users boosted for competitors not in the leaderboard
    const boostAllocations: BoostAllocation[] = [
      // Alice boosted valid competitors
      {
        user_id: "alice-id",
        user_wallet: "Alice",
        competitor: "Competitor A",
        boost: 100n,
        timestamp: new Date("2024-01-01T12:00:00Z"),
      },
      {
        user_id: "alice-id",
        user_wallet: "Alice",
        competitor: "Competitor B",
        boost: 50n,
        timestamp: new Date("2024-01-02T12:00:00Z"),
      },

      // Bob boosted a valid competitor and a disqualified one
      {
        user_id: "bob-id",
        user_wallet: "Bob",
        competitor: "Competitor A",
        boost: 80n,
        timestamp: new Date("2024-01-01T12:00:00Z"),
      },
      {
        user_id: "bob-id",
        user_wallet: "Bob",
        competitor: "Disqualified Competitor", // This competitor is not in leaderboard
        boost: 120n,
        timestamp: new Date("2024-01-02T12:00:00Z"),
      },

      // Charlie only boosted disqualified competitors
      {
        user_id: "charlie-id",
        user_wallet: "Charlie",
        competitor: "Removed Competitor", // This competitor is not in leaderboard
        boost: 200n,
        timestamp: new Date("2024-01-01T12:00:00Z"),
      },
      {
        user_id: "charlie-id",
        user_wallet: "Charlie",
        competitor: "Another Disqualified", // This competitor is not in leaderboard
        boost: 150n,
        timestamp: new Date("2024-01-02T12:00:00Z"),
      },
    ];

    // Calculate rewards - should not throw an error
    const rewards = calculateRewardsForUsers(
      prizePool,
      boostAllocations,
      leaderBoard,
      window,
      0.5,
      0.5,
    );

    // Verify the results structure
    expect(rewards).toHaveLength(2); // Only Alice and Bob should get rewards

    // Sort by address to ensure consistent ordering for comparison
    const sortedRewards = rewards.sort((a, b) =>
      a.address.localeCompare(b.address),
    );

    // Verify only users who boosted for valid competitors get rewards
    const addresses = sortedRewards.map((r) => r.address);
    expect(addresses).toContain("Alice");
    expect(addresses).toContain("Bob");
    expect(addresses).not.toContain("Charlie"); // Charlie should not get rewards

    // Verify that rewards were distributed (total should be positive)
    const totalDistributed = rewards.reduce(
      (sum, reward) => sum + reward.amount,
      0n,
    );
    expect(totalDistributed).toBeGreaterThan(0n);
    expect(totalDistributed).toBeLessThanOrEqual(prizePool);

    // Verify all rewards are positive
    rewards.forEach((reward) => {
      expect(reward.amount).toBeGreaterThan(0n);
    });

    // Verify Alice gets more reward than Bob since Bob's boost to disqualified competitor is ignored
    const aliceReward = rewards.find((r) => r.address === "Alice")!;
    const bobReward = rewards.find((r) => r.address === "Bob")!;

    // Alice has 100 + 50 = 150 total boost, Bob has only 80 (120 to disqualified is ignored)
    expect(aliceReward.amount).toBeGreaterThan(bobReward.amount);
  });
});

describe("calculate rewards for competitors", () => {
  it("should return empty array when leaderBoard is empty", () => {
    const prizePool = 1000n * 10n ** 18n;
    const rewards = calculateRewardsForCompetitors(prizePool, []);
    expect(rewards).toEqual([]);
  });

  it("should throw error when prizePoolDecayRate is invalid for competitors", () => {
    const prizePool = 1000n * 10n ** 18n;
    const leaderBoard = [
      {
        competitor: "A",
        wallet: "0x1234567890123456789012345678901234567890",
        rank: 1,
        owner: "owner-a",
      },
    ];

    expect(() =>
      calculateRewardsForCompetitors(prizePool, leaderBoard, 0.05),
    ).toThrow("Invalid prize pool decay rate");
  });

  it("should calculate rewards correctly for 1000 ETH prize pool with 3 competitors", () => {
    const prizePool = 1000n * 10n ** 18n; // 1000 ETH in WEI
    const leaderBoard: Leaderboard = [
      {
        competitor: "Competitor A",
        wallet: "0x1234567890123456789012345678901234567890",
        rank: 1,
        owner: "owner-a",
      },
      {
        competitor: "Competitor B",
        wallet: "0x2345678901234567890123456789012345678901",
        rank: 2,
        owner: "owner-b",
      },
      {
        competitor: "Competitor C",
        wallet: "0x3456789012345678901234567890123456789012",
        rank: 3,
        owner: "owner-c",
      },
    ];
    const rewards = calculateRewardsForCompetitors(prizePool, leaderBoard);

    // Verify the results structure
    expect(rewards).toHaveLength(3);

    // Sort by address to ensure consistent ordering for comparison
    const sortedRewards = rewards.sort((a, b) =>
      a.address.localeCompare(b.address),
    );

    // Verify all competitors are present
    const addresses = sortedRewards.map((r) => r.address);
    expect(addresses).toContain("0x1234567890123456789012345678901234567890");
    expect(addresses).toContain("0x2345678901234567890123456789012345678901");
    expect(addresses).toContain("0x3456789012345678901234567890123456789012");

    // Verify that rewards were distributed (total should be approximately equal to prize pool)
    const totalDistributed = rewards.reduce(
      (sum, reward) => sum + reward.amount,
      0n,
    );
    // Allow for small rounding differences due to ROUND_DOWN
    expect(totalDistributed).toBeGreaterThan(prizePool - 10n);
    expect(totalDistributed).toBeLessThanOrEqual(prizePool);

    // Verify all rewards are positive
    rewards.forEach((reward) => {
      expect(reward.amount).toBeGreaterThan(0n);
    });

    // Verify rank 1 gets the highest reward, rank 2 gets second highest, etc.
    const competitorAReward = rewards.find(
      (r) => r.address === "0x1234567890123456789012345678901234567890",
    )!;
    const competitorBReward = rewards.find(
      (r) => r.address === "0x2345678901234567890123456789012345678901",
    )!;
    const competitorCReward = rewards.find(
      (r) => r.address === "0x3456789012345678901234567890123456789012",
    )!;

    expect(competitorAReward.amount).toBeGreaterThan(competitorBReward.amount);
    expect(competitorBReward.amount).toBeGreaterThan(competitorCReward.amount);

    // Verify specific expected values based on decay rate of 0.5
    // With decay rate 0.5 and 3 competitors:
    // Rank 1: ~57.14% of prize pool = ~571.43 ETH
    // Rank 2: ~28.57% of prize pool = ~285.71 ETH
    // Rank 3: ~14.29% of prize pool = ~142.86 ETH
    expect(competitorAReward.amount).toBe(571428571428571428571n);
    expect(competitorAReward.owner).toBe("owner-a");
    expect(competitorAReward.competitor).toBe("Competitor A");
    expect(competitorBReward.amount).toBe(285714285714285714285n);
    expect(competitorBReward.owner).toBe("owner-b");
    expect(competitorBReward.competitor).toBe("Competitor B");
    expect(competitorCReward.amount).toBe(142857142857142857142n);
    expect(competitorCReward.owner).toBe("owner-c");
    expect(competitorCReward.competitor).toBe("Competitor C");
  });

  it("should calculate rewards correctly for 1000 ETH prize pool with ties in rankings", () => {
    const prizePool = 1000n * 10n ** 18n; // 1000 ETH in WEI
    const leaderBoard: Leaderboard = [
      {
        competitor: "Competitor A",
        wallet: "0x1234567890123456789012345678901234567890",
        rank: 1,
        owner: "owner-a",
      },
      {
        competitor: "Competitor B",
        wallet: "0x2345678901234567890123456789012345678901",
        rank: 1,
        owner: "owner-b",
      }, // Tie for first place
      {
        competitor: "Competitor C",
        wallet: "0x3456789012345678901234567890123456789012",
        rank: 3,
        owner: "owner-c",
      },
    ];

    const rewards = calculateRewardsForCompetitors(prizePool, leaderBoard);

    // Verify the results structure
    expect(rewards).toHaveLength(3);

    // Sort by address to ensure consistent ordering for comparison
    const sortedRewards = rewards.sort((a, b) =>
      a.address.localeCompare(b.address),
    );

    // Verify all competitors are present
    const addresses = sortedRewards.map((r) => r.address);
    expect(addresses).toContain("0x1234567890123456789012345678901234567890");
    expect(addresses).toContain("0x2345678901234567890123456789012345678901");
    expect(addresses).toContain("0x3456789012345678901234567890123456789012");

    // Verify that rewards were distributed (total should be approximately equal to prize pool)
    const totalDistributed = rewards.reduce(
      (sum, reward) => sum + reward.amount,
      0n,
    );
    // Allow for small rounding differences due to ROUND_DOWN
    expect(totalDistributed).toBeGreaterThan(prizePool - 10n);
    expect(totalDistributed).toBeLessThanOrEqual(prizePool);

    // Verify all rewards are positive
    rewards.forEach((reward) => {
      expect(reward.amount).toBeGreaterThan(0n);
    });

    // Verify tied competitors get equal rewards
    const competitorAReward = rewards.find(
      (r) => r.address === "0x1234567890123456789012345678901234567890",
    )!;
    const competitorBReward = rewards.find(
      (r) => r.address === "0x2345678901234567890123456789012345678901",
    )!;
    const competitorCReward = rewards.find(
      (r) => r.address === "0x3456789012345678901234567890123456789012",
    )!;

    // Tied competitors should get equal rewards
    expect(competitorAReward.amount).toBe(competitorBReward.amount);

    // Third place should get less than the tied first place competitors
    expect(competitorAReward.amount).toBeGreaterThan(competitorCReward.amount);
    expect(competitorBReward.amount).toBeGreaterThan(competitorCReward.amount);

    // Verify specific expected values based on decay rate of 0.5 with ties:
    // Rank 1 (tied): ~42.86% each = ~428.57 ETH each
    // Rank 3: ~14.29% = ~142.86 ETH
    expect(competitorAReward.amount).toBe(428571428571428571428n);
    expect(competitorAReward.owner).toBe("owner-a");
    expect(competitorAReward.competitor).toBe("Competitor A");
    expect(competitorBReward.amount).toBe(428571428571428571428n);
    expect(competitorBReward.owner).toBe("owner-b");
    expect(competitorBReward.competitor).toBe("Competitor B");
    expect(competitorCReward.amount).toBe(142857142857142857142n);
    expect(competitorCReward.owner).toBe("owner-c");
    expect(competitorCReward.competitor).toBe("Competitor C");
  });
});
