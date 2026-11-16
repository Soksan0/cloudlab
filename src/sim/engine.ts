import { UPGRADES, upgradeById } from './upgrades'
import type { AdvisorRecommendation, GameState, Incident, IncidentKind, Metrics, PolicyState, UpgradeId } from './types'

const ids = UPGRADES.map((u) => u.id)
const kinds: IncidentKind[] = ['marketing', 'hardware', 'bot', 'billing']
const owned = (s: GameState, id: UpgradeId) => s.upgrades.includes(id)
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n))
const training = (s: GameState) => s.tutorial.status === 'active' || s.tutorial.status === 'welcome'
const addLog = (s: GameState, text: string, tone: 'info' | 'good' | 'warn' = 'info') => {
  s.logs = [{ id: (s.logs[0]?.id ?? 0) + 1, time: s.elapsed, tone, text }, ...s.logs].slice(0, 18)
}
const nextRandom = (s: GameState) => {
  s.rng = (s.rng * 1664525 + 1013904223) >>> 0
  return s.rng / 4294967296
}

export const createInitialState = (): GameState => {
  const state: GameState = {
    version: 2, cash: 25, reputation: 60, elapsed: 0, totalServed: 0, paused: true, speed: 1,
    upgrades: [], policies: { loadBalancer: 'efficiency', firewall: 'balanced', autoscaling: 'economy' },
    policyCooldownUntil: 0, tutorialStep: 0, tutorialComplete: false,
    tutorial: { status: 'welcome', step: 0, phase: 'explain', demoRemaining: 0, replay: false, demonstrated: false },
    upgradeTimes: {}, cloudProvisioned: 0, aiProvisioned: 0, scaleTimer: 0,
    incident: null, incidentQueue: [], triggered: [], nextIncidentAt: 150, rng: 209,
    challenge: { active: false, remaining: 90, totalDemand: 0, totalServed: 0, result: null, retryAt: 0 },
    completed: false, metrics: {} as Metrics,
    logs: [{ id: 1, time: 0, tone: 'info', text: 'Welcome to CloudLab. Your first lab is ready.' }],
  }
  state.metrics = calculateMetrics(state)
  return state
}

const milestoneDemand = (s: GameState) => {
  const bonuses: Partial<Record<UpgradeId, number>> = {
    cpu: 1, memory: 1.5, ssd: 2, virtualization: 2, server2: 4, load_balancer: 5,
    security: 2, cache: 5, cloud: 8, autoscaling: 12, ai: 10,
  }
  return s.upgrades.reduce((sum, id) => sum + (bonuses[id] ?? 0) * clamp((s.elapsed - (s.upgradeTimes[id] ?? 0) - 15) / 60, 0, 1), 0)
}

const demandFor = (s: GameState) => {
  if (training(s)) {
    if (s.tutorial.step <= 1) return 2
    if (s.tutorial.step <= 4) return 5
    return 6
  }
  let demand = Math.min(72, (4 + Math.min(20, s.elapsed * .003) + milestoneDemand(s)) * (.70 + s.reputation / 200))
  if (s.incident?.kind === 'marketing') demand *= 1.5
  if (s.challenge.active) demand *= 2
  return demand
}

export const getEffectiveUpgrades = (s: GameState): UpgradeId[] => {
  if (!training(s) || !s.tutorial.replay) return s.upgrades
  return (['cpu', 'memory', 'ssd'] as const).filter((_, index) => {
    const lesson = index + 3
    return s.tutorial.step > lesson || (s.tutorial.step === lesson && (s.tutorial.phase === 'demo' || s.tutorial.demonstrated))
  })
}

