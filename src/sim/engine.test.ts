import { describe, expect, it } from 'vitest'
import { advanceTutorial, calculateMetrics, canPurchase, createInitialState, getChallengeReadiness, getPurchaseAdvice, getRecommendation, loadGame, purchaseUpgrade, replayTutorial, serializeGame, setPolicy, skipTutorial, startChallenge, startTutorial, stepGame, triggerIncident } from './engine'
import { UPGRADES } from './upgrades'
import type { GameState, UpgradeId } from './types'

const openLab = () => skipTutorial(createInitialState())
const withUpgrades = (until?: UpgradeId) => {
  let s = openLab(); s.cash = 1000000
  for (const item of UPGRADES) { s = purchaseUpgrade(s, item.id); if (item.id === until) break }
  return s
}
const finishDemo = (s: GameState) => stepGame(s, 4.1)

describe('guided beginner tutorial', () => {
  it('starts with a welcome gate and no elapsed time or reputation loss', () => {
    const s = createInitialState()
    expect(s.tutorial.status).toBe('welcome'); expect(s.paused).toBe(true)
    expect(stepGame(s, 30)).toEqual(s)
    expect(canPurchase(s, 'cpu').ok).toBe(false)
  })

  it('requires actual actions, provides grants, and completes every lesson', () => {
    let s = startTutorial(createInitialState())
    expect(s.tutorial.step).toBe(1)
    s = advanceTutorial(s); expect(s.tutorial.phase).toBe('demo')
    s = finishDemo(s); expect(s.paused).toBe(true)
    s = advanceTutorial(s); expect(s.tutorial.step).toBe(2)
    s = finishDemo(advanceTutorial(s)); expect(s.metrics.bottleneck).toBe('compute')
    s = advanceTutorial(s); expect(s.tutorial.step).toBe(3)
    for (const id of ['cpu', 'memory', 'ssd'] as const) {
      s = advanceTutorial(s)
      expect(s.tutorial.phase).toBe('action'); expect(canPurchase(s, id).ok).toBe(true)
      const current = s.tutorial.step
      expect(advanceTutorial(s).tutorial.step).toBe(current)
      s = purchaseUpgrade(s, id); expect(s.tutorial.phase).toBe('demo')
      s = finishDemo(s); expect(s.tutorial.demonstrated).toBe(true)
      s = advanceTutorial(s)
    }
    expect(s.tutorial.step).toBe(6)
    s = advanceTutorial(s); expect(s.tutorial.step).toBe(7)
    s = advanceTutorial(s)
    expect(s.tutorialComplete).toBe(true); expect(s.paused).toBe(false)
    expect(s.reputation).toBe(60); expect(s.upgrades).toEqual(['cpu', 'memory', 'ssd'])
  })

  it('replays owned lessons without charging twice or stalling', () => {
    let s = replayTutorial(withUpgrades('ssd'))
    const cash = s.cash
    for (let i = 0; i < 2; i++) s = advanceTutorial(finishDemo(advanceTutorial(s)))
    expect(s.tutorial.step).toBe(3)
    s = advanceTutorial(s); expect(s.tutorial.phase).toBe('demo')
    s = advanceTutorial(finishDemo(s)); expect(s.tutorial.step).toBe(4)
    expect(s.upgrades).toHaveLength(3); expect(s.cash).toBeGreaterThanOrEqual(cash)
  })

  it('replays a fully upgraded lab using a baseline lesson preview without grants', () => {
    let s = withUpgrades(); s.cash = 0
    s = replayTutorial(s)
    expect(s.metrics.compute).toBe(3); expect(s.metrics.cloud).toBe(0)
    s = advanceTutorial(finishDemo(advanceTutorial(s)))
    expect(s.tutorial.step).toBe(2)
    expect(s.metrics.bottleneck).toBe('compute')
    s = advanceTutorial(finishDemo(advanceTutorial(s)))
    s.cash = 0
    s = advanceTutorial(s)
    expect(s.cash).toBe(0); expect(s.metrics.compute).toBe(6)
    expect(s.metrics.bottleneck).toBe('memory'); expect(s.upgrades).toHaveLength(12)
  })

  it('saves and resumes an action lesson with the same funding', () => {
    let s = startTutorial(createInitialState())
    for (let i = 0; i < 2; i++) s = advanceTutorial(finishDemo(advanceTutorial(s)))
    s = advanceTutorial(s)
    const loaded = loadGame(serializeGame(s))!
    expect(loaded.tutorial).toEqual(s.tutorial)
    expect(loaded.cash).toBe(s.cash); expect(canPurchase(loaded, 'cpu').ok).toBe(true)
  })
})

