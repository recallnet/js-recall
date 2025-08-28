# Model

## 1. Define the prize split across placements

Let the total rewards pool be $X$. Pay only the top $k$ competitors, with a simple decay:

- Choose a decay parameter $r \in (0, 1)$ (lower $r$ = steeper decay)
- Unnormalized weights: $u_i = r^{i - 1}$ for rank $i = 1..k$
- Normalized weights

$$
w_i = \frac{u_i}{\sum_{j=1}^{k} u_j}
        = \frac{(1-r)\,r^{\,i-1}}{1-r^{k}}
$$

- Pool for placement $i$: $Pool_i = X \cdot w_i$

### Example

$X=1000, k=10, r=0.5$

| Rank i | w_i     | Pool_i ($) |
| ------ | ------- | ---------- |
| 1      | 0.50195 | 501.95     |
| 2      | 0.25098 | 250.98     |
| 3      | 0.12549 | 125.49     |
| 4      | 0.06274 | 62.74      |
| 5      | 0.03122 | 31.22      |
| 6      | 0.01562 | 15.62      |
| 7      | 0.00781 | 7.81       |
| 8      | 0.00391 | 3.91       |
| 9      | 0.00195 | 1.95       |
| 10     | 0.00098 | 0.98       |

## 2 Distribute each placement’s pool to its voters

For the competitor who finished at placement $i$:

- Let $B_i = \sum_{u}{b_{u,i}}$ be the total boost they received
- A user $u$ who boosted that competitor with $b_{u,i}$ earns:

$$
\text{Payout}_{u,i} =\begin{cases}\text{Pool}_i \cdot \dfrac{b_{u,i}}{B_i}, & \text{if } B_i>0 \\[2mm]0, & \text{if } B_i=0\end{cases}
$$

- A user’s total payout is

$$
Payout_u = \sum_{i = 1}^{k}{Payout_{u, i}}
$$

### Example

Boost allocation per competitor

| Competitor | User A | User B | User C | Total Boost |
| ---------- | ------ | ------ | ------ | ----------- |
| 1          | 30     | 50     | 20     | 100         |
| 2          | 10     | 30     | 10     | 50          |
| 3          | 5      | 10     | 5      | 20          |
| 4          | 2      | 3      | 5      | 10          |
| 5          | 1      | 2      | 1      | 4           |
| 6          | 0      | 1      | 1      | 2           |
| 7          | 1      | 1      | 0      | 2           |
| 8          | 0      | 0      | 1      | 1           |
| 9          | 0      | 1      | 0      | 1           |
| 10         | 0      | 0      | 1      | 1           |

Payouts per placement

| Rank | Pool   | User A | User B | User C |
| ---- | ------ | ------ | ------ | ------ |
| 1    | 501.95 | 150.6  | 250.98 | 100.39 |
| 2    | 250.98 | 50.20  | 150.59 | 50.20  |
| 3    | 125.49 | 31.37  | 62.74  | 31.37  |
| 4    | 62.74  | 12.55  | 18.82  | 31.37  |
| 5    | 31.22  | 7.81   | 15.61  | 7.81   |
| 6    | 15.62  | 0      | 7.81   | 7.81   |
| 7    | 7.81   | 3.91   | 3.91   | 0      |
| 8    | 3.91   | 0      | 0      | 3.91   |
| 9    | 1.95   | 0      | 1.95   | 0      |
| 10   | 0.98   | 0      | 0      | 0.98   |

Total payouts

| User | Total Payout |
| ---- | ------------ |
| A    | 255.53       |
| B    | 612.40       |
| C    | 132.07       |

### 2.1 Time-Based Boost Decay

This extension incorporates a time factor that decreases the value of boosts as time progresses. We apply a geometric decay weight $w_d$ to the value of boosts

$$
w_d = q ^{d - 1}, q \in (0, 1]
$$

Example of a 7-day competition with $q = 0.7$

| d   | w_d      |
| --- | -------- |
| 1   | 1        |
| 2   | 0.7      |
| 3   | 0.49     |
| 4   | 0.343    |
| 5   | 0.2401   |
| 6   | 0.16807  |
| 7   | 0.117649 |

That lead us to a new value $b_{u,i,d}$, an user $u$ who boosted a competitor $i$ with $b_{u,i}$ at day $d$,

$$
b_{u,i,d} = b_{u,i} \cdot w_d
$$

You can see that at $d = 1$ (first day), $b_{u,i,d} = b_{u,i}$, that is, all of your boosts will be used to affect your payout. This means if **everyone only allocates boosts on the first day**, we revert to the scenario described in section **2**.

With that, $Payout_{u,i}$ becomes

