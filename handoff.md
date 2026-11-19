# CloudLab implementation handoff

Updated 2026-11-19, Asia/Phnom_Penh. This replaces the old version-6 rollback handoff.

## Current release and scope

Repository: `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab`.

This release implements **simpler play, trustworthy diagnostics, clearer learning**, using version 8 source `1e69cbfa9457d77b8a72df40a94a1bc9439aa6b1` as its baseline. Do not restore version 6 or reapply the discarded partial rollback patch. The branch is `feat/cloudlab-v7-improvements`; use `git log -1` for the resulting source-helper release commit.

Site: https://cloudlab-infra-tycoon.jetdew16.chatgpt.site
Project: `appgprj_6afa9e6b5aac81919edd603746760ef4`.

The audience is owner-only (custom policy, sole owner, no groups). Publication uses the existing Site and native Sites version history; the previous saved version 8 remains available for recovery. Native publication receipts in the delivering chat/Sites history identify the new saved version and deployment. Do not infer deployment identifiers from this document or republish without checking that history.

The normal screen now concentrates on money, operating profit, service health, company progress, the objective, and one selected inspector. React/Vite, pixel artwork, automatic routes, physical hardware, owned companies, catalog IDs, prices, rewards, production workloads, 25-second level quotas, 2% linear fleet expansion prices, and the financial ledger are preserved. No backend, offline earnings, prestige, currency, manual wiring, power management, or new queueing engine was added.

## Architecture and behavior

- `calculateMetrics` remains the financial/simulation authority. Its additional `ResourceReading[]` is independent of React. It distinguishes offered pressure from executed use, owned CPU/RAM from rented CPU/RAM, storage space from IOPS/bandwidth, effective network ingress/admitted requests, and GPU availability. CPU/RAM rejection uses local-first allocation; storage write/IO rejection is attributed once. Summed rejection matches customer outcomes. These are explicitly modeled estimates.
- One 60-sample, timestamped active-second history lives in `useLiveFeed`; no samples are saved in company data. Partial active seconds survive pauses; hidden/paused time is excluded. New companies/imports and entry/exit from replay clear presentation history. The same readings feed the rail, inspector, dashboard, and Service Flow. Hysteresis prevents strain flicker; a full bar alone is not proof of rejected service.
- `TuningInspector` combines purpose, current reading/history, upgrade preview, one purchase action, optional comparisons, and Learn more. Space/IOPS/transfer and rented CPU/RAM use tabs. `getInterventions` previews funded copies at one workload snapshot; delayed rentals preview online capacity without advancing time or billing. Max previews use actual affordable quantities. Cost/improvement/operating-cost awards use stable ties. Alternative actions must improve current service; protection is marked future-facing.
- `StatusDashboard` replaces the old dashboard with Status / Finance / History. It reserves scene height instead of covering the workshop. Below 1100px, opening it collapses the inspector. Policies are in the Load Balancer, Security, Cloud, AI, or Autoscaling inspector. Finance retains the reconciled secondary ledger; reports remain paginated. The minimap, detached diagnostics dock, repeated Focus action, traffic preview, nested Operations tabs, and Copy save action are removed.
- Selection and manual camera framing remain presentation state. Explicit navigation focuses the target; direct equipment selection and simulation updates preserve manual framing. Custom selectors retain keyboard support. Read-only motherboard/power/cooling inspection names the selected part without fabricating live measurements.
- Protected tutorial action steps run traffic; explanatory dialogs pause. Required purchases remain funded and company-level advancement/incidents remain suppressed during training. Replay uses an ephemeral projection, preserving live cash, elapsed time, data, purchases, rewards, and levels; it does not force a finishing view.
- Shroud responds manually, waits 15 active seconds before unsolicited failure advice, observes a 45-second cooldown, suppresses a dismissed condition, avoids automatic purchase commentary, and offers Only when asked. That preference is stored separately as `cloudlab-help-only-asked`. Overlay placement accounts for controls, selected targets, the dashboard, tutorial, and feedback.
- Passive money displays refresh once a second; deliberate spending is immediate. Operating receipts exclude rewards/purchases and remain capped at three. Purchase feedback lasts 2.6 seconds. Readings use redundant shapes and cyan/amber/vermilion/lavender states, with restrained motion and reduced-motion support.
- Corrected language includes tier-zero Storage (HDD), SSD tiers as configured teaching limits, Application Cache behind the shared uplink, effective workload-dependent cache hits, simulated provisioning/policy/achievement clocks, shared event severity definitions, the first 30% surge, 50% higher cloud billing, future-only backup recovery protection, reserved failover headroom, and at least 98% served.

## Compatibility and modeling limits

Company schema stays version 6. Existing loading/migration, pre-migration backups, imports, claims, financial reconciliation, and the bounded achievement/report cursors remain. No new persisted company fields were necessary; new metrics are recalculated on load. Help preferences and histories are separate from companies.

