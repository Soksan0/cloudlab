import { expect, test, type Page } from '@playwright/test'
import {
  acknowledgeAnnouncement, calculateMetrics, createInitialState, getNextAnnouncement,
  purchaseEquipment, purchaseUpgrade, serializeGame, skipTutorial, startChallenge,
  stepGame, triggerIncident,
} from '../src/sim/engine'
import { UPGRADES } from '../src/sim/upgrades'
import type { GameState, UpgradeId } from '../src/sim/types'

const SAVE_KEY = 'cloudlab-save-v1'
const pageErrors = new WeakMap<Page, string[]>()
test.beforeEach(async ({ page }) => {
  const errors: string[] = []; pageErrors.set(page, errors)
  page.on('pageerror', error => errors.push(error.message))
})
test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page), 'No unhandled browser errors').toEqual([])
})

function acknowledgeAll(state: GameState) {
  let event = getNextAnnouncement(state)
  while (event) { state = acknowledgeAnnouncement(state, event.id); event = getNextAnnouncement(state) }
  return state
}
function fund(state: GameState, cash: number) {
  state.cash = cash
  const r = state.revenue
  r.opening = cash - r.gross - r.grants - r.rewards + r.purchases + r.expenses
  return state
}
function sandbox(upgrades: UpgradeId[] = []) {
  let state = fund(skipTutorial(createInitialState()), 1_000_000)
  for (const id of upgrades) state = acknowledgeAll(purchaseUpgrade(state, id))
  state.incident = null; state.incidentQueue = []; state.nextIncidentAt = 1_000_000
  state.paused = false; state.reputation = 80; state.metrics = calculateMetrics(state)
  return state
}
function completeLab() { return sandbox(UPGRADES.map(upgrade => upgrade.id)) }
async function openGame(page: Page, state?: GameState | string) {
  await page.clock.install()
  await page.addInitScript(({ key, save }) => {
    if (!sessionStorage.getItem('cloudlab-test-initialized')) {
      localStorage.clear(); if (save) localStorage.setItem(key, save)
      sessionStorage.setItem('cloudlab-test-initialized', 'yes')
    }
  }, { key: SAVE_KEY, save: typeof state === 'string' ? state : state ? serializeGame(state) : null })
  await page.goto('/')
}
async function saveSnapshot(page: Page): Promise<GameState> {
  await page.getByRole('button', { name: /^save$/i }).click()
  const value = await page.getByLabel('Save data').inputValue()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  return JSON.parse(value)
}
function expectBalanced(state: GameState) {
  const r = state.revenue
  expect(state.cash).toBeCloseTo(r.opening + r.gross + r.grants + r.rewards - r.purchases - r.expenses, 6)
}
async function finishTutorial(page: Page) {
  let turns = 0
  while (turns++ < 45 && await page.getByTestId('tutorial-banner').isVisible()) {
    const banner = page.getByTestId('tutorial-banner'), phase = await banner.getAttribute('data-phase')
    if (phase === 'demo') await page.clock.runFor(6_000)
    else if (phase === 'action') {
      const purchase = page.locator('.tutorial-target').getByRole('button', { name: /^Purchase / })
      await expect(purchase).toBeEnabled()
      await purchase.click()
    } else await page.getByTestId('tutorial-next').click()
  }
  await expect(page.getByTestId('tutorial-banner')).toBeHidden()
}

test('welcome requires a choice and leaves the company paused while reading', async ({ page }) => {
  await openGame(page)
  const welcome = page.getByRole('dialog', { name: 'Your cloud starts here.' })
  await expect(welcome).toBeVisible(); await page.clock.runFor(5_000)
  await expect(welcome).toBeVisible()
  await page.getByRole('button', { name: 'Skip to sandbox', exact: true }).click()
  await expect(welcome).toBeHidden()
  expect((await saveSnapshot(page)).elapsed).toBeLessThan(1)
})

test('a beginner completes funded guided actions and reaches independent play', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await openGame(page)
  await page.getByRole('button', { name: 'Start tutorial', exact: true }).click()
  await finishTutorial(page)
  const snapshot = await saveSnapshot(page)
  expect(snapshot.tutorialComplete).toBe(true)
  expect(snapshot.upgrades).toEqual(expect.arrayContaining(['cpu', 'memory', 'ssd']))
  expectBalanced(snapshot)
  await expect(page.getByTestId('milestone-strip')).toBeVisible()
  await page.screenshot({ path: 'test-results/cloudlab-tutorial.png' })
})

