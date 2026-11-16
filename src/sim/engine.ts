import { UPGRADES, upgradeById } from './upgrades'
import type { GameState, Incident, IncidentKind, Metrics, PolicyState, UpgradeId } from './types'

const emptyMetrics: Metrics = {
  demand: 4, standardDemand: 4, aiDemand: 0, served: 3, dropped: 1, successRate: .75,
  network: 8, compute: 3, memory: 4, storage: 5, onPrem: 3, cloud: 0, aiCapacity: 0,
  cacheHits: 0, latency: 600, gross: 3, expenses: .8, net: 2.2, bottleneck: 'compute',
  utilizations: { network: .5, compute: 1, memory: .75, storage: .6, ai: 0 },
}

export const createInitialState = (): GameState => ({
  version: 1, cash: 25, reputation: 60, elapsed: 0, totalServed: 0, paused: false, speed: 1,
  upgrades: [], policies: { loadBalancer: 'efficiency', firewall: 'balanced', autoscaling: 'economy' },
  policyCooldownUntil: 0, tutorialStep: 0, tutorialComplete: false, incident: null, triggered: [],
  nextIncidentAt: 150, rng: 209, challenge: { active: false, remaining: 90, totalDemand: 0, totalServed: 0, result: null, retryAt: 0 },
  completed: false, metrics: emptyMetrics,
  logs: [{ id: 1, time: 0, tone: 'info', text: 'Office server online. Customer requests are arriving.' }],
})

const owned = (s: GameState, id: UpgradeId) => s.upgrades.includes(id)
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))
const addLog = (s: GameState, text: string, tone: 'info' | 'good' | 'warn' = 'info') => {
  const entry = { id: (s.logs[0]?.id ?? 0) + 1, time: s.elapsed, tone, text }
  s.logs = [entry, ...s.logs].slice(0, 18)
}

const nextRandom = (s: GameState) => {
  s.rng = (s.rng * 1664525 + 1013904223) >>> 0
  return s.rng / 4294967296
}

const milestoneDemand = (s: GameState) => {
  const bonuses: Partial<Record<UpgradeId, number>> = {
    cpu: 1, memory: 1.5, ssd: 2, virtualization: 2, server2: 4, load_balancer: 5,
    security: 2, cache: 5, cloud: 8, autoscaling: 12, ai: 10,
  }
  return s.upgrades.reduce((sum, id) => sum + (bonuses[id] ?? 0), 0)
}

export const calculateMetrics = (s: GameState): Metrics => {
  let demand = (4 + Math.min(20, s.elapsed * .01) + milestoneDemand(s)) * (.70 + s.reputation / 200)
  if (s.incident?.kind === 'marketing') demand *= 1.8
  if (s.challenge.active) demand *= 2

  let network = owned(s, 'load_balancer') ? 20 : 8
  if (owned(s, 'cloud')) network = 40
  let compute = 3 + (owned(s, 'cpu') ? 3 : 0)
  let memory = 4 + (owned(s, 'memory') ? 4 : 0)
  let storage = 5 + (owned(s, 'ssd') ? 7 : 0)

  if (owned(s, 'virtualization')) { compute *= 1.25; memory *= 1.25 }
  if (owned(s, 'server2')) {
    const factor = owned(s, 'load_balancer') ? 1 : .5
    compute += 6 * factor; memory += 8 * factor; storage += 6 * factor
  }
  if (owned(s, 'load_balancer')) {
    const factor = s.policies.loadBalancer === 'efficiency' ? 1.1 : .9
    compute *= factor; memory *= factor; storage *= factor
  }
  if (owned(s, 'security') && s.policies.firewall === 'strict') compute *= .92
  if (s.incident?.kind === 'hardware') {
    const impact = s.policies.loadBalancer === 'redundancy' ? .8 : .6
    compute *= impact; memory *= impact; storage *= impact
  }
  if (s.incident?.kind === 'bot') network *= owned(s, 'security') ? .92 : .72

  const aiShare = owned(s, 'ai') ? (s.challenge.active ? .35 : .18) : 0
  const aiDemand = demand * aiShare
  const standardDemand = demand - aiDemand
  const ingressScale = Math.min(1, network / Math.max(.001, demand))
  const standardIngress = standardDemand * ingressScale
  const aiIngress = aiDemand * ingressScale
  const cacheHits = owned(s, 'cache') ? standardIngress * .35 : 0
  const originDemand = standardIngress - cacheHits
  const onPrem = Math.min(compute, memory, storage)

  let cloud = owned(s, 'cloud') ? 24 : 0
  if (owned(s, 'autoscaling')) {
    const target = s.policies.autoscaling === 'economy' ? .85 : .60
    const desired = Math.max(24, originDemand / target - onPrem)
    cloud = clamp(desired, 24, 84)
  }
  const originServed = Math.min(originDemand, onPrem + cloud)
  const aiCapacity = owned(s, 'ai') ? 8 : 0
  const aiServed = Math.min(aiIngress, aiCapacity)
  const served = cacheHits + originServed + aiServed
  const dropped = Math.max(0, demand - served)
  const successRate = demand > 0 ? served / demand : 1
  const onPremUsed = Math.min(originDemand, onPrem)
  const cloudUsed = Math.max(0, originServed - onPremUsed)
  const gross = cacheHits + originServed + aiServed * 4
  let expenses = owned(s, 'virtualization') ? .72 : .8
  if (owned(s, 'server2')) expenses += 1.5
  if (owned(s, 'backup')) expenses += .3
  if (owned(s, 'security')) expenses += .4
  if (owned(s, 'cache')) expenses += .4
  expenses += cloudUsed * (s.incident?.kind === 'billing' ? .15 : .05)
  expenses += aiServed * .15

  const utilizations = {
    network: clamp(demand / network, 0, 1),
    compute: clamp(onPremUsed / Math.max(.001, compute), 0, 1),
    memory: clamp(onPremUsed / Math.max(.001, memory), 0, 1),
    storage: clamp(onPremUsed / Math.max(.001, storage), 0, 1),
    ai: aiCapacity ? clamp(aiDemand / aiCapacity, 0, 1) : 0,
  }
  const stages = Object.entries(utilizations) as [keyof typeof utilizations, number][]
  const [mostUsed, utilization] = stages.sort((a, b) => b[1] - a[1])[0]
  let bottleneck: Metrics['bottleneck'] = successRate >= .985 ? 'healthy' : mostUsed
  if (aiDemand > aiCapacity && aiShare) bottleneck = 'ai'
  const latency = 80 + 520 * utilization ** 3 + (s.incident?.kind === 'bot' ? 180 : 0)
  return { demand, standardDemand, aiDemand, served, dropped, successRate, network, compute, memory, storage, onPrem, cloud, aiCapacity, cacheHits, latency, gross, expenses, net: gross - expenses, bottleneck, utilizations }
}