export const calculateMetrics = (state: GameState): Metrics => {
  const s = training(state) && state.tutorial.replay ? { ...state, upgrades: getEffectiveUpgrades(state), incident: null } : state
  const demand = demandFor(s)
  let network = owned(s, 'autoscaling') ? 160 : owned(s, 'cloud') ? 40 : owned(s, 'load_balancer') ? 20 : 8
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
    const factor = owned(s, 'load_balancer') && s.policies.loadBalancer === 'redundancy' ? .8 : .6
    compute *= factor; memory *= factor; storage *= factor
  }
  if (s.incident?.kind === 'bot') {
    const protection = owned(s, 'security') ? s.policies.firewall === 'strict' ? .9 : .7 : 0
    network *= 1 - .35 * (1 - protection)
  }
  const aiShare = owned(s, 'ai') ? s.challenge.active ? .35 : .18 : 0
  const aiDemand = demand * aiShare
  const standardDemand = demand - aiDemand
  const ingress = Math.min(1, network / Math.max(.001, demand))
  const standardIngress = standardDemand * ingress
  const aiIngress = aiDemand * ingress
  const cacheHits = owned(s, 'cache') ? standardIngress * .35 : 0
  const originDemand = standardIngress - cacheHits
  const onPrem = Math.min(compute, memory, storage)
  const cloud = owned(s, 'cloud') ? owned(s, 'autoscaling') ? clamp(s.cloudProvisioned, 24, 84) : 24 : 0
  const originServed = Math.min(originDemand, onPrem + cloud)
  const aiCapacity = owned(s, 'ai') ? clamp(s.aiProvisioned, 8, 48) : 0
  const aiServed = Math.min(aiIngress, aiCapacity)
  const served = cacheHits + originServed + aiServed
  const dropped = Math.max(0, demand - served)
  const successRate = served / Math.max(.001, demand)
  const onPremUsed = Math.min(originDemand, onPrem)
  const cloudUsed = Math.max(0, originServed - onPremUsed)
  const gross = (cacheHits + originServed) * 4 + aiServed * 12
  let expenses = owned(s, 'virtualization') ? .72 : .8
  if (owned(s, 'server2')) expenses += 1.5
  if (owned(s, 'backup')) expenses += .3
  if (owned(s, 'security')) expenses += .4
  if (owned(s, 'cache')) expenses += .4
  const billFactor = s.incident?.kind === 'billing' ? 3 : 1
  expenses += (cloud * .08 + cloudUsed * .05) * billFactor
  expenses += aiCapacity * .06 + aiServed * .15
  const utilizations = {
    network: clamp(demand / network, 0, 1), compute: clamp(onPremUsed / compute, 0, 1),
    memory: clamp(onPremUsed / memory, 0, 1), storage: clamp(onPremUsed / storage, 0, 1),
    ai: aiCapacity ? clamp(aiIngress / aiCapacity, 0, 1) : 0,
  }
  const networkLost = Math.max(0, demand - network)
  const originLost = Math.max(0, originDemand - originServed)
  const aiLost = Math.max(0, aiIngress - aiServed)
  const originStage = compute <= memory && compute <= storage ? 'compute' : memory <= storage ? 'memory' : 'storage'
  const losses: [Metrics['bottleneck'], number][] = [['network', networkLost], [originStage, originLost], ['ai', aiLost]]
  losses.sort((a, b) => b[1] - a[1])
  const bottleneck = successRate >= .985 ? 'healthy' : losses[0][0]
  const serviceUse = Math.max(demand / Math.max(1, network), originDemand / Math.max(1, onPrem + cloud), aiCapacity ? aiIngress / aiCapacity : 0)
  const latency = 80 + 520 * Math.min(1, serviceUse) ** 3
  return { demand, standardDemand, aiDemand, served, dropped, successRate, network, compute, memory, storage, onPrem, cloud, aiCapacity, cacheHits, latency, gross, expenses, net: gross - expenses, bottleneck, utilizations }
}

