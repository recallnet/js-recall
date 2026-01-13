# Model for Boosters

## High-level

1. Users cast boosts to competitors
2. Competition results determine top-k placements.
3. Compute placement pools using a decaying reward curve
4. For each placement, split the pool proportionally among boosters
5. Sum all payouts to calculate each user’s total reward

## 1 Define the prize split across placements

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
| 1      | 0.50049 | 500.49     |
| 2      | 0.25024 | 250.24     |
| 3      | 0.12512 | 125.12     |
| 4      | 0.06256 | 62.56      |
| 5      | 0.03128 | 31.28      |
| 6      | 0.01564 | 15.64      |
| 7      | 0.00782 | 7.82       |
| 8      | 0.00391 | 3.91       |
| 9      | 0.00196 | 1.96       |
| 10     | 0.00098 | 0.98       |

## 2 Distribute each placement’s pool to its boosters

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
| 1    | 500.49 | 150.14 | 250.24 | 100.09 |
| 2    | 250.24 | 50.04  | 150.15 | 50.05  |
| 3    | 125.12 | 31.28  | 62.56  | 31.28  |
| 4    | 62.56  | 12.51  | 18.76  | 31.28  |
| 5    | 31.28  | 7.82   | 15.64  | 7.82   |
| 6    | 15.64  | 0      | 7.82   | 7.82   |
| 7    | 7.82   | 3.91   | 3.91   | 0      |
| 8    | 3.91   | 0      | 0      | 3.91   |
| 9    | 1.96   | 0      | 1.95   | 0      |
| 10   | 0.98   | 0      | 0      | 0.98   |

Total payouts

| User | Total Payout |
| ---- | ------------ |
| A    | 255.72       |
| B    | 511.05       |
| C    | 233.24       |

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

You can see that at $d = 1$ (first day of the boost allocation window), $b_{u,i,d} = b_{u,i}$, that is, all of your boosts will be used to affect your payout. This means if **everyone only allocates boosts on the first day**, we revert to the scenario described in section **2**.

With time-based decay, the total time-weighted boost for competitor $i$ is:

$$
B_i = \sum_{u}{\sum_{d=1}^{N}{b_{u,i,d}}}
$$

where $N$ is the last day of the boost allocation window. Note that $B_i$ uses time-weighted boosts, ensuring consistency with the numerator in the payout calculation.

With that, $Payout_{u,i}$ becomes

$$
\text{Payout}_{u,i} =\begin{cases}\text{Pool}_i \cdot \dfrac{\sum_{d=1}^{N}{b_{u,i,d}}}{B_i}, & \text{if } B_i>0 \\[2mm]0, & \text{if } B_i=0\end{cases}
$$

### Example: Time-Weighted Distribution

Consider a competitor prize pool of 1000 tokens with two users:

- User A votes 100 on Day 1 (weight 100% = 1.0)
- User B votes 400 on Day 3 (weight 25% = 0.25)

- Weighted total: $B_i = 100 \times 1.0 + 400 \times 0.25 = 200$
- User A reward: $1000 \times \frac{100 \times 1.0}{200} = 500$ tokens
- User B reward: $1000 \times \frac{400 \times 0.25}{200} = 500$ tokens

Both users receive equal rewards because they contributed equal time-weighted boosts (100 each).

In this setting, the sum of payouts does not equal to the total pool of rewards:

$$
\sum_u{Payout_u} \neq X
$$

It means people can only get the theoretical maximum if they allocated all boost on day one.

# Model for competitors

For rewarding competitors we use a separated prize pool and apply the exact same calculations defined by **1 Define the prize split across placements** section.

# Appendix

## Parameters and knobs

- Prize pool: $X$
- The number $k$ of competitors among whom the prize pool is distributed
- Decay $r$, $q$

## Handling ties

When competitors are tied at the same rank, we split the combined pool equally among all tied competitors

**Example**

Consider the following prize pool distribution for 3 competitors: [57.14%, 28.57%, 14.29%]

If competitors A and B are tied for 1st place:

- Instead of A getting 57.14% and B getting 28.57%
- They each get: (57.14% + 28.57%) / 2 = 42.86%
- The 3rd place competitor still gets 14.29%

## **Properties of the System**

- **Fairness:** Users are rewarded in proportion to how much they contributed to the winners.
- **Top-heavy rewards:** The geometric decay ensures higher-ranked competitors get a larger share of the pool.
- **Transparency:** Calculations are deterministic and easily verifiable.
- **Flexible:** You can adjust the decay factor $r$ or the number of rewarded placements $k$ to tune competitiveness.
- **Time-based:** You earn higher rewards by correctly predicting winners earlier

## Code for the above calculation

### Basic calculation (without time decay)

```python
from collections import defaultdict
from decimal import Decimal, getcontext, ROUND_DOWN

getcontext().prec = 50

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
unnormalized_weights = [Decimal(r**i) for i in range(k)]
total_weight = sum(unnormalized_weights)
placement_pools = [Decimal(X) * (Decimal(w) / Decimal(total_weight)) for w in unnormalized_weights]

# Step 2: distribute each placement's pool to boosters
user_payouts = {}  # {user_id: total_payout}

for rank in range(k):
    competitor = results[rank]
    pool = placement_pools[rank]

    # total boost for this competitor
    comp_boosts = boosts.get(competitor, {})
    total_boost = Decimal(sum(comp_boosts.values()))

    if total_boost == 0:
        # optional: handle zero boost (skip or redistribute)
        continue

    # distribute proportionally
    for user, boost in comp_boosts.items():
        share = boost / total_boost
        payout = pool * share
        print("Competitor: ", competitor, "User: " , user, "Amount: ", payout)
        user_payouts[user] = user_payouts.get(user, 0) + payout

    print("\n")

# Step 3: print results
for user, payout in user_payouts.items():
    print(f"User {user}: {payout:.2f}")

```