describe('economy and capacity', () => {
  it('pays only successful requests and keeps net income separate', () => {
    const m = calculateMetrics(openLab())
    expect(m.bottleneck).toBe('compute'); expect(m.gross).toBe(m.served * 4)
    expect(m.net).toBe(m.gross - m.expenses)
  })
  it('enforces prerequisites, ownership, funding, and all twelve unlocks', () => {
    const s = openLab(); s.cash = 100000
    expect(canPurchase(s, 'cloud').ok).toBe(false)
    const cpu = purchaseUpgrade(s, 'cpu')
    expect(purchaseUpgrade(cpu, 'cpu')).toBe(cpu)
    expect(withUpgrades().upgrades).toHaveLength(12)
  })
  it('keeps CPU, memory and SSD sequentially observable bottlenecks', () => {
    let s = openLab(); s.elapsed = 350; s.cash = 10000
    expect(calculateMetrics(s).bottleneck).toBe('compute')
    s = purchaseUpgrade(s, 'cpu'); expect(s.metrics.bottleneck).toBe('memory')
    s = purchaseUpgrade(s, 'memory'); s.elapsed = 1000
    expect(calculateMetrics(s).bottleneck).toBe('storage')
  })
  it('does not create a demand jump at the moment of purchase', () => {
    const s = openLab(); s.cash = 10000; s.elapsed = 200
    const before = calculateMetrics(s).demand
    const after = purchaseUpgrade(s, 'cpu')
    expect(after.metrics.demand).toBe(before)
    after.elapsed += 14; expect(calculateMetrics(after).demand - before).toBeLessThan(.1)
    after.elapsed += 61; expect(calculateMetrics(after).demand - before).toBeGreaterThan(1)
  })
  it('accounts for every elapsed fixed step and speed, including larger frames', () => {
    const s = openLab(); const one = stepGame(s, 1); let pieces = s
    for (let i = 0; i < 10; i++) pieces = stepGame(pieces, .1)
    expect(one.elapsed).toBeCloseTo(1); expect(one.cash).toBeCloseTo(pieces.cash)
    s.speed = 4; expect(stepGame(s, 1).elapsed).toBeCloseTo(4)
  })
  it('keeps initial sandbox purchases within seconds at normal speed', () => {
    let s = openLab(); const waits: number[] = []
    for (const id of ['cpu', 'memory', 'ssd'] as const) {
      let wait = 0
      while (!canPurchase(s, id).ok && wait < 120) { s = stepGame(s, 1); wait++ }
      waits.push(wait); s = purchaseUpgrade(s, id)
    }
    expect(Math.max(...waits)).toBeLessThan(30)
    expect(s.upgrades).toHaveLength(3)
  })
})

describe('advice and runtime policies', () => {
  it('recommends a reachable prerequisite instead of a locked network solution', () => {
    const s = withUpgrades('ssd'); s.elapsed = 2000
    const r = getRecommendation(s)
    expect(r.priority).toBe('capacity'); expect(r.upgradeId).toBe('virtualization')
    expect(r.reason).toContain('Load Balancer'); expect(r.reason).toContain('prerequisite')
    expect(getPurchaseAdvice(s, 'backup')).toContain('reliability')
    expect(getPurchaseAdvice(s, 'virtualization')).toBeNull()
  })
  it('validates policy prerequisites, values, and cooldowns', () => {
    const s = openLab()
    expect(setPolicy(s, 'firewall', 'strict')).toBe(s)
    const ready = withUpgrades(); ready.elapsed = 30
    const strict = setPolicy(ready, 'firewall', 'strict')
    expect(strict.policies.firewall).toBe('strict')
    expect(setPolicy(strict, 'firewall', 'balanced')).toBe(strict)
    expect(setPolicy(ready, 'firewall', 'bogus')).toBe(ready)
  })
  it('makes Resilient react sooner with more billable provisioned headroom', () => {
    const s = withUpgrades(); s.elapsed = 2000; s.incidentQueue = []; s.nextIncidentAt = 99999
    s.cloudProvisioned = 24; s.aiProvisioned = 8
    const resilient = setPolicy(s, 'autoscaling', 'resilient')
    const earlyEconomy = stepGame(s, 4), earlyResilient = stepGame(resilient, 4)
    expect(earlyEconomy.cloudProvisioned).toBe(24)
    expect(earlyResilient.cloudProvisioned).toBeGreaterThan(24)
    const economy = stepGame(s, 50), resilientLater = stepGame(resilient, 50)
    expect(resilientLater.cloudProvisioned).toBeGreaterThan(economy.cloudProvisioned)
    expect(resilientLater.metrics.expenses).toBeGreaterThan(economy.metrics.expenses)
  })
})