const makeIncident = (kind: IncidentKind, s: GameState): Incident => {
  const definitions = {
    marketing: ['Marketing traffic spike', 'A promotion is sending far more visitors than forecast.', 25],
    hardware: ['Server hardware fault', 'One machine is degraded. Redundancy and recovery reduce the impact.', owned(s, 'backup') ? 10 : 24],
    bot: ['Automated bot attack', 'Suspicious traffic is consuming gateway capacity.', owned(s, 'security') ? 10 : 24],
    billing: ['Cloud bill shock', 'Burst capacity is temporarily three times more expensive.', 22],
  } as const
  const [title, detail, total] = definitions[kind]
  return { kind, title, detail, remaining: total, total }
}

export const triggerIncident = (s: GameState, kind: IncidentKind) => {
  if (s.incident) return s
  const copy = structuredClone(s)
  copy.incident = makeIncident(kind, copy)
  if (!copy.triggered.includes(kind)) copy.triggered.push(kind)
  addLog(copy, copy.incident.title, 'warn')
  return copy
}

const maybeAdvanceTutorial = (s: GameState) => {
  if (s.tutorialStep === 0 && s.totalServed >= 20) {
    s.tutorialStep = 1; s.cash += 55; addLog(s, 'Traffic observed. Diagnostic grant: +$55', 'good')
  }
}

export const inspectDiagnostics = (state: GameState) => {
  const s = structuredClone(state)
  if (s.tutorialStep === 2) {
    s.tutorialStep = 3; s.cash += 80; addLog(s, 'Bottleneck identified. Optimization grant: +$80', 'good')
  }
  return s
}

export const canPurchase = (s: GameState, id: UpgradeId) => {
  const item = upgradeById[id]
  if (owned(s, id)) return { ok: false, reason: 'Installed' }
  const missing = item.prerequisites.filter((need) => !owned(s, need))
  if (missing.length) return { ok: false, reason: `Requires ${missing.map((x) => upgradeById[x].name).join(', ')}` }
  if (s.cash < item.cost) return { ok: false, reason: `Need $${Math.ceil(item.cost - s.cash).toLocaleString()} more` }
  return { ok: true, reason: 'Ready' }
}