const lessonDefinitions = [
  { title: 'Welcome to your first lab', body: 'Customers send requests. Servers process them. Successful responses earn money. Let’s learn one part at a time.', target: 'server' },
  { title: 'Follow one customer request', body: 'A request enters the gateway, reaches the server, reads storage, and returns a response. Watch the moving packet.', target: 'gateway' },
  { title: 'Find the first bottleneck', body: 'Five requests arrive each minute, but the CPU can process only three. The unserved requests are dropped. Watch the CPU meter.', target: 'diagnostics' },
  { title: 'Install a CPU Module', body: 'The CPU does the processing work. More CPU capacity lets this server handle more requests. A training grant covers this purchase.', target: 'cpu', requiredUpgrade: 'cpu' as UpgradeId },
  { title: 'Add working memory', body: 'The CPU is faster, but memory only holds four active requests. Install memory so more requests can stay in flight.', target: 'memory', requiredUpgrade: 'memory' as UpgradeId },
  { title: 'Fix slow storage', body: 'Six requests now arrive, but storage handles only five reads per minute. Add an SSD Array to remove this constraint.', target: 'ssd', requiredUpgrade: 'ssd' as UpgradeId },
  { title: 'Read your business results', body: 'Every standard request earns $4. Operating costs are subtracted to give net income. Dropped requests earn nothing. Your priority card explains what to improve next.', target: 'economy' },
  { title: 'Your lab is ready', body: 'You improved CPU, memory, and storage. In your own lab, follow the current priority, compare upgrades, and experiment with risk and cost. Help can replay these lessons anytime.', target: 'diagnostics' },
]

export const getTutorialLesson = (s: GameState) => {
  const lesson = lessonDefinitions[s.tutorial.step] ?? lessonDefinitions[0]
  const t = s.tutorial
  let body = lesson.body
  if (t.demonstrated && t.step >= 3 && t.step <= 5) body = `${upgradeById[lesson.requiredUpgrade!].name} is installed. Compare the served requests and capacity meters: removing one constraint can reveal the next.`
  if (t.phase === 'demo') body = t.step <= 2 ? lesson.body : 'Watch the result: requests are being served with the upgraded capacity. The demonstration will pause automatically.'
  const actionLabel = t.step === 7 ? 'Run my lab' : t.demonstrated ? 'Next lesson' : t.step === 1 || t.step === 2 ? 'Run demonstration' : lesson.requiredUpgrade ? 'Show required upgrade' : 'Continue'
  return { ...lesson, body, actionLabel, progress: t.step + 1 }
}

const syncTutorial = (s: GameState) => { s.tutorialStep = s.tutorial.step; s.tutorialComplete = s.tutorial.status === 'complete' || s.tutorial.status === 'skipped' }
export const startTutorial = (state: GameState) => {
  const s = structuredClone(state)
  s.tutorial = { status: 'active', step: 1, phase: 'explain', demoRemaining: 0, replay: false, demonstrated: false }
  s.paused = true; syncTutorial(s); s.metrics = calculateMetrics(s)
  return s
}
export const replayTutorial = (state: GameState) => {
  const s = startTutorial(state)
  s.tutorial.replay = true
  s.metrics = calculateMetrics(s)
  return s
}
export const skipTutorial = (state: GameState) => {
  const s = structuredClone(state)
  s.tutorial.status = 'skipped'; s.tutorial.phase = 'explain'; s.tutorial.demoRemaining = 0
  s.paused = false; syncTutorial(s); s.metrics = calculateMetrics(s)
  addLog(s, 'Open Lab online. Your priority card will guide the next decision.', 'good')
  return s
}
export const advanceTutorial = (state: GameState) => {
  if (state.tutorial.status !== 'active' || state.tutorial.phase === 'demo' || state.tutorial.phase === 'action') return state
  const s = structuredClone(state), t = s.tutorial
  if (t.step === 7) {
    t.status = 'complete'; s.paused = false; s.nextIncidentAt = s.elapsed + 150
    addLog(s, 'Orientation complete. Build the infrastructure your way.', 'good')
  } else if (t.demonstrated || t.step === 6) {
    t.step++; t.demonstrated = false; t.phase = 'explain'; s.paused = true
  } else if (t.step <= 2) { t.phase = 'demo'; t.demoRemaining = 4; s.paused = false }
  else {
    const upgrade = lessonDefinitions[t.step].requiredUpgrade!
    t.phase = owned(s, upgrade) ? 'demo' : 'action'
    t.demoRemaining = owned(s, upgrade) ? 4 : 0
    s.paused = !owned(s, upgrade)
    const grant = owned(s, upgrade) ? 0 : Math.max(0, upgradeById[upgrade].cost - s.cash)
    if (grant) { s.cash += grant; addLog(s, `Training grant: +$${Math.ceil(grant)} for ${upgradeById[upgrade].name}.`, 'good') }
  }
  syncTutorial(s); s.metrics = calculateMetrics(s)
  return s
}
export const inspectDiagnostics = (s: GameState) => advanceTutorial(s)

