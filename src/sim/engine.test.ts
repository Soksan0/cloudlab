import { describe, expect, it } from 'vitest'
import { acknowledgeAnnouncement, ACHIEVEMENTS, advanceTutorial, calculateMetrics, canPurchase, createInitialState, getChallengeReadiness, getEquipmentQuote, getNextAnnouncement, getPurchaseAdvice, getRecommendation, loadGame, purchaseEquipment, purchaseUpgrade, replayTutorial, serializeGame, setPolicy, skipTutorial, startChallenge, startTutorial, stepGame, triggerIncident } from './engine'
import { UPGRADES } from './upgrades'
import type { GameState, UpgradeId } from './types'

const openLab = () => skipTutorial(createInitialState())
const acknowledgeAll = (state: GameState) => {
  let s = state
  while(getNextAnnouncement(s)) s = acknowledgeAnnouncement(s,getNextAnnouncement(s)!.id)
  return s
}
const withUpgrades = (until?: UpgradeId) => {
  let s = openLab(); s.cash = 1000000
  for (const item of UPGRADES) { s = acknowledgeAll(purchaseUpgrade(s, item.id)); if (item.id === until) break }
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
    expect(purchaseUpgrade(cpu, 'cpu').equipmentLevels.cpu).toBe(2)
    expect(withUpgrades().upgrades).toHaveLength(12)
  })
  it('keeps CPU, memory and SSD sequentially observable bottlenecks', () => {
    let s = openLab(); s.elapsed = 350; s.cash = 10000
    expect(calculateMetrics(s).bottleneck).toBe('compute')
    s = purchaseUpgrade(s, 'cpu'); expect(s.metrics.bottleneck).toBe('memory')
    s = purchaseUpgrade(s, 'memory'); s.elapsed = 500
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
  it('continues demand growth after all technologies are installed', () => {
    const s = withUpgrades(); s.elapsed = 10000
    const before = calculateMetrics(s).demand
    s.elapsed += 10000
    expect(calculateMetrics(s).demand).toBeGreaterThan(before+50)
  })
})

