# CloudLab implementation handoff

Updated 26 November 2026, Asia/Phnom_Penh.

## Goal and current outcome

Implemented “a clearer mission, a lighter HUD, and meaningful challenges” on clean baseline `cc695617bb5ebb0b1821533bffcc9f701a91f768` (saved Site version 9). Repository: `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab`. Branch: `feat/cloudlab-v7-improvements`.

The pixel city, React/Vite, automatic routing, physical resource model, companies, and Workshop / Server Interior / Service Flow are preserved. Normal monitoring is a 96px integrated HUD; expanded Status / Finance / History is capped at 220px and resizes the scene. Compact monitoring collapses the inspector. The introduction explains the player's role and mission; exact tutorial targets, detour guidance, selection/install feedback, sampled request tickets, observed service results, and cancelable scene transitions make the loop clearer.

Incidents are infrastructure encounters with centered countdowns, phases, explicit containment objectives, and honest operating results. Traffic encounters use the approved 15/40/20-second phase schedule; legacy active incidents finish without being converted to the new rules. Failed encounters preserve the company.

The economy is deliberately changed after experiments, not by an unvalidated multiplier. See `ECONOMY_PROPOSAL.md` for the selected configuration, methods, measurements, and limits. No prestige, resets, new currency, manual wiring, offline earnings, backend, power-management system, or replacement queue engine was added.

## Architectural decisions

- `calculateMetrics`, resource readings, the ledger, and engine clocks remain authoritative. Cash now derives from accounting totals, preventing accumulated drift. Presentation never awards cash or determines service/event/tutorial completion.
- `PerformanceHUD` and `StatusDashboard` consume the existing shared 60-active-second history. Samples are not persisted. Sampled request tickets and profit receipts remain bounded; receipts exclude claims, grants, and purchases.
- `tutorialTargets` shares action names/semantic anchors with UI controls. `TutorialGuide` tracks camera/resizing changes, distinguishes selecting from buying, and points back to a usable control after unrelated exploration or closing a panel. It uses a static cue for reduced motion, a gentle bob otherwise, and 8/20-second reminders.
- Tutorial replay has separate displayed equipment plus the unsaved teaching projection. A maximum-tier live company can complete replay without changing its live inventory, cash, storage, elapsed time, or progression.
- `useSceneTransition` separates cross-view dissolves from simulation and handles cancellation. Within-view camera travel is 350ms; direct manipulation cancels automatic camera motion. Manual framing survives simulation updates.
- `usePresentation` bounds semantic presentation events; purchase/activation feedback carries its own telemetry baseline. Service comparisons distinguish predictions from observed ledger/work deltas, label traffic changes, and do not attribute unrelated earlier purchases to rental activation. Feedback avoids the inspector and minimizes covering the selected equipment.
- Save schema is **7**. It persists encounter progress and balance terms. `cloudlab-save-pre-v7` retains recoverable old saves; earlier recovery keys remain readable. Existing operating terms and already-earned checkpoint rewards are grandfathered. Existing running/provisioning rental capacity is mapped into a sufficient configured ceiling.
- Selected balance: hardware 2× after introductory tier; repeat fleet base 16×; count coefficient 20%; additional active-owned maintenance 10%; newly priced VM/GPU base charges 25% of nominal workload revenue; future recurring checkpoints capped at $1,000. Configured rental ceilings are explicit game settings. Their upfront deployment fees are fictional, not an AWS price claim.
- Budget Guard trims unused capacity while preserving needed pending startup and useful scaling checks. It preserves debt and owned equipment.

## What was tried and corrected

The original 36-configuration price grid passed its level-100 screen but no candidate qualified with two strategies at every decision delay through level 1,000. Unlimited autoscaling bypassed deliberate expansion. A separate configured-ceiling revision qualified; all original failures and revised results are retained.

