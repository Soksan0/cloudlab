# Economy experiment: quotas and linear fleet prices

Measured 2026-11-19. Production remains at the existing 25-second quota and 2% linear fleet-price coefficient. No experimental price, reward, demand, quota, or financial change ships in this release.

## Recommendation

Keep production constants unchanged. None of the tested combinations maintains money as a meaningful late-game constraint. At level 1,000, all three most recent purchase reserve ratios are roughly 90–95%. Longer quotas substantially increase accumulated cash; increasing the tested fleet coefficient barely changes progression time. These measurements do not justify a production multiplier.

Use the existing 25-second / 2% setting as the control for a separate economy proposal. First investigate when purchases stop competing for funds, compare rental policies and mixed owned/rented strategies, and add human decision/reading delays. Revisit reward and cost relationships together rather than increasing every price. Preserve existing companies' money and purchases. This document recommends experiments, not new shipping constants.

## Method and interpretation

Run `CLOUDLAB_BALANCE=1 npx vitest run benchmarks/balance-experiment.test.ts --silent=false`.

- 18 deterministic runs: 25/35/45-second quotas × 2%/4%/6% linear fleet-price coefficients × capacity-first/cache-first strategies. Each reaches level 1,001 and records levels 5, 10, 20, 40, 100, and 1,000: 108 observations.
- New sandbox companies, existing workload profiles, prices outside fleet expansion, rewards, events, default Economy policy, and Budget Guard. The agent immediately claims eligible rewards and acknowledges blocking dialogs. It checks approximately every five active seconds while healthy and every second under overload. It waits for pending rentals before purchasing the same remote pool again.
- Capacity-first takes the current component's primary upgrade/expansion. Cache-first prefers Application Cache when it improves the current service, otherwise the same primary action. Both unlock eligible technologies while healthy. This is a narrow comparison, not an optimal strategy search.
- Fleet coefficient changes are test-only ledger adjustments to one-unit expansion purchases. All checkpoint ledgers reconcile within $0.001. Experimental quota companies are not production save files.
- `purchaseOpportunities` counts agent decisions with an available candidate, including funding waits; it does not mean a new distinct product appeared. `purchases` counts successful transactions. Three reserve observations are cash divided by cumulative opening funds, customer revenue, and rewards immediately after the last three purchases. The summary reserve is their mean.
- Funding wait counts overloaded intervals where the chosen candidate is unaffordable. Recovery/stall includes all overloaded intervals, including provisioning and incidents. These are different measures. The bot's one-second maximum funding wait benefits from immediate claims and instant diagnosis; it does not predict human recovery time.
- Service percentage is the workload-weighted sampled rate, using the interval's starting metrics. It is an estimate near event/level/purchase boundaries, not a percentile latency or a measured queue. Financial totals use the actual engine ledger. Repeated runs share one seed and no human reading delay, offline earnings, alternative rental policy, or delayed reward claiming.

## Findings

The baseline capacity strategy reaches level 100 with $166,291 and level 1,000 with $16,268,005. Its last three level-1,000 purchase reserves are 90.8%, 90.8%, and 90.8%. Cache-first uses 86 rather than 96 purchases by that checkpoint and arrives 36 active seconds earlier, with $43,347 more cash. That small time difference is not evidence of a universally better strategy.

At 2%, lengthening the quota from 25 to 45 seconds raises the capacity strategy's level-1,000 cash from $16.27 million to $29.80 million. Raising the coefficient from 2% to 6% at a 25-second quota lowers that cash by $112,456 (about 0.69%) and changes neither the sampled checkpoint time nor purchase count. Coefficients have no effect at early checkpoints before repeat fleet purchases.

Every configuration keeps sampled cumulative service above 99.9% by level 1,000. Maximum all-cause overload lasts 10–12 active seconds at that checkpoint. This demonstrates recoverability for these agents; it does not establish sufficiently interesting difficulty or remove the need for human playtesting. The separate production continuity test still exercises 10,000 levels.

## Baseline checkpoints: 25 seconds / 2% / capacity-first

