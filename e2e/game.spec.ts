import { expect, test, type Page } from '@playwright/test'
import {
  calculateMetrics, createInitialState, purchaseUpgrade, serializeGame, skipTutorial,
  startChallenge, stepGame, triggerIncident,
} from '../src/sim/engine'
import { UPGRADES } from '../src/sim/upgrades'
import type { GameState, UpgradeId } from '../src/sim/types'

const SAVE_KEY = 'cloudlab-save-v1'
const ids = UPGRADES.map((upgrade) => upgrade.id)
const pageErrors = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  pageErrors.set(page, errors)
  page.on('pageerror', error => errors.push(error.message))
})

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page), 'No unhandled browser errors').toEqual([])
})

function sandbox(upgrades: UpgradeId[] = []) {
  let state = skipTutorial(createInitialState())
  state.cash = 1_000_000
  for (const id of upgrades) state = purchaseUpgrade(state, id)
  state.incident = null
  state.incidentQueue = []
  state.nextIncidentAt = 1_000_000
  state.paused = false
  state.reputation = 80
  state.metrics = calculateMetrics(state)
  return state
}

async function openGame(page: Page, state?: GameState | string) {
  await page.clock.install()
  await page.addInitScript(({ key, save }) => {
    if (!sessionStorage.getItem('cloudlab-test-initialized')) {
      localStorage.clear()
      if (save) localStorage.setItem(key, save)
      sessionStorage.setItem('cloudlab-test-initialized', 'yes')
    }
  }, { key: SAVE_KEY, save: typeof state === 'string' ? state : state ? serializeGame(state) : null })
  await page.goto('/')
}

async function saveSnapshot(page: Page): Promise<GameState> {
  await page.getByRole('button', { name: 'SAVE', exact: true }).click()
  const value = await page.getByLabel('Save data').inputValue()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  return JSON.parse(value)
}