export const purchaseUpgrade = (state: GameState, id: UpgradeId) => {
  if (!canPurchase(state, id).ok) return state
  const s = structuredClone(state)
  const item = upgradeById[id]
  s.cash -= item.cost; s.upgrades.push(id); addLog(s, `${item.name} installed. ${item.effect}`, 'good')
  if (id === 'cpu' && s.tutorialStep === 1) { s.tutorialStep = 2; s.cash += 50 }
  if (id === 'memory' && s.tutorialStep === 3) {
    s.tutorialStep = 4; s.tutorialComplete = true; s.cash += 100
    addLog(s, 'Orientation complete. Build the infrastructure your way.', 'good')
  }
  const incidents: Partial<Record<UpgradeId, IncidentKind>> = { ssd: 'marketing', server2: 'hardware', load_balancer: 'bot', cloud: 'billing' }
  const incident = incidents[id]
  if (incident && !s.triggered.includes(incident) && !s.incident) {
    s.incident = makeIncident(incident, s); s.triggered.push(incident); addLog(s, s.incident.title, 'warn')
  }
  s.metrics = calculateMetrics(s)
  return s
}

export const setPolicy = (state: GameState, group: keyof PolicyState, value: string) => {
  if (state.elapsed < state.policyCooldownUntil) return state
  const s = structuredClone(state)
  ;(s.policies[group] as string) = value
  s.policyCooldownUntil = s.elapsed + 10
  addLog(s, `${group === 'loadBalancer' ? 'Load balancer' : group === 'firewall' ? 'Firewall' : 'Autoscaling'} policy changed to ${value}.`)
  return s
}

export const startChallenge = (state: GameState) => {
  if (!owned(state, 'ai') || state.challenge.active || state.elapsed < state.challenge.retryAt) return state
  const s = structuredClone(state)
  s.challenge = { active: true, remaining: 90, totalDemand: 0, totalServed: 0, result: null, retryAt: 0 }
  addLog(s, 'Launch Day started: 90 minutes of peak traffic.', 'warn')
  return s
}

export const setSpeed = (state: GameState, speed: 1 | 2 | 4) => ({ ...state, speed })
export const togglePause = (state: GameState) => ({ ...state, paused: !state.paused })

export const stepGame = (state: GameState, realDelta: number): GameState => {
  if (state.paused) return state
  const s = structuredClone(state)
  const dt = Math.min(.25, realDelta) * s.speed
  s.elapsed += dt
  s.metrics = calculateMetrics(s)
  s.cash = Math.max(0, s.cash + s.metrics.net * dt)
  s.totalServed += s.metrics.served * dt
  const repDelta = s.metrics.successRate >= .98 ? .02 : -.12 * (1 - s.metrics.successRate)
  s.reputation = clamp(s.reputation + repDelta * dt, 0, 100)
  maybeAdvanceTutorial(s)

  if (s.incident) {
    s.incident.remaining -= dt
    if (s.incident.remaining <= 0) { addLog(s, `${s.incident.title} resolved.`, 'good'); s.incident = null }
  }
  if (!s.incident && s.tutorialComplete && s.upgrades.length >= 4 && s.elapsed >= s.nextIncidentAt) {
    const available: IncidentKind[] = ['marketing']
    if (owned(s, 'server2')) available.push('hardware')
    if (owned(s, 'load_balancer')) available.push('bot')
    if (owned(s, 'cloud')) available.push('billing')
    const kind = available[Math.floor(nextRandom(s) * available.length)]
    s.incident = makeIncident(kind, s); addLog(s, s.incident.title, 'warn')
    s.nextIncidentAt = s.elapsed + 100 + nextRandom(s) * 80
  }

  if (s.challenge.active) {
    s.challenge.remaining -= dt
    s.challenge.totalDemand += s.metrics.demand * dt
    s.challenge.totalServed += s.metrics.served * dt
    if (s.challenge.remaining <= 0) {
      const rate = s.challenge.totalServed / Math.max(1, s.challenge.totalDemand)
      const passed = rate >= .90 && s.reputation >= 65
      s.challenge.active = false; s.challenge.result = passed ? 'passed' : 'failed'
      if (passed) { s.completed = true; s.cash += 50000; addLog(s, 'Launch Day passed! Endless Lab mode unlocked.', 'good') }
      else { s.challenge.retryAt = s.elapsed + 30; addLog(s, 'Launch Day missed its service target. Review the bottleneck and retry.', 'warn') }
    }
  }
  return s
}

export const serializeGame = (s: GameState) => JSON.stringify({ ...s, paused: true })

export const loadGame = (value: string): GameState | null => {
  try {
    const parsed = JSON.parse(value) as Partial<GameState>
    if (parsed.version !== 1 || !Array.isArray(parsed.upgrades) || typeof parsed.cash !== 'number') return null
    const validIds = new Set(UPGRADES.map((x) => x.id))
    if (parsed.upgrades.some((x) => !validIds.has(x))) return null
    const base = createInitialState()
    const merged = { ...base, ...parsed, paused: false, metrics: base.metrics } as GameState
    merged.metrics = calculateMetrics(merged)
    return merged
  } catch { return null }
}
