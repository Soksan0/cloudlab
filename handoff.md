# CloudLab coding handoff

Updated 2026-11-18, Asia/Phnom_Penh (UTC+07:00).

## Current status — read this first

The latest user decision was to **restore the build that was live around 9:07 AM on November 17**. That rollback is complete. Do not assume the newer endless-game implementation is the desired baseline for further work.

- Repository: `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab`
- Live Site: https://cloudlab-infra-tycoon.jetdew16.chatgpt.site
- Site project ID: `appgprj_6afa9e6b5aac81919edd603746760ef4`
- **Live restored version: 6**, source commit `9b7d9f23dfe9ddda87afcf4a0d0140d9b3c01002`, committed November 17 at **09:04:54 +07:00**. This was the matching saved build around 09:07.
- Saved version ID: `appgprj_6afa9e6b5aac81919edd603746760ef4~appgver_8eab195e9b508191bd2ca3e5f873e009`
- Successful rollback deployment: `appgdep_6afc152035ac8191a468e636908b6592`, completed November 17 at 15:49:49 +07:00.
- Audience remains owner-only (custom access policy, sole owner, no groups).
- **Local HEAD is still version 7**, commit `83e83f0a5cd249ba924bfd635620bcea8d8ae034`, committed November 17 at 15:36:14 +07:00. Rollback redeployed the archived version; it did not roll back the local checkout or Git branch.
- Version 7 remains recoverable as saved version `appgprj_6afa9e6b5aac81919edd603746760ef4~appgver_e2808f4003448191ae38beee9325ff91`.

On inspection for this handoff, two files already had uncommitted changes: `src/App.tsx` and `src/useLiveFeed.ts`. Their origin is not established by this turn; preserve them. They partially undo version-7 refinements: fleet feedback/coalescing, reward timer cleanup, direct-click camera preservation, chooser CPU tutorial advancement, and receipt expiration. They are **not** a complete rollback to version 6. The current dirty checkout has not been revalidated. This handoff is the only file intentionally added in the present documentation task. No deployment is requested for this handoff.

## 1. Main goal and requirements

CloudLab is an educational incremental infrastructure game. The core learning loop is inspect the service, identify its constraint, upgrade a component, and observe the result. Preserve React/Vite, browser-local saves, fictional game prices, the pixel cyberpunk artwork, and the existing Site identity.

Earlier accepted requirements implemented across the saved versions:

- A compact, visualization-first desktop interface with Workshop, Server Interior, and Service Flow views; a floating Equipment/Technology tuning console; readable locally bundled pixel fonts and coherent neon equipment/city graphics.
- No page or gameplay-panel scrolling at 780×600, 1024×600, 1280×720, 1440×900, and 1920×1080.
- Short explanations by default; optional paginated Learn more content. Actionable prerequisites, consistently named Storage (SSD), component selection linked to visual focus, and immediate purchase feedback in every view.
- Interactive tutorial actions, funded required purchases, replay protection, useful bottleneck hints, concise large incident/technology/result popups, and correct pause restoration.
- Meaningful physical units: CPU cores × GHz, RAM/storage GiB, storage IOPS/MiB/s, network Mbps/Gbps, GPU count/VRAM. Explicit workloads derive service capacity; shared storage, routing, cache, virtualization overhead, rental charges, provisioning, backups, and failover have distinct roles.
- One financial ledger: cash = opening funds + customer revenue + rewards + grants − purchases − operating expenses. Completed work earns revenue; costs are recorded even when cash is depleted. Operating profit excludes purchases/rewards/grants.

The subsequent **version-7 endless-game plan was implemented and published, then the user requested rollback**. Its requirements were:

- Fixed demand per company level, approximately 25 healthy seconds per quota at 1×; progress requires at least 98% served and freezes under overload without escalating demand or reputation penalties.
- Linear base demand growth (7% of starting traffic per level), gradually introduced CPU/data-heavy profiles, and AI demand introduced only after launch.
- Bounded hardware tiers with repeatable servers, storage groups, network links, cloud workers, and GPU workers; representative fleet drawings rather than one object per machine.
- Budget Guard on by default, standby capacity, and autoscaling based on admitted traffic and shared-storage limits.
- Events at eligible fifth-level checkpoints, no overlapping/backlogged events, at least 45 quiet active seconds afterward, 60–90 active-real-second windows (default 75), independent of financial simulation speed.
- Explicit trophy reward claims, live Performance/Finance/Operations/Events dashboard on the workshop monitor, themed chooser, persistent manual pan/zoom/Fit, subdued net-profit receipts, and removal of the coffee sticker.

Do not automatically reintroduce these version-7 features after the rollback. Wait for the next concrete feature/fix request and apply it against the restored baseline.

