# CloudLab

CloudLab is a pixel-art infrastructure game built with React, TypeScript, and Vite. Read the live monitor, identify a bottleneck, upgrade the right resource, and grow a reliable company through procedural levels.

## Run and verify

```bash
npm install
npm run dev
npm test
npm run build
npm run test:e2e
```

## Monitor, diagnose, upgrade

Click the workshop’s **Performance & Operations** monitor, or use its shortcut from any view. The projected dashboard stays live while you browse **Performance**, **Finance**, **Operations**, and **Events**. Performance shows incoming traffic, served percentage, the limiting resource, and a direct **Inspect upgrade** action. The graph contains the last 60 active seconds; it is not a decorative success animation.

The floating tuning console shows one component at a time. Its game-styled **Equipment / Technology** chooser supports keyboard navigation and stays inside the desktop playfield. Select CPU, Memory, Storage (SSD), or Network to focus its physical location inside the server; cloud and GPU controls focus their remote service nodes. Clicking equipment directly preserves the current view.

Each component has a short purpose, physical specifications, upgrade price, and immediate local feedback. Missing prerequisites lead directly to the required component. **Learn more** keeps conversion assumptions on optional pages. **Workshop**, **Server Interior**, and **Service Flow** explain the physical equipment and service relationships without drawing one object for every fleet worker.

Drag to pan, use trackpad scrolling to move the camera, and pinch or Ctrl-wheel to zoom. **+**, **−**, and **Fit** provide visible alternatives. Manual framing persists until Fit or explicit component navigation. A drag does not accidentally select or purchase a part.

## Levels, recovery, and events

A company level has fixed traffic and a work quota. Completing that quota while serving at least 98% of requests advances the level. At 1×, a healthy early level takes approximately 25 seconds. When the system falls behind, earned progress remains and demand does not continue increasing. CPU-heavy, data-heavy, and AI workloads gradually add resource tradeoffs; heavier work earns correspondingly higher fictional fees.

Individual hardware has plausible limits. Further growth comes from additional servers, storage groups, network links, cloud workers, and GPU workers. **Budget Guard** warns about operating losses and reduces unused capacity rather than allowing idle rentals to create a debt spiral. Costs remain visible in the ledger; it does not invent revenue or delete owned equipment.

Events occur at eligible fifth-level checkpoints, never overlap, and have a quiet period after resolution. The default event window is 75 seconds, with event-specific windows between 60 and 90 seconds. Event clocks measure active real time at every game speed. Pauses, blocking popups, hidden tabs, and closed pages stop those timers. The company may continue leveling during an event; overlapping checkpoints do not accumulate a backlog.

The small trophy button opens **Achievements** and displays available rewards. Completing a checkpoint unlocks a reward; **Claim rewards** credits it once. Rewards are separate from customer earnings. Existing rewards that were already paid before migration are not paid again.

## Money and time

All prices are fictional game prices. Completed work earns revenue; rejected work earns nothing. More demanding profiles receive higher fees.

**Available funds = opening funds + customer revenue + rewards + training grants − purchases − operating expenses.**

The steady **Profit/min** badge and subdued receipts show customer revenue minus operating expenses. Green means profit, red means loss, and zero is neutral. Purchases, grants, and reward claims never appear as operating profit. Funds use a stable layout; purchase deductions appear immediately. Finance provides current rates, balance, Budget Guard status, and the detailed ledger.

At 1×, one real second advances one simulated minute for service and financial calculations. The 2× and 4× controls accelerate that simulation; event reaction time remains an active real-time countdown such as `01:15`. Paused, hidden, and closed pages produce no offline earnings.

Hardware uses cores and GHz, GiB, IOPS, MiB/s, Mbps/Gbps, and GPU count/VRAM. Explicit workload assumptions derive service estimates. GHz measures cycles rather than a universal instruction or operation count. Virtualization partitions existing resources with overhead; load balancing routes traffic without creating bandwidth; shared data and network resources can constrain an expanded compute fleet.

## Learning and saves

The tutorial prompts real actions, provides required purchase funding, teaches the performance monitor and reward claims, and protects the live company during replay. **Hint** explains the current constraint or reassures the player that service is healthy. Major incident, technology, and result popups pause for reading and preserve the player’s manual pause state.

The menu contains Help, Save, and settings. Finance, Operations, Events, and the trophy are directly accessible rather than hidden in that menu. Export a backup before resetting or clearing browser storage.

Progress is stored locally in the browser. Existing companies migrate without losing cash, purchases, achievements, or reports. Migration avoids sudden workload jumps and retroactive payouts. Invalid imports leave the current company unchanged. Graph samples and historical notification bookkeeping stay bounded for long sessions.

## Accessibility and QA

The original SVG city, equipment, people, and signs share locally bundled pixel fonts; their licenses are under `public/fonts/`. Controls support keyboard navigation, clear focus, and reduced motion. Sound is optional.

Playwright tests the production build on localhost port 4173. Close unrelated servers on that port before running the suite. Chromium covers gameplay, progression, dashboard operation, custom selectors, camera gestures, rewards, events, finances, and saves. Firefox and WebKit cover the desktop smoke and layout matrix. Responsive checks cover 780×600 through 1920×1080 and verify that views, selectors, dashboards, and overlays fit without page or panel scrolling. Screenshots are written to `test-results/`.

Validation for the endless-game update: 84 unit tests pass, including an actual progression run through 10,000 levels with affordable recovery and ledger checks. The 54 browser scenarios cover Chromium gameplay and the five desktop sizes across Chromium, Firefox, and WebKit. A 60-active-second, 4× headless Chromium profile at 1440×900 recorded no long tasks; history stayed at 60 samples and receipts at three. A separate 90-view-change audit retained one camera listener per event and one connected scene SVG. These measurements describe the local QA environment rather than a performance guarantee for every device.