export const canPurchase = (s: GameState, id: UpgradeId) => {
  const item = upgradeById[id]
  if (!item) return { ok: false, reason: 'Unknown upgrade' }
  if (owned(s, id)) return { ok: false, reason: 'Installed' }
  if (training(s) && (s.tutorial.phase !== 'action' || getTutorialLesson(s).requiredUpgrade !== id)) return { ok: false, reason: 'Follow the highlighted tutorial action, or skip to Open Lab.' }
  const missing = item.prerequisites.filter((need) => !owned(s, need))
  if (missing.length) return { ok: false, reason: `Requires ${missing.map((x) => upgradeById[x].name).join(', ')}` }
  if (s.cash < item.cost) return { ok: false, reason: `Need $${Math.ceil(item.cost - s.cash).toLocaleString()} more` }
  return { ok: true, reason: 'Ready' }
}

const makeIncident = (kind: IncidentKind, s: GameState): Incident => {
  const duration = kind === 'hardware' ? owned(s, 'backup') ? 10 : 25 : kind === 'bot' ? owned(s, 'security') ? s.policies.firewall === 'strict' ? 5 : 9 : 25 : kind === 'marketing' ? 25 : 22
  const details = {
    marketing: ['Marketing traffic spike', 'A promotion is sending more visitors than forecast. More capacity and caching can help.'],
    hardware: ['Server hardware fault', 'One machine is degraded. Backup recovery shortens the outage; redundancy reduces the capacity loss.'],
    bot: ['Automated bot attack', 'Suspicious traffic is consuming gateway capacity. Firewall protection reduces the impact and duration.'],
    billing: ['Cloud bill shock', 'Cloud capacity and usage temporarily cost three times as much. Economy autoscaling carries less spare capacity.'],
  }
  return { kind, title: details[kind][0], detail: details[kind][1], remaining: duration, total: duration }
}

const queueIncident = (s: GameState, kind: IncidentKind) => {
  if (!s.triggered.includes(kind) && !s.incidentQueue.includes(kind)) s.incidentQueue.push(kind)
}
export const triggerIncident = (state: GameState, kind: IncidentKind) => {
  const s = structuredClone(state)
  if (s.incident || training(s) || s.elapsed < s.nextIncidentAt) queueIncident(s, kind)
  else { s.incident = makeIncident(kind, s); if (!s.triggered.includes(kind)) s.triggered.push(kind); addLog(s, s.incident.title, 'warn') }
  return s
}

export const purchaseUpgrade = (state: GameState, id: UpgradeId) => {
  if (!canPurchase(state, id).ok) return state
  const s = structuredClone(state), item = upgradeById[id]
  s.cash -= item.cost; s.upgrades.push(id); s.upgradeTimes[id] = s.elapsed
  if (id === 'cloud') s.cloudProvisioned = 24
  if (id === 'ai') s.aiProvisioned = 8
  addLog(s, `${item.name} installed. ${item.effect}`, 'good')
  if (training(s)) { s.tutorial.phase = 'demo'; s.tutorial.demoRemaining = 4; s.paused = false }
  else {
    const milestone: Partial<Record<UpgradeId, IncidentKind>> = { ssd: 'marketing', server2: 'hardware', load_balancer: 'bot', cloud: 'billing' }
    if (milestone[id]) queueIncident(s, milestone[id]!)
  }
  s.metrics = calculateMetrics(s)
  return s
}

