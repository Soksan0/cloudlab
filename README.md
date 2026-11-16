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

After orientation, the priority card diagnoses the current constraint and recommends an available upgrade or the next prerequisite. A purchase that will not solve that constraint prompts advice before spending, with **Buy anyway** available. Reliability purchases can still be sensible even when they do not increase throughput.

Click any map component for its purpose, current capacity, and related upgrades. **Help** provides a glossary and tutorial replay on the current lab without deleting progress.

Standard requests earn $4 and AI requests $12. Operating expenses are deducted separately. One real second equals one game minute at normal speed. Economy autoscaling reacts after ten game minutes; Resilient reacts after three, maintains more capacity, and costs more.

Progress is stored in localStorage, including tutorial progress and manual pause. Version-one saves migrate automatically. Closing or hiding the page never produces offline earnings. Export a backup with **Save**; invalid imports do not replace the current company.

## QA

The browser suite tests the production build by default. Close any development server on port 4173 before running it. Chromium runs the full gameplay suite; Firefox and WebKit run welcome, controls, and desktop-layout smoke tests. Browser screenshots are written to test-results.
