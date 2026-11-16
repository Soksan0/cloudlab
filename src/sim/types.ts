export type UpgradeId =
  | 'cpu' | 'memory' | 'ssd' | 'virtualization' | 'server2' | 'load_balancer'
  | 'backup' | 'security' | 'cache' | 'cloud' | 'autoscaling' | 'ai'

export type PolicyState = {
  loadBalancer: 'efficiency' | 'redundancy'
  firewall: 'balanced' | 'strict'
  autoscaling: 'economy' | 'resilient'
}

export type EquipmentId = 'cpu' | 'memory' | 'ssd' | 'network' | 'cloud' | 'ai'
export type EquipmentDefinition = { id: EquipmentId; name: string; baseCost: number; increase: number; unlock?: UpgradeId }
export type Announcement = { id: string; kind: 'incident' | 'technology' | 'achievement' | 'challenge' | 'report'; title: string; body: string; actionLabel: string; illustration?: string; reportId?: string; impact?: PurchaseImpact; tip?: string }
export type LossStage = 'network' | 'compute' | 'memory' | 'storage' | 'ai'
export type PurchaseImpact = { id: string; at: number; before: Metrics; after: Metrics }
export type EventStatistics = {
  duration: number; standardRequests: number; aiRequests: number; served: number; dropped: number;
  gross: number; expenses: number; potentialGross: number; extraRequests: number;
  missedByStage: Record<LossStage, number>; partial: boolean
}
export type EventReport = EventStatistics & { id: string; kind: IncidentKind; title: string; endedAt: number; dominantStage: LossStage | null }
export type AchievementDefinition = { id: string; name: string; description: string; reward: number }

export type UpgradeDefinition = {
  id: UpgradeId
  name: string
  short: string
  cost: number
  prerequisites: UpgradeId[]
  icon: string
  category: 'hardware' | 'reliability' | 'cloud' | 'advanced'
  effect: string
  lesson: string
}

export type IncidentKind = 'marketing' | 'hardware' | 'bot' | 'billing'

export type Incident = {
  kind: IncidentKind
  title: string
  detail: string
  remaining: number
  total: number
  stats?: EventStatistics
}

export type ChallengeState = {
  active: boolean
  remaining: number
  totalDemand: number
  totalServed: number
  result: 'passed' | 'failed' | null
  retryAt: number
}

export type Metrics = {
  demand: number
  standardDemand: number
  aiDemand: number
  aiServed: number
  losses: Record<LossStage, number>
  served: number
  dropped: number
  successRate: number
  network: number
  compute: number
  memory: number
  storage: number
  onPrem: number
  cloud: number
  aiCapacity: number
  cacheHits: number
  latency: number
  gross: number
  expenses: number
  net: number
  bottleneck: 'network' | 'compute' | 'memory' | 'storage' | 'ai' | 'healthy'
  utilizations: Record<'network' | 'compute' | 'memory' | 'storage' | 'ai', number>
}

export type LogEntry = { id: number; time: number; tone: 'info' | 'good' | 'warn'; text: string }

export type TutorialState = {
  status: 'welcome' | 'active' | 'complete' | 'skipped'
  step: number
  phase: 'explain' | 'demo' | 'action'
  demoRemaining: number
  replay: boolean
  demonstrated: boolean
}

export type AdvisorRecommendation = {
  id: string
  title: string
  reason: string
  upgradeId?: UpgradeId | EquipmentId
  target: string
  priority: 'capacity' | 'risk' | 'healthy'
}

export type GameState = {
  version: 4
  revenue: { gross: number; expenses: number; grants: number }
  lastPurchase: PurchaseImpact | null
  eventReports: EventReport[]
  cash: number
  reputation: number
  elapsed: number
  totalServed: number
  paused: boolean
  speed: 1 | 2 | 4
  upgrades: UpgradeId[]
  equipmentLevels: Record<EquipmentId, number>
  aiServed: number
  stableServiceMinutes: number
  incidentsRecovered: number
  achievementIDs: string[]
  announcements: Announcement[]
  acknowledgedAnnouncements: string[]
  announcementSequence: number
  policies: PolicyState
  policyCooldownUntil: number
  tutorialStep: number
  tutorialComplete: boolean
  tutorial: TutorialState
  upgradeTimes: Partial<Record<UpgradeId, number>>
  cloudProvisioned: number
  aiProvisioned: number
  scaleTimer: number
  incidentQueue: IncidentKind[]
  incident: Incident | null
  triggered: IncidentKind[]
  nextIncidentAt: number
  rng: number
  challenge: ChallengeState
  completed: boolean
  metrics: Metrics
  logs: LogEntry[]
}