test('welcome requires a choice and does not run the company while reading', async ({ page }) => {
  await openGame(page)
  const welcome = page.getByRole('dialog', { name: 'Welcome to CloudLab' })
  await expect(welcome).toBeVisible()
  const startingCash = await page.locator('.stat.cash strong').textContent()
  await page.clock.runFor(5_000)
  await expect(page.locator('.stat.cash strong')).toHaveText(startingCash!)
  await expect(page.getByRole('button', { name: 'Start tutorial', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Skip to sandbox', exact: true }).click()
  await expect(welcome).toBeHidden()
  await expect(page.getByTestId('advisor-card')).toBeVisible()
})

test('a beginner completes the guided tutorial using highlighted actions without waiting for money', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openGame(page)
  await page.getByRole('button', { name: 'Start tutorial', exact: true }).click()
  const purchases = new Set<string>()
  let turns = 0
  while (turns++ < 35 && await page.getByTestId('tutorial-banner').isVisible()) {
    const banner = page.getByTestId('tutorial-banner')
    const phase = await banner.getAttribute('data-phase')
    if (phase === 'demo') {
      await page.clock.runFor(12_000)
    } else if (phase === 'action') {
      const purchase = page.locator('.upgrade-target').getByRole('button', { name: /^Purchase / })
      await expect(purchase).toBeEnabled()
      purchases.add(await purchase.getAttribute('aria-label') ?? '')
      if (await purchase.getAttribute('aria-label') === 'Purchase CPU Module') {
        await page.screenshot({ path: 'test-results/cloudlab-tutorial.png' })
      }
      await purchase.click()
    } else {
      await page.getByTestId('tutorial-next').click()
    }
  }
  await expect(page.getByTestId('tutorial-banner')).toBeHidden()
  expect([...purchases]).toEqual(expect.arrayContaining(['Purchase CPU Module', 'Purchase Memory Bank', 'Purchase SSD Array']))
  const state = await saveSnapshot(page)
  expect(state.tutorialComplete).toBe(true)
  expect(state.upgrades).toEqual(expect.arrayContaining(['cpu', 'memory', 'ssd']))
})

test('tutorial progress survives a reload and can be skipped', async ({ page }) => {
  await openGame(page)
  await page.getByRole('button', { name: 'Start tutorial', exact: true }).click()
  await page.getByTestId('tutorial-next').click()
  await page.clock.runFor(12_000)
  const step = await page.getByTestId('tutorial-banner').getAttribute('data-step')
  await saveSnapshot(page)
  await page.reload()
  await expect(page.getByTestId('tutorial-banner')).toHaveAttribute('data-step', step!)
  await page.getByRole('button', { name: 'Skip tutorial', exact: true }).click()
  await expect(page.getByTestId('tutorial-banner')).toBeHidden()
})

test('faster earnings fund the first sandbox CPU upgrade quickly', async ({ page }) => {
  await openGame(page)
  await page.getByRole('button', { name: 'Skip to sandbox', exact: true }).click()
  await page.clock.runFor(6_000)
  await expect(page.getByLabel('Purchase CPU Module')).toBeEnabled()
  await page.getByLabel('Purchase CPU Module').click()
  await expect(page.locator('.upgrade-card').filter({ hasText: 'CPU Module' }).first()).toContainText('OWNED')
})

test('sustained overload offers a dismissible CPU hint and the purchase reveals the next bottleneck', async ({ page }) => {
  const state = sandbox()
  // Established demand exceeds both the original CPU and the next memory limit.
  state.elapsed = 350
  state.metrics = calculateMetrics(state)
  await openGame(page, state)
  await page.clock.runFor(7_000)
  const hint = page.locator('.hint-toast')
  await expect(hint).toBeVisible()
  await expect(hint).toContainText(/CPU processing/i)
  await expect(hint).toContainText(/CPU Module/i)
  await hint.getByRole('button', { name: 'Dismiss hint', exact: true }).click()
  await expect(hint).toBeHidden()
  await page.clock.runFor(8_000)
  await expect(hint).toBeHidden()
  await page.getByLabel('Purchase CPU Module').click()
  await expect(page.getByTestId('advisor-card')).toContainText(/memory/i)
  await expect(page.locator('.bottleneck-tag')).toHaveText('MEMORY LIMITED')
})

test('an existing complete lab replays real bottlenecks without spending money or losing upgrades', async ({ page }) => {
  const state = sandbox(ids)
  state.paused = true
  await openGame(page, state)
  await page.getByRole('button', { name: 'HELP', exact: true }).click()
  await page.getByRole('button', { name: 'Replay tutorial', exact: true }).click()
  const banner = page.getByTestId('tutorial-banner')
  await expect(page.locator('.capacity-row').filter({ hasText: 'CPU' }).locator('strong')).toHaveText('3 req/m')
  const observed = new Set<string>()
  let turns = 0
  while (turns++ < 35 && await banner.getAttribute('data-step') !== '7') {
    observed.add(await page.locator('.bottleneck-tag').innerText())
    const phase = await banner.getAttribute('data-phase')
    if (phase === 'demo') {
      await page.clock.runFor(5_000)
      observed.add(await page.locator('.bottleneck-tag').innerText())
    } else {
      await page.getByTestId('tutorial-next').click()
    }
  }
  await expect(banner).toHaveAttribute('data-step', '7')
  expect([...observed]).toEqual(expect.arrayContaining(['CPU LIMITED', 'MEMORY LIMITED', 'STORAGE LIMITED', 'BALANCED']))
  const snapshot = await saveSnapshot(page)
  expect(snapshot.cash).toBe(state.cash)
  expect(snapshot.upgrades).toEqual(state.upgrades)
  await page.getByRole('button', { name: 'Run my lab', exact: true }).click()
  await expect(banner).toBeHidden()
  await expect(page.locator('.upgrade-count')).toHaveText('12/12')
})

test('all upgrades can be purchased through the console and every purchase is represented in the map', async ({ page }) => {
  await openGame(page, sandbox())
  for (const upgrade of UPGRADES) {
    const button = page.getByLabel(`Purchase ${upgrade.name}`)
    await expect(button).toBeEnabled()
    await button.click()
    const advice = page.getByRole('dialog', { name: 'Before you buy' })
    if (await advice.isVisible()) await advice.getByRole('button', { name: 'Buy anyway', exact: true }).click()
  }
  await expect(page.locator('.upgrade-count')).toHaveText('12/12')
  await expect(page.getByRole('button', { name: 'Cloud compute', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'AI inference', exact: true })).toBeVisible()
  const snapshot = await saveSnapshot(page)
  expect(snapshot.upgrades).toHaveLength(12)
  await page.getByRole('button', { name: 'AI inference', exact: true }).click()
  await expect(page.locator('.component-inspector')).toContainText(/inference/i)
})

test('pause, speed, reduced motion and sound controls respond', async ({ page }) => {
  await openGame(page, sandbox())
  await page.getByRole('button', { name: /PAUSE/ }).click()
  const cash = await page.locator('.stat.cash strong').textContent()
  await page.clock.runFor(3_000)
  await expect(page.locator('.stat.cash strong')).toHaveText(cash!)
  await page.getByRole('button', { name: /RESUME/ }).click()
  await page.getByRole('button', { name: '4×', exact: true }).click()
  await expect(page.getByText('4× SPEED')).toBeVisible()
  await page.getByRole('button', { name: 'MOTION ON', exact: true }).click()
  await expect(page.locator('.app')).toHaveClass(/reduce-motion/)
  await page.getByRole('button', { name: 'SOUND OFF', exact: true }).click()
  await expect(page.getByRole('button', { name: 'SOUND ON', exact: true })).toBeVisible()
})

test('invalid imports preserve the current company and dialogs support Escape', async ({ page }) => {
  await openGame(page, sandbox(['cpu']))
  await page.getByRole('button', { name: 'SAVE', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await page.getByLabel('Save data').fill('{"version":2,"cash":-100,"upgrades":[],"speed":-4}')
  await page.getByRole('button', { name: 'Import pasted save', exact: true }).click()
  await expect(dialog).toContainText(/invalid|incompatible/i)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  const snapshot = await saveSnapshot(page)
  expect(snapshot.upgrades).toContain('cpu')
  expect(snapshot.cash).toBeGreaterThan(0)
})

test('a legacy save retains money, upgrades and manual pause without replaying the welcome', async ({ page }) => {
  const current = sandbox(['cpu', 'memory', 'ssd'])
  const legacy = { ...current, version: 1, cash: 4321, paused: true, tutorialComplete: true, tutorialStep: 4 }
  await openGame(page, JSON.stringify(legacy))
  await expect(page.getByRole('dialog', { name: 'Welcome to CloudLab' })).toBeHidden()
  await expect(page.getByRole('button', { name: /RESUME/ })).toBeVisible()
  await page.clock.runFor(10_000)
  const snapshot = await saveSnapshot(page)
  expect(snapshot.cash).toBe(4321)
  expect(snapshot.version).toBe(2)
  expect(snapshot.upgrades).toEqual(expect.arrayContaining(['cpu', 'memory', 'ssd']))
  await page.reload()
  await expect(page.getByRole('button', { name: /RESUME/ })).toBeVisible()
})

test('a less useful purchase explains the network priority before spending money', async ({ page }) => {
  const state = sandbox(['cpu', 'memory', 'ssd', 'virtualization', 'server2', 'load_balancer', 'backup', 'security'])
  state.elapsed = 2_000
  await openGame(page, state)
  await page.getByRole('button', { name: /PAUSE/ }).click()
  const cash = await page.locator('.stat.cash strong').textContent()
  const before = await saveSnapshot(page)
  await page.getByLabel('Purchase Edge Cache').click()
  const advice = page.getByRole('dialog', { name: 'Before you buy' })
  await expect(advice).toBeVisible()
  await expect(advice).toContainText(/network/i)
  await advice.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.locator('.stat.cash strong')).toHaveText(cash!)
  await page.getByLabel('Purchase Edge Cache').click()
  await advice.getByRole('button', { name: 'Buy anyway', exact: true }).click()
  const snapshot = await saveSnapshot(page)
  expect(snapshot.upgrades).toContain('cache')
  expect(snapshot.cash).toBe(before.cash - UPGRADES.find(u => u.id === 'cache')!.cost)
})

test('help can replay lessons on an existing lab and reset cancellation preserves progress', async ({ page }) => {
  await openGame(page, sandbox(['cpu', 'memory', 'ssd']))
  await page.getByRole('button', { name: 'HELP', exact: true }).click()
  await page.getByRole('button', { name: 'Replay tutorial', exact: true }).click()
  await expect(page.getByTestId('tutorial-banner')).toBeVisible()
  await page.getByRole('button', { name: 'Skip tutorial', exact: true }).click()
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('button', { name: 'RESET', exact: true }).click()
  const snapshot = await saveSnapshot(page)
  expect(snapshot.upgrades).toEqual(expect.arrayContaining(['cpu', 'memory', 'ssd']))
})

test('live operating policies have cooldowns and incidents explain mitigation', async ({ page }) => {
  let state = sandbox(ids)
  state.nextIncidentAt = 0
  state = triggerIncident(state, 'bot')
  await openGame(page, state)
  await expect(page.getByRole('heading', { name: 'Automated bot attack' })).toBeVisible()
  await page.getByRole('button', { name: 'FIREWALL strict', exact: true }).click()
  await expect(page.getByRole('button', { name: 'FIREWALL balanced', exact: true })).toBeDisabled()
  await page.clock.runFor(11_000)
  await expect(page.getByRole('button', { name: 'FIREWALL balanced', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'AUTOSCALING resilient', exact: true }).click()
  await expect(page.getByRole('button', { name: 'AUTOSCALING resilient', exact: true })).toHaveClass(/active/)
})

test('a prepared company passes the complete Launch Day simulation', async ({ page }) => {
  let state = sandbox(ids)
  state.reputation = 90
  for (let i = 0; i < 200; i++) state = stepGame(state, .25)
  state.incident = null
  await openGame(page, state)
  await page.getByRole('button', { name: 'Start Launch Day', exact: true }).click()
  await expect(page.getByText('◆ LAUNCH DAY')).toBeVisible()
  await page.clock.runFor(92_000)
  const snapshot = await saveSnapshot(page)
  expect(snapshot.challenge.result).toBe('passed')
  expect(snapshot.completed).toBe(true)
  await expect(page.getByRole('heading', { name: 'Launch Day passed', exact: true })).toBeVisible()
})

test('failed Launch Day explains the failure and permits another attempt', async ({ page }) => {
  let state = sandbox(ids)
  state.reputation = 10
  state = startChallenge(state)
  await openGame(page, state)
  await page.clock.runFor(92_000)
  const snapshot = await saveSnapshot(page)
  expect(snapshot.challenge.result).toBe('failed')
  await expect(page.getByText(/Last launch missed the target/)).toBeVisible()
  await page.clock.runFor(32_000)
  await expect(page.getByRole('button', { name: 'Start Launch Day', exact: true })).toBeEnabled()
})

for (const viewport of [{ width: 1024, height: 700 }, { width: 1440, height: 900 }]) {
  test(`desktop ${viewport.width}px keeps controls and map inside the viewport`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await openGame(page, sandbox(ids))
    await expect(page.getByRole('heading', { name: 'Upgrade console', exact: true })).toBeVisible()
    const bounds = await page.evaluate(() => ({ inner: innerWidth, content: document.documentElement.scrollWidth }))
    expect(bounds.content).toBeLessThanOrEqual(bounds.inner)
    for (const name of ['Storage', 'AI inference']) {
      const box = await page.getByRole('button', { name, exact: true }).boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)
    }
    await page.screenshot({ path: `test-results/cloudlab-${viewport.width}.png`, fullPage: true })
  })
}
