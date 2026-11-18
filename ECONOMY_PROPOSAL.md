# Economy measurements and approval gate

Production balance is unchanged. Run `npx vitest run src/sim/endless.test.ts --silent=false -t 'benchmarks economy'` to reproduce the exploratory 200-active-second, 4× advisor run.

| Experimental multiplier per prior purchase | Level | Purchases | Cash | Unspent income |
| --- | ---: | ---: | ---: | ---: |
| 1.00 | 38 | 14 | $17,831 | 60.3% |
| 1.18 | 35 | 13 | $3,228 | 11.9% |
| 1.22 | 36 | 12 | $8,640 | 31.5% |
| 1.25 | 36 | 12 | $4,240 | 15.7% |

These test-only multipliers apply to purchases globally, not just repeat fleet units. They establish sensitivity, not recommended shipping constants. The bot acts once per active second, acknowledges notices, and does not reproduce human reading or decision time. A single endpoint ratio does not prove bounded cash growth across long runs.

The chosen hybrid direction should next compare per-pool 18%, 20%, and 22% fleet scaling with explicit cache-versus-capacity choices. Dynamic scaling should compare 25% fleet scaling without new choices. The sink alternative should compare optional spending of 10%, 15%, and 20% of recent gross income. Do not introduce compulsory retroactive charges or remove existing cash/purchases/rewards.

The measurements do not meet the desired level-20–30 pacing target. Raising prices alone lowers reserve cash but barely slows the level curve. Before changing production balance, benchmark these designs through levels 10, 20, 40, 100, and 1,000, using repeated cash-ratio observations, recovery time, purchase count, ledger checks, and save reloads. Reject configurations with sustained cash above 35% across more than three purchase opportunities or recovery exceeding 45 active seconds.

Approval is still required for final constants, new trade-off rules, and any persistent choice schema. No save migration is included in this change.
