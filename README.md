# CloudLab

CloudLab is a desktop browser infrastructure tycoon. Serve customer requests, diagnose bottlenecks, upgrade a single office server into a resilient cloud platform, and validate the design with an AI Launch Day challenge.

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

## Learning the game

New labs begin at a paused welcome screen. Choose **Start tutorial** for eight guided lessons, or **Skip to sandbox** to experiment immediately. Explanations pause the company; short demonstrations show request flow and bottlenecks. Training grants cover CPU, memory, and SSD purchases.

After orientation, **Hint** is optional and always visible. It explains the current constraint and can highlight an upgrade. Purchases happen directly. Reliability investments can protect the service even when they do not increase throughput.

Click workshop equipment to open its controls. CPU, memory, storage, network, cloud, and AI support repeatable levels, bought singly or with **Max**. Prices grow by 35% per level, rounded up; levels add permanent capacity alongside rented elastic capacity. Technology unlocks new systems. **Help** provides tutorial replay without deleting progress.

Ten achievements automatically credit cash once. Major incidents and first technology unlocks pause for a central announcement; **Continue** preserves your previous manual pause state. Achievement celebrations do not stop play. Diagnostics, operating policies, achievements, and event history live in compact drawers beneath the workshop.

Standard requests earn $4 and AI requests $12. Operating expenses are deducted separately. One real second equals one game minute at normal speed. Economy autoscaling reacts after ten game minutes; Resilient reacts after three, maintains more capacity, and costs more.

Progress is stored in localStorage, including tutorial progress, equipment levels, achievement records, pending announcements, and manual pause. Older saves migrate to version four with purchases and cash preserved; historical achievements are recognized without backpay. Closing or hiding the page never produces offline earnings. Export a backup with **Save**; invalid imports do not replace the current company.

Equipment benefits use simplified workload limits, not literal GHz or GB. Purchase previews and celebrations calculate effective rates before and after the purchase, including policies and virtualization, and show income changes at current demand. The billing terminal animates recorded customer gross revenue; rewards and spending never appear as customer earnings.

Incidents accumulate measured requests, revenue, costs, and losses throughout their game-time duration. Their reports compare actual gross earnings with the ceiling from serving all arriving paid requests, identify the dominant limiting stage, and remain available in event history. Incidents imported from older saves measure only the portion after migration and label this explicitly.

The pixel illustrations are original SVG artwork. The locally bundled Press Start 2P display font is licensed under the SIL Open Font License; see public/fonts/OFL.txt. Reduced motion uses static artwork and immediate scenery changes; mute disables feedback sounds.

## QA

The browser suite tests the production build by default. Close any development server on port 4173 before running it. Chromium runs the full gameplay suite; Firefox and WebKit run welcome, controls, and desktop-layout smoke tests. Browser screenshots are written to test-results.