$$
\text{Payout}_{u,i} =\begin{cases}\text{Pool}_i \cdot \dfrac{\sum_{d=1}^{N}{b_{u,i,d}}}{B_i}, & \text{if } B_i>0 \\[2mm]0, & \text{if } B_i=0\end{cases}
$$

where $N$ is the last day of the competition. In this setting, the sum of payouts does not equal to the total pool of rewards:

$$
\sum_u{Payout_u} \neq X
$$

It means people can only get the theoretical maximum if they allocated all boost on day one.

# Appendix

## Parameters and knobs

- Prize pool: $X$
- The number $k$ of competitors among whom the prize pool is distributed
- Decays $r$, $q$

## **Properties of the System**

- **Fairness:** Users are rewarded in proportion to how much they contributed to the winners.
- **Top-heavy rewards:** The geometric decay ensures higher-ranked competitors get a larger share of the pool.
- **Transparency:** Calculations are deterministic and easily verifiable.
- **Flexible:** You can adjust the decay factor $r$ or the number of rewarded placements $k$ to tune competitiveness.
- **Time-based:** You earn higher rewards by correctly predicting winners earlier

## Code for the above calculations

```python
# Pseudocode: Top-k proportional boost payout system

X = 1000       # Total reward pool
k = 10         # Top-k placements
r = 0.5        # Decay factor

# Example results: list of competitor IDs in rank order
results = ["C1","C2","C3","C4","C5","C6","C7","C8","C9","C10"]

# Example boosts: dictionary {competitor_id: {user_id: boost_amount}}
boosts = {
    "C1": {"A": 30, "B": 50, "C": 20},
    "C2": {"A": 10, "B": 30, "C": 10},
    "C3": {"A": 5,  "B": 10, "C": 5},
    "C4": {"A": 2,  "B": 3,  "C": 5},
    "C5": {"A": 1,  "B": 2,  "C": 1},
    "C6": {"A": 0,  "B": 1,  "C": 1},
    "C7": {"A": 1,  "B": 1,  "C": 0},
    "C8": {"A": 0,  "B": 0,  "C": 1},
    "C9": {"A": 0,  "B": 1,  "C": 0},
    "C10":{"A": 0,  "B": 0,  "C": 1},
}

# Step 1: compute placement pools
unnormalized_weights = [r**i for i in range(k)]
total_weight = sum(unnormalized_weights)
placement_pools = [X * (w / total_weight) for w in unnormalized_weights]

# Step 2: distribute each placement's pool to voters
user_payouts = {}  # {user_id: total_payout}

for rank in range(k):
    competitor = results[rank]
    pool = placement_pools[rank]

    # total boost for this competitor
    comp_boosts = boosts.get(competitor, {})
    total_boost = sum(comp_boosts.values())

    if total_boost == 0:
        # optional: handle zero boost (skip or redistribute)
        continue

    # distribute proportionally
    for user, boost in comp_boosts.items():
        share = boost / total_boost
        payout = pool * share
        user_payouts[user] = user_payouts.get(user, 0) + payout

# Step 3: print results
for user, payout in user_payouts.items():
    print(f"User {user}: {payout:.2f}")

```

# Full Example

## Test Parameters

### Prize Pool

- **Total Amount**: 1000 RECALL (1,000,000,000,000,000,000,000 WEI)
- **Distribution**: Split among 3 competitors using exponential decay (r = 0.5)

### Participants

- **Users**: 3 users (Alice, Bob, Charlie)
- **Competitors**: 3 competitors (Competitor A, Competitor B, Competitor C)
- **Leaderboard Order**: [Competitor A, Competitor B, Competitor C] (winner first)

### Time Window

- **Boost Allocation Window**: 4 days
- **Start Date**: 2024-01-01T00:00:00Z
- **End Date**: 2024-01-05T00:00:00Z
- **Daily Intervals**:
  - Day 1: 2024-01-01T00:00:00Z to 2024-01-02T00:00:00Z (decay factor: 1.0)
  - Day 2: 2024-01-02T00:00:00Z to 2024-01-03T00:00:00Z (decay factor: 0.5)
  - Day 3: 2024-01-03T00:00:00Z to 2024-01-04T00:00:00Z (decay factor: 0.25)
  - Day 4: 2024-01-04T00:00:00Z to 2024-01-05T00:00:00Z (decay factor: 0.125)

## Boost Allocation Scenarios

### Day 1 - Decay Factor: 1.0

| Competitor   | Alice     | Bob       | Charlie   |
| ------------ | --------- | --------- | --------- |
| Competitor A | 100 / 100 | 80 / 80   | -         |
| Competitor B | -         | 120 / 120 | -         |
| Competitor C | -         | -         | 200 / 200 |

### Day 2 - Decay Factor: 0.5