const dependencyFor = (s: GameState, goal: UpgradeId): UpgradeId | undefined => {
  if (owned(s, goal)) return undefined
  const missing = upgradeById[goal].prerequisites.find((id) => !owned(s, id))
  return missing ? dependencyFor(s, missing) : goal
}

export const getRecommendation = (s: GameState): AdvisorRecommendation => {
  const m = calculateMetrics(s)
  const capacityGoal: Record<string, UpgradeId> = { network: owned(s, 'load_balancer') ? owned(s, 'cloud') ? 'autoscaling' : 'cloud' : 'load_balancer', compute: !owned(s, 'cpu') ? 'cpu' : !owned(s, 'virtualization') ? 'virtualization' : !owned(s, 'server2') ? 'server2' : !owned(s, 'cloud') ? 'cloud' : 'autoscaling', memory: !owned(s, 'memory') ? 'memory' : !owned(s, 'server2') ? 'server2' : !owned(s, 'cloud') ? 'cloud' : 'autoscaling', storage: !owned(s, 'ssd') ? 'ssd' : !owned(s, 'server2') ? 'server2' : !owned(s, 'cloud') ? 'cloud' : 'autoscaling', ai: 'autoscaling' }
  if (m.bottleneck !== 'healthy') {
    const goal = capacityGoal[m.bottleneck], upgradeId = dependencyFor(s, goal)
    const name = m.bottleneck === 'compute' ? 'CPU processing' : m.bottleneck === 'ai' ? 'AI inference' : m.bottleneck
    const limits = { network: m.network, compute: m.compute, memory: m.memory, storage: m.storage, ai: m.aiCapacity }
    const incoming = m.bottleneck === 'ai' ? m.aiDemand : m.bottleneck === 'network' ? m.demand : m.standardDemand - m.cacheHits
    const reason = `Your ${name} is limiting requests: its capacity is ${limits[m.bottleneck].toFixed(1)} per minute, while ${incoming.toFixed(1)} requests need that stage.${upgradeId ? upgradeId === goal ? ` ${upgradeById[upgradeId].name} addresses this limit.` : ` Work toward ${upgradeById[goal].name}; first install ${upgradeById[upgradeId].name}, its next prerequisite.` : ' Allow the elastic service time to scale; Resilient policy responds faster and keeps more headroom.'}`
    return { id: `capacity-${m.bottleneck}-${upgradeId ?? 'scale'}`, title: `Current priority: ${name}`, reason, upgradeId, target: upgradeId ?? (m.bottleneck === 'network' ? 'gateway' : 'diagnostics'), priority: 'capacity' }
  }
  const risk = s.incident?.kind === 'hardware' ? 'backup' : s.incident?.kind === 'bot' ? 'security' : !owned(s, 'backup') && owned(s, 'ssd') ? 'backup' : !owned(s, 'security') && owned(s, 'virtualization') ? 'security' : undefined
  if (risk && !owned(s, risk)) {
    const upgradeId = dependencyFor(s, risk)
    return { id: `risk-${risk}`, title: 'Current priority: protect the service', reason: `${upgradeById[risk].name} reduces incident impact. It protects reliability rather than increasing normal throughput.`, upgradeId, target: upgradeId ?? 'diagnostics', priority: 'risk' }
  }
  const next = UPGRADES.find((item) => !owned(s, item.id) && item.prerequisites.every((need) => owned(s, need)))
  return { id: `healthy-${next?.id ?? 'complete'}`, title: 'Your current demand is being served', reason: next ? `There is no throughput emergency. ${next.name} is a useful next capability. Compare its cost and purpose before investing.` : 'Your architecture is complete. Review Launch Day readiness or experiment with operating policies.', upgradeId: next?.id, target: next?.id ?? 'diagnostics', priority: 'healthy' }
}

export const getPurchaseAdvice = (s: GameState, id: UpgradeId): string | null => {
  if (training(s)) return null
  const recommendation = getRecommendation(s)
  if (recommendation.priority !== 'capacity' || recommendation.upgradeId === id) return null
  if (id === 'backup' || id === 'security') return `${recommendation.reason} ${upgradeById[id].name} is still a valid reliability investment, but it will not increase normal request throughput.`
  return `${recommendation.reason} ${upgradeById[id].name} may add another capability, but it does not address the current priority. You can still buy it if that is your plan.`
}