CPU instructions, IPC, workload sizes, GPU throughput, and all prices remain teaching assumptions. Estimated response time retains the existing pressure formula and is labeled accordingly. No queue backlog, per-core imbalance, watts, or latency percentiles are invented. Power and cooling remain explanatory components. Production economy constants are unchanged; do not ship the benchmark's experimental settings.

## Verification

- `npm run build`: passes.
- `npm test`: 99 passing unit tests; the opt-in benchmark is skipped during ordinary runs.
- `npm run test:e2e`: 69 browser scenarios in the final suite, including Chromium plus Firefox/WebKit desktop matrices. Every equipment/technology card, resource tab, policy disclosure, selector, dashboard page, and utility overlay is exercised at 780×600, 1024×600, 1280×720, 1440×900, and 1920×1080 without gameplay scrolling or clipped controls.
- A final 18-scenario follow-up verifies resizing an already-open 1440px dashboard into a compact window, the full three-browser desktop matrix, compact training, and capped fleet cards after the responsive CSS adjustment.
- Interactive training at 780×600 and the normal laptop size; skip/reload/replay isolation; manual and contextual Shroud; event timing at 1×/2×/4×; achievement idempotency; immediate purchases and honest profit; legacy/invalid imports; camera gestures and keyboard selection; focus restoration; reduced motion and meter-text contrast are covered.
- The production continuity test traverses 10,000 levels. Sustained 4× browser play runs for 60 real seconds, checks no long tasks, bounds receipts/history/artwork instances, and repeated view/dashboard changes leave global listener and DOM counts bounded.
- Visual review inspected the street workshop, rooftop, operations/AI scenes, all three views, and compact/large monitoring layouts. Browser screenshots and reports are generated in ignored `test-results/` and `playwright-report/`.
- The separately run economy benchmark passes 18 configurations to level 1,001 with 108 checkpoint records and ledger assertions. See `ECONOMY_PROPOSAL.md` and tracked `benchmarks/results/balance-matrix.json` for methods, limitations, repeated reserves, recovery/funding waits, opportunities, service estimates, and recommendations.

## Approaches corrected during this work

The old diagnostic mapping treated clamped pressure as utilization and mixed owned/cloud compute. It was replaced by shared readings from the real calculation. Duplicate resource rejection and unavailable-as-standby counts were corrected. A technology/equipment ID collision initially hid Cloud Migration acquisition; its explicit acquisition path now works. Old native-width CSS and a later density override caused compact Firefox/Safari overflow; the inspector now honors its reserved width, removes repeated values, and fits all resource pages without shrinking essential labels below 14px. Tests were revised where they expected removed tabs, a minimap, a forced view switch, or frozen tutorial actions.

An early benchmark agent repeatedly purchased remote workers during provisioning and reset startup timers. Those numbers were discarded. The retained agent waits for startup; its findings are separate from production. Longer quotas and 2%/4%/6% coefficients do not solve late-game cash accumulation. The report explicitly describes sampled reliability, immediate reward claims, one deterministic seed, and absent human decision/reading delays.

## Exact changed paths

All paths below are relative to the repository root above. `src/LiveDashboard.tsx` and `src/SystemDiagnostics.tsx` were deleted; `src/StatusDashboard.tsx` and the integrated inspector replace them.

- `ECONOMY_PROPOSAL.md`
- `benchmarks/balance-experiment.test.ts`
- `benchmarks/results/balance-matrix.json`
- `e2e/game.spec.ts`
- `handoff.md`
- `src/App.tsx`
- `src/ComponentChooser.tsx`
- `src/ComponentDiagnostics.tsx`
- `src/InfrastructureMap.tsx`
- `src/InspectorPolicies.tsx`
- `src/LiveDashboard.tsx`
- `src/ResourceMeter.tsx`
- `src/ServerInterior.tsx`
- `src/Shroud.tsx`
- `src/StatusDashboard.tsx`
- `src/SystemDiagnostics.tsx`
- `src/TuningInspector.tsx`
- `src/Workshop.tsx`
- `src/components.ts`
- `src/guidance.test.tsx`
- `src/main.tsx`
- `src/sim/diagnostics.test.ts`
- `src/sim/diagnostics.ts`
- `src/sim/engine.test.ts`
- `src/sim/engine.ts`
- `src/sim/feedback.ts`
- `src/sim/hardware.ts`
- `src/sim/interventions.ts`
- `src/sim/types.ts`
- `src/sim/upgrades.ts`
- `src/simple.css`
- `src/useCollisionAnchor.ts`
- `src/useGuidance.ts`
- `src/useLiveFeed.ts`
- `src/useSceneCamera.ts`

## Next step

The approved implementation is complete. For a fresh coding session, first inspect the current Git commit and native Site version/deployment receipt so work starts from this release. Do not reopen the old rollback or silently change balance. Any further economy work should start with the separate report and an explicitly scoped proposal; no experimental constants are ready to ship. No additional feature work is required by this release plan.
