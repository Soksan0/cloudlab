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
export type PurchaseImpact = { id: string; at: number; before: Metrics; after: Metrics; beforeLevel?:number; afterLevel?:number; quantity?:number; cost?:number; expansionPool?:FleetPool }
export type EventStatistics = {
  duration: number; durationSeconds?:number; standardRequests: number; aiRequests: number; served: number; dropped: number;
  gross: number; expenses: number; potentialGross: number; extraRequests: number;
  missedByStage: Record<LossStage, number>; partial: boolean
}
export type EventReport = EventStatistics & { id: string; kind: IncidentKind; title: string; endedAt: number; dominantStage: LossStage | null; outcome?:'contained'|'survived' }
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
  encounter?:{revision:1;early:boolean;finalStreak:number}
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

export type Hardware = {
  cpuCores:number; cpuGHz:number; instructionsPerCycle:number; ramGiB:number; reservedRamGiB:number;
  storageGiB:number; storageUsedGiB:number; storageIOPS:number; storageMiBs:number; networkMbps:number;
  gpuCount:number; gpuVRAMGiB:number; serverCount:number; cloudInstances:number; cloudInstanceCores:number; cloudInstanceRamGiB:number; storageGroupCount:number;networkLinkCount:number;unitStorageGiB:number;unitStorageIOPS:number;unitStorageMiBs:number;unitNetworkMbps:number
}

export type FleetPool = 'servers'|'storage'|'network'|'cloud'|'ai'
export type ResourceId = 'cpu'|'memory'|'space'|'iops'|'transfer'|'network'|'cloud'|'cloud-memory'|'ai'
export type ResourceState = 'healthy'|'strained'|'headroom'|'limiting'|'starting'|'stopped'|'unavailable'
export type ResourceReading = {
  id:ResourceId; name:string; component:string; scope:'owned fleet'|'rented pool'|'shared service';
  unit:string; offered:number; used:number; capacity:number; rejected:number; pressure:number;
  availability:'online'|'starting'|'stopped'|'unavailable'; estimated:true; reserved?:number; admitted?:number;
}
export type Metrics = {
  resources:ResourceReading[]
  admittedStandard:number;admittedAI:number;eligibleCloudWork:number;workloadMix:{cpuHeavy:number;dataHeavy:number;ai:number};activeServers:number;standbyServers:number;standardPrice:number;aiPrice:number

  hardware: Hardware
  routes: {arrived:number;cache:number;origin:number;ai:number;rejected:number;pending:number}
  writeRateGiB:number
  cloudUsed:number
  missedRevenue:Record<LossStage,number>

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
  returnPaused?: boolean
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
  version: 7
  balance?: BalanceConfig | null
  legacyTerms?: {servers:number;cloud:number;ai:number;checkpointEnd:number}
  uiRevision?: 2
  workloadOffset:number;companyLevel:number;levelProgress:number;levelQuota:number;fleet:{servers:number;storageGroups:number;networkLinks:number};budgetGuard:{enabled:boolean;lossSeconds:number;status:'healthy'|'warning'|'recovering'};claimedAchievementIDs:string[];claimedCheckpointLevel:number;eventCheckpoint:number;eventQuietSeconds:number;activeSeconds:number;aiLaunchLevel:number|null
  revenue: { gross: number; expenses: number; grants: number; purchases:number; rewards:number; opening:number }
  storageUsedGiB:number
  rentalsEnabled:boolean
  provisioning:{target:number;gpuTarget:number;remaining:number}
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

export type BalanceConfig={hardware:2|4;fleet:8|16|32;coefficient:.1|.2|.3;maintenance:.05|.1;rentalLimits?:true}