export const setPolicy = (state: GameState, group: keyof PolicyState, value: string) => {
  const unlock: Record<keyof PolicyState, UpgradeId> = { loadBalancer: 'load_balancer', firewall: 'security', autoscaling: 'autoscaling' }
  const valid = { loadBalancer: ['efficiency', 'redundancy'], firewall: ['balanced', 'strict'], autoscaling: ['economy', 'resilient'] }
  if (!valid[group]?.includes(value) || !owned(state, unlock[group]) || training(state) || state.elapsed < state.policyCooldownUntil || state.policies[group] === value) return state
  const s = structuredClone(state)
  ;(s.policies[group] as string) = value
  s.policyCooldownUntil = s.elapsed + 10; s.scaleTimer = 0
  addLog(s, `${group === 'loadBalancer' ? 'Load balancer' : group === 'firewall' ? 'Firewall' : 'Autoscaling'} policy changed to ${value}.`)
  s.metrics = calculateMetrics(s)
  return s
}

export const getChallengeReadiness = (state: GameState) => {
  const s = structuredClone(state), reasons: string[] = []
  if (!owned(s, 'ai')) reasons.push('Install AI Inference to unlock Launch Day.')
  if (s.reputation < 65) reasons.push('Recover reputation to at least 65 by serving current demand reliably.')
  if (s.incident) reasons.push('Wait until the active incident has resolved.')
  s.challenge.active = true
  const m = calculateMetrics(s)
  if (m.successRate < .90) reasons.push(`At current provisioned capacity, peak service is ${Math.round(m.successRate * 100)}%. Allow scaling to react or use Resilient policy.`)
  return { ready: reasons.length === 0, reasons }
}
export const startChallenge = (state: GameState) => {
  if (!owned(state, 'ai') || state.challenge.active || state.elapsed < state.challenge.retryAt || training(state)) return state
  const s = structuredClone(state)
  s.challenge = { active: true, remaining: 90, totalDemand: 0, totalServed: 0, result: null, retryAt: 0 }
  addLog(s, 'Launch Day started: 90 game minutes of peak traffic.', 'warn')
  return s
}
export const setSpeed = (s: GameState, speed: 1 | 2 | 4) => [1, 2, 4].includes(speed) ? { ...s, speed } : s
export const togglePause = (s: GameState) => training(s) ? s : { ...s, paused: !s.paused }