## 2. Architectural decisions

- Keep deterministic simulation calculations in `src/sim/`; keep camera, interpolation, receipts, selection, and other presentation state outside financial calculations.
- Existing purchase, preview, stepping, serialization, and import entry points were retained and updated together with consumers.
- Version 7 uses GameState save version **6** (this is distinct from Site version 6). Added company quota/progress, workload offsets/mix, fleet counts, Budget Guard, claim records/cursor, real-time event state, and AI launch level.
- Version-7 base traffic is `45 * (1 + .07 * (level - 1))`; quota is base traffic × 60 × 25. One real second at 1× advances one simulated minute. Events instead decrement active real time; paused/hidden/closed pages earn nothing and consume no event time.
- CPU/RAM tiers remain per-host bounded. Shared storage groups and network links expand aggregate capacity; additional application hosts cannot bypass storage or uplink constraints.
- Rentals provision with a two-simulated-minute delay. Autoscaling respects admitted work and storage limits. Budget Guard trims idle rentals and puts excess owned servers in standby while preserving data/hardware and honest costs.
- Rewards are completed separately from claimed rewards. Recurring checkpoint claims use a cursor instead of an ever-growing list. Notification queues, event reports, logs, and graphs are bounded.
- Shared component metadata lives in `src/components.ts`. The custom chooser supports arrows, Home/End, Enter, Escape, outside dismissal, and focus restoration.
- Camera framing uses imperative SVG viewBox updates, per-view cached frames, explicit navigation `focusKey`, resize observers, wheel/pinch/drag/keyboard controls, and a 5px drag threshold. Simulation rerenders must not recenter manual framing.
- Dashboard browsing keeps play running and collapses tuning controls. Blocking explanations/reports pause play without changing the player's prior manual pause state.
- `useLiveFeed` samples once per second, bounds history to 60 and receipts to three, and uses actual revenue-minus-expense ledger deltas. HUD/Finance passive displays refresh calmly; spending appears immediately.
- Migration preserves cash, purchased progression, paid achievements, reports, and remaining active-event fraction. Legacy rewards become already claimed. Active legacy event totals are retained; estimated historical real duration is marked partial.
- Local save key remains `cloudlab-save-v1`; version-7 pre-migration backup key is `cloudlab-save-pre-v6`, with fallback access to `cloudlab-save-pre-v5`.
- Publishing uses the Sites skill/source helper and exact pushed commits plus deployment archives. Redeploying an existing archived version needs no source rewrite. Preserve audience; never expose repository credentials or Site bypass tokens.

## 3. Exact paths changed

The following files were added or modified in the version-7 implementation commit `83e83f0` relative to restored source `9b7d9f2`:

```text
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/README.md
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/e2e/game.spec.ts
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/App.tsx
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/ComponentChooser.tsx
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/InfrastructureMap.tsx
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/LiveDashboard.tsx
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/ServerInterior.tsx
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/Workshop.tsx
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/camera.css
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/endless.css
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/main.tsx
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/sim/endless.test.ts
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/sim/engine.test.ts
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/sim/engine.ts
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/sim/feedback.test.ts
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/sim/feedback.ts
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/sim/hardware.ts
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/sim/types.ts
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/sim/upgrades.ts
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/useLiveFeed.ts
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/useSceneCamera.ts
```

Additional paths changed in earlier saved revisions after the first saved source commit `16b7bdc` (some generated files were subsequently removed; this is historical, not an assertion that every path still exists):

```text
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/.gitignore
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/playwright.config.ts
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/playwright.config.js
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/playwright.config.d.ts
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/public/fonts/OFL.txt
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/public/fonts/PressStart2P-Regular.ttf
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/public/fonts/VT323-OFL.txt
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/public/fonts/VT323-Regular.ttf
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/TechArt.tsx
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/app-panels.css
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/compact.css
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/components.ts
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/pixel.css
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/styles.css
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/src/useEarnings.ts
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/tsconfig.app.tsbuildinfo
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/tsconfig.node.json
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/tsconfig.node.tsbuildinfo
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/vite.config.js
/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/vite.config.d.ts
```

Current documentation addition: `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab/handoff.md`.

## 4. Tried, failed, and corrected

