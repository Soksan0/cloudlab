import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import {
  acknowledgeAnnouncement, calculateMetrics, createInitialState, getNextAnnouncement,
  purchaseEquipment, purchaseUpgrade, serializeGame, skipTutorial,
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
  let next = getNextAnnouncement(state)
  while (next) { state = acknowledgeAnnouncement(state, next.id); next = getNextAnnouncement(state) }
  return state
}
function fund(state: GameState, cash: number) {
  const r = state.revenue
  r.opening = cash - r.gross - r.grants - r.rewards + r.purchases + r.expenses
  state.cash = cash
  return state
}
function sandbox(upgrades: UpgradeId[] = []) {
  let s = fund(skipTutorial(createInitialState()), 1_000_000)
  for (const id of upgrades) s = acknowledgeAll(purchaseUpgrade(s, id))
  s.incident = null; s.incidentQueue = []; s.nextIncidentAt = 1_000_000
  s.paused = false; s.reputation = 80; s.metrics = calculateMetrics(s)
  return s
}
function completeLab() {
  return acknowledgeAll(stepGame(sandbox(UPGRADES.map(u => u.id)), 2.1))
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
  await page.clock.runFor(450)
}
async function snapshot(page: Page): Promise<GameState> {
  return page.evaluate(key => {
    window.dispatchEvent(new Event('pagehide'))
    return JSON.parse(localStorage.getItem(key)!)
  }, SAVE_KEY)
}
function expectBalanced(s: GameState) {
  const r = s.revenue
  expect(s.cash).toBeCloseTo(r.opening + r.gross + r.grants + r.rewards - r.purchases - r.expenses, 6)
}
async function utility(page: Page, name: string) {
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  await page.getByRole('button', { name, exact: true }).click()
}
async function selectComponent(page: Page, id: string, category: 'Equipment' | 'Technology' = 'Equipment') {
  if (await page.getByRole('button', { name: /^Tune components/ }).isVisible()) {
    await page.getByRole('button', { name: /^Tune components/ }).click()
  }
  const console = page.getByTestId('tuning-console')
  await console.getByRole('button', { name: category, exact: true }).click()
  await console.getByLabel('Component', { exact: true }).selectOption(id)
  await page.clock.runFor(450)
}
async function continueMajor(page: Page) {
  for (let i = 0; i < 20 && await page.getByTestId('major-announcement').isVisible(); i++) {
    await page.getByTestId('major-announcement').getByRole('button', { name: /^Continue/ }).click()
  }
}
async function finishTutorial(page: Page) {
  for (let i = 0; i < 45; i++) {
    const coach = page.getByTestId('tutorial-coach')
    if (!await coach.isVisible()) return
    const step = Number(await coach.getAttribute('data-step'))
    const phase = await coach.getAttribute('data-phase')
    if (phase === 'explain'||await coach.getByRole('button',{name:/^Continue tutorial/}).isVisible()) await coach.getByRole('button', { name: /^Continue tutorial/ }).click()
    else if (step === 1) await page.getByRole('button', { name: 'Select Server 01', exact: true }).click()
    else if (step === 2) await page.getByRole('button', { name: 'Inspect CPU', exact: true }).click()
    else if (step >= 3 && step <= 5) {
      const name = ['CPU', 'Memory', 'Storage (SSD)'][step - 3]
      await page.getByTestId('tuning-console').getByRole('button', { name: `Upgrade ${name}`, exact: true }).click()
    } else if (step === 6) await page.getByRole('button', { name: 'Hint', exact: true }).click()
    else await page.clock.runFor(500)
  }
  await expect(page.getByTestId('tutorial-coach')).toBeHidden()
}
async function expectViewportFit(page: Page) {
  const bounds = await page.evaluate(() => ({
    w: innerWidth, h: innerHeight,
    pageW: document.documentElement.scrollWidth,
    pageH: document.documentElement.scrollHeight,
  }))
  expect(bounds.pageW, 'No horizontal page scrolling').toBeLessThanOrEqual(bounds.w + 1)
  expect(bounds.pageH, 'No vertical page scrolling').toBeLessThanOrEqual(bounds.h + 1)
  const console = page.getByTestId('tuning-console')
  if (await console.isVisible()) {
    const box = await console.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(bounds.w + 1)
    expect(box!.y + box!.height).toBeLessThanOrEqual(bounds.h + 1)
    const dimensions = await console.evaluate(node => ({
      scroll:node.scrollHeight,client:node.clientHeight,
      children:[...node.children].map(child=>({tag:child.tagName,class:child.className,height:child.getBoundingClientRect().height}))
    }))
    expect(dimensions.scroll, `No console scrolling: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(dimensions.client+1)
    const clipped = await console.evaluate(node => {
      const panel = node.getBoundingClientRect()
      return [...node.querySelectorAll('button,select')].filter(control => {
        const r = control.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && (r.left < panel.left - 1 || r.right > panel.right + 1 || r.top < panel.top - 1 || r.bottom > panel.bottom + 1)
      }).map(control => control.getAttribute('aria-label') || control.textContent)
    })
    expect(clipped, 'Tuning controls are not clipped').toEqual([])
  }
  const dialog = page.getByRole('dialog')
  if (await dialog.isVisible()) {
    const box = await dialog.boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(bounds.w + 1)
    expect(box!.y + box!.height).toBeLessThanOrEqual(bounds.h + 1)
    expect(await dialog.evaluate(node => node.scrollHeight <= node.clientHeight + 1), 'No dialog scrolling').toBe(true)
  }
}

test('welcome requires a choice and keeps reading time free', async ({ page }) => {
  await openGame(page)
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('cloud')
  await page.clock.runFor(5_000)
  expect((await snapshot(page)).elapsed).toBe(0)
  await page.getByRole('button', { name: /Open sandbox|Skip to sandbox/ }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByTestId('tuning-console')).toBeVisible()
})

test('a beginner completes live guided actions instead of a text banner', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 }); await openGame(page)
  await page.getByRole('button', { name: /^Start tutorial/ }).click()
  const coach = page.getByTestId('tutorial-coach')
  await expect(coach).toBeVisible()
  const before = await snapshot(page)
  await page.clock.runFor(2_000)
  expect((await snapshot(page)).elapsed).toBeGreaterThan(before.elapsed)
  await finishTutorial(page)
  const s = await snapshot(page)
  expect(s.tutorialComplete).toBe(true)
  expect(s.upgrades).toEqual(expect.arrayContaining(['cpu', 'memory', 'ssd']))
  expectBalanced(s)
  await expect(page.locator('.tutorial-strip')).toHaveCount(0)
  await expectViewportFit(page)
})

test('tutorial action reload resumes the task and skipping preserves the company', async ({ page }) => {
  await openGame(page)
  await page.getByRole('button', { name: /^Start tutorial/ }).click()
  await page.getByRole('button', { name: 'Select Server 01', exact: true }).click()
  const step = await page.getByTestId('tutorial-coach').getAttribute('data-step')
  await snapshot(page); await page.reload()
  await expect(page.getByTestId('tutorial-coach')).toHaveAttribute('data-step', step!)
  await page.getByRole('button', { name: 'Skip tutorial', exact: true }).click()
  await expect(page.getByTestId('tutorial-coach')).toBeHidden()
  expectBalanced(await snapshot(page))
})

test('component choices focus the matching view and concise controls', async ({ page }) => {
  const s = completeLab(); s.paused = true; await openGame(page, s)
  for (const id of ['cpu', 'memory', 'ssd', 'network']) {
    await selectComponent(page, id)
    await expect(page.getByRole('button', { name: 'Server Interior', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('tuning-console').getByLabel('Component')).toHaveValue(id)
    const part = await page.locator(`.scene-viewport [data-component-id="${id}"]`).first().boundingBox()
    const console = await page.getByTestId('tuning-console').boundingBox()
    expect(part, 'Focused component remains present').not.toBeNull()
    expect(part!.x).toBeGreaterThanOrEqual(0)
    expect(part!.x + part!.width, 'Focused component stays beside the tuning console').toBeLessThanOrEqual(console!.x - 3)
    if(id==='cpu'||id==='network')await page.screenshot({path:`test-results/cloudlab-compact-focused-${id}.png`})
  }
  await expect(page.getByTestId('tuning-console')).toContainText(/Mbps|Gbps/)
  await expect(page.getByTestId('tuning-console')).not.toContainText(/instructions per cycle|assumed 256|requests\/second/)
  for (const id of ['cloud', 'ai']) {
    await selectComponent(page, id)
    await expect(page.getByRole('button', { name: 'Service Flow', exact: true })).toHaveAttribute('aria-pressed', 'true')
  }
})

test('scene clicks select their controls without leaving the current view', async ({ page }) => {
  const s = completeLab(); s.paused = true; await openGame(page, s)
  await page.getByRole('button', { name: 'Server Interior', exact: true }).click()
  await page.getByRole('button', { name: 'Inspect RAM', exact: true }).click()
  await expect(page.getByTestId('tuning-console').getByLabel('Component')).toHaveValue('memory')
  await page.getByRole('button', { name: 'Service Flow', exact: true }).click()
  await page.locator('[data-component-id="network"]').first().click()
  await expect(page.getByRole('button', { name: 'Service Flow', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('tuning-console').getByLabel('Component')).toHaveValue('network')
  await page.getByRole('button', { name: 'Workshop', exact: true }).click()
  await expect(page.getByTestId('tuning-console').getByLabel('Component')).toHaveValue('network')
})

test('keyboard exploration reframes parts without buying or changing the tuning selection', async ({ page }) => {
  const s=sandbox();s.paused=true;await openGame(page,s)
  await selectComponent(page,'cpu')
  await page.getByRole('button',{name:'Inspect CPU',exact:true}).focus()
  await page.keyboard.press('Tab');await page.clock.runFor(450)
  await expect(page.getByRole('button',{name:'Inspect RAM',exact:true})).toBeFocused()
  await expect(page.getByTestId('tuning-console').getByLabel('Component')).toHaveValue('cpu')
  const part=await page.locator('.scene-viewport [data-component-id="memory"]').boundingBox()
  const console=await page.getByTestId('tuning-console').boundingBox()
  expect(part!.x).toBeGreaterThanOrEqual(0)
  expect(part!.x+part!.width).toBeLessThanOrEqual(console!.x-3)
  expect((await snapshot(page)).revenue.purchases).toBe(s.revenue.purchases)
})

test('missing Storage (SSD) prerequisite leads directly to its upgrade', async ({ page }) => {
  const s = sandbox(['cpu', 'memory']); s.paused = true; await openGame(page, s)
  await selectComponent(page, 'virtualization', 'Technology')
  const console = page.getByTestId('tuning-console')
  await console.getByRole('button', { name: /^Upgrade Storage \(SSD\)/ }).click()
  await expect(console.getByLabel('Component')).toHaveValue('ssd')
  await expect(page.getByRole('button', { name: 'Server Interior', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await console.getByRole('button', { name: 'Upgrade Storage (SSD)', exact: true }).click()
  await selectComponent(page, 'virtualization', 'Technology')
  await expect(console.getByRole('button', { name: 'Unlock Virtualization', exact: true })).toBeEnabled()
})

test('all technologies are reachable through the selected-component console', async ({ page }) => {
  const s = sandbox(); s.paused = true; await openGame(page, s)
  for (const [id, name] of [['cpu', 'CPU'], ['memory', 'Memory'], ['ssd', 'Storage (SSD)']] as const) {
    await selectComponent(page, id)
    await page.getByTestId('tuning-console').getByRole('button', { name: `Upgrade ${name}`, exact: true }).click()
  }
  for (const upgrade of UPGRADES.filter(u => !['cpu', 'memory', 'ssd'].includes(u.id))) {
    await selectComponent(page, upgrade.id, 'Technology')
    const button = page.getByTestId('tuning-console').getByRole('button', { name: `Unlock ${upgrade.name}`, exact: true })
    await expect(button).toBeEnabled()
    await button.click()
    await expect(page.getByTestId('major-announcement')).toBeVisible()
    await continueMajor(page)
  }
  const state = await snapshot(page)
  expect(state.upgrades).toHaveLength(12)
  expectBalanced(state)
})

test('upgrade feedback follows the selected component in every view', async ({ page }) => {
  const s = sandbox(); s.paused = true; await openGame(page, s)
  for (const view of ['Workshop', 'Server Interior', 'Service Flow']) {
    await page.getByRole('button', { name: view, exact: true }).click()
    await page.getByTestId('tuning-console').getByRole('button', { name: 'Upgrade CPU', exact: true }).click()
    const feedback = page.getByTestId('purchase-feedback')
    await expect(feedback).toBeVisible()
    await expect(feedback).toContainText(/LV/)
    await expect(feedback).toContainText(/→/)
    await expect(page.getByRole('button', { name: view, exact: true })).toHaveAttribute('aria-pressed', 'true')
  }
  expect((await snapshot(page)).equipmentLevels.cpu).toBe(3)
})

test('rapid purchases retain the newest level and physical specification feedback', async ({ page }) => {
  const s = sandbox(); s.paused = true; await openGame(page, s)
  await selectComponent(page, 'network')
  const button = page.getByTestId('tuning-console').getByRole('button', { name: 'Upgrade Network', exact: true })
  await button.click(); await page.clock.runFor(400); await button.click()
  await expect(page.getByTestId('purchase-feedback')).toContainText('2')
  await expect(page.getByTestId('purchase-feedback')).toContainText(/500 Mbps/)
  await page.clock.runFor(700)
  await expect(page.getByTestId('purchase-feedback')).toBeVisible()
  const state = await snapshot(page)
  expect(state.equipmentLevels.network).toBe(2); expectBalanced(state)
})

test('unaffordable actions explain the shortfall without successful feedback', async ({ page }) => {
  const s = fund(sandbox(), 0); s.paused = true; await openGame(page, s)
  const console = page.getByTestId('tuning-console')
  await expect(console.getByRole('button', { name: 'Upgrade CPU', exact: true })).toBeDisabled()
  await expect(console).toContainText(/Need|Short/)
  await expect(page.getByTestId('purchase-feedback')).toBeHidden()
})

test('the tuning console collapses and reopens without losing its selection', async ({ page }) => {
  const s = sandbox(); s.paused = true; await openGame(page, s)
  await selectComponent(page, 'memory')
  await page.getByRole('button', { name: 'Collapse tuning console', exact: true }).click()
  await expect(page.getByTestId('tuning-console')).toBeHidden()
  await page.getByRole('button', { name: /^Tune components/ }).click()
  await expect(page.getByTestId('tuning-console').getByLabel('Component')).toHaveValue('memory')
})

test('Hint shows a short constraint and navigates to the suggested component', async ({ page }) => {
  const s = sandbox(); s.paused = true; await openGame(page, s)
  await page.getByRole('button', { name: 'Hint', exact: true }).click()
  const hint = page.getByTestId('hint-popover')
  await expect(hint).toContainText(/CPU|processor/i)
  await expect(hint).toContainText(/keep up|slow|upgrade/i)
  await hint.getByRole('button', { name: /^Inspect upgrade/ }).click()
  await expect(page.getByTestId('tuning-console').getByLabel('Component')).toHaveValue('cpu')
  await expect(page.getByRole('button', { name: 'Server Interior', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('healthy service gives reassurance without inventing an urgent purchase', async ({ page }) => {
  const s = sandbox(['cpu']); s.paused = true; s.reputation = 60; s.totalServed = 0; s.metrics = calculateMetrics(s)
  await openGame(page, s)
  await page.getByRole('button', { name: 'Hint', exact: true }).click()
  const hint = page.getByTestId('hint-popover')
  await expect(hint).toContainText('Everything is working well')
  await expect(hint.getByRole('button', { name: /^Inspect upgrade/ })).toBeHidden()
})

test('technology acquisition is a short popup and preserves a manual pause', async ({ page }) => {
  const s = sandbox(['cpu', 'memory', 'ssd']); s.paused = true; await openGame(page, s)
  await selectComponent(page, 'virtualization', 'Technology')
  await page.getByRole('button', { name: 'Unlock Virtualization', exact: true }).click()
  const dialog = page.getByTestId('major-announcement')
  await expect(dialog).toContainText(/Acquired.*Virtualization/i)
  const before = await snapshot(page); await page.clock.runFor(5_000)
  expect((await snapshot(page)).elapsed).toBe(before.elapsed)
  await dialog.getByRole('button', { name: /^Continue/ }).click()
  expect((await snapshot(page)).paused).toBe(true)
  await expectViewportFit(page)
})

test('incident start and summary pause reading time and report net results', async ({ page }) => {
  let s = sandbox(); s.nextIncidentAt = 0; s = triggerIncident(s, 'marketing'); await openGame(page, s)
  const notice = page.getByTestId('major-announcement')
  await expect(notice).toContainText(/viral|campaign/i)
  await expect(notice).toContainText(/25.*minutes/)
  const before = await snapshot(page); await page.clock.runFor(5_000)
  expect((await snapshot(page)).elapsed).toBe(before.elapsed)
  await continueMajor(page); await page.clock.runFor(27_000)
  const report = page.getByTestId('event-summary')
  await expect(report).toBeVisible()
  await expect(report).toContainText(/profit|loss/i)
  await expect(report).toContainText(/served/i)
  const finished = await snapshot(page)
  expect(finished.eventReports[0].duration).toBeCloseTo(25)
  expect(finished.elapsed).toBeCloseTo(before.elapsed + 25)
  await page.clock.runFor(4_000)
  expect((await snapshot(page)).cash).toBe(finished.cash)
  await continueMajor(page); await page.clock.runFor(1_000)
  expect((await snapshot(page)).elapsed).toBeGreaterThan(finished.elapsed)
  expectBalanced(await snapshot(page))
})

test('legacy pending alerts are archived rather than replayed as a backlog', async ({ page }) => {
  let s = sandbox(['cpu', 'memory', 'ssd']); s = purchaseUpgrade(s, 'virtualization'); s.paused = true
  const legacy = JSON.parse(serializeGame(s)); delete legacy.uiRevision
  await openGame(page, JSON.stringify(legacy))
  await expect(page.getByTestId('major-announcement')).toBeHidden()
  const restored = await snapshot(page)
  expect(restored.cash).toBe(s.cash); expect(restored.upgrades).toEqual(s.upgrades)
  expectBalanced(restored)
})

test('profit badge uses net operating profit and the funds counter has stable dimensions', async ({ page }) => {
  const s = fund(sandbox(), 95); await openGame(page, s)
  const cash = page.getByTestId('cash-display'), badge = page.getByTestId('profit-badge')
  const before = await cash.boundingBox()
  await expect(badge).toContainText(/Profit.*\+/i)
  await page.clock.runFor(3_000)
  const after = await cash.boundingBox()
  expect(after!.width).toBeCloseTo(before!.width, 1)
  expect(after!.height).toBeCloseTo(before!.height, 1)
  await expect(page.locator('.earning-burst')).toHaveCount(0)
  await expect(badge).toContainText('/min')
  expectBalanced(await snapshot(page))
})

test('zero completed requests still show a red operating loss', async ({ page }) => {
  let s = sandbox(['cpu', 'memory', 'ssd', 'virtualization']); s.nextIncidentAt = 0
  s = acknowledgeAll(triggerIncident(s, 'hardware')); s.nextIncidentAt = 1_000_000
  expect(calculateMetrics(s).served).toBe(0)
  await openGame(page, s)
  const badge = page.getByTestId('profit-badge')
  await expect(badge).toContainText(/Profit.*[−-]/i)
  const color = await badge.evaluate(node => getComputedStyle(node).color)
  const channels = color.match(/[\d.]+/g)!.map(Number)
  expect(channels[0]).toBeGreaterThan(channels[1])
  await page.clock.runFor(1_000)
  const after = await snapshot(page)
  expect(after.cash).toBeLessThan(s.cash); expectBalanced(after)
})

test('purchase deductions are immediate and rewards do not become operating profit', async ({ page }) => {
  const s = sandbox(); s.paused = true; await openGame(page, s)
  const badge = page.getByTestId('profit-badge'), before = await badge.innerText()
  await selectComponent(page, 'memory')
  await page.getByRole('button', { name: 'Upgrade Memory', exact: true }).click()
  const after = await snapshot(page)
  expect(after.revenue.purchases).toBe(220)
  expect(after.revenue.rewards).toBeGreaterThan(0)
  expect(after.revenue.gross).toBe(0)
  expect(after.metrics.net).toBe(s.metrics.net)
  await expect(badge).toHaveText(before)
  expectBalanced(after)
})

test('rented resources show startup before capacity becomes available', async ({ page }) => {
  const s = completeLab(); await openGame(page, s)
  await selectComponent(page, 'cloud')
  const before = await snapshot(page)
  await page.getByRole('button', { name: 'Upgrade Cloud capacity', exact: true }).click()
  await expect(page.getByTestId('tuning-console')).toContainText(/Starting|provision/i)
  expect((await snapshot(page)).cloudProvisioned).toBe(before.cloudProvisioned)
  await page.clock.runFor(2_500)
  expect((await snapshot(page)).cloudProvisioned).toBeGreaterThan(before.cloudProvisioned)
})

test('pause, speed and settings controls preserve the compact playfield', async ({ page }) => {
  await openGame(page, sandbox())
  await page.getByRole('button', { name: /Pause/ }).click()
  const paused = await snapshot(page); await page.clock.runFor(3_000)
  expect((await snapshot(page)).cash).toBe(paused.cash)
  await page.getByRole('button', { name: /Resume/ }).click()
  await page.getByRole('button', { name: '4×', exact: true }).click()
  await page.clock.runFor(1_000)
  expect((await snapshot(page)).elapsed).toBeGreaterThan(paused.elapsed + 3.5)
  await utility(page, 'Settings')
  await page.getByRole('button', { name: 'Motion on', exact: true }).click()
  await expect(page.locator('.compact-app')).toHaveClass(/reduced-motion/)
  await expectViewportFit(page)
})

test('Finance remains accurate in a compact overlay and Escape returns focus', async ({ page }) => {
  await openGame(page, completeLab())
  await utility(page, 'Finance')
  const dialog = page.getByRole('dialog')
  for (const name of ['Customer revenue', 'Operating expenses', 'Available funds']) await expect(dialog).toContainText(name)
  await expectViewportFit(page)
  await page.keyboard.press('Escape'); await expect(dialog).toBeHidden()
  await expect(page.getByRole('button',{name:'Menu',exact:true})).toBeFocused()
  expectBalanced(await snapshot(page))
})

test('Save exports valid snapshots and invalid imports leave the company unchanged', async ({ page }) => {
  const s = sandbox(['cpu']); s.paused = true; await openGame(page, s)
  await utility(page, 'Save')
  const exported = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export save', exact: true }).click()
  const path = await (await exported).path()
  expect(path).not.toBeNull()
  const saved = JSON.parse(await readFile(path!, 'utf8')) as GameState
  expect(saved.upgrades).toContain('cpu'); expectBalanced(saved)
  await page.getByLabel('Import save file', { exact: true }).setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"version":5,"cash":0}')})
  await expect(page.getByRole('dialog')).toContainText(/invalid/i)
  await page.keyboard.press('Escape')
  expect((await snapshot(page)).cash).toBe(s.cash)
})

test('tutorial replay preserves live finances, achievements, and the manual pause', async ({ page }) => {
  const s = completeLab(); s.paused = true; await openGame(page, s)
  const before = await snapshot(page)
  await utility(page, 'Help')
  await page.getByRole('button', { name: 'Replay tutorial', exact: true }).click()
  await page.clock.runFor(2_000)
  const replay = await snapshot(page)
  expect(replay.cash).toBe(before.cash); expect(replay.revenue).toEqual(before.revenue)
  expect(replay.achievementIDs).toEqual(before.achievementIDs)
  await page.getByRole('button', { name: 'Skip tutorial', exact: true }).click()
  expect((await snapshot(page)).paused).toBe(before.paused)
})

test('hidden pages do not earn offline revenue', async ({ page }) => {
  await openGame(page, sandbox()); const before = await snapshot(page)
  await page.evaluate(() => {Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))})
  await page.clock.runFor(10_000)
  const hidden = await snapshot(page)
  expect(hidden.cash).toBeCloseTo(before.cash, 1); expect(hidden.elapsed).toBeCloseTo(before.elapsed, 1)
  await page.evaluate(() => {Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'))})
  await page.clock.runFor(1_000)
  expect((await snapshot(page)).elapsed).toBeGreaterThan(hidden.elapsed)
})

for (const viewport of [{width:780,height:600},{width:1024,height:600},{width:1280,height:720},{width:1440,height:900},{width:1920,height:1080}]) {
  test(`desktop ${viewport.width}×${viewport.height} keeps views and overlays inside the viewport`, async ({ page }) => {
    await page.setViewportSize(viewport)
    const s = completeLab(); s.paused = true; await openGame(page, s)
    for (const view of ['Workshop','Server Interior','Service Flow']) {
      await page.getByRole('button',{name:view,exact:true}).click()
      await page.screenshot({path:`test-results/cloudlab-compact-${viewport.width}-${view.toLowerCase().replaceAll(' ','-')}.png`})
      await expectViewportFit(page)
      await expect(page.getByTestId('tuning-console').getByRole('button',{name:'Upgrade CPU',exact:true})).toBeVisible()
    }
    await page.getByRole('button',{name:'Workshop',exact:true}).click()
    await page.screenshot({path:`test-results/cloudlab-compact-${viewport.width}.png`})
    for (const name of ['Finance','Operations','Achievements','Events','Help','Save','Settings']) {
      await utility(page,name); await expectViewportFit(page)
      await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click()
    }
  })
}


test('maximum Storage (SSD) specifications and funding notes fit a compact console',async({page})=>{
  await page.setViewportSize({width:780,height:600})
  let s=sandbox();s=purchaseEquipment(s,'ssd','max');s.paused=true
  await openGame(page,s);await selectComponent(page,'ssd')
  await expect(page.getByTestId('tuning-console')).toContainText(/16,384/)
  await expectViewportFit(page)
  await page.screenshot({path:'test-results/cloudlab-compact-max-storage.png'})
})


test('all locked technology and equipment cards fit the smallest desktop window',async({page})=>{
  await page.setViewportSize({width:780,height:600})
  const s=sandbox();s.paused=true;await openGame(page,s)
  for(const id of ['cpu','memory','ssd','network','cloud','ai']){
    await selectComponent(page,id)
    await expectViewportFit(page)
  }
  for(const item of UPGRADES.filter(u=>!['cpu','memory','ssd'].includes(u.id))){
    await selectComponent(page,item.id,'Technology')
    await expectViewportFit(page)
  }
})