| Level | Active seconds | Cash | Purchases / opportunities | Max funding wait / all-cause stall (s) | Service estimate | Last three purchase reserves |
| ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 5 | 127 | $869 | 5 / 20 | 1 / 3 | 99.56% | 52.8%, 17.4%, 1.0% |
| 10 | 253 | $402 | 9 / 47 | 1 / 3 | 99.8% | 6.1%, 1.8%, 1.0% |
| 20 | 477 | $1,573 | 12 / 96 | 1 / 3 | 99.87% | 0.4%, 8.2%, 0.3% |
| 40 | 951 | $10,444 | 14 / 161 | 1 / 3 | 99.92% | 0.3%, 0%, 0.5% |
| 100 | 2,423 | $166,291 | 18 / 165 | 1 / 4 | 99.97% | 57.3%, 56.9%, 56.6% |
| 1000 | 24,010 | $16,268,005 | 96 / 243 | 1 / 11 | 99.94% | 90.8%, 90.8%, 90.8% |

## Level-1,000 comparison

| Quota (s) | Fleet coefficient | Strategy | Active seconds | Cash | Purchases / opportunities | Max funding / stall (s) | Service estimate | Mean recent reserve |
| ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 25 | 2% | capacity | 24,010 | $16,268,005 | 96 / 243 | 1 / 11 | 99.94% | 90.8% |
| 25 | 2% | cache | 23,974 | $16,311,352 | 86 / 233 | 1 / 10 | 99.94% | 91.1% |
| 25 | 4% | capacity | 24,010 | $16,211,774 | 96 / 243 | 1 / 11 | 99.94% | 90.5% |
| 25 | 4% | cache | 23,974 | $16,267,501 | 86 / 233 | 1 / 10 | 99.94% | 90.8% |
| 25 | 6% | capacity | 24,010 | $16,155,549 | 96 / 243 | 1 / 11 | 99.94% | 90.1% |
| 25 | 6% | cache | 23,974 | $16,223,660 | 86 / 233 | 1 / 10 | 99.94% | 90.5% |
| 35 | 2% | capacity | 33,675 | $23,388,924 | 141 / 313 | 1 / 12 | 99.92% | 94.7% |
| 35 | 2% | cache | 33,664 | $22,437,305 | 127 / 310 | 1 / 12 | 99.93% | 90.9% |
| 35 | 4% | capacity | 33,675 | $23,250,266 | 141 / 313 | 1 / 12 | 99.92% | 94.1% |
| 35 | 4% | cache | 33,664 | $22,313,755 | 127 / 310 | 1 / 12 | 99.93% | 90.4% |
| 35 | 6% | capacity | 33,675 | $23,111,618 | 141 / 313 | 1 / 12 | 99.92% | 93.6% |
| 35 | 6% | cache | 33,664 | $22,190,215 | 127 / 310 | 1 / 12 | 99.93% | 89.9% |
| 45 | 2% | capacity | 43,669 | $29,797,511 | 141 / 330 | 1 / 12 | 99.93% | 95.0% |
| 45 | 2% | cache | 43,661 | $28,586,809 | 126 / 326 | 1 / 12 | 99.95% | 91.1% |
| 45 | 4% | capacity | 43,669 | $29,658,853 | 141 / 330 | 1 / 12 | 99.93% | 94.5% |
| 45 | 4% | cache | 43,661 | $28,465,683 | 126 / 326 | 1 / 12 | 99.95% | 90.7% |
| 45 | 6% | capacity | 43,669 | $29,520,205 | 141 / 330 | 1 / 12 | 99.93% | 94.1% |
| 45 | 6% | cache | 43,661 | $28,344,567 | 126 / 326 | 1 / 12 | 99.95% | 90.4% |

All 108 checkpoint observations, including individual reserve ratios and total funding waits: [balance-matrix.json](benchmarks/results/balance-matrix.json). Earlier uncontrolled runs that repeatedly bought workers during provisioning were discarded; they over-rented and measured a different strategy.
