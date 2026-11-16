import { expect, test } from '@playwright/test'
import { createInitialState, purchaseUpgrade, serializeGame } from '../src/sim/engine'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('starts playable and identifies the CPU bottleneck', async ({ page }) => {
  await expect(page.getByText('Watch the traffic')).toBeVisible()
  await expect(page.getByText('CPU LIMITED')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Upgrade console' })).toBeVisible()
  await expect(page.getByLabel('Infrastructure map')).toBeVisible()
})

test('earns revenue and completes the guided hardware upgrades', async ({ page }) => {
  await page.getByRole('button', { name: '4×' }).click()
  await expect(page.getByText('Fix the red bottleneck')).toBeVisible({ timeout: 5_000 })
  await page.getByLabel('Purchase CPU Module').click()
  await expect(page.getByText('Read the diagnostics')).toBeVisible()
  await page.getByRole('button', { name: /Inspect diagnostics/ }).click()
  await expect(page.getByText('Add working memory')).toBeVisible()
  await expect(page.getByLabel('Purchase Memory Bank')).toBeEnabled({ timeout: 8_000 })
  await page.getByLabel('Purchase Memory Bank').click()
  await expect(page.getByText('OPEN LAB')).toBeVisible()
})

test('pause and speed controls work', async ({ page }) => {
  await page.getByRole('button', { name: 'Ⅱ PAUSE' }).click()
  await expect(page.getByRole('button', { name: '▶ RESUME' })).toBeVisible()
  await page.getByRole('button', { name: '▶ RESUME' }).click()
  await page.getByRole('button', { name: '4×' }).click()
  await expect(page.getByText('4× SPEED')).toBeVisible()
})

test('save dialog validates imported data', async ({ page }) => {
  await page.getByRole('button', { name: 'SAVE' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByLabel('Save data').fill('not valid')
  await page.getByRole('button', { name: 'Import pasted save' }).click()
  await expect(page.getByText('That save is invalid or incompatible.')).toBeVisible()
})

test('renders the completed architecture and starts Launch Day', async ({ page }) => {
  let state = createInitialState()
  state.cash = 1_000_000
  for (const id of ['cpu','memory','ssd','virtualization','server2','load_balancer','backup','security','cache','cloud','autoscaling','ai'] as const) {
    state = purchaseUpgrade(state, id)
  }
  await page.addInitScript(([key, save]) => localStorage.setItem(key, save), ['cloudlab-save-v1', serializeGame(state)])
  await page.reload()
  await expect(page.getByText('12/12')).toBeVisible()
  await expect(page.getByText('Launch Day', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Start Launch Day' }).click()
  await expect(page.getByText('◆ LAUNCH DAY')).toBeVisible()
  await expect(page.getByText('Service target: 90%')).toBeVisible()
})