test('tutorial reload restores the lesson and skipping reaches equipment', async ({ page }) => {
  await openGame(page); await page.getByRole('button', { name: 'Start tutorial', exact: true }).click()
  await page.getByTestId('tutorial-next').click(); await page.clock.runFor(6_000)
  const step = await page.getByTestId('tutorial-banner').getAttribute('data-step')
  await saveSnapshot(page); await page.reload()
  await expect(page.getByTestId('tutorial-banner')).toHaveAttribute('data-step', step!)
  await page.getByRole('button', { name: 'Skip tutorial', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Upgrade CPU', exact: true })).toBeVisible()
})

test('equipment purchases repeat and Max stays within physical tiers and funds', async ({ page }) => {
  const state = fund(sandbox(), 5_000); state.paused = true
  await openGame(page, state)
  const cpu = page.getByRole('button', { name: 'Upgrade CPU', exact: true })
  await cpu.click(); await cpu.click()
  await expect(page.getByRole('dialog')).toBeHidden()
  expect((await saveSnapshot(page)).equipmentLevels.cpu).toBe(2)
  await page.getByRole('button', { name: /^(Buy )?Max$/i }).click()
  await page.getByRole('button', { name: 'Upgrade Memory', exact: true }).click()
  const snapshot = await saveSnapshot(page)
  expect(snapshot.equipmentLevels.memory).toBeGreaterThan(1)
  expect(snapshot.equipmentLevels.memory).toBeLessThanOrEqual(6)
  expect(snapshot.cash).toBeGreaterThanOrEqual(0)
  expectBalanced(snapshot)
})

test('all equipment tracks and technologies remain reachable through the tray', async ({ page }) => {
  const state = sandbox(); state.paused = true
  await openGame(page, state)
  for (const name of ['CPU', 'Memory', 'Storage', 'Network']) await page.getByRole('button', { name: `Upgrade ${name}`, exact: true }).click()
  await page.getByRole('button', { name: /^Technology/ }).click()
  for (const upgrade of UPGRADES.filter(upgrade => !['cpu', 'memory', 'ssd'].includes(upgrade.id))) {
    await page.getByRole('button', { name: `Unlock ${upgrade.name}`, exact: true }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
  }
  await page.getByRole('button', { name: 'Equipment', exact: true }).click()
  await page.getByRole('button', { name: 'Upgrade Cloud capacity', exact: true }).click()
  await page.getByRole('button', { name: 'Upgrade AI capacity', exact: true }).click()
  const snapshot = await saveSnapshot(page)
  expect(snapshot.upgrades).toHaveLength(12)
  for (const level of Object.values(snapshot.equipmentLevels)) expect(level).toBeGreaterThan(0)
  expectBalanced(snapshot)
})

test('physical specifications and Why explanations replace arbitrary capacity units', async ({ page }) => {
  const state = sandbox(); state.paused = true
  await openGame(page, state)
  const cpu = page.getByTestId('equipment-card-cpu')
  await expect(cpu).toContainText(/GHz/)
  await cpu.getByText('Why?', { exact: true }).click()
  await expect(cpu).toContainText(/cycles/i)
  await expect(cpu).toContainText(/instructions/i)
  await expect(page.getByTestId('equipment-card-memory')).toContainText(/GiB/)
  await expect(page.getByTestId('equipment-card-ssd')).toContainText(/GiB/)
  await expect(page.getByTestId('equipment-card-ssd')).toContainText(/IOPS/)
  await expect(page.getByTestId('equipment-card-network')).toContainText(/Mbps|Gbps/)
  await expect(page.locator('.app')).not.toContainText(/game minute|game min|permanent managed capacity/i)
})

test('linked views preserve selection and explain server parts and sampled service flow', async ({ page }) => {
  const state = completeLab(); state.paused = true
  await openGame(page, state)
  await page.getByRole('button', { name: 'Server Interior', exact: true }).click()
  await expect(page.locator('.app')).toContainText(/motherboard/i)
  await expect(page.locator('.app')).toContainText(/power supply/i)
  await page.getByRole('button', { name: /Select Memory|Inspect Memory|Inspect RAM/i }).click()
  await expect(page.getByTestId('equipment-card-memory')).toHaveClass(/is-selected/)
  await page.getByRole('button', { name: 'Service Flow', exact: true }).click()
  await expect(page.locator('.app')).toContainText(/sample/i)
  await expect(page.locator('.app')).toContainText(/shared.*data|shared.*storage/i)
  await page.getByRole('button', { name: 'Workshop', exact: true }).click()
  await expect(page.getByTestId('equipment-card-memory')).toHaveClass(/is-selected/)
  await expect(page.locator('.billing-route')).toHaveCount(0)
})

test('technology notifications preserve manual pause without a modal', async ({ page }) => {
  const state = sandbox(['cpu', 'memory', 'ssd']); state.paused = true
  await openGame(page, state)
  await page.getByRole('button', { name: /^Technology/ }).click()
  await page.getByRole('button', { name: 'Unlock Virtualization', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByTestId('live-alert')).toContainText(/Virtualization/i)
  await page.clock.runFor(5_000)
  const snapshot = await saveSnapshot(page)
  expect(snapshot.paused).toBe(true); expect(snapshot.elapsed).toBe(state.elapsed)
  expectBalanced(snapshot)
})

test('incidents notify continuously while service and elapsed time keep advancing', async ({ page }) => {
  let state = sandbox(['cpu', 'memory', 'ssd'])
  state.nextIncidentAt = 0; state = triggerIncident(state, 'marketing')
  await openGame(page, state)
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByTestId('live-alert')).toContainText(/viral|campaign/i)
  await page.clock.runFor(10_000)
  const snapshot = await saveSnapshot(page)
  expect(snapshot.elapsed).toBeGreaterThan(state.elapsed + 9)
  expect(snapshot.totalServed).toBeGreaterThan(state.totalServed)
  expectBalanced(snapshot)
})

test('cash ledger reconciles completed revenue, purchases, and one-time rewards', async ({ page }) => {
  const state = sandbox()
  await openGame(page, state)
  await page.clock.runFor(2_000)
  await page.getByRole('button', { name: 'Upgrade CPU', exact: true }).click()
  const first = await saveSnapshot(page)
  expect(first.revenue.gross).toBeGreaterThan(0)
  expect(first.revenue.purchases).toBeGreaterThan(0)
  expect(first.revenue.rewards).toBeGreaterThan(0)
  expectBalanced(first)
  await page.getByRole('button', { name: 'Finance', exact: true }).click()
  const ledger = page.getByTestId('cash-ledger')
  for (const label of ['Opening funds', 'Customer revenue', 'Rewards', 'Training grants', 'Equipment & technology', 'Operating expenses', 'Available funds']) await expect(ledger).toContainText(label)
  await page.getByRole('button', { name: /Pause/ }).click()
  const before = await saveSnapshot(page)
  await page.reload(); await page.clock.runFor(3_000)
  const after = await saveSnapshot(page)
  expect(after.cash).toBe(before.cash)
  expect(after.revenue.rewards).toBe(before.revenue.rewards)
  expect(after.achievementIDs).toEqual(before.achievementIDs)
})

test('pause, speed and optional flow animations respond', async ({ page }) => {
  await openGame(page, sandbox())
  await page.getByRole('button', { name: /Pause/ }).click()
  const before = await saveSnapshot(page); await page.clock.runFor(3_000)
  const after = await saveSnapshot(page); expect(after.cash).toBe(before.cash)
  await page.getByRole('button', { name: /Resume/ }).click()
  await page.getByRole('button', { name: '4×', exact: true }).click()
  await page.clock.runFor(1_000)
  expect((await saveSnapshot(page)).elapsed - after.elapsed).toBeGreaterThan(3.5)
  await page.getByRole('button', { name: /Flow off/i }).click()
  await expect(page.getByRole('button', { name: /Flow on/i })).toBeVisible()
})

test('policies retain cooldowns and rented resources can be stopped and resumed', async ({ page }) => {
  await openGame(page, completeLab())
  await page.getByRole('button', { name: 'Operations', exact: true }).click()
  await page.getByRole('button', { name: 'Firewall strict', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Firewall balanced', exact: true })).toBeDisabled()
  await page.clock.runFor(11_000)
  await expect(page.getByRole('button', { name: 'Firewall balanced', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Stop rentals', exact: true }).click()
  let snapshot = await saveSnapshot(page)
  expect(snapshot.rentalsEnabled).toBe(false)
  expect(snapshot.metrics.cloud).toBe(0)
  const stoppedExpense = snapshot.metrics.expenses
  await page.getByRole('button', { name: 'Resume rentals', exact: true }).click()
  await page.clock.runFor(4_000)
  snapshot = await saveSnapshot(page)
  expect(snapshot.rentalsEnabled).toBe(true)
  expect(snapshot.metrics.expenses).toBeGreaterThan(stoppedExpense)
})

test('v4 migration preserves the company and keeps a recoverable backup', async ({ page }) => {
  const state = sandbox(['cpu', 'memory', 'ssd']); state.paused = true
  const legacy = { ...state, version: 4, cash: 4321 }
  await openGame(page, JSON.stringify(legacy)); await page.clock.runFor(10_000)
  const snapshot = await saveSnapshot(page)
  expect(snapshot.version).toBe(5); expect(snapshot.cash).toBe(4321)
  expect(snapshot.upgrades).toEqual(expect.arrayContaining(['cpu', 'memory', 'ssd']))
  expect(snapshot.paused).toBe(true); expectBalanced(snapshot)
  await page.getByRole('button', { name: /^Save$/i }).click()
  await expect(page.getByRole('button', { name: 'Load pre-migration backup', exact: true })).toBeVisible()
})

test('invalid imports preserve the company and dialogs support Escape', async ({ page }) => {
  await openGame(page, sandbox(['cpu']))
  await page.getByRole('button', { name: /^Save$/i }).click()
  const dialog = page.getByRole('dialog')
  await page.getByLabel('Save data').fill('{"version":5,"cash":0,"equipmentLevels":{"cpu":-4}}')
  await page.getByRole('button', { name: 'Import save', exact: true }).click()
  await expect(dialog).toContainText(/invalid|incompatible/i)
  await page.keyboard.press('Escape'); await expect(dialog).toBeHidden()
  expect((await saveSnapshot(page)).upgrades).toContain('cpu')
})

test('tutorial replay preserves live finances and achievements', async ({ page }) => {
  const state = completeLab(); state.paused = true
  await openGame(page, state)
  const before = await saveSnapshot(page)
  await page.getByRole('button', { name: 'Help', exact: true }).click()
  await page.getByRole('button', { name: 'Replay tutorial', exact: true }).click()
  await page.clock.runFor(3_000)
  const training = await saveSnapshot(page)
  expect(training.cash).toBe(before.cash)
  expect(training.revenue).toEqual(before.revenue)
  expect(training.achievementIDs).toEqual(before.achievementIDs)
  await page.getByRole('button', { name: 'Skip tutorial', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
})

test('a prepared company passes Launch Day and an underprepared company can retry', async ({ page }) => {
  let state = completeLab(); state.reputation = 90
  for (const id of ['cpu', 'memory', 'ssd', 'network', 'cloud', 'ai'] as const) {
    for (let i = 0; i < 5; i++) state = purchaseEquipment(state, id)
  }
  state = acknowledgeAll(state)
  for (let i = 0; i < 200; i++) state = acknowledgeAll(stepGame(state, .25))
  state.incident = null; state.nextIncidentAt = 1_000_000
  await openGame(page, state)
  await page.getByRole('button', { name: 'Operations', exact: true }).click()
  await page.getByRole('button', { name: 'Start Launch Day', exact: true }).click()
  await page.getByRole('button', { name: 'Close details', exact: true }).click()
  await page.clock.runFor(92_000)
  expect((await saveSnapshot(page)).challenge.result).toBe('passed')
  const failing = completeLab(); failing.reputation = 10
  const active = acknowledgeAll(startChallenge(failing))
  await page.getByRole('button', { name: /^Save$/i }).click()
  await page.getByLabel('Save data').fill(serializeGame(active))
  await page.getByRole('button', { name: 'Import save', exact: true }).click()
  await page.clock.runFor(92_000)
  expect((await saveSnapshot(page)).challenge.result).toBe('failed')
  await page.clock.runFor(32_000)
  await page.getByRole('button', { name: 'Operations', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start Launch Day', exact: true })).toBeEnabled()
})

test('measured event reports remain inspectable without stopping ordinary play', async ({ page }) => {
  let state = sandbox(); state.nextIncidentAt = 0
  state = triggerIncident(state, 'marketing')
  await openGame(page, state); await page.clock.runFor(27_000)
  await expect(page.getByRole('dialog')).toBeHidden()
  const running = await saveSnapshot(page)
  expect(running.eventReports).toHaveLength(1)
  expect(running.eventReports[0].duration).toBeCloseTo(25)
  await page.getByRole('button', { name: 'Events', exact: true }).click()
  await page.locator('.event-report-list').getByRole('button').first().click()
  await expect(page.getByTestId('event-report')).toContainText('Potential gross earnings')
  await expect(page.getByTestId('event-report')).not.toContainText('game minute')
  await page.clock.runFor(5_000)
  await page.getByRole('dialog').getByRole('button', { name: 'Continue', exact: true }).click()
  expect((await saveSnapshot(page)).elapsed).toBeCloseTo(running.elapsed, 1)
  await page.clock.runFor(1_000)
  expect((await saveSnapshot(page)).elapsed).toBeGreaterThan(running.elapsed)
})

test('billing terminal follows customer gross revenue and stops during pauses and purchases', async ({ page }) => {
  await openGame(page, sandbox(['cpu', 'memory', 'ssd']))
  await page.clock.runFor(2_000)
  const meter = page.getByTestId('billing-earnings')
  const displayed = Number(await meter.getAttribute('data-total'))
  expect(displayed).toBeGreaterThan(0)
  await page.getByRole('button', { name: /Pause/ }).click()
  const snapshot = await saveSnapshot(page)
  expect(displayed).toBeLessThanOrEqual(snapshot.revenue.gross + .01)
  const stopped = await meter.getAttribute('data-total')
  await page.clock.runFor(3_000)
  await page.getByRole('button', { name: 'Upgrade CPU', exact: true }).click()
  await page.clock.runFor(2_000)
  await expect(meter).toHaveAttribute('data-total', stopped!)
  expect((await saveSnapshot(page)).revenue.gross).toBe(snapshot.revenue.gross)
})

for (const viewport of [{ width: 1024, height: 700 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
  test(`desktop ${viewport.width}px keeps workshop, toolbar and upgrade tray inside the viewport`, async ({ page }) => {
    await page.setViewportSize(viewport); await openGame(page, completeLab())
    await expect(page.getByRole('button', { name: 'Upgrade CPU', exact: true })).toBeVisible()
    const bounds = await page.evaluate(() => ({ inner: innerWidth, content: document.documentElement.scrollWidth }))
    expect(bounds.content).toBeLessThanOrEqual(bounds.inner)
    await expect(page.getByTestId('milestone-strip')).toBeVisible()
    await page.getByRole('button', { name: 'Motion on', exact: true }).click()
    await expect(page.locator('.app')).toHaveClass(/reduced-motion/)
    await page.screenshot({ path: `test-results/cloudlab-${viewport.width}.png` })
  })
}

test('facility eras and linked views keep pixel graphics and controls readable', async ({ page }) => {
  await page.setViewportSize({width:1440,height:1000})
  const first=sandbox();first.paused=true
  await openGame(page,first)
  await page.screenshot({path:'test-results/cloudlab-workshop.png'})
  for(const [era,until] of [['rooftop','load_balancer'],['datacenter','autoscaling'],['ai','ai']] as const){
    const end=UPGRADES.findIndex(u=>u.id===until)
    const state=sandbox(UPGRADES.slice(0,end+1).map(u=>u.id));state.paused=true
    await page.getByRole('button',{name:/^Save$/i}).click()
    await page.getByLabel('Save data').fill(serializeGame(state))
    await page.getByRole('button',{name:'Import save',exact:true}).click()
    await expect(page.locator('.workshop-stage')).toHaveAttribute('data-era',era)
    await page.screenshot({path:`test-results/cloudlab-${era}.png`})
  }
  for(const view of ['Server Interior','Service Flow'] as const){
    await page.getByRole('button',{name:view,exact:true}).click()
    await page.screenshot({path:`test-results/cloudlab-${view==='Server Interior'?'interior':'flow'}.png`,fullPage:true})
  }
  const node=page.getByRole('button',{name:'Inspect SHARED DATA',exact:true})
  await node.press('Enter')
  await expect(page.locator('.component-inspector')).toContainText('Shared data service')
  await page.getByRole('button',{name:'Finance',exact:true}).click()
  await expect(page.getByTestId('cash-ledger')).toBeVisible()
})

test('hidden pages freeze service and compact windows retain the pixel theme',async({page})=>{
  await page.setViewportSize({width:780,height:900})
  await openGame(page,sandbox())
  const before=await saveSnapshot(page)
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))})
  await page.clock.runFor(10_000)
  const hidden=await saveSnapshot(page)
  expect(hidden.elapsed).toBeCloseTo(before.elapsed,1)
  expect(hidden.cash).toBeCloseTo(before.cash,1)
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'))})
  await page.clock.runFor(1_000)
  expect((await saveSnapshot(page)).elapsed).toBeGreaterThan(hidden.elapsed)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(780)
  expect(await page.locator('.machine-tag text').first().evaluate(node=>getComputedStyle(node).fontFamily)).toContain('CloudPixelBody')
  await page.getByRole('button',{name:'Motion on',exact:true}).click()
  await expect(page.locator('.app')).toHaveClass(/reduced-motion/)
})
