# CloudLab

CloudLab is a pixel-art cloud infrastructure tycoon built with React, TypeScript, and Vite. Start with an office server, learn to identify bottlenecks, expand into a rooftop facility and cloud operations room, and test the system with AI Launch Day.

## Run locally

```bash
npm install
npm run dev
```

## Verify

```bash
npm test
npm run build
npm run test:e2e
```

## Play and learn

A new lab opens at a paused welcome screen. **Start tutorial** provides funded, guided experiments; **Skip to sandbox** starts independent play. Tutorial explanations pause the lab. **Help** can replay training without spending live company funds or deleting progress.

Three linked views explain the same system. **Workshop** shows the facility and city; **Server Interior** reveals the CPU, RAM, drives, network interface, motherboard, power supply, and cooling; **Service Flow** shows how customers, cache, application servers, shared storage, and GPU services interact. Select equipment to inspect or upgrade it. Moving packets are a sample of traffic, not one sprite per customer request.

CPU specifications use cores and GHz; memory uses GiB; storage shows used/total space, IOPS, and MiB/s; networking uses Mbps/Gbps; GPUs show their count and VRAM. Workload profiles convert these specifications into estimated requests/second. **Why?** explains the assumptions: GHz measures clock cycles, not a universal number of instructions or operations. Storage capacity and storage access performance are separate limits.

Virtualization partitions existing hardware with overhead. Load balancing distributes requests and checks healthy servers without creating CPU or network bandwidth. Cloud instances are rented and incur recurring charges; adding compute does not remove the shared storage limit. Backups help restoration, while redundancy and failover help availability. AI requests still need application and data handling as well as GPU capacity.

**Hint** is optional. Upgrade previews compare physical resources, expected throughput, current-demand income, and the remaining bottleneck. Hardware specifications have bounded tiers; expansion continues through additional machines and rented resources. The milestone strip explains the next capability. The city and facility change as the company reaches rooftop, cloud, and AI milestones. Customer demand grows from service performance and reputation, rather than jumping when hardware is purchased.

Routine technology unlocks, achievements, incidents, and completed reports use live notifications and do not interrupt play. Deliberately opening a report pauses the simulation until it closes and preserves any manual pause. Diagnostics, Finance, operating policies, achievements, and event history remain available beneath the scene.

## Economy and time

All prices are fictional game prices, not cloud-provider quotations. Completed standard requests earn **$4 per 1,000 requests**; completed AI requests earn **$12 per 1,000 requests**. Rejected requests earn nothing. The Finance ledger separates customer revenue, rewards, training grants, equipment and technology purchases, and operating expenses:

**Available funds = opening funds + customer revenue + rewards + training grants − purchases − operating expenses.**

The response terminal shows recorded customer revenue only. Purchases, rewards, and grants are not customer earnings. Operating costs continue for provisioned resources even when they are idle. Negative funds retain the debt rather than silently discarding costs; **Stop rentals** reduces rental costs to help the company recover.

At **1×**, one real second advances one simulated **minute**. The 2× and 4× controls accelerate that clock. Throughput is displayed in requests/second and financial rates in dollars/minute; the engine converts those units when integrating progress. Pause, hidden tabs, and closed pages produce no offline earnings.

## Saves and compatibility

Progress is stored in browser localStorage, including tutorial progress, hardware levels, finances, policies, achievements, and manual pause. Older saves migrate to **version five**, preserving cash, purchases, and progression while mapping hardware levels to the new catalog. A pre-migration backup remains recoverable from **Save**. Historical achievements are recognized without issuing rewards twice. Invalid imports leave the current company unchanged.

Use **Save** to export a portable snapshot. Keep an exported backup before resetting the lab or clearing browser storage.

## Artwork and accessibility

The city, equipment, people, diagrams, and signs use original pixel-style SVG artwork. Locally bundled font licenses are included under `public/fonts/`. Neon lettering has aligned sign housings and bright cores; essential text stays readable without glow. Reduced motion keeps information available with static artwork. Sound is optional. Interactive equipment, tabs, dialogs, and controls support keyboard navigation.

## Browser QA

The Playwright suite tests the production build. Close any unrelated server on port 4173 before running it. Chromium runs the gameplay and accounting scenarios; Firefox and WebKit run welcome, controls, and desktop-layout smoke tests. Tests cover tutorial completion, purchases, continuous play, physical specifications, linked views, saves, finances, policies, launch results, and responsive layouts. Screenshots are written to `test-results/`.