An early deep benchmark excluded provisioning from stalled time; it was stopped and rerun with complete ordinary-stall measurement. Independent cash accumulation caused long-run ledger drift and was replaced with canonical ledger-derived cash. Maximum-tier replay, stale activation comparisons, interrupted fades, misleading hardware-failure advice, 01:16 rounding for 75-second reports, tutorial detours, and compact Firefox overflow were fixed with regressions.

The iterative 30-minute UI review's simple purchasing strategy sometimes neglected spare servers. It is recorded as an agent strategy limitation, not proof that real students understand the game. Two simultaneous browser suites once collided in a shared trace directory; the final isolated complete suite passes.

## Verification and evidence

- Production build passes.
- **153 unit tests pass**; four opt-in benchmark cases are skipped in ordinary runs.
- **81 browser scenarios pass** in the final isolated suite, including Chromium/Firefox/WebKit and 780×600, 1024×600, 1280×720, 1440×900, 1920×1080. Views, cards, chooser, policies, monitor pages, dialogs, keyboard paths, reduced motion, tutorial, migration, events, cash, and saves are covered without gameplay scrolling.
- Final selected balance: nine strategy/delay combinations reach level 10,001 after the recovery fix. First successful upgrade 4–12 active seconds; longest ordinary stalls 8/22/40 seconds; zero recorded reserve-gate failures; ledgers reconcile. Every selected strategy passes at 0/5/10-second delays.
- Ordinary-UI endurance: **1,801.53 active seconds**, 47 observations, no browser errors. Separate selected-balance fresh run: **301.16 active seconds**, guided setup and first encounter, no browser errors. These are agent-run sessions, not a human student study.
- Sustained 4× browser run, bounded history/receipts/DOM/listeners, transition lifecycle, and no observed long tasks in that run pass. Visual review inspected progression scenes, selected hardware, compact monitoring, finance, and encounter layouts.
- Evidence: `PLAYTEST_REPORT.md`, `ECONOMY_PROPOSAL.md`, tracked JSON under `benchmarks/results/`. Transient screenshots/traces are ignored; progress-only benchmark files are ignored.

## Delivery and exact next step

Existing Site: https://cloudlab-infra-tycoon.jetdew16.chatgpt.site
Project: `appgprj_6afa9e6b5aac81919edd603746760ef4`.
Access was rechecked before packaging: custom owner-only policy, one owner, no groups; previous saved version 9 is retained.

This handoff is part of the source package, so the source helper's final commit and native publication receipt are recorded in the delivering chat / Sites history. Use `git log -1` for the release source commit. If resuming before a successful publication receipt, finish that same package/publication operation rather than creating another Site. After successful publication, no required implementation remains; the next useful step is real-student playtesting, especially late-game choice/pacing. Do not infer human comprehension from automated checks.

## Exact changed file paths in this release

- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/.gitignore`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/ECONOMY_PROPOSAL.md`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/PLAYTEST_REPORT.md`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/benchmarks/play-review.mjs`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/benchmarks/release-balance.test.ts`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/benchmarks/results/first-session.json`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/benchmarks/results/play-review.json`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/benchmarks/results/release-deep.json`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/benchmarks/results/release-screen.json`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/benchmarks/results/revised-deep.json`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/benchmarks/results/revised-screen.json`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/benchmarks/results/selected-final.json`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/e2e/game.spec.ts`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/handoff.md`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/App.tsx`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/EventHUD.tsx`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/InspectorPolicies.tsx`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/PerformanceHUD.tsx`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/ServiceResult.tsx`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/StatusDashboard.tsx`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/TuningInspector.tsx`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/TutorialGuide.tsx`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/main.tsx`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/mission.css`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/presentation.test.ts`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/sim/balance.ts`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/sim/diagnostics.test.ts`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/sim/encounters.ts`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/sim/endless.test.ts`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/sim/engine.test.ts`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/sim/engine.ts`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/sim/feedback.test.ts`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/sim/hardware.ts`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/sim/mission.test.ts`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/sim/types.ts`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/tutorialTargets.ts`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/useCollisionAnchor.ts`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/usePresentation.ts`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/useSceneCamera.ts`
- `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/useSceneTransition.ts`
