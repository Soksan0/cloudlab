# CloudLab balance selection — 26 November 2026

This supersedes the 19 November recommendation to leave the version-9 economy unchanged. The earlier 18-run quota experiment remains in `benchmarks/results/balance-matrix.json` as historical evidence.

## Release decision

Activate `{hardware:2, fleet:16, coefficient:0.2, maintenance:0.1, rentalLimits:true}`. Workload fees, physical specifications, the 98% progression target, and 25-second quotas remain controls.

- Preserve introductory first-tier prices. Later hardware tiers cost 2× their previous unit price; fleet-wide hardware changes charge each affected owned machine/group/link.
- Repeat expansions use 16× their previous base price and a 20% linear count coefficient. Bulk prices sum the individual count-dependent prices.
- Newly priced active owned compute adds maintenance equal to 10% of its nominal standard-workload revenue. This is fictional game maintenance, not a power measurement.
- A newly priced VM has a $5.32/simulated-minute base; a GPU has a $3.60 base. These are 25% of the respective modeled rated workload revenue. The existing disclosed usage charges and event surcharges remain additional.
- Future recurring checkpoints cap at $1,000 each. Already-earned rewards are preserved.
- Autoscaling operates between zero and the configured worker maximum. Capacity purchases raise that maximum and request startup. Deployment/setup fees are fictional game rules; changing a real AWS scaling-group maximum does not imply this upfront fee.

## Reproducible selection

Run these opt-in commands from the repository:

```sh
CLOUDLAB_RELEASE_BALANCE=1 npx vitest run benchmarks/release-balance.test.ts
CLOUDLAB_RELEASE_BALANCE=deep npx vitest run benchmarks/release-balance.test.ts
CLOUDLAB_RELEASE_BALANCE=revised npx vitest run benchmarks/release-balance.test.ts
CLOUDLAB_RELEASE_BALANCE=revised-deep npx vitest run benchmarks/release-balance.test.ts
CLOUDLAB_RELEASE_BALANCE=selected npx vitest run benchmarks/release-balance.test.ts
```

The approved 36 combinations were screened through level 100 with capacity-first, cache-first, and rental-first choices, each at 0/5/10-second decision delays: 324 runs. All screened successfully. The following 324 runs through level 1,000 found no configuration with two strategies passing every delay. The result is deliberately `selected:null` in `release-deep.json`; no original-grid multiplier was activated.

The structural gap was unlimited automatic rental growth, which could bypass deliberate capacity expansion. The revised experiment adds a configured scaling ceiling while retaining the same 36 price combinations, fees, workloads, and quotas. It screens another 324 runs. Deep validation has 84 recorded runs, including 24 that reach level 10,001. Remaining delays of an already-failing strategy can be pruned because that strategy cannot qualify. Failed candidates remain in the result file.

Candidate order is declared lexicographically: lower hardware multiplier, lower expansion-base multiplier, lower count coefficient, then lower maintenance. This prioritizes preserving access to hardware and expansion before reducing operating terms. The first qualifying candidate wins; no identical-price configuration tie arose. The selected candidate passes all three strategies, not merely the required two.

After the Budget Guard startup correction, a separate final rerun checks all nine selected strategy/delay combinations through level 10,001 against the actual release engine. All nine pass.

## Final measurements

| Strategy | Decision delay | First upgrade | Longest ordinary stall | Sampled service | Level-10,000 cash | Last three reserve ratios |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Capacity | 0 s | 4 s | 8 s | 99.815% | $946.26M | 57.1%, 57.4%, 57.6% |
| Capacity | 5 s | 12 s | 22 s | 99.807% | $956.68M | 57.4%, 57.4%, 57.5% |
| Capacity | 10 s | 12 s | 40 s | 99.791% | $966.86M | 57.5%, 57.4%, 57.5% |
| Cache | 0 s | 4 s | 8 s | 99.814% | $966.24M | 58.4%, 58.7%, 58.8% |
| Cache | 5 s | 12 s | 22 s | 99.805% | $975.87M | 58.8%, 58.7%, 58.8% |
| Cache | 10 s | 12 s | 40 s | 99.788% | $989.80M | 58.8%, 58.7%, 58.9% |
| Rental | 0 s | 4 s | 8 s | 99.768% | $2.16M | 0.2%, 0.1%, <0.1% |
| Rental | 5 s | 12 s | 22 s | 99.758% | $0.79M | <0.1%, <0.1%, <0.1% |
| Rental | 10 s | 12 s | 40 s | 99.736% | $37.36M | 2.2%, 2.1%, 2.0% |

All selected runs reach 10,001 with finite values, reconciled ledgers, and zero recorded reserve-gate failures. Ordinary stalled time includes provisioning; event time is tracked separately. Checkpoints record levels 5, 10, 20, 40, 100, 1,000, and 10,000. Recovery unit scenarios also exercise an unprepared first encounter across the full grid without claiming rewards, unused-rental trimming with retained debt, and needed GPU startup during losses.

## Interpretation and safeguards

Reserve ratio retains the earlier experiment's definition: remaining cash divided by cumulative opening funds, customer revenue, and claimed rewards immediately after a purchase. The gate rejects three consecutive ratios above 60% at the sampled later checkpoints. **It is not cash divided by the next upgrade cost.** Large late-game absolute balances remain possible, particularly with owned capacity. Passing this arithmetic target is not proof that every late-game choice feels scarce or engaging.

Agents claim rewards only as deliberate funding actions when a chosen intervention is unaffordable; rewards are never automatically credited by the engine. They acknowledge dialogs immediately, use one deterministic seed, and cannot represent human reading or comprehension time. Service reliability is sampled at interval starts, not measured percentile latency. The ledger uses integrated engine totals.

Existing companies keep cash, stored data, purchases, reports, earned rewards, and level progress. Their current owned and running rented capacity retains old operating terms; a deliberate owned hardware upgrade adopts new terms for that affected fleet, while new rental capacity receives new rates. Existing running/provisioning remote capacity is mapped into the configured ceiling so migration cannot shrink it. Already-earned checkpoint bonuses keep their old values. A pre-v7 backup supports recovery.

Budget Guard removes unused capacity without cancelling needed pending startup or permanently resetting useful scaling checks. It does not forgive expenses or silently clamp debt. Overbuilding a machine can still reduce operating profit; previews disclose the change.

## Evidence

- `release-screen.json`, `release-deep.json`: original grid and failed selection.
- `revised-screen.json`, `revised-deep.json`: revised experiment and selection.
- `selected-final.json`: nine release-engine reruns through 10,000 levels.
- `play-review.json`: 1,801.53 active seconds of ordinary-UI endurance review.
- `first-session.json`: 301.16 active seconds from a fresh selected-balance company.
- `PLAYTEST_REPORT.md`: observed usability/teaching bugs, fixes, and review limits.

The configured-limit relationship follows [AWS's scaling-limit documentation](https://docs.aws.amazon.com/autoscaling/ec2/userguide/asg-capacity-limits.html). The game does not claim its prices or modeled service rates are AWS prices or universal hardware benchmarks.