const tick = (s: GameState, dt: number) => {
  s.elapsed += dt
  s.metrics = calculateMetrics(s)
  if (!(training(s) && s.tutorial.replay)) {
    s.cash = Math.max(0, s.cash + s.metrics.net * dt)
    s.totalServed += s.metrics.served * dt
  }
  if (training(s)) {
    s.tutorial.demoRemaining = Math.max(0, s.tutorial.demoRemaining - dt)
    if (s.tutorial.demoRemaining <= .000001) { s.tutorial.phase = 'explain'; s.tutorial.demonstrated = true; s.paused = true }
    return
  }
  const repDelta = s.metrics.successRate >= .98 ? .05 : -.06 * (1 - s.metrics.successRate)
  s.reputation = clamp(s.reputation + repDelta * dt, 0, 100)
  if (owned(s, 'autoscaling')) {
    s.scaleTimer += dt
    const delay = s.policies.autoscaling === 'economy' ? 10 : 3
    if (s.scaleTimer >= delay) {
      s.scaleTimer %= delay
      const target = s.policies.autoscaling === 'economy' ? .85 : .60
      const originLoad = s.metrics.standardDemand * (owned(s, 'cache') ? .65 : 1)
      const cloudTarget = clamp(originLoad / target - s.metrics.onPrem, 24, 84)
      s.cloudProvisioned += clamp(cloudTarget - s.cloudProvisioned, -12, 12)
      if (owned(s, 'ai')) {
        const aiTarget = clamp(s.metrics.aiDemand / target, 8, 48)
        s.aiProvisioned += clamp(aiTarget - s.aiProvisioned, -8, 8)
      }
    }
  }
  if (s.incident) {
    s.incident.remaining -= dt
    if (s.incident.remaining <= 0) {
      addLog(s, `${s.incident.title} resolved.`, 'good'); s.incident = null; s.nextIncidentAt = s.elapsed + 90
    }
  }
  if (!s.incident && !s.challenge.active && s.elapsed >= s.nextIncidentAt) {
    let kind = s.incidentQueue.shift()
    if (!kind && s.upgrades.length >= 4) {
      const available: IncidentKind[] = ['marketing']
      if (owned(s, 'server2')) available.push('hardware')
      if (owned(s, 'load_balancer')) available.push('bot')
      if (owned(s, 'cloud')) available.push('billing')
      kind = available[Math.floor(nextRandom(s) * available.length)]
    }
    if (kind) {
      s.incident = makeIncident(kind, s)
      if (!s.triggered.includes(kind)) s.triggered.push(kind)
      addLog(s, s.incident.title, 'warn')
    }
  }
  if (s.challenge.active) {
    s.challenge.remaining = Math.max(0, s.challenge.remaining - dt)
    s.challenge.totalDemand += s.metrics.demand * dt; s.challenge.totalServed += s.metrics.served * dt
    if (s.challenge.remaining <= .000001) {
      const passed = s.challenge.totalServed / Math.max(1, s.challenge.totalDemand) >= .90 && s.reputation >= 65
      s.challenge.active = false; s.challenge.result = passed ? 'passed' : 'failed'
      if (passed) { s.completed = true; s.cash += 5000; addLog(s, 'Launch Day passed! Endless Lab mode unlocked.', 'good') }
      else { s.challenge.retryAt = s.elapsed + 30; addLog(s, 'Launch Day missed its target. Review service capacity and reputation, then retry.', 'warn') }
    }
  }
}

export const stepGame = (state: GameState, realDelta: number): GameState => {
  if (state.paused || !Number.isFinite(realDelta) || realDelta <= 0) return state
  const s = structuredClone(state)
  let remaining = realDelta * s.speed
  while (remaining > .000001 && !s.paused) { const dt = Math.min(.1, remaining); tick(s, dt); remaining -= dt }
  s.metrics = calculateMetrics(s)
  return s
}

export const serializeGame = (s: GameState) => JSON.stringify(s)

