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
test.afterEach(async ({ page }) => { expect(pageErrors.get(page), 'No unhandled browser errors').toEqual([]) })

function acknowledgeAll(state: GameState) {
  let announcement = getNextAnnouncement(state)
  while (announcement) { state = acknowledgeAnnouncement(state, announcement.id); announcement = getNextAnnouncement(state) }
  return state
}
function sandbox(upgrades: UpgradeId[] = []) {
  let state = skipTutorial(createInitialState()); state.cash = 1_000_000
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
async function continueAnnouncements(page: Page) {
  for (let i = 0; i < 20; i++) {
    const button = page.getByRole('dialog').getByRole('button', { name: 'Continue', exact: true })
    if (!await button.isVisible()) break
    await button.click()
  }
}
async function finishTutorial(page: Page, capture = false) {
  let turns = 0
  while (turns++ < 35 && await page.getByTestId('tutorial-banner').isVisible()) {
    const banner = page.getByTestId('tutorial-banner'), phase = await banner.getAttribute('data-phase')
    if (phase === 'demo') await page.clock.runFor(6_000)
    else if (phase === 'action') {
      const purchase = page.locator('.tutorial-target').getByRole('button', { name: /^Purchase / })
      await expect(purchase).toBeEnabled()
      if (capture && await purchase.getAttribute('aria-label') === 'Purchase CPU Module') {
        await page.screenshot({ path: 'test-results/cloudlab-tutorial.png' })
      }
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
  const snapshot = await saveSnapshot(page)
  expect(snapshot.elapsed).toBeLessThan(1)
})

test('a beginner completes funded guided actions and reaches independent play', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await openGame(page)
  await page.getByRole('button', { name: 'Start tutorial', exact: true }).click()
  await finishTutorial(page, true)
  const snapshot = await saveSnapshot(page)
  expect(snapshot.tutorialComplete).toBe(true)
  expect(snapshot.upgrades).toEqual(expect.arrayContaining(['cpu', 'memory', 'ssd']))
  expect(snapshot.equipmentLevels.cpu).toBeGreaterThan(0)
})

test('tutorial reload restores the lesson and skipping reaches the equipment tray', async ({ page }) => {
  await openGame(page); await page.getByRole('button', { name: 'Start tutorial', exact: true }).click()
  await page.getByTestId('tutorial-next').click(); await page.clock.runFor(6_000)
  const step = await page.getByTestId('tutorial-banner').getAttribute('data-step')
  await saveSnapshot(page); await page.reload()
  await expect(page.getByTestId('tutorial-banner')).toHaveAttribute('data-step', step!)
  await page.getByRole('button', { name: 'Skip tutorial', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Upgrade CPU', exact: true })).toBeVisible()
})

test('equipment buys directly, repeats and Max buys the affordable quantity', async ({ page }) => {
  const state = sandbox(); state.paused = true; state.cash = 5_000
  await openGame(page, state)
  await page.getByRole('button', { name: 'Upgrade CPU', exact: true }).click()
  await page.getByRole('button', { name: 'Upgrade CPU', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  let snapshot = await saveSnapshot(page)
  expect(snapshot.equipmentLevels.cpu).toBe(2)
  await page.getByRole('button', { name: /^(Buy )?Max$/i }).click()
  await page.getByRole('button', { name: 'Upgrade Memory', exact: true }).click()
  snapshot = await saveSnapshot(page)
  expect(snapshot.equipmentLevels.memory).toBeGreaterThan(1)
  expect(snapshot.cash).toBeGreaterThanOrEqual(0)
  await expect(page.getByRole('dialog', { name: 'Before you buy' })).toBeHidden()
})

test('all equipment tracks and technologies are reachable through the tray', async ({ page }) => {
  await openGame(page, sandbox())
  for (const name of ['CPU', 'Memory', 'Storage', 'Network']) await page.getByRole('button', { name: `Upgrade ${name}`, exact: true }).click()
  await page.getByRole('button', { name: /^Technology/ }).click()
  for (const upgrade of UPGRADES.filter(upgrade => !['cpu', 'memory', 'ssd'].includes(upgrade.id))) {
    await page.getByRole('button', { name: `Unlock ${upgrade.name}`, exact: true }).click()
    await continueAnnouncements(page)
  }
  await page.getByRole('button', { name: 'Equipment', exact: true }).click()
  await page.getByRole('button', { name: 'Upgrade Cloud capacity', exact: true }).click()
  await page.getByRole('button', { name: 'Upgrade AI capacity', exact: true }).click()
  const snapshot = await saveSnapshot(page)
  expect(snapshot.upgrades).toHaveLength(12)
  for (const level of Object.values(snapshot.equipmentLevels)) expect(level).toBeGreaterThan(0)
})

test('a fresh sandbox earns its way to cloud at normal speed through real purchases', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openGame(page)
  await page.getByRole('button', { name: 'Skip to sandbox', exact: true }).click()
  let elapsed = 0, eventCaptured = false, rewardCaptured = false
  const acknowledgeVisible = async () => {
    const event = page.getByRole('dialog')
    if (await event.getByRole('button', { name: 'Continue', exact: true }).isVisible()) {
      if (!eventCaptured) {
        await page.screenshot({ path: 'test-results/cloudlab-event.png' })
        eventCaptured = true
      }
      await continueAnnouncements(page)
    }
  }
  const earnAndBuy = async (name: string, initialEquipment = false) => {
    const button = page.getByRole('button', { name, exact: true })
    const started = elapsed
    await acknowledgeVisible()
    while (!await button.isEnabled() && elapsed < 600) {
      await page.clock.runFor(1_000); elapsed++
      await acknowledgeVisible()
    }
    expect(elapsed, `${name} stays reachable without a long idle grind`).toBeLessThan(600)
    if (initialEquipment) expect(elapsed - started, `${name} becomes affordable within 30 seconds at 1×`).toBeLessThan(30)
    await expect(button).toBeEnabled()
    await button.click()
    if (!rewardCaptured && name === 'Upgrade CPU') {
      await page.clock.runFor(100)
      await expect(page.getByTestId('achievement-toast')).toBeVisible()
    }
    if (!rewardCaptured && await page.getByTestId('achievement-toast').isVisible()) {
      await page.screenshot({ path: 'test-results/cloudlab-reward.png' })
      rewardCaptured = true
    }
    await acknowledgeVisible()
  }
  for (const name of ['CPU', 'Memory', 'Storage']) await earnAndBuy(`Upgrade ${name}`, true)
  await page.getByRole('button', { name: /^Technology/ }).click()
  for (const name of ['Virtualization', 'Second Server', 'Load Balancer', 'Backup & Recovery', 'Firewall & IAM', 'Cloud Migration']) {
    await earnAndBuy(`Unlock ${name}`)
  }
  const snapshot = await saveSnapshot(page)
  expect(snapshot.speed).toBe(1)
  expect(snapshot.upgrades).toContain('cloud')
  expect(snapshot.metrics.cloud).toBeGreaterThanOrEqual(24)
  expect(snapshot.cash).toBeGreaterThanOrEqual(0)
  expect(eventCaptured).toBe(true)
  expect(rewardCaptured).toBe(true)
  await page.getByRole('button', { name: 'Equipment', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Upgrade Cloud capacity', exact: true })).toBeVisible()
})

test('Hint is opt-in and overload never raises automatic advice or confirmation', async ({ page }) => {
  const state = sandbox(); state.elapsed = 350
  await openGame(page, state); await page.clock.runFor(15_000)
  await expect(page.locator('.hint-toast')).toBeHidden()
  await expect(page.getByRole('dialog')).toBeHidden()
  await page.getByRole('button', { name: 'Hint', exact: true }).click()
  const drawer = page.getByRole('region', { name: 'Hint', exact: true })
  await expect(drawer).toContainText(/CPU|processing/i)
  await page.getByRole('button', { name: 'Close details', exact: true }).click()
  await page.getByRole('button', { name: 'Upgrade Network', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
})

test('unlock announcements pause the simulation until Continue and preserve manual pause', async ({ page }) => {
  const state = sandbox(['cpu', 'memory', 'ssd']); state.paused = true
  await openGame(page, state)
  await page.getByRole('button', { name: /^Technology/ }).click()
  await page.getByRole('button', { name: 'Unlock Virtualization', exact: true }).click()
  const event = page.getByRole('dialog')
  await expect(event).toContainText(/Virtualization/i)
  await page.clock.runFor(20_000)
  await event.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(event).toBeHidden()
  const snapshot = await saveSnapshot(page)
  expect(snapshot.paused).toBe(true)
  expect(snapshot.elapsed).toBe(state.elapsed)
  await expect(page.getByRole('button', { name: /Resume/ })).toBeVisible()
})

test('incident announcements queue and time resumes only after acknowledgment', async ({ page }) => {
  let state = sandbox(['cpu', 'memory', 'ssd'])
  state.nextIncidentAt = 0; state = triggerIncident(state, 'marketing')
  const eventTitle = getNextAnnouncement(state)!.title
  await openGame(page, state)
  const event = page.getByRole('dialog', { name: eventTitle })
  await expect(event).toBeVisible(); await page.clock.runFor(10_000)
  await event.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.clock.runFor(1_000)
  const snapshot = await saveSnapshot(page)
  expect(snapshot.elapsed).toBeGreaterThan(0)
  expect(snapshot.acknowledgedAnnouncements).toContain(getNextAnnouncement(state)!.id)
})

test('achievements pay once and survive reload, import and tutorial replay', async ({ page }) => {
  const state = sandbox(); state.paused = true; state.cash = 5_000
  await openGame(page, state)
  const expected = purchaseEquipment(state, 'cpu', 1)
  await page.getByRole('button', { name: 'Upgrade CPU', exact: true }).click()
  let snapshot = await saveSnapshot(page)
  expect(snapshot.cash).toBe(expected.cash)
  expect(snapshot.achievementIDs.length).toBeGreaterThan(0)
  const cash = snapshot.cash, achievements = snapshot.achievementIDs
  await page.reload(); snapshot = await saveSnapshot(page)
  expect(snapshot.cash).toBe(cash); expect(snapshot.achievementIDs).toEqual(achievements)
  await page.getByRole('button', { name: /^Save$/i }).click()
  await page.getByLabel('Save data').fill(serializeGame(snapshot))
  await page.getByRole('button', { name: 'Import save', exact: true }).click()
  await page.getByRole('button', { name: 'Help', exact: true }).click()
  await page.getByRole('button', { name: 'Replay tutorial', exact: true }).click()
  snapshot = await saveSnapshot(page)
  expect(snapshot.achievementIDs).toEqual(achievements)
  expect(snapshot.cash).toBe(cash)
  await page.getByRole('button', { name: 'Skip tutorial', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  const liveStart = await saveSnapshot(page)
  await page.clock.runFor(2_000)
  const liveAfter = await saveSnapshot(page)
  expect(liveAfter.elapsed).toBeGreaterThan(liveStart.elapsed)
  expect(liveAfter.achievementIDs).toEqual(achievements)
  await page.getByRole('button', { name: /^Achievements/ }).click()
  await expect(page.getByRole('region', { name: 'Achievements', exact: true })).toContainText(/earned|complete|unlocked/i)
})

test('pause, speed and optional flow animations respond', async ({ page }) => {
  await openGame(page, sandbox())
  await page.getByRole('button', { name: /Pause/ }).click()
  const before = await saveSnapshot(page); await page.clock.runFor(3_000)
  const after = await saveSnapshot(page); expect(after.cash).toBe(before.cash)
  await page.getByRole('button', { name: /Resume/ }).click()
  await page.getByRole('button', { name: '4×', exact: true }).click()
  await page.getByRole('button', { name: /Flow off/i }).click()
  await expect(page.getByRole('button', { name: /Flow on/i })).toBeVisible()
})

test('operations policies change with cooldowns and queued technology events are acknowledged individually', async ({ page }) => {
  let state = sandbox(['cpu', 'memory', 'ssd'])
  state = purchaseUpgrade(state, 'virtualization')
  state = purchaseUpgrade(state, 'server2')
  const events = state.announcements.filter(a => a.kind === 'technology')
  await openGame(page, state)
  for (const event of events) {
    const dialog = page.getByRole('dialog', { name: event.title })
    await expect(dialog).toBeVisible()
    await page.clock.runFor(3_000)
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click()
  }
  await continueAnnouncements(page)
  let snapshot = await saveSnapshot(page)
  for (const event of events) expect(snapshot.acknowledgedAnnouncements).toContain(event.id)
  // Import an operating lab so policy behavior is checked independently of unlock timing.
  const operating = completeLab()
  await page.getByRole('button', { name: /^Save$/i }).click()
  await page.getByLabel('Save data').fill(serializeGame(operating))
  await page.getByRole('button', { name: 'Import save', exact: true }).click()
  await page.getByRole('button', { name: 'Operations', exact: true }).click()
  await page.getByRole('button', { name: 'Firewall strict', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Firewall balanced', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Close details', exact: true }).click()
  await page.clock.runFor(11_000); await continueAnnouncements(page)
  await page.getByRole('button', { name: 'Operations', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Firewall balanced', exact: true })).toBeEnabled()
})

test('v2 migration preserves company state and manual pause', async ({ page }) => {
  const state = sandbox(['cpu', 'memory', 'ssd'])
  const legacy = { ...state, version: 2, cash: 4321, paused: true }
  await openGame(page, JSON.stringify(legacy)); await page.clock.runFor(10_000)
  const snapshot = await saveSnapshot(page)
  expect(snapshot.version).toBe(3); expect(snapshot.cash).toBe(4321)
  expect(snapshot.upgrades).toEqual(expect.arrayContaining(['cpu', 'memory', 'ssd']))
  expect(snapshot.equipmentLevels.cpu).toBe(1)
  expect(snapshot.paused).toBe(true)
})

test('invalid imports preserve the company and dialogs support Escape', async ({ page }) => {
  await openGame(page, sandbox(['cpu']))
  await page.getByRole('button', { name: /^Save$/i }).click()
  const dialog = page.getByRole('dialog')
  await page.getByLabel('Save data').fill('{"version":3,"cash":-100,"equipmentLevels":{"cpu":-4}}')
  await page.getByRole('button', { name: 'Import save', exact: true }).click()
  await expect(dialog).toContainText(/invalid|incompatible/i)
  await page.keyboard.press('Escape'); await expect(dialog).toBeHidden()
  expect((await saveSnapshot(page)).upgrades).toContain('cpu')
})

test('a prepared company passes the full Launch Day and failed launches allow retry', async ({ page }) => {
  let state = completeLab(); state.reputation = 90
  for (let i = 0; i < 200; i++) state = acknowledgeAll(stepGame(state, .25))
  state.incident = null; state = acknowledgeAll(state)
  await openGame(page, state)
  await page.getByRole('button', { name: 'Operations', exact: true }).click()
  await page.getByRole('button', { name: 'Start Launch Day', exact: true }).click()
  await continueAnnouncements(page)
  await page.getByRole('button', { name: 'Close details', exact: true }).click()
  await page.clock.runFor(92_000); await continueAnnouncements(page)
  const snapshot = await saveSnapshot(page)
  expect(snapshot.challenge.result).toBe('passed'); expect(snapshot.completed).toBe(true)
})

test('underprepared Launch Day fails and retry becomes available', async ({ page }) => {
  let state = completeLab(); state.reputation = 10; state = acknowledgeAll(startChallenge(state))
  await openGame(page, state); await page.clock.runFor(92_000); await continueAnnouncements(page)
  expect((await saveSnapshot(page)).challenge.result).toBe('failed')
  await page.clock.runFor(32_000); await continueAnnouncements(page)
  await page.getByRole('button', { name: 'Operations', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start Launch Day', exact: true })).toBeEnabled()
})

for (const viewport of [{ width: 1024, height: 700 }, { width: 1440, height: 900 }]) {
  test(`desktop ${viewport.width}px keeps the map, toolbar and upgrade tray inside the viewport`, async ({ page }) => {
    await page.setViewportSize(viewport); await openGame(page, completeLab())
    await expect(page.getByRole('button', { name: 'Upgrade CPU', exact: true })).toBeVisible()
    const bounds = await page.evaluate(() => ({ inner: innerWidth, content: document.documentElement.scrollWidth }))
    expect(bounds.content).toBeLessThanOrEqual(bounds.inner)
    for (const name of ['Select Storage', 'Select AI']) {
      const box = await page.getByRole('button', { name, exact: true }).boundingBox()
      expect(box).not.toBeNull(); expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)
    }
    await page.screenshot({ path: `test-results/cloudlab-${viewport.width}.png` })
  })
}