describe('advice and runtime policies', () => {
  it('recommends a repeatable network purchase when the uplink is limiting', () => {
    const s = withUpgrades('ssd'); s.elapsed = 2000
    const r = getRecommendation(s)
    expect(r.priority).toBe('capacity'); expect(r.upgradeId).toBe('network')
    expect(r.reason).toContain('Network Uplink')
    expect(getPurchaseAdvice(s, 'backup')).toContain('reliability')
    expect(getPurchaseAdvice(s, 'network')).toBeNull()
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
    const resolved = stepGame(acknowledgeAll(started), 26)
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
    expect(stepGame(acknowledgeAll(s), 5).elapsed).toBeGreaterThan(s.elapsed)
  })
  it('fails an unprepared challenge, exposes reasons and respects retry delay', () => {
    let s = withUpgrades(); s.reputation = 10; s.incidentQueue = []; s.nextIncidentAt = 99999
    expect(getChallengeReadiness(s).ready).toBe(false)
    s = stepGame(startChallenge(s), 91)
    expect(s.challenge.result).toBe('failed'); expect(startChallenge(s)).toBe(s)
    s = stepGame(acknowledgeAll(s), 31); expect(startChallenge(s).challenge.active).toBe(true)
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
    expect(loaded.version).toBe(3); expect(loaded.upgrades).toEqual(s.upgrades); expect(loaded.cash).toBe(s.cash)
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

describe('repeatable equipment', () => {
  it('allows memory, storage and network purchases without a CPU prerequisite', () => {
    const s = openLab(); s.cash = 10000
    const memory = purchaseEquipment(s,'memory')
    expect(memory.equipmentLevels.memory).toBe(1)
    expect(memory.metrics.memory).toBe(8)
    expect(loadGame(serializeGame(memory))?.equipmentLevels.memory).toBe(1)
    expect(purchaseEquipment(s,'network').metrics.network).toBe(12)
    expect(purchaseEquipment(s,'ssd').metrics.storage).toBe(12)
    expect(getEquipmentQuote(s,'cloud').available).toBe(false)
    expect(getEquipmentQuote(s,'ai').available).toBe(false)
  })
  it('uses the exact rounded price recurrence and has no installed-level ceiling', () => {
    let s = openLab(); s.cash = 1000000000
    const prices:number[] = []
    for (let i=0;i<40;i++) {
      const quote = getEquipmentQuote(s,'cpu',1); prices.push(quote.cost)
      s = purchaseEquipment(s,'cpu')
    }
    expect(prices.slice(0,4)).toEqual([80,108,146,198])
    expect(s.equipmentLevels.cpu).toBe(40)
    expect(s.metrics.compute).toBe(123)
  })
  it('makes Max match sequential purchases with an exact affordable total', () => {
    let s = openLab(); s.cash = 1000; s.achievementIDs = ['first-equipment','equipment-5']
    const quote = getEquipmentQuote(s,'cpu','max')
    expect(quote.count).toBeGreaterThan(1)
    const bulk = purchaseEquipment(s,'cpu','max')
    let sequential = s
    for(let i=0;i<quote.count;i++) sequential = purchaseEquipment(sequential,'cpu')
    expect(bulk.equipmentLevels.cpu).toBe(sequential.equipmentLevels.cpu)
    expect(bulk.cash).toBe(sequential.cash)
    expect(bulk.cash).toBe(s.cash - quote.cost)
    expect(getEquipmentQuote(bulk,'cpu',1).available).toBe(false)
    expect(quote.increase).toBe(quote.count*3)
    const empty = openLab(); empty.cash = 0
    expect(getEquipmentQuote(empty,'cpu','max').count).toBe(0)
    expect(purchaseEquipment(empty,'cpu','max')).toBe(empty)
  })
  it('adds cloud and AI base and elastic capacity after their technologies unlock', () => {
    const s = withUpgrades()
    const cloud = purchaseEquipment(s,'cloud')
    expect(cloud.metrics.cloud).toBe(s.metrics.cloud+6)
    const ai = purchaseEquipment(s,'ai')
    expect(ai.metrics.aiCapacity).toBe(s.metrics.aiCapacity+4)
  })
})

describe('achievement rewards and announcements', () => {
  it('awards the first equipment and fifth level once, including a Max purchase', () => {
    let s = openLab(); s.cash = 5000
    const quote = getEquipmentQuote(s,'cpu','max')
    s = purchaseEquipment(s,'cpu','max')
    expect(s.achievementIDs).toEqual(['first-equipment','equipment-5'])
    expect(s.cash).toBe(5000-quote.cost+350)
    expect(getNextAnnouncement(s)).toBeUndefined()
    const saved = loadGame(serializeGame(s))!
    expect(saved.cash).toBe(s.cash)
    saved.cash += 10000
    const again = purchaseEquipment(saved,'cpu')
    expect(again.achievementIDs).toEqual(s.achievementIDs)
    expect(again.cash).toBe(saved.cash-getEquipmentQuote(saved,'cpu').cost)
  })
  it('awards request, stable service and AI milestones without replay or import duplicates', () => {
    let s = withUpgrades(); s.incidentQueue = []; s.nextIncidentAt = 99999
    s.totalServed = 99; s.aiServed = 99; s.stableServiceMinutes = 29.9
    const next = stepGame(s,1)
    expect(next.achievementIDs).toContain('requests-100')
    expect(next.achievementIDs).toContain('stable-30')
    // AI demand is initially below one; accrue enough traffic to cross its lifetime threshold.
    const ai = stepGame(next,20)
    expect(ai.achievementIDs).toContain('ai-100')
    const loaded = loadGame(serializeGame(ai))!
    expect(loaded.cash).toBe(ai.cash); expect(loaded.achievementIDs).toEqual(ai.achievementIDs)
    const replayed = replayTutorial(loaded)
    const afterDemo = finishDemo(advanceTutorial(replayed))
    expect(afterDemo.cash).toBe(loaded.cash)
    expect(afterDemo.aiServed).toBe(loaded.aiServed)
  })
  it('resets the continuous reliable-service clock after overload', () => {
    const s = openLab(); s.stableServiceMinutes = 29.9
    expect(stepGame(s,.2).stableServiceMinutes).toBe(0)
    expect(stepGame(s,.2).achievementIDs).not.toContain('stable-30')
  })
  it('gives incident recovery credit and a single launch reward instead of two bonuses', () => {
    let s = withUpgrades(); s.nextIncidentAt = 0; s.incidentQueue = []
    s = acknowledgeAll(triggerIncident(s,'hardware')); s = stepGame(s,11)
    expect(s.incidentsRecovered).toBe(1); expect(s.achievementIDs).toContain('first-recovery')
    s = acknowledgeAll(s); s.reputation = 90; s.elapsed = 2000; s.nextIncidentAt = 99999
    s.cloudProvisioned = 84; s.aiProvisioned = 48
    s = stepGame(startChallenge(s),91)
    expect(s.completed).toBe(true); expect(s.achievementIDs.filter(id => id === 'launch')).toHaveLength(1)
    expect(s.logs.filter(log => log.text.includes('Launch Champion achievement: +$5000.'))).toHaveLength(1)
  })
  it('pauses for incident-first announcements and preserves manual pause on acknowledgement and reload', () => {
    let s = withUpgrades('ssd'); s.nextIncidentAt = 0; s.incidentQueue = []
    s = purchaseUpgrade(s,'virtualization')
    const tech = getNextAnnouncement(s)!
    expect(tech.kind).toBe('technology'); expect(stepGame(s,5)).toBe(s)
    s = triggerIncident(s,'bot')
    expect(getNextAnnouncement(s)!.kind).toBe('incident')
    const restored = loadGame(serializeGame(s))!
    expect(getNextAnnouncement(restored)!.id).toBe(getNextAnnouncement(s)!.id)
    s = acknowledgeAnnouncement(restored,getNextAnnouncement(restored)!.id)
    expect(getNextAnnouncement(s)!.id).toBe(tech.id)
    s.paused = true
    s = acknowledgeAnnouncement(s,tech.id)
    expect(s.paused).toBe(true); expect(getNextAnnouncement(s)).toBeUndefined()
    const again = loadGame(serializeGame(s))!
    expect(getNextAnnouncement(again)).toBeUndefined(); expect(again.paused).toBe(true)
  })
  it('migrates v2 history without retroactive cash or unlock dialogs', () => {
    const s = withUpgrades(); s.totalServed = 200; s.completed = true
    const old = {...s,version:2,equipmentLevels:undefined,achievementIDs:undefined,announcements:undefined,acknowledgedAnnouncements:undefined,announcementSequence:undefined,aiServed:undefined,stableServiceMinutes:undefined,incidentsRecovered:undefined}
    const loaded = loadGame(JSON.stringify(old))!
    expect(loaded.version).toBe(3); expect(loaded.cash).toBe(s.cash)
    expect(loaded.equipmentLevels.cpu).toBe(1); expect(loaded.equipmentLevels.cloud).toBe(0)
    expect(loaded.achievementIDs).toContain('requests-100'); expect(loaded.achievementIDs).toContain('launch')
    expect(getNextAnnouncement(loaded)).toBeUndefined()
  })
  it('has the approved ten reward milestones', () => {
    expect(ACHIEVEMENTS).toHaveLength(10)
    expect(ACHIEVEMENTS.reduce((sum,a) => sum+a.reward,0)).toBe(9750)
  })
})