- Original problems included arbitrary capacity units, confusing money routing, dense text/segmentation, native dropdowns, decorative monitoring, overload-driven demand growth, automatic rewards masking purchase deductions, hard fleet caps, and very short accelerated events. These motivated the two successive redesigns; the user ultimately preferred restoring the earlier build after version 7.
- Initial camera/dashboard browser checks reported SVG interception of overlay clicks. Fresh production builds with the completed overlay CSS passed; do not reuse a stale preview bundle.
- Layout tests initially counted decorative projection rays extending outside the dashboard as panel overflow. The oracle now verifies content/control bounds while allowing the intentional decorative projection.
- Capped-resource recommendations initially redirected to cloud/autoscaling prerequisites, eventually returning no action despite available fleet expansion. Version 7 now links to the constrained equipment card, or the Load Balancer prerequisite for server expansion.
- Legacy event migration initially discarded in-progress measured report totals. Version 7 now retains those totals and the remaining-time fraction.
- Healthy classification originally used 98.5% while progression used 98%, making dashboard stall guidance contradictory. Version 7 aligns both at 98%.
- The 10,000-level test first failed only on a floating-point reconciliation tolerance: about $0.000048 difference at roughly $1.65 billion. The long-run ledger assertion now allows less than $0.001, still below a cent; no money clamp or unrecorded credit was added.
- A new tutorial regression found that clicking the already-active Equipment tab advanced the CPU selection task before the chooser was used, opening a blocking explanation mid-action. Version 7 ignores redundant category-tab selection and the regression passes.
- Version-7 refinements included immediate purchase display, expansion-specific FLEET feedback, saved reward-step restoration, manual framing on direct clicks, receipt expiration, reward-timer cleanup, and avoiding per-tick localStorage writes for Budget Guard's loss timer. Some are partially undone in the current dirty files; inspect their diff before assuming these guarantees.
- Subagents hit usage limits near the end of implementation. Root completed the remaining tests, listener audit, publication, and rollback. No agents are needed for this documentation request.
- Remote-origin computer-use observation had previously been declined. Do not silently retry that route. Local browser QA and successful native Sites deployment results supplied verification.

### Verification already completed (historical, not a fresh dirty-checkout result)

- Version-6 baseline reported 58 unit tests and 47 browser scenarios passing before endless work.
- Version 7: production build passed; 84 unit tests passed, including actual progression through 10,000 levels with finite values, affordable expansion/recovery, save reloads, bounded history, and ledger reconciliation.
- Version 7: 53 browser scenarios passed in one complete run, then an additional compact capped-prerequisite/fleet-card regression passed (54 total covered). Chromium exercised gameplay; Chromium/Firefox/WebKit covered the five desktop sizes. Checks included tutorial/replay/reload/claims, event speeds, hidden pages, routing controls, migration, chooser keyboard behavior, camera gestures, receipts, and layout.
- A 60-active-second headless Chromium profile at 4×, 1440×900, advanced level-101 fleet recorded no long tasks; graph history stayed at 60 and receipts at three. A separate 90-view-change audit retained one listener per camera/window event and one connected scene SVG. This is local QA evidence, not a universal performance guarantee.
- Temporary QA artifacts may remain at `/tmp/cloudlab-perf-review/profile.json`, `/tmp/cloudlab-perf-review/listener-audit.json`, and `/tmp/cloudlab-perf-review/advanced-4x-profile.png`. Temporary paths may disappear between sessions.
- Version-7 archive: `/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab-endless.tar.gz`.
- No tests were rerun for the hosting-only rollback; the exact existing version-6 archive was redeployed successfully. The rollback did not alter browser-local saves. A save migrated by version 7 may need its pre-v6 backup when used with the older build; do not clear browser storage casually.

## 5. Exact next step

**The requested rollback is finished. No further feature change or deployment is currently authorized by this handoff request.** For the next coding session, first inspect the local-versus-live mismatch and preserve the dirty edits before applying any requested change:

```bash
cd '/Users/soksanhay/Documents/ChatGPT/ICT-209 AI/cloudlab'
git status --short
git diff -- src/App.tsx src/useLiveFeed.ts
git diff --stat 9b7d9f23dfe9ddda87afcf4a0d0140d9b3c01002 HEAD
```

Then treat `9b7d9f23dfe9ddda87afcf4a0d0140d9b3c01002` as the user-selected baseline for the next requested work. Preserve version 7 and all uncommitted changes before arranging a checkout/branch based on version 6. Do not blindly reset, overwrite files, or publish the current HEAD: doing so would undo the requested live rollback. If the user has not supplied a new change request, stop after reporting this state.

For later authorized implementation, use `npm test`, `npm run build`, and `npm run test:e2e` as appropriate. Playwright uses localhost port 4173 and tests production output. Read the Sites skill and relevant local-preview instructions before browser work/publication; refresh Site ownership/audience and credentials rather than reusing expired secrets. The Sites skill is `/Users/soksanhay/.codex/plugins/cache/openai-curated-remote/sites/1.1.6/skills/sites/SKILL.md`.
