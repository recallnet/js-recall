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

With that, $Payout_{u,i}$ becomes

$$
\text{Payout}_{u,i} =\begin{cases}\text{Pool}_i \cdot \dfrac{\sum_{d=1}^{N}{b_{u,i,d}}}{B_i}, & \text{if } B_i>0 \\[2mm]0, & \text{if } B_i=0\end{cases}
$$

where $N$ is the last day of the boost allocation window. In this setting, the sum of payouts does not equal to the total pool of rewards:

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
