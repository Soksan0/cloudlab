import { describe, expect, it } from 'vitest'
import { calculateMetrics, canPurchase, createInitialState, loadGame, purchaseUpgrade, serializeGame, setPolicy, stepGame } from './engine'

describe('CloudLab simulation', () => {
  it('starts CPU-bound and earns positive income', () => {
    const state = createInitialState()
    const metrics = calculateMetrics(state)
    expect(metrics.bottleneck).toBe('compute')
    expect(metrics.net).toBeGreaterThan(0)
  })

  it('moves the bottleneck after the CPU upgrade', () => {
    const state = createInitialState(); state.cash = 100
    const upgraded = purchaseUpgrade(state, 'cpu')
    expect(upgraded.upgrades).toContain('cpu')
    expect(upgraded.metrics.compute).toBe(6)
  })

  it('enforces prerequisites and affordability', () => {
    const state = createInitialState(); state.cash = 999999
    expect(canPurchase(state, 'cloud').ok).toBe(false)
    expect(canPurchase(state, 'cpu').ok).toBe(true)
  })

  it('never lets cash fall below zero', () => {
    const state = createInitialState(); state.cash = 0
    const advanced = stepGame(state, 1)
    expect(advanced.cash).toBeGreaterThanOrEqual(0)
  })

  it('round-trips valid saves and rejects malformed saves', () => {
    const state = createInitialState(); state.cash = 1234
    expect(loadGame(serializeGame(state))?.cash).toBe(1234)
    expect(loadGame('{"version":99}')).toBeNull()
  })

  it('applies policy cooldowns', () => {
    const state = createInitialState(); state.elapsed = 20
    const changed = setPolicy(state, 'firewall', 'strict')
    const blocked = setPolicy(changed, 'firewall', 'balanced')
    expect(blocked.policies.firewall).toBe('strict')
  })

  it('keeps all twelve upgrades reachable in dependency order', () => {
    let state = createInitialState()
    state.cash = 1_000_000
    for (const id of ['cpu','memory','ssd','virtualization','server2','load_balancer','backup','security','cache','cloud','autoscaling','ai'] as const) {
      state = purchaseUpgrade(state, id)
      expect(state.upgrades).toContain(id)
    }
    expect(state.upgrades).toHaveLength(12)
    expect(state.metrics.aiCapacity).toBe(8)
  })
})