### Calculation with time-based decay

```python
from collections import defaultdict
from decimal import Decimal, getcontext, ROUND_DOWN
from datetime import datetime

getcontext().prec = 50

# Test parameters matching TypeScript test
X = 1000 * 10**18  # 1000 ETH in WEI
k = 3              # Top-3 placements
r = Decimal("0.5") # Prize pool decay factor
q = Decimal("0.5") # Time decay factor

# Boost allocation window: 2024-01-01 to 2024-01-05 (4 days)
window_start = datetime(2024, 1, 1)
window_end = datetime(2024, 1, 5)

# Leaderboard: 3 competitors ranked 1, 2, 3
results = ["Competitor A", "Competitor B", "Competitor C"]

# Boost allocations with exact timestamps from test
# Format: (competitor, user, boost_amount, timestamp)
boost_allocations = [
    # Alice's allocations
    ("Competitor A", "Alice", 100, datetime(2024, 1, 1, 12, 0, 0)),  # Day 1: decay^0 = 1.0
    ("Competitor B", "Alice", 50, datetime(2024, 1, 2, 18, 0, 0)),   # Day 2: decay^1 = 0.5
    ("Competitor C", "Alice", 75, datetime(2024, 1, 3, 9, 0, 0)),    # Day 3: decay^2 = 0.25

    # Bob's allocations
    ("Competitor A", "Bob", 80, datetime(2024, 1, 1, 15, 0, 0)),     # Day 1: decay^0 = 1.0
    ("Competitor A", "Bob", 40, datetime(2024, 1, 2, 10, 0, 0)),      # Day 2: decay^1 = 0.5
    ("Competitor B", "Bob", 120, datetime(2024, 1, 1, 20, 0, 0)),     # Day 1: decay^0 = 1.0
    ("Competitor C", "Bob", 60, datetime(2024, 1, 4, 14, 0, 0)),      # Day 4: decay^3 = 0.125

    # Charlie's allocations
    ("Competitor B", "Charlie", 90, datetime(2024, 1, 2, 12, 0, 0)),  # Day 2: decay^1 = 0.5
    ("Competitor C", "Charlie", 200, datetime(2024, 1, 1, 8, 0, 0)), # Day 1: decay^0 = 1.0
    ("Competitor C", "Charlie", 30, datetime(2024, 1, 3, 16, 0, 0)),  # Day 3: decay^2 = 0.25
]

def get_day_index(timestamp: datetime, window_start: datetime, window_end: datetime) -> int:
    """Get the day index (0-based) for a timestamp within the window.
    Each day interval is [start + n*24h, start + (n+1)*24h) for n = 0, 1, 2, ...
    """
    if timestamp < window_start or timestamp >= window_end:
        return -1

    delta = timestamp - window_start
    day_index = delta.days
    return day_index

def calculate_time_weight(timestamp: datetime, window_start: datetime, window_end: datetime, q: Decimal) -> Decimal:
    """Calculate time decay weight: w_d = q^index where index is 0 for day 1, 1 for day 2, etc."""
    day_index = get_day_index(timestamp, window_start, window_end)
    if day_index < 0:
        return Decimal(0)
    return q ** day_index

# Step 1: Compute placement pools using prize pool decay
unnormalized_weights = [r ** i for i in range(k)]
total_weight = sum(unnormalized_weights)
placement_pools = [Decimal(X) * (w / total_weight) for w in unnormalized_weights]

# Step 2: Calculate time-weighted boosts per user per competitor
user_effective_boosts = defaultdict(lambda: defaultdict(Decimal))  # {competitor: {user: effective_boost}}
competitor_total_effective_boosts = defaultdict(Decimal)  # {competitor: total_effective_boost}

for competitor, user, boost, timestamp in boost_allocations:
    time_weight = calculate_time_weight(timestamp, window_start, window_end, q)
    effective_boost = Decimal(boost) * time_weight

    user_effective_boosts[competitor][user] += effective_boost
    competitor_total_effective_boosts[competitor] += effective_boost

# Step 3: Distribute each placement's pool to boosters using time-weighted boosts
user_payouts = {}  # {user_id: total_payout}

for rank in range(k):
    competitor = results[rank]
    pool = placement_pools[rank]

    # Total time-weighted boost for this competitor (denominator)
    total_effective_boost = competitor_total_effective_boosts.get(competitor, Decimal(0))

    if total_effective_boost == 0:
        continue

    # Distribute proportionally using time-weighted boosts
    for user, effective_boost in user_effective_boosts.get(competitor, {}).items():
        if effective_boost > 0:
            # Both numerator (effective_boost) and denominator (total_effective_boost) use time weighting
            share = effective_boost / total_effective_boost
            payout = pool * share
            print(f"Rank {rank+1} ({competitor}): User {user}, Effective Boost: {effective_boost}, Share: {share:.6f}, Payout: {payout:.0f} WEI")
            user_payouts[user] = user_payouts.get(user, Decimal(0)) + payout

    print()

# Step 4: Print results (matching TypeScript test expectations)
print("Total payouts:")
for user in sorted(user_payouts.keys()):
    payout = user_payouts[user]
    # Convert to match TypeScript bigint representation
    payout_bigint = int(payout.to_integral_value(rounding=ROUND_DOWN))
    print(f"User {user}: {payout_bigint} WEI ({payout / Decimal(10**18):.6f} ETH)")

# Expected results (from TypeScript test):
# Alice: 334767399782879659040 WEI
# Bob: 470749065176309758353 WEI
# Charlie: 194483535040810582606 WEI

```