describe('incidents and Launch Day', () => {
  it('queues milestone incidents instead of losing overlapping lessons', () => {
    const s = withUpgrades()
    expect(s.incidentQueue).toEqual(['marketing', 'hardware', 'bot', 'billing'])
    expect(s.incident).toBeNull()
    const started = stepGame(s, 151)
    expect(started.incident?.kind).toBe('marketing')
    const resolved = stepGame(started, 26)
    expect(resolved.incident).toBeNull()
    const beforeCooldown = stepGame(resolved, 30)
    expect(beforeCooldown.incident).toBeNull()
  })
  it('backs up recovery and filters bots according to the descriptions', () => {
    const unprotected = withUpgrades('load_balancer'); unprotected.nextIncidentAt = 0; unprotected.incidentQueue = []
    const hardware = triggerIncident(unprotected, 'hardware')
    let protectedState = withUpgrades(); protectedState.nextIncidentAt = 0; protectedState.incidentQueue = []
    expect(triggerIncident(protectedState, 'hardware').incident!.total).toBeCloseTo(hardware.incident!.total * .4)
    const balanced = triggerIncident(protectedState, 'bot')
    protectedState = setPolicy(protectedState, 'firewall', 'strict')
    const strict = triggerIncident(protectedState, 'bot')
    expect(calculateMetrics(strict).network).toBeGreaterThan(calculateMetrics(balanced).network)
    expect(strict.incident!.total).toBeLessThan(balanced.incident!.total)
  })
  it('passes a prepared full challenge at mature demand and continues sandbox', () => {
    let s = withUpgrades(); s.reputation = 90; s.elapsed = 2000; s.incidentQueue = []; s.nextIncidentAt = 99999
    s = setPolicy(s, 'autoscaling', 'resilient'); s = stepGame(s, 50)
    s = startChallenge(s); s = stepGame(s, 91)
    expect(s.challenge.result).toBe('passed'); expect(s.completed).toBe(true)
    expect(s.challenge.totalServed / s.challenge.totalDemand).toBeGreaterThan(.9)
    expect(stepGame(s, 5).elapsed).toBeGreaterThan(s.elapsed)
  })
  it('fails an unprepared challenge, exposes reasons and respects retry delay', () => {
    let s = withUpgrades(); s.reputation = 10; s.incidentQueue = []; s.nextIncidentAt = 99999
    expect(getChallengeReadiness(s).ready).toBe(false)
    s = stepGame(startChallenge(s), 91)
    expect(s.challenge.result).toBe('failed'); expect(startChallenge(s)).toBe(s)
    s = stepGame(s, 31); expect(startChallenge(s).challenge.active).toBe(true)
  })
})

describe('save compatibility and validation', () => {
  it('preserves pause without adding offline earnings', () => {
    const s = withUpgrades('cpu'); s.paused = true
    const loaded = loadGame(serializeGame(s))!
    expect(loaded.paused).toBe(true); expect(loaded.cash).toBe(s.cash); expect(loaded.elapsed).toBe(s.elapsed)
  })
  it('migrates an existing v1 lab without forcing tutorial or losing purchases', () => {
    const s = withUpgrades('memory')
    const legacy = { ...s, version: 1, tutorial: undefined, upgradeTimes: undefined, cloudProvisioned: undefined, aiProvisioned: undefined, scaleTimer: undefined }
    const loaded = loadGame(JSON.stringify(legacy))!
    expect(loaded.version).toBe(2); expect(loaded.upgrades).toEqual(s.upgrades); expect(loaded.cash).toBe(s.cash)
    expect(loaded.tutorial.status).toBe('skipped')
  })
  it.each([
    {cash:-1}, {cash:1e300}, {speed:-4}, {reputation:101}, {upgrades:['ai']}, {upgrades:['cpu','cpu']},
    {policies:{loadBalancer:'efficiency',firewall:'bogus',autoscaling:'economy'}},
    {tutorial:{status:'active',step:99,phase:'action',demoRemaining:0,replay:false,demonstrated:false}},
    {challenge:{active:true,remaining:90,totalDemand:0,totalServed:0,result:null,retryAt:0}},
    {cloudProvisioned:999}, {incident:{kind:'bogus',remaining:10,total:10}},
  ])('rejects invalid imported state %j', (bad) => {
    const s = createInitialState()
    expect(loadGame(JSON.stringify({...s,...bad}))).toBeNull()
  })
})
