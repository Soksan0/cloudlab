# CloudLab

CloudLab is a pixel-art infrastructure tycoon built with React, TypeScript, and Vite. Start with a borrowed server, learn to remove bottlenecks, expand into cloud services, and test your design on Launch Day.

## Run and verify

```bash
npm install
npm run dev
npm test
npm run build
npm run test:e2e
```

## Play the system

The desktop playfield fits the available window. The floating tuning console shows one part at a time: choose **Equipment** or **Technology**, then a component. Choosing CPU, Memory, Storage (SSD), or Network focuses its physical location inside the server. Cloud and GPU controls focus their remote service nodes. Clicking the scene also selects the corresponding controls without changing views.

Each card provides a short purpose, physical specifications, the next upgrade, and its price. Missing prerequisites are links to the required component. **Learn more** keeps the conversion assumptions and deeper explanations available on separate pages. Upgrades show a local level change and specification-change badge in all three views. Rented resources show their startup state until they are ready.

**Workshop** shows your facility and city, **Server Interior** shows the physical parts, and **Service Flow** shows requests, shared data, cache, cloud, and GPU routes. Facility artwork advances through workshop, rooftop, cloud operations, and AI milestones. Moving segments represent sampled traffic, not one sprite per request.

The tutorial teaches by asking you to inspect, select, and upgrade real components. Required purchases are funded, traffic continues during guided actions, and explanations pause for reading. Replay preserves the live company. **Hint** opens a small bubble explaining the current constraint, or tells you everything is working well.

Major incidents, event results, technology acquisitions, and launch results use short popups. Reading pauses the simulation; Continue restores the previous manual pause state. Incident results distinguish actual net profit or loss from potential revenue that was never earned. History remains available from the menu.

## Money, time, and hardware

All prices are fictional game prices. Completed standard responses earn **$4 per 1,000**, and AI responses earn **$12 per 1,000**. Rejected work earns nothing.

**Available funds = opening funds + customer revenue + rewards + training grants − purchases − operating expenses.**

The steady **Profit/min** badge is customer revenue minus operating expenses. Green means profit, red means loss, and zero is neutral. Purchases, rewards, and grants are separate transactions. Funds keep a fixed layout and update calmly; purchase deductions appear immediately. Running cloud and GPU instances incur costs even when idle. **Stop rentals** reduces those costs; debt is retained rather than silently discarded.

At 1×, one real second advances one simulated minute. The 2× and 4× controls accelerate that clock. Hardware and traffic rates use seconds, while financial rates use minutes. Paused, hidden, and closed pages produce no offline earnings.

CPU uses cores and GHz; RAM uses GiB; storage uses GiB, IOPS, and MiB/s; networking uses Mbps/Gbps; GPUs show count and VRAM. Explicit workload assumptions produce the displayed capacity estimates. GHz measures clock cycles, not a universal operations count. Virtualization partitions existing hardware with overhead, load balancing routes traffic without creating bandwidth, and additional compute remains constrained by shared data resources. Backups support restoration; healthy replicas and failover support availability.

## Saves and accessibility

Progress is stored locally in the browser, including purchases, finances, achievements, tutorial progress, and manual pause. Existing version-five companies and older saves remain compatible. Legacy pending notifications are archived rather than replayed as a backlog. Historical reports remain accessible. Invalid imports leave the current company unchanged; pre-migration backups remain recoverable where available.

The menu opens compact Finance, Operations, Achievements, History, Help, Save, and settings overlays. Longer information uses pages or tabs. Export a backup before resetting or clearing browser storage.

The original SVG city, equipment, people, and signs share locally bundled pixel fonts; licenses are under `public/fonts/`. Controls support keyboard navigation and clear focus. Reduced motion retains static highlights and upgrade badges without camera motion. Sound is optional.

## Browser QA

Playwright tests the production build on localhost port 4173. Close unrelated servers on that port before running the suite. Chromium covers gameplay, guided actions, prerequisite navigation, popups, finances, saves, and upgrade feedback. Firefox and WebKit run desktop smoke checks. Responsive checks cover compact desktop windows through 1920×1080 and verify the scene, console, selectors, and overlays without page or panel scrolling. Screenshots are written to `test-results/`.