export const loadGame = (value: string): GameState | null => {
  try {
    const p = JSON.parse(value)
    const finite = (v: unknown, min = 0, max = 1e15): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
    if (!p || ![1, 2].includes(p.version) || !finite(p.cash) || !Array.isArray(p.upgrades)) return null
    if (new Set(p.upgrades).size !== p.upgrades.length || p.upgrades.some((id: UpgradeId) => !ids.includes(id) || upgradeById[id].prerequisites.some((dep) => !p.upgrades.includes(dep)))) return null
    const s = createInitialState()
    const numberKeys = ['cash', 'elapsed', 'totalServed', 'policyCooldownUntil', 'nextIncidentAt'] as const
    for (const key of numberKeys) if (p[key] !== undefined) { if (!finite(p[key])) return null; s[key] = p[key] }
    if (p.reputation !== undefined) { if (!finite(p.reputation, 0, 100)) return null; s.reputation = p.reputation }
    if (p.speed !== undefined) { if (![1, 2, 4].includes(p.speed)) return null; s.speed = p.speed }
    for (const key of ['paused', 'completed'] as const) if (p[key] !== undefined) { if (typeof p[key] !== 'boolean') return null; s[key] = p[key] }
    if (p.rng !== undefined) { if (!Number.isInteger(p.rng) || !finite(p.rng, 0, 4294967295)) return null; s.rng = p.rng }
    s.upgrades = [...p.upgrades]
    if (p.policies !== undefined) {
      if (!p.policies || !['efficiency', 'redundancy'].includes(p.policies.loadBalancer) || !['balanced', 'strict'].includes(p.policies.firewall) || !['economy', 'resilient'].includes(p.policies.autoscaling)) return null
      s.policies = { ...p.policies }
    }
    if (p.version === 2) {
      const t = p.tutorial
      if (!t || !['welcome', 'active', 'complete', 'skipped'].includes(t.status) || !Number.isInteger(t.step) || t.step < 0 || t.step > 7 || !['explain', 'demo', 'action'].includes(t.phase) || !finite(t.demoRemaining, 0, 4) || typeof t.replay !== 'boolean' || typeof t.demonstrated !== 'boolean') return null
      if (t.phase === 'action' && ![3, 4, 5].includes(t.step)) return null
      if (t.phase !== 'explain' && t.status !== 'active') return null
      if (t.status === 'welcome' && t.step !== 0) return null
      if (t.status === 'active' && t.step < 1) return null
      if (t.phase === 'action' && p.upgrades.includes(lessonDefinitions[t.step].requiredUpgrade)) return null
      s.tutorial = { ...t }; syncTutorial(s)
      if (training(s) && t.phase !== 'demo') s.paused = true
      for (const key of ['cloudProvisioned', 'aiProvisioned', 'scaleTimer'] as const) { if (!finite(p[key], 0, key === 'cloudProvisioned' ? 84 : key === 'aiProvisioned' ? 48 : 10)) return null; s[key] = p[key] }
      if (!p.upgradeTimes || typeof p.upgradeTimes !== 'object') return null
      for (const id of ids) if (p.upgradeTimes[id] !== undefined) { if (!finite(p.upgradeTimes[id], 0, s.elapsed)) return null; s.upgradeTimes[id] = p.upgradeTimes[id] }
    } else {
      s.tutorial = { status: 'skipped', step: 7, phase: 'explain', demoRemaining: 0, replay: false, demonstrated: false }
      syncTutorial(s)
      s.cloudProvisioned = owned(s, 'cloud') ? 24 : 0; s.aiProvisioned = owned(s, 'ai') ? 8 : 0
      for (const id of s.upgrades) s.upgradeTimes[id] = Math.max(0, s.elapsed - 75)
      addLog(s, 'Your previous lab was restored. Open Help to try the new guided tutorial.', 'good')
    }
    if (p.incident !== undefined && p.incident !== null) {
      const i = p.incident
      if (!kinds.includes(i.kind) || !finite(i.total, .1, 100) || !finite(i.remaining, 0, i.total) || typeof i.title !== 'string' || typeof i.detail !== 'string') return null
      s.incident = { kind: i.kind, total: i.total, remaining: i.remaining, title: i.title.slice(0, 200), detail: i.detail.slice(0, 500) }
    }
    for (const key of ['triggered', 'incidentQueue'] as const) if (p[key] !== undefined) { if (!Array.isArray(p[key]) || p[key].length > 4 || p[key].some((x: IncidentKind) => !kinds.includes(x)) || new Set(p[key]).size !== p[key].length) return null; s[key] = [...p[key]] }
    if (p.challenge !== undefined) {
      const c = p.challenge
      if (!c || typeof c.active !== 'boolean' || ![null, 'passed', 'failed'].includes(c.result) || !finite(c.remaining, 0, 90) || !finite(c.totalDemand) || !finite(c.totalServed, 0, c.totalDemand + .001) || !finite(c.retryAt) || (c.active && !owned(s, 'ai'))) return null
      s.challenge = { ...c }
    }
    if (p.logs !== undefined) {
      if (!Array.isArray(p.logs) || p.logs.length > 18 || p.logs.some((l: Record<string, unknown>) => !l || !finite(l.id) || !finite(l.time) || typeof l.text !== 'string' || !['info', 'good', 'warn'].includes(l.tone as string))) return null
      s.logs = p.logs.map((l: {id:number;time:number;text:string;tone:'info'|'good'|'warn'}) => ({ ...l, text: l.text.slice(0, 500) }))
    }
    s.metrics = calculateMetrics(s)
    return s
  } catch { return null }
}