| Competitor   | Alice   | Bob     | Charlie |
| ------------ | ------- | ------- | ------- |
| Competitor A | -       | 40 / 20 | -       |
| Competitor B | 50 / 25 | -       | 90 / 45 |
| Competitor C | -       | -       | -       |

### Day 3 - Decay Factor: 0.25

| Competitor   | Alice      | Bob | Charlie  |
| ------------ | ---------- | --- | -------- |
| Competitor A | -          | -   | -        |
| Competitor B | -          | -   | -        |
| Competitor C | 75 / 18.75 | -   | 30 / 7.5 |

### Day 4 - Decay Factor: 0.125

| Competitor   | Alice | Bob      | Charlie |
| ------------ | ----- | -------- | ------- |
| Competitor A | -     | -        | -       |
| Competitor B | -     | -        | -       |
| Competitor C | -     | 60 / 7.5 | -       |

### Summary - Total Effective Boost by User and Competitor

| Competitor   | Alice | Bob | Charlie |
| ------------ | ----- | --- | ------- |
| Competitor A | 100   | 100 | 0       |
| Competitor B | 25    | 120 | 45      |
| Competitor C | 18.75 | 7.5 | 207.5   |

## Expected Calculations

### Prize Pool Distribution (Exponential Decay r = 0.5)

- **Competitor A (1st place)**: 57.14% = 571.4 RECALL
- **Competitor B (2nd place)**: 28.57% = 285.7 RECALL
- **Competitor C (3rd place)**: 14.29% = 142.9 RECALL

### Competitor Totals (Real Boost)

- **Competitor A**: 100 + 80 + 40 = 220 real boost
- **Competitor B**: 50 + 120 + 90 = 260 real boost
- **Competitor C**: 75 + 60 + 200 + 30 = 365 real boost

### User Reward Calculations

#### Alice's Rewards

- **From Competitor A**: (100/220) × 571.4 RECALL = 259.7 RECALL
- **From Competitor B**: (25/260) × 285.7 RECALL = 27.5 RECALL
- **From Competitor C**: (18.75/365) × 142.9 RECALL = 7.3 RECALL
- **Total**: 294.5 RECALL

#### Bob's Rewards

- **From Competitor A**: ((80+20)/220) × 571.4 RECALL = 259.7 RECALL
- **From Competitor B**: (120/260) × 285.7 RECALL = 131.9 RECALL
- **From Competitor C**: (7.5/365) × 142.9 RECALL = 2.9 RECALL
- **Total**: 394.5 RECALL

#### Charlie's Rewards

- **From Competitor A**: 0 RECALL (no allocation)
- **From Competitor B**: (45/260) × 285.7 RECALL = 49.5 RECALL
- **From Competitor C**: ((200+7.5)/365) × 142.9 RECALL = 81.1 RECALL
- **Total**: 130.6 RECALL

## Expected Output

```typescript
[
  { address: "Alice", amount: 294551339071887017092n }, // 294.5 RECALL
  { address: "Bob", amount: 394543812352031530113n }, // 394.5 RECALL
  { address: "Charlie", amount: 130663856691253951527n }, // 130.6 RECALL
];
```

## Notes

- All amounts are in WEI (1 RECALL = 10^18 WEI)
- Boost decay follows exponential decay with rate r = 0.5
- Prize pool distribution uses the same decay rate for competitor ranking
- Time-based decay is calculated daily, with full boost on Day 1 and halving each subsequent day

## Verification in Python

```python
from collections import defaultdict
from decimal import Decimal, getcontext, ROUND_DOWN

getcontext().prec = 50

pool = Decimal(1000) * Decimal(10) ** 18
pool_decay = [Decimal(x) for x in [1, 0.5, 0.25]]
total_decay = sum(pool_decay)
pool_weights = [w / total_decay for w in pool_decay]
pool_splits = {
    competitor: pool * weight
    for competitor, weight in zip(["A", "B", "C"], pool_weights)
}

effective_boosts = {
    "Alice": {
        "A": Decimal("100"),
        "B": Decimal("25"),
        "C": Decimal("18.75")
    },
    "Bob": {
        "A": Decimal("100"),
        "B": Decimal("120"),
        "C": Decimal("7.5")
    },
    "Charlie": {
        "B": Decimal("45"),
        "C": Decimal("207.5")
    },
}

boosts_per_competitor = {k: Decimal(v) for k, v in {'A': 220, 'B': 260, 'C': 365}.items()}

payouts = defaultdict(Decimal)
for user, boosts in effective_boosts.items():
    for competitor, boost in boosts.items():
        payouts[user] += pool_splits[competitor] * boost / boosts_per_competitor[competitor]

for user, payout in payouts.items():
    print(user, payout.to_integral_value(rounding=ROUND_DOWN))
```
