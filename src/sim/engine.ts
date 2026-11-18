import { getHardware, WORKLOAD, STANDARD_PRICE, AI_PRICE, MAX_LEVELS, levelDemand,quotaForLevel,workloadMix } from './hardware'
export {getHardware,hardwareSummary,getHardwareExplanation,getMilestone,STANDARD_PRICE,AI_PRICE} from './hardware'
import { UPGRADES, upgradeById } from './upgrades'
import type { AchievementDefinition, AdvisorRecommendation, Announcement, EquipmentDefinition, EquipmentId, GameState, Incident, IncidentKind, Metrics, PolicyState, UpgradeId,FleetPool } from './types'
import { emptyEventStats, integrateEvent, EVENT_STORIES, STAGES, TECHNOLOGY_TIPS } from './feedback'

export const EQUIPMENT: EquipmentDefinition[] = [
  {id:'cpu',name:'CPU Module',baseCost:80,increase:3},
  {id:'memory',name:'Memory',baseCost:220,increase:4},
  {id:'ssd',name:'Storage (SSD)',baseCost:400,increase:7},
  {id:'network',name:'Network Uplink',baseCost:180,increase:4},
  {id:'cloud',name:'Cloud Capacity',baseCost:800,increase:6,unlock:'cloud'},
  {id:'ai',name:'AI Compute',baseCost:1200,increase:4,unlock:'ai'},
]
const equipmentById = Object.fromEntries(EQUIPMENT.map(item => [item.id,item])) as Record<EquipmentId,EquipmentDefinition>
const basicEquipment = ['cpu','memory','ssd','network'] as const
export const ACHIEVEMENTS: AchievementDefinition[] = [
  {id:'first-equipment',name:'First Upgrade',description:'Purchase your first equipment level.',reward:100},
  {id:'requests-100',name:'Hello, Customers',description:'Serve 100 customer requests.',reward:100},
  {id:'equipment-5',name:'Rack Builder',description:'Install five equipment levels.',reward:250},
  {id:'stable-30',name:'Reliable Operator',description:'Serve at least 98% of demand for 30 continuous minutes.',reward:300},
  {id:'virtualization',name:'Virtual Pioneer',description:'Install Virtualization.',reward:400},
  {id:'second-server',name:'Horizontal Scale',description:'Bring a second server online.',reward:600},
  {id:'first-recovery',name:'Recovery Operator',description:'Recover from your first incident.',reward:500},
  {id:'cloud',name:'Above the Clouds',description:'Migrate to cloud compute.',reward:1000},
  {id:'ai-100',name:'Intelligent Service',description:'Serve 100 AI requests.',reward:1500},
  {id:'launch',name:'Launch Champion',description:'Pass Launch Day.',reward:5000},
]

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

const announce = (s: GameState, kind: Announcement['kind'], title: string, body: string, details:Partial<Announcement> = {}) => {
  if (training(s)) return
  const id = `${kind}-${++s.announcementSequence}`
  s.announcements.push({id,kind,title,body,actionLabel:'Continue',...details}); s.announcements=s.announcements.slice(-20)
}
export const getNextAnnouncement = (s: GameState): Announcement | undefined => {
  if (training(s)) return undefined
  const pending = s.announcements.filter(a => a.kind !== 'achievement' && !s.acknowledgedAnnouncements.includes(a.id))
  return pending.find(a => a.kind === 'incident') ?? pending[0]
}
export const acknowledgeAnnouncement = (state: GameState, id: string) => {
  if (!state.announcements.some(a => a.id === id) || state.acknowledgedAnnouncements.includes(id)) return state
  const s = structuredClone(state)
  s.acknowledgedAnnouncements = []
  s.announcements = s.announcements.filter(a => a.id !== id)
  return s
}
const achieved = (s: GameState): string[] => {
  const levels = Object.values(s.equipmentLevels).reduce((a,b) => a+b,0)
  return [levels >= 1 ? 'first-equipment' : '',s.totalServed >= 100 ? 'requests-100' : '',levels >= 5 ? 'equipment-5' : '',s.stableServiceMinutes >= 30 ? 'stable-30' : '',owned(s,'virtualization') ? 'virtualization' : '',owned(s,'server2') ? 'second-server' : '',s.incidentsRecovered >= 1 ? 'first-recovery' : '',owned(s,'cloud') ? 'cloud' : '',s.aiServed >= 100 ? 'ai-100' : '',s.completed ? 'launch' : ''].filter(Boolean)
}
const awardAchievements = (s: GameState) => {
  if (training(s)&&s.tutorial.replay) return
  for (const id of achieved(s)) {
    if (s.achievementIDs.includes(id)) continue
    const achievement = ACHIEVEMENTS.find(a => a.id === id)!
    s.achievementIDs.push(id)
    addLog(s, `${achievement.name} complete. Claim $${achievement.reward} from the trophy.`, 'good')
  }
}
export const getClaimableRewards=(s:GameState)=>{
 if(s.tutorial.status==='active'&&s.tutorial.replay&&s.tutorial.step===9)return {count:1,amount:100}
 const unclaimed=ACHIEVEMENTS.filter(a=>s.achievementIDs.includes(a.id)&&!s.claimedAchievementIDs.includes(a.id))
 const end=Math.floor((s.companyLevel-1)/5),start=Math.floor(s.claimedCheckpointLevel/5),checkpoints=Math.max(0,end-start)
 return {count:unclaimed.length+checkpoints,amount:unclaimed.reduce((sum,a)=>sum+a.reward,0)+checkpoints*100+50*(end*(end+1)-start*(start+1))/2}
}
export const claimRewards=(state:GameState):GameState=>{
 if(state.tutorial.status==='active'&&state.tutorial.replay){if(state.tutorial.step!==9)return state;const s=structuredClone(state);moveTutorial(s,10);s.metrics=calculateMetrics(s);return s}
 const s=structuredClone(state);awardAchievements(s);const claim=getClaimableRewards(s)
 if(!claim.count)return state
 s.cash+=claim.amount;s.revenue.rewards+=claim.amount;s.claimedAchievementIDs=[...s.achievementIDs];s.claimedCheckpointLevel=Math.floor((s.companyLevel-1)/5)*5
 addLog(s,`${claim.count} reward${claim.count===1?'':'s'} claimed: +$${claim.amount.toFixed(0)}.`,'good')
 if(s.tutorial.status==='active'&&s.tutorial.step===9)moveTutorial(s,10)
 s.metrics=calculateMetrics(s);return s
}
export const setBudgetGuard=(state:GameState,enabled:boolean)=>{if(state.budgetGuard.enabled===enabled)return state;const s=structuredClone(state);s.budgetGuard={enabled,lossSeconds:0,status:'healthy'};s.metrics=calculateMetrics(s);return s}
export const getExpansionQuote=(s:GameState,pool:FleetPool,quantity:1|'max'=1)=>{
 const definition={servers:{base:1000,count:s.fleet.servers,unlock:'load_balancer'},storage:{base:600,count:s.fleet.storageGroups,unlock:''},network:{base:300,count:s.fleet.networkLinks,unlock:''},cloud:{base:800,count:1+s.equipmentLevels.cloud,unlock:'cloud'},ai:{base:1200,count:1+s.equipmentLevels.ai,unlock:'ai'}}[pool]
 if(!definition)return {count:0,cost:0,nextCost:0,available:false,reason:'Unknown fleet pool'}
 const price=(count:number)=>Math.ceil(definition.base*(count*(1+.02*Math.max(0,definition.count-1))+.01*count*(count-1)))
 const nextCost=price(1)
 if(training(s))return {count:0,cost:nextCost,nextCost,available:false,reason:'Finish the tutorial before expanding.'}
 if(definition.unlock&&!owned(s,definition.unlock as UpgradeId))return {count:0,cost:nextCost,nextCost,available:false,reason:`Unlock ${upgradeById[definition.unlock].name} first.`}
 let count=1
 if(quantity==='max'){let low=0,high=1;while(price(high)<=s.cash&&high<1e9)high*=2;while(low+1<high){const mid=Math.floor((low+high)/2);if(price(mid)<=s.cash)low=mid;else high=mid}count=low}
 const cost=price(count),available=count>0&&Number.isSafeInteger(definition.count+count)&&Number.isFinite(cost)&&cost<=s.cash
 return {count,cost:count?cost:nextCost,nextCost,available,reason:available?'Ready':`Need $${Math.max(0,Math.ceil(nextCost-s.cash)).toLocaleString()} more`}
}
export const expandFleet=(state:GameState,pool:FleetPool,quantity:1|'max'=1)=>{
 const quote=getExpansionQuote(state,pool,quantity);if(!quote.available)return state
 const s=structuredClone(state),id=pool==='servers'?'server2':pool==='storage'?'ssd':pool==='network'?'network':pool
 const before=pool==='servers'?s.fleet.servers:pool==='storage'?s.fleet.storageGroups:pool==='network'?s.fleet.networkLinks:1+s.equipmentLevels[pool]
 s.cash-=quote.cost;s.revenue.purchases+=quote.cost
 if(pool==='servers')s.fleet.servers+=quote.count
 else if(pool==='storage')s.fleet.storageGroups+=quote.count
 else if(pool==='network')s.fleet.networkLinks+=quote.count
 else{s.equipmentLevels[pool]+=quote.count;if(s.rentalsEnabled)s.provisioning={target:Math.max(s.cloudProvisioned,s.provisioning.target)+(pool==='cloud'?quote.count:0),gpuTarget:Math.max(s.aiProvisioned,s.provisioning.gpuTarget)+(pool==='ai'?quote.count:0),remaining:2}}
 addLog(s,`Expanded ${pool} pool by ${quote.count}.`,'good');awardAchievements(s);s.metrics=calculateMetrics(s)
 s.lastPurchase={id,at:s.elapsed,before:calculateMetrics(state),after:s.metrics,beforeLevel:before,afterLevel:before+quote.count,quantity:quote.count,cost:quote.cost,expansionPool:pool}
 return s
}

const equipmentPrice = (id: EquipmentId, level: number) => {
  let price = equipmentById[id].baseCost
  for (let i=0;i<level && Number.isFinite(price);i++) price = Math.ceil(price * 1.35)
  return price
}
export const getEquipmentQuote = (s: GameState, id: EquipmentId, quantity: 1 | 'max' = 1) => {
  const item = equipmentById[id]
  if (!item) return {count:0,cost:0,increase:0,nextCost:0,available:false,reason:'Unknown equipment'}
  const nextCost = equipmentPrice(id,Math.min(s.equipmentLevels[id],MAX_LEVELS[id]))
  if(s.tutorial.status==='active' && s.tutorial.replay){
    const available=s.tutorial.phase==='action'&&getTutorialLesson(s).requiredUpgrade===id
    return {count:available?1:0,cost:0,increase:available?item.increase:0,nextCost:0,available,reason:available?'Training upgrade — no charge':'Follow the highlighted tutorial action.'}
  }
  if(s.equipmentLevels[id]>=MAX_LEVELS[id])return {count:0,cost:nextCost,increase:0,nextCost,available:false,reason:'Maximum hardware tier reached; expand the service instead.'}
  const locked = item.unlock && !owned(s,item.unlock) ? `Unlock ${upgradeById[item.unlock].name} first.` : ''
  const guided = training(s) && (s.tutorial.phase !== 'action' || getTutorialLesson(s).requiredUpgrade !== id || s.equipmentLevels[id] > 0) ? 'Follow the highlighted tutorial action, or skip to Open Lab.' : ''
  if (locked || guided) return {count:0,cost:nextCost,increase:0,nextCost,available:false,reason:locked || guided}
  let count = quantity === 1 ? 1 : 0, cost = quantity === 1 ? nextCost : 0, price = nextCost
  if (quantity === 'max') while (s.equipmentLevels[id]+count<MAX_LEVELS[id] && Number.isFinite(price) && cost + price <= s.cash) { cost += price; count++; price = Math.ceil(price * 1.35) }
  const available = count > 0 && Number.isFinite(cost) && cost <= s.cash
  return {count,cost,increase:count*item.increase,nextCost:quantity === 'max' ? price : Math.ceil(nextCost*1.35),available,reason:available ? 'Ready' : `Need $${Math.max(0,Math.ceil(nextCost-s.cash)).toLocaleString()} more`}
}
export const purchaseEquipment = (state: GameState, id: EquipmentId, quantity: 1 | 'max' = 1) => {
  const quote = getEquipmentQuote(state,id,quantity)
  if (!quote.available) return state
  const s = structuredClone(state)
  if(s.tutorial.status==='active'&&s.tutorial.replay){
    moveTutorial(s,s.tutorial.step+1)
    s.metrics=calculateMetrics(s)
    s.lastPurchase={id,at:s.elapsed,before:calculateMetrics(state),after:s.metrics,beforeLevel:0,afterLevel:1,quantity:1,cost:0}
    return s
  }
  s.cash -= quote.cost; s.revenue.purchases += quote.cost; s.equipmentLevels[id] += quote.count
  if (id !== 'network' && !owned(s,id)) { s.upgrades.push(id); s.upgradeTimes[id] = s.elapsed }
  if ((id === 'cloud' || id === 'ai') && s.rentalsEnabled) {
    s.provisioning={target:Math.max(s.cloudProvisioned,s.provisioning.target)+(id==='cloud'?quote.count:0),gpuTarget:Math.max(s.aiProvisioned,s.provisioning.gpuTarget)+(id==='ai'?quote.count:0),remaining:2}
  }
  addLog(s,`${equipmentById[id].name}: ${quote.count} upgrade${quote.count===1?'':'s'} installed${id==='cloud'||id==='ai'?'; rental capacity starts in 2 minutes':''}.`, 'good')
  if (training(s)) {moveTutorial(s,s.tutorial.step+1);awardAchievements(s)}
  else awardAchievements(s)
  s.metrics = calculateMetrics(s)
  s.lastPurchase = {id,at:s.elapsed,before:calculateMetrics(state),after:s.metrics,beforeLevel:state.equipmentLevels[id],afterLevel:s.equipmentLevels[id],quantity:quote.count,cost:quote.cost}
  return s
}

export const previewEquipmentImpact = (state:GameState,id:EquipmentId,count=1) => {
  if(state.tutorial.status==='active'&&state.tutorial.replay){
    const before=calculateMetrics(state)
    if(getTutorialLesson(state).requiredUpgrade!==id)return {id,at:state.elapsed,before,after:before}
    const next=structuredClone(state);moveTutorial(next,next.tutorial.step+1)
    return {id,at:state.elapsed,before,after:calculateMetrics(next)}
  }
  const s={...state,equipmentLevels:{...state.equipmentLevels,[id]:Math.min(MAX_LEVELS[id],state.equipmentLevels[id]+count)},upgrades:[...state.upgrades]}
  if(id!=='network'&&!owned(s,id))s.upgrades.push(id)
  if(id==='cloud'&&s.rentalsEnabled)s.cloudProvisioned=Math.max(s.cloudProvisioned,s.provisioning.target)+Math.min(count,MAX_LEVELS[id]-state.equipmentLevels[id])
  if(id==='ai'&&s.rentalsEnabled)s.aiProvisioned=Math.max(s.aiProvisioned,s.provisioning.gpuTarget)+Math.min(count,MAX_LEVELS[id]-state.equipmentLevels[id])
  return {id,at:state.elapsed,before:calculateMetrics(state),after:calculateMetrics(s)}
}

export const createInitialState = (): GameState => {
  const state: GameState = {
    version: 6, uiRevision:2, workloadOffset:0,companyLevel:1,levelProgress:0,levelQuota:quotaForLevel(1),fleet:{servers:1,storageGroups:1,networkLinks:1},budgetGuard:{enabled:true,lossSeconds:0,status:'healthy'},claimedAchievementIDs:[],claimedCheckpointLevel:0,eventCheckpoint:0,eventQuietSeconds:0,activeSeconds:0,aiLaunchLevel:null, storageUsedGiB:32,rentalsEnabled:true,provisioning:{target:0,gpuTarget:0,remaining:0}, revenue:{opening:25,gross:0,expenses:0,grants:0,rewards:0,purchases:0},lastPurchase:null,eventReports:[], cash: 25, reputation: 60, elapsed: 0, totalServed: 0, paused: true, speed: 1,
    equipmentLevels: {cpu:0,memory:0,ssd:0,network:0,cloud:0,ai:0}, aiServed:0,stableServiceMinutes:0,incidentsRecovered:0,achievementIDs:[],announcements:[],acknowledgedAnnouncements:[],announcementSequence:0,
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

const demandFor=(s:GameState)=>{
 if(training(s))return s.tutorial.step<=1?25:s.tutorial.step<=3?55:60
 let demand=levelDemand(s.companyLevel)
 if(s.incident?.kind==='marketing')demand*=s.companyLevel<10?1.3:1.5
 if(s.challenge.active)demand*=2
 return demand
}

export const getEffectiveUpgrades = (s: GameState): UpgradeId[] => {
  if (!training(s) || !s.tutorial.replay) return s.upgrades
  return (['cpu', 'memory', 'ssd'] as const).filter((_, index) => {
    const lesson = [3,6,7][index]
    return s.tutorial.step > lesson || (s.tutorial.step === lesson && (s.tutorial.phase === 'demo' || s.tutorial.demonstrated))
  })
}

export const calculateMetrics=(state:GameState,trafficMultiplier=1):Metrics=>{
 const effective=getEffectiveUpgrades(state),s=training(state)&&state.tutorial.replay?{...state,upgrades:effective,equipmentLevels:{cpu:effective.includes('cpu')?1:0,memory:effective.includes('memory')?1:0,ssd:effective.includes('ssd')?1:0,network:0,cloud:0,ai:0},fleet:{servers:1,storageGroups:1,networkLinks:1},storageUsedGiB:32,incident:null}:state
 const h=getHardware(s),w=WORKLOAD,mix=training(s)?{cpuHeavy:0,dataHeavy:0,ai:0}:workloadMix(s)
 if(training(s))h.networkMbps=1000
 const demand=demandFor(s)*Math.max(.5,Math.min(2,trafficMultiplier)),aiShare=owned(s,'ai')?(s.challenge.active?Math.max(.35,mix.ai):mix.ai):0,aiDemand=demand*aiShare,standardDemand=demand-aiDemand
 const stdCPU=1+mix.cpuHeavy+mix.dataHeavy*.1,stdMemory=1+(mix.cpuHeavy+mix.dataHeavy)*.25,stdOps=w.operations*(1+mix.dataHeavy*3),stdIo=w.ioMiB*(1+mix.dataHeavy*3),stdNet=1+mix.dataHeavy
 const standardPrice=STANDARD_PRICE*(1+mix.cpuHeavy+mix.dataHeavy*.6),aiPrice=AI_PRICE
 let network=h.networkMbps*1e6/(w.networkKiB*1024*8)
 if(s.incident?.kind==='bot')network*=1-.35*(1-(owned(s,'security')?(s.policies.firewall==='strict'?.9:.7):0))
 let standard=standardDemand,ai=aiDemand,standardWrites=standard*w.writeFraction,aiWrites=ai*w.writeFraction
 const losses={network:0,compute:0,memory:0,storage:0,ai:0},missedRevenue={network:0,compute:0,memory:0,storage:0,ai:0}
 const restrict=(stage:keyof typeof losses,ratio:number)=>{const r=clamp(ratio,0,1),a=standard*(1-r),b=ai*(1-r);losses[stage]+=a+b;missedRevenue[stage]+=(a*standardPrice+b*aiPrice)*60;standard*=r;ai*=r;standardWrites*=r;aiWrites*=r}
 const networkLoad=standard*stdNet+ai*2
 restrict('network',network/Math.max(.000001,networkLoad))
 const admittedStandard=standard,admittedAI=ai
 const cacheHits=owned(s,'cache')?standard*(1-w.writeFraction)*.35*(1-mix.cpuHeavy*.75-mix.dataHeavy*.5):0
 standard-=cacheHits
 if(h.storageUsedGiB>=h.storageGiB-.000000001){losses.storage+=standardWrites+aiWrites;missedRevenue.storage+=(standardWrites*standardPrice+aiWrites*aiPrice)*60;standard-=standardWrites;ai-=aiWrites;standardWrites=0;aiWrites=0}
 const ioRatio=Math.min(1,h.storageIOPS/Math.max(.000001,standard*stdOps+ai*w.aiOperations),h.storageMiBs/Math.max(.000001,standard*stdIo+ai*w.aiIoMiB))
 const eligibleCloudWork=(standard*stdCPU+ai*2)*ioRatio
 const overhead=owned(s,'virtualization')?.95:1,strict=owned(s,'security')&&s.policies.firewall==='strict'?.92:1
 const cpuPerServer=h.cpuCores*h.cpuGHz*1e9/w.instructions*overhead*strict,memoryPerServer=Math.floor(Math.max(0,h.ramGiB-h.reservedRamGiB-(owned(s,'virtualization')?.25:0))*1024/w.memoryMiB)/w.residenceSeconds
 let availableServers=owned(s,'load_balancer')?h.serverCount:1
 if(s.incident?.kind==='hardware')availableServers=Math.max(0,availableServers-Math.max(1,Math.ceil(availableServers*.25)))
 else if(owned(s,'load_balancer')&&s.policies.loadBalancer==='redundancy')availableServers=Math.max(1,availableServers-1)
 const activeServers=s.budgetGuard.enabled?Math.min(availableServers,Math.max(1,Math.ceil(Math.max(eligibleCloudWork,(standard*stdMemory+ai*2)*ioRatio)/Math.max(.001,Math.min(cpuPerServer,memoryPerServer))))):availableServers
 const localCompute=activeServers*cpuPerServer,localMemory=activeServers*memoryPerServer
 const cloud=h.cloudInstances*h.cloudInstanceCores*2.8e9/w.instructions*.95,compute=localCompute+cloud,memory=localMemory+h.cloudInstances*Math.floor((h.cloudInstanceRamGiB-1)*1024/w.memoryMiB)/w.residenceSeconds
 const storage=Math.min(h.storageIOPS/w.operations,h.storageMiBs/w.ioMiB),aiCapacity=h.gpuCount*(h.gpuVRAMGiB>=w.modelVRAMGiB?1/w.gpuSeconds:0)
 const cpuLoad=standard*stdCPU+ai*2;restrict('compute',compute/Math.max(.000001,cpuLoad))
 const memoryLoad=standard*stdMemory+ai*2;restrict('memory',memory/Math.max(.000001,memoryLoad))
 const appProcessed=standard*stdCPU+ai*2,ioLoad=standard*stdOps/w.operations+ai*w.aiOperations/w.operations
 restrict('storage',Math.min(h.storageIOPS/Math.max(.000001,standard*stdOps+ai*w.aiOperations),h.storageMiBs/Math.max(.000001,standard*stdIo+ai*w.aiIoMiB)))
 const gpuLost=Math.max(0,ai-aiCapacity),aiRatio=ai>0?(ai-gpuLost)/ai:0;losses.ai+=gpuLost;missedRevenue.ai+=gpuLost*aiPrice*60;ai-=gpuLost;aiWrites*=aiRatio
 const served=cacheHits+standard+ai,dropped=Math.max(0,demand-served),successRate=served/Math.max(.001,demand),onPrem=Math.min(localCompute,localMemory),cloudUsed=Math.max(0,appProcessed-Math.min(appProcessed,onPrem))
 const gross=((cacheHits+standard)*standardPrice+ai*aiPrice)*60,billFactor=s.incident?.kind==='billing'?1.5:1
 const expenses=.8+Math.max(0,activeServers-1)*1.5+(owned(s,'backup')?.3:0)+(owned(s,'security')?.4:0)+(owned(s,'cache')?.4:0)+(h.cloudInstances*.65+h.gpuCount*1.2+cloudUsed*60*.0001)*billFactor
 const utilizations={network:clamp(networkLoad/Math.max(.001,network),0,1),compute:clamp(cpuLoad/Math.max(.001,compute),0,1),memory:clamp(memoryLoad/Math.max(.001,memory),0,1),storage:clamp(ioLoad/Math.max(.001,storage),0,1),ai:aiCapacity?clamp(admittedAI/aiCapacity,0,1):0}
 const dominant=STAGES.reduce((best,k)=>losses[k]>losses[best]?k:best,STAGES[0]),bottleneck=successRate>=.98?'healthy':dominant
 const writeRateGiB=h.storageUsedGiB>=h.storageGiB?0:(standardWrites+aiWrites)*w.writeKiB/(1024*1024)
 return {hardware:h,routes:{arrived:demand,cache:cacheHits,origin:standard,ai,rejected:dropped,pending:0},writeRateGiB,cloudUsed,missedRevenue,demand,standardDemand,aiDemand,aiServed:ai,losses,served,dropped,successRate,network,compute,memory,storage,onPrem,cloud,aiCapacity,cacheHits,latency:w.residenceSeconds*1000+250*Math.max(...Object.values(utilizations))**3,gross,expenses,net:gross-expenses,utilizations,bottleneck,admittedStandard,admittedAI,eligibleCloudWork,workloadMix:mix,activeServers,standbyServers:Math.max(0,h.serverCount-activeServers),standardPrice,aiPrice}
}

export type TutorialAction='inspect-server'|'select-cpu'|'open-dashboard'|'inspect-bottleneck'|'open-trophy'|'claim-rewards'|'open-hint'
const lessonDefinitions=[
 {title:'Your first lab',body:'Inspect, upgrade, and watch your service improve.',target:'server'},
 {title:'Open your server',body:'Click the server to look inside.',target:'server',expectedAction:'inspect-server' as TutorialAction},
 {title:'Find the CPU',body:'Click the CPU. It processes customer requests.',target:'cpu',expectedAction:'select-cpu' as TutorialAction},
 {title:'Give the CPU a boost',body:'The CPU cannot keep up. Buy the highlighted upgrade.',target:'cpu',requiredUpgrade:'cpu' as UpgradeId},
 {title:'Check the live monitor',body:'Open Performance & Operations to see what needs attention.',target:'dashboard',expectedAction:'open-dashboard' as TutorialAction},
 {title:'Find the next bottleneck',body:'Memory cannot keep up. Choose Inspect upgrade on the Performance dashboard.',target:'dashboard',expectedAction:'inspect-bottleneck' as TutorialAction},
 {title:'Add working memory',body:'Memory keeps active work ready. Upgrade it next.',target:'memory',requiredUpgrade:'memory' as UpgradeId},
 {title:'Upgrade Storage (SSD)',body:'Storage supplies customer data. A faster drive removes this limit.',target:'ssd',requiredUpgrade:'ssd' as UpgradeId},
 {title:'A reward is ready',body:'Click the trophy to see the checkpoints you completed.',target:'trophy',expectedAction:'open-trophy' as TutorialAction},
 {title:'Claim your reward',body:'Claim rewards. These bonuses are separate from customer profit.',target:'trophy',expectedAction:'claim-rewards' as TutorialAction},
 {title:'Your lab is ready',body:'Watch performance, upgrade the bottleneck, and serve reliable work to advance levels.',target:'dashboard'},
]
export const getTutorialLesson=(s:GameState)=>({...lessonDefinitions[s.tutorial.step]??lessonDefinitions[0],actionLabel:s.tutorial.step===10?'Run my lab':'Continue tutorial',nextLabel:s.tutorial.step===10?'Run my lab':'Continue tutorial',progress:s.tutorial.step+1})
const syncTutorial=(s:GameState)=>{s.tutorialStep=s.tutorial.step;s.tutorialComplete=s.tutorial.status==='complete'||s.tutorial.status==='skipped'}
const moveTutorial=(s:GameState,step:number)=>{s.tutorial.step=Math.min(10,step);s.tutorial.phase=[1,2,4,5,8,9].includes(step)?'action':'explain';s.tutorial.demoRemaining=0;s.tutorial.demonstrated=false;s.paused=s.tutorial.phase==='explain';syncTutorial(s)}
export const startTutorial=(state:GameState)=>{const s=structuredClone(state);s.tutorial={status:'active',step:1,phase:'action',demoRemaining:0,replay:false,demonstrated:false,returnPaused:state.tutorial.status==='welcome'?false:state.paused};s.paused=false;syncTutorial(s);s.metrics=calculateMetrics(s);return s}
export const replayTutorial=(state:GameState)=>{const s=startTutorial(state);s.tutorial.replay=true;s.tutorial.returnPaused=state.paused;s.metrics=calculateMetrics(s);return s}
export const skipTutorial=(state:GameState)=>{const s=structuredClone(state),replay=s.tutorial.replay;s.tutorial.status='skipped';s.tutorial.phase='explain';s.tutorial.demoRemaining=0;s.paused=s.tutorial.returnPaused??false;syncTutorial(s);s.metrics=calculateMetrics(s);addLog(s,'Open Lab online. Watch performance and upgrade the bottleneck.','good');if(!replay)awardAchievements(s);return s}
export const tutorialAction=(state:GameState,action:TutorialAction)=>{const t=state.tutorial;if(t.status!=='active'||t.phase!=='action'||getTutorialLesson(state).expectedAction!==action)return state;if(action==='claim-rewards'&&!t.replay&&getClaimableRewards(state).count>0)return state;const s=structuredClone(state);moveTutorial(s,t.step+1);s.metrics=calculateMetrics(s);return s}
export const advanceTutorial=(state:GameState)=>{
 if(state.tutorial.status!=='active'||state.tutorial.phase!=='explain')return state
 const s=structuredClone(state),t=s.tutorial
 if(t.step===10){t.status='complete';s.paused=t.returnPaused??false;addLog(s,'Orientation complete. Build your fleet.','good');if(!t.replay)awardAchievements(s)}
 else{const upgrade=lessonDefinitions[t.step].requiredUpgrade;if(!upgrade)return state;if(!t.replay&&owned(s,upgrade))moveTutorial(s,t.step+1);else{t.phase='action';s.paused=false;const grant=t.replay?0:Math.max(0,getEquipmentQuote(s,upgrade as EquipmentId).cost-s.cash);if(grant){s.cash+=grant;s.revenue.grants+=grant;addLog(s,`Training credits: +$${Math.ceil(grant)} for ${upgradeById[upgrade].name}.`,'good')}}}
 syncTutorial(s);s.metrics=calculateMetrics(s);return s
}
export const inspectDiagnostics=(s:GameState)=>advanceTutorial(s)

export const canPurchase = (s: GameState, id: UpgradeId) => {
  if (id === 'cpu' || id === 'memory' || id === 'ssd') {
    const quote = getEquipmentQuote(s,id as EquipmentId,1)
    return {ok:quote.available,reason:quote.reason}
  }
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
  const duration=kind==='hardware'?(owned(s,'backup')?60:90):kind==='bot'&&owned(s,'security')?60:75
  const details = {
    marketing: ['Marketing traffic spike', 'A promotion is sending more visitors than forecast. More capacity and caching can help.'],
    hardware: ['Server hardware fault', 'One machine is degraded. Backup recovery shortens the outage; redundancy reduces the capacity loss.'],
    bot: ['Automated bot attack', 'Suspicious traffic is consuming gateway capacity. Firewall protection reduces the impact and duration.'],
    billing: ['Cloud bill shock', 'Cloud capacity and usage temporarily cost 50% more. Economy autoscaling carries less spare capacity.'],
  }
  return { kind, title: details[kind][0], detail: details[kind][1], remaining: duration, total: duration, stats:emptyEventStats() }
}

const announceIncident = (s:GameState) => {
  if(!s.incident)return
  const story=EVENT_STORIES[s.incident.kind]
  announce(s,'incident',story.title,`${story.body} Event time: ${Math.ceil(s.incident.remaining)} seconds.`,{illustration:s.incident.kind,tip:story.tip})
}

const queueIncident = (s: GameState, kind: IncidentKind) => {
  if (!s.triggered.includes(kind) && !s.incidentQueue.includes(kind)) s.incidentQueue.push(kind)
}
export const triggerIncident = (state: GameState, kind: IncidentKind) => {
  const s = structuredClone(state)
  if (s.incident || training(s)) return state
  else { s.incident = makeIncident(kind, s); if (!s.triggered.includes(kind)) s.triggered.push(kind); addLog(s, s.incident.title, 'warn'); announceIncident(s) }
  return s
}

export const purchaseUpgrade = (state: GameState, id: UpgradeId) => {
  if (id === 'cpu' || id === 'memory' || id === 'ssd') return purchaseEquipment(state,id,1)
  if (!canPurchase(state, id).ok) return state
  const s = structuredClone(state), item = upgradeById[id]
  s.cash -= item.cost; s.revenue.purchases += item.cost; s.upgrades.push(id); s.upgradeTimes[id] = s.elapsed
  if(id==='server2')s.fleet.servers=Math.max(2,s.fleet.servers)
  if(id==='ai')s.aiLaunchLevel=s.companyLevel
  if ((id === 'cloud' || id === 'ai') && s.rentalsEnabled) s.provisioning={target:owned(s,'cloud')?Math.max(1,s.cloudProvisioned,s.provisioning.target):0,gpuTarget:owned(s,'ai')?Math.max(1,s.aiProvisioned,s.provisioning.gpuTarget):0,remaining:2}
  addLog(s, `${item.name} installed. ${item.effect}`, 'good')
  if (training(s)) { s.tutorial.phase = 'demo'; s.tutorial.demoRemaining = 4; s.paused = false }

  s.metrics = calculateMetrics(s)
  s.lastPurchase = {id,at:s.elapsed,before:calculateMetrics(state),after:s.metrics,beforeLevel:0,afterLevel:1,quantity:1,cost:item.cost}
  announce(s,'technology',`Acquired: ${item.name}`,item.short,{illustration:id,impact:s.lastPurchase,tip:TECHNOLOGY_TIPS[id]})
  awardAchievements(s)
  return s
}

const dependencyFor = (s: GameState, goal: UpgradeId): UpgradeId | undefined => {
  if (owned(s, goal)) return undefined
  const missing = upgradeById[goal].prerequisites.find((id) => !owned(s, id))
  return missing ? dependencyFor(s, missing) : goal
}

export const getRecommendation = (s: GameState): AdvisorRecommendation => {
  const m = calculateMetrics(s)
  const capacityGoal: Record<string, EquipmentId> = {network:'network',compute:'cpu',memory:'memory',storage:'ssd',ai:'ai'}
  if (m.bottleneck !== 'healthy') {
    const goal=capacityGoal[m.bottleneck],capped=s.equipmentLevels[goal]>=MAX_LEVELS[goal],upgradeId=goal==='ai'&&!owned(s,'ai')?dependencyFor(s,'ai'):capped&&(goal==='cpu'||goal==='memory')&&!owned(s,'load_balancer')?dependencyFor(s,'load_balancer'):goal
    const name = m.bottleneck === 'compute' ? 'CPU processing' : m.bottleneck === 'ai' ? 'AI inference' : m.bottleneck
    const expansion=goal==='cpu'||goal==='memory'?'servers':goal==='ssd'?'storage groups':goal==='network'?'network links':'GPU workers'
    const reason=upgradeId!==goal?`Your ${name} cannot keep up. Install ${upgradeById[upgradeId!].name} to enable more capacity.`:capped?`Your ${name} cannot keep up. Add more ${expansion} from this component's expansion controls.`:`Your ${name} cannot keep up. Consider a ${equipmentById[goal].name} upgrade.`
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

export const getPurchaseAdvice = (s: GameState, id: UpgradeId | EquipmentId): string | null => {
  if (training(s)) return null
  const recommendation = getRecommendation(s)
  if (recommendation.priority !== 'capacity' || recommendation.upgradeId === id) return null
  if (id === 'backup' || id === 'security') return `${recommendation.reason} ${upgradeById[id].name} is still a valid reliability investment, but it will not increase normal request throughput.`
  const name = id === 'network' ? equipmentById.network.name : upgradeById[id].name
  return `${recommendation.reason} ${name} may add another capability, but it does not address the current priority. You can still buy it if that is your plan.`
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
  addLog(s, 'Launch Day started: 90 minutes of peak traffic.', 'warn')
  return s
}
export const setSpeed = (s: GameState, speed: 1 | 2 | 4) => [1, 2, 4].includes(speed) ? { ...s, speed } : s
export const togglePause = (s: GameState) => training(s) ? s : { ...s, paused: !s.paused }

const checkpointEvent=(s:GameState)=>{
 if(s.companyLevel%5!==0||s.companyLevel<=s.eventCheckpoint)return
 s.eventCheckpoint=s.companyLevel
 if(s.incident||s.challenge.active||s.eventQuietSeconds>0)return
 const available:IncidentKind[]=['marketing']
 if(s.companyLevel>5){if(s.fleet.servers>=2)available.push('hardware');if(owned(s,'load_balancer'))available.push('bot');if(owned(s,'cloud')&&(s.cloudProvisioned+s.aiProvisioned)>0)available.push('billing')}
 const kind=s.companyLevel===5?'marketing':available[Math.floor(nextRandom(s)*available.length)]
 s.incident=makeIncident(kind,s);if(!s.triggered.includes(kind))s.triggered.push(kind);addLog(s,s.incident.title,'warn');announceIncident(s)
}
const tick=(s:GameState,dt:number,realDt:number,current:Metrics)=>{
 s.elapsed+=dt;s.activeSeconds+=realDt;s.metrics=current
 const incidentExtra=s.incident?.kind==='marketing'?s.metrics.demand-demandFor({...s,incident:null}):0
 if(!(training(s)&&s.tutorial.replay)){
  s.cash+=s.metrics.net*dt;s.revenue.gross+=s.metrics.gross*dt;s.revenue.expenses+=s.metrics.expenses*dt;s.totalServed+=s.metrics.served*dt*60
  s.storageUsedGiB=Math.min(s.metrics.hardware.storageGiB,s.storageUsedGiB+s.metrics.writeRateGiB*dt*60)
  if(!training(s))s.aiServed+=s.metrics.aiServed*dt*60
 }
 if(training(s)){if(!s.tutorial.replay)awardAchievements(s);if(s.tutorial.phase==='demo'){s.tutorial.demoRemaining=Math.max(0,s.tutorial.demoRemaining-dt);if(s.tutorial.demoRemaining<=.000001)moveTutorial(s,s.tutorial.step+1)}return}
 s.eventQuietSeconds=Math.max(0,s.eventQuietSeconds-realDt)
 s.stableServiceMinutes=s.metrics.successRate>=.98?s.stableServiceMinutes+dt:0
 // Falling behind stalls progress; it never increases demand or creates a reputation death spiral.
 if(s.metrics.successRate>=.98){s.reputation=clamp(s.reputation+.05*dt,0,100);s.levelProgress+=s.metrics.served*dt*60}
 const completedLevel=s.levelProgress>=s.levelQuota-.000001
 if(s.rentalsEnabled){
  if(s.provisioning.remaining>0){s.provisioning.remaining=Math.max(0,s.provisioning.remaining-dt);if(s.provisioning.remaining<=.000001){s.cloudProvisioned=s.provisioning.target;s.aiProvisioned=s.provisioning.gpuTarget;s.provisioning={target:s.cloudProvisioned,gpuTarget:s.aiProvisioned,remaining:0}}}
  if(owned(s,'autoscaling')){
   s.scaleTimer+=dt;const delay=s.policies.autoscaling==='economy'?10:3
   if(s.scaleTimer>=delay&&s.provisioning.remaining===0){s.scaleTimer%=delay;const use=s.policies.autoscaling==='economy'?.85:.6
    const neededVMs=Math.ceil(Math.max(0,s.metrics.eligibleCloudWork/use-s.metrics.onPrem)/(4*2.8e9/WORKLOAD.instructions*.95))
    const target=Math.max(s.budgetGuard.enabled?0:1+s.equipmentLevels.cloud,neededVMs)
    const gpuTarget=owned(s,'ai')?Math.max(s.budgetGuard.enabled?0:1+s.equipmentLevels.ai,Math.ceil(Math.min(s.metrics.admittedAI,s.metrics.storage)/Math.max(.01,20*use))):0
    if(target!==s.cloudProvisioned||gpuTarget!==s.aiProvisioned)s.provisioning={target,gpuTarget,remaining:2}
   }
  }
 }
 if(s.budgetGuard.enabled&&s.metrics.net<-.005){
  s.budgetGuard.lossSeconds+=realDt;s.budgetGuard.status='warning'
  const timeToEmpty=s.cash/Math.max(.001,-s.metrics.net*s.speed)
  if(s.budgetGuard.lossSeconds>=8||timeToEmpty<8){
   const requiredVMs=Math.max(0,Math.ceil(Math.max(0,s.metrics.eligibleCloudWork-s.metrics.onPrem)/(4*2.8e9/WORKLOAD.instructions*.95))),requiredGPUs=owned(s,'ai')?Math.ceil(Math.min(s.metrics.admittedAI,s.metrics.storage)/20):0
   s.cloudProvisioned=Math.min(s.cloudProvisioned,requiredVMs);s.aiProvisioned=Math.min(s.aiProvisioned,requiredGPUs)
   s.provisioning={target:s.cloudProvisioned,gpuTarget:s.aiProvisioned,remaining:0};s.budgetGuard.status='recovering';s.scaleTimer=0
  }
 }else{s.budgetGuard.lossSeconds=0;s.budgetGuard.status='healthy'}
 if(s.incident){
  const stats=s.incident.stats??=emptyEventStats(true);integrateEvent(stats,s.metrics,dt,incidentExtra,realDt);s.incident.remaining=Math.max(0,s.incident.remaining-realDt)
  if(s.incident.remaining<=.000001){const kind=s.incident.kind,dominant=STAGES.reduce((best,k)=>stats.missedByStage[k]>stats.missedByStage[best]?k:best,STAGES[0]);const report={...stats,missedByStage:{...stats.missedByStage},id:`report-${s.announcementSequence+1}`,kind,title:kind==='marketing'?'Marketing campaign feedback':kind==='hardware'?'Recovery debrief':kind==='bot'?'Security incident debrief':'Cloud spending debrief',endedAt:s.elapsed,dominantStage:stats.dropped>.000001?dominant:null};s.eventReports=[report,...s.eventReports].slice(0,20);announce(s,'report',report.title,'Here is how your infrastructure handled the event.',{illustration:kind,reportId:report.id});addLog(s,`${s.incident.title} resolved.`,'good');s.incident=null;s.eventQuietSeconds=45;s.incidentsRecovered++}
 }
 if(s.challenge.active){
  s.challenge.remaining=Math.max(0,s.challenge.remaining-dt);s.challenge.totalDemand+=s.metrics.demand*dt*60;s.challenge.totalServed+=s.metrics.served*dt*60
  if(s.challenge.remaining<=.000001){const passed=s.challenge.totalServed/Math.max(1,s.challenge.totalDemand)>=.9;s.challenge.active=false;s.challenge.result=passed?'passed':'failed';if(passed){s.completed=true;announce(s,'challenge','Launch Day passed','Your architecture kept up. Keep expanding your fleet.')}else{s.challenge.retryAt=s.elapsed+30;announce(s,'challenge','Launch Day needs another try','Inspect the limiting component and try again.')}}
 }
 if(completedLevel){s.levelProgress=0;s.companyLevel++;s.levelQuota=quotaForLevel(s.companyLevel);checkpointEvent(s)}
 awardAchievements(s)
}
export const stepGame=(state:GameState,realDelta:number):GameState=>{
 if(training(state)&&state.tutorial.phase!=='demo')return state
 if(state.paused||getNextAnnouncement(state)||!Number.isFinite(realDelta)||realDelta<=0)return state
 const s=structuredClone(state);let remaining=realDelta
 while(remaining>.000001&&!s.paused&&!getNextAnnouncement(s)){
  const current=calculateMetrics(s),quotaBoundary=!training(s)&&current.successRate>=.98?Math.max(.000001,(s.levelQuota-s.levelProgress)/(Math.max(.001,current.served)*60*s.speed)):Infinity
  const realDt=Math.min(.1/s.speed,remaining,s.incident&&!training(s)?Math.max(.000001,s.incident.remaining):Infinity,s.challenge.active?Math.max(.000001,s.challenge.remaining/s.speed):Infinity,quotaBoundary)
  tick(s,realDt*s.speed,realDt,current);remaining-=realDt
 }
 s.metrics=calculateMetrics(s);return s
}

export const setRentalsEnabled=(state:GameState,enabled:boolean):GameState=>{
  if(state.rentalsEnabled===enabled||training(state))return state
  const s=structuredClone(state);s.rentalsEnabled=enabled;s.cloudProvisioned=0;s.aiProvisioned=0
  s.provisioning=enabled?{target:owned(s,'cloud')?1+s.equipmentLevels.cloud:0,gpuTarget:owned(s,'ai')?1+s.equipmentLevels.ai:0,remaining:2}:{target:0,gpuTarget:0,remaining:0}
  addLog(s,enabled?'Rented pools restarting; ready in 2 minutes.':'Rented CPU and GPU pools stopped. Their ongoing charges are suspended.')
  s.metrics=calculateMetrics(s);return s
}

export const serializeGame = (s: GameState) => JSON.stringify(s)

export const loadGame = (value: string): GameState | null => {
  try {
    const p = JSON.parse(value)
    const finite = (v: unknown, min = 0, max = 1e15): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
    const validStats = (x:unknown): x is import('./types').EventStatistics => {
      if(!x||typeof x!=='object')return false
      const v=x as Record<string,unknown>,loss=v.missedByStage as Record<string,unknown>
      return ['duration','standardRequests','aiRequests','served','dropped','gross','expenses','potentialGross','extraRequests'].every(k=>finite(v[k]))&&(v.durationSeconds===undefined||finite(v.durationSeconds))&&typeof v.partial==='boolean'&&!!loss&&STAGES.every(k=>finite(loss[k]))&&Number(v.gross)<=Number(v.potentialGross)+.001&&Math.abs(Number(v.served)+Number(v.dropped)-Number(v.standardRequests)-Number(v.aiRequests))<.01
    }
    const validMetrics = (x:unknown):x is Metrics => {
      if(!x||typeof x!=='object')return false
      const v=x as Record<string,unknown>
      return ['demand','standardDemand','aiDemand','aiServed','served','dropped','successRate','network','compute','memory','storage','onPrem','cloud','aiCapacity','cacheHits','latency','gross','expenses'].every(k=>finite(v[k]))&&finite(v.net,-1e15)&&['healthy',...STAGES].includes(v.bottleneck as string)&&!!v.utilizations&&!!v.losses&&STAGES.every(k=>finite((v.utilizations as Record<string,unknown>)[k],0,1)&&finite((v.losses as Record<string,unknown>)[k]))
    }
    const validImpact = (v:unknown):v is import('./types').PurchaseImpact => {
      if(!v||typeof v!=='object')return false
      const x=v as import('./types').PurchaseImpact
      return [...ids,'network'].includes(x.id)&&(x.expansionPool===undefined||['servers','storage','network','cloud','ai'].includes(x.expansionPool))&&finite(x.at)&&validMetrics(x.before)&&validMetrics(x.after)&&['beforeLevel','afterLevel','quantity','cost'].every(k=>(x as unknown as Record<string,unknown>)[k]===undefined||finite((x as unknown as Record<string,unknown>)[k]))
    }
    if (!p || ![1, 2, 3, 4, 5, 6].includes(p.version) || !finite(p.cash,p.version>=5?-1e15:0) || !Array.isArray(p.upgrades)) return null
    if (new Set(p.upgrades).size !== p.upgrades.length || p.upgrades.some((id: UpgradeId) => !ids.includes(id) || (!(p.version >= 3 && (id === 'memory' || id === 'ssd')) && upgradeById[id].prerequisites.some((dep) => !p.upgrades.includes(dep))))) return null
    const s = createInitialState()
    const numberKeys = ['cash', 'elapsed', 'totalServed', 'policyCooldownUntil', 'nextIncidentAt'] as const
    for (const key of numberKeys) if (p[key] !== undefined) { if (!finite(p[key],key==='cash'&&p.version>=5?-1e15:0)) return null; s[key] = p[key] }
    if (p.reputation !== undefined) { if (!finite(p.reputation, 0, 100)) return null; s.reputation = p.reputation }
    if (p.speed !== undefined) { if (![1, 2, 4].includes(p.speed)) return null; s.speed = p.speed }
    for (const key of ['paused', 'completed'] as const) if (p[key] !== undefined) { if (typeof p[key] !== 'boolean') return null; s[key] = p[key] }
    if (p.rng !== undefined) { if (!Number.isInteger(p.rng) || !finite(p.rng, 0, 4294967295)) return null; s.rng = p.rng }
    s.upgrades = [...p.upgrades]
    if (p.version >= 3) {
      if (!p.equipmentLevels || typeof p.equipmentLevels !== 'object') return null
      for (const item of EQUIPMENT) {
        const n = p.equipmentLevels[item.id]
        if (!Number.isSafeInteger(n) || n < 0 || (p.version===6&&basicEquipment.includes(item.id as typeof basicEquipment[number])&&n>MAX_LEVELS[item.id]) || (item.unlock && !owned(s,item.unlock) && n > 0)) return null
        s.equipmentLevels[item.id] = p.version<6&&basicEquipment.includes(item.id as typeof basicEquipment[number])?Math.min(n,MAX_LEVELS[item.id]):n
      }
      for (const id of ['cpu','memory','ssd'] as const) if (owned(s,id) !== (s.equipmentLevels[id] > 0)) return null
      for (const key of ['aiServed','stableServiceMinutes','incidentsRecovered'] as const) {
        if (!finite(p[key]) || (key === 'incidentsRecovered' && !Number.isInteger(p[key]))) return null
        s[key] = p[key]
      }
      if (!Array.isArray(p.achievementIDs) || new Set(p.achievementIDs).size !== p.achievementIDs.length || p.achievementIDs.some((id:string) => !ACHIEVEMENTS.some(a => a.id === id))) return null
      s.achievementIDs = [...p.achievementIDs]
      if (!Array.isArray(p.announcements) || p.announcements.length>100 || !Array.isArray(p.acknowledgedAnnouncements) || !Number.isSafeInteger(p.announcementSequence) || p.announcementSequence < 0) return null
      if (p.acknowledgedAnnouncements.some((id:unknown) => typeof id !== 'string' || !/^(incident|technology|achievement|challenge|report)-\d+$/.test(id)) || new Set(p.acknowledgedAnnouncements).size !== p.acknowledgedAnnouncements.length) return null
      if (new Set(p.announcements.map((a:Announcement) => a?.id)).size !== p.announcements.length || p.announcements.some((a:Announcement) => !a || !['incident','technology','achievement','challenge','report'].includes(a.kind) || typeof a.id !== 'string' || !new RegExp(`^${a.kind}-\\d+$`).test(a.id) || Number(a.id.split('-')[1]) > p.announcementSequence || typeof a.title !== 'string' || typeof a.body !== 'string' || typeof a.actionLabel !== 'string'||(a.impact!==undefined&&!validImpact(a.impact))||(a.tip!==undefined&&typeof a.tip!=='string')||(a.illustration!==undefined&&![...ids,...kinds].includes(a.illustration as UpgradeId))||(a.reportId!==undefined&&(typeof a.reportId!=='string'||!/^report-\d+$/.test(a.reportId))))) return null
      s.announcements = p.announcements.map((a:Announcement) => ({id:a.id,kind:a.kind,title:a.title.slice(0,200),body:a.body.slice(0,2000),actionLabel:a.actionLabel.slice(0,100),illustration:a.illustration,reportId:a.reportId,impact:a.impact,tip:a.tip?.slice(0,500)}))
      s.acknowledgedAnnouncements = [...p.acknowledgedAnnouncements]
      s.announcementSequence = p.announcementSequence
    } else {
      for (const id of ['cpu','memory','ssd'] as const) s.equipmentLevels[id] = owned(s,id) ? 1 : 0
    }
    if (p.policies !== undefined) {
      if (!p.policies || !['efficiency', 'redundancy'].includes(p.policies.loadBalancer) || !['balanced', 'strict'].includes(p.policies.firewall) || !['economy', 'resilient'].includes(p.policies.autoscaling)) return null
      s.policies = { ...p.policies }
    }
    if (p.version >= 2) {
      const t = p.tutorial
      if (!t || !['welcome', 'active', 'complete', 'skipped'].includes(t.status) || !Number.isInteger(t.step) || t.step < 0 || t.step > (p.version===6?10:7) || !['explain', 'demo', 'action'].includes(t.phase) || !finite(t.demoRemaining, 0, 4) || typeof t.replay !== 'boolean' || typeof t.demonstrated !== 'boolean') return null
      if (t.phase === 'action' && !(p.version===6?[1,2,3,4,5,6,7,8,9]:[1,2,3,4,5,6]).includes(t.step)) return null
      if (t.phase !== 'explain' && t.status !== 'active') return null
      if (t.status === 'welcome' && t.step !== 0) return null
      if (t.status === 'active' && t.step < 1) return null
      if (t.returnPaused!==undefined&&typeof t.returnPaused!=='boolean')return null
      if (t.phase === 'action' && !t.replay && p.upgrades.includes(p.version===6?lessonDefinitions[t.step].requiredUpgrade:({3:'cpu',4:'memory',5:'ssd'} as Record<number,string>)[t.step])) return null
      s.tutorial = { ...t }; syncTutorial(s)
      if (training(s)) s.paused=t.phase==='explain'
      for (const key of ['cloudProvisioned', 'aiProvisioned', 'scaleTimer'] as const) { if (!finite(p[key], 0, key === 'cloudProvisioned' ? (p.version===6?1e12:p.version===5?8:84 + s.equipmentLevels.cloud * 6) : key === 'aiProvisioned' ? (p.version===6?1e12:p.version===5?4:48 + s.equipmentLevels.ai * 4) : 10.000001)) return null; s[key] = p[key] }
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
      if(p.version>=4&&!validStats(i.stats))return null
      s.incident = { kind: i.kind, total: i.total, remaining: i.remaining, title: i.title.slice(0, 200), detail: i.detail.slice(0, 500),stats:p.version>=4?i.stats:emptyEventStats(true) }
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
    if (p.version < 3) {
      // Old progress is recognized without issuing retroactive cash or unlock dialogs.
      if (s.triggered.length) s.incidentsRecovered = s.triggered.length - (s.incident ? 1 : 0)
      s.achievementIDs = achieved(s)
      s.acknowledgedAnnouncements = s.upgrades.filter(id => !['cpu','memory','ssd'].includes(id)).map((_,index) => `technology-${index+1}`)
      s.announcementSequence = s.acknowledgedAnnouncements.length
    }
    if(p.version>=4){
      if(!p.revenue||!['gross','expenses','grants'].every(k=>finite(p.revenue[k]))||!Array.isArray(p.eventReports)||p.eventReports.length>20)return null
      if(p.lastPurchase!==null&&!validImpact(p.lastPurchase))return null
      if(p.eventReports.some((r:import('./types').EventReport)=>!validStats(r)||!kinds.includes(r.kind)||typeof r.title!=='string'||typeof r.id!=='string'||!/^report-\d+$/.test(r.id)||!finite(r.endedAt)||(r.dominantStage!==null&&!STAGES.includes(r.dominantStage))))return null
      s.revenue={...s.revenue,gross:p.revenue.gross,expenses:p.revenue.expenses,grants:p.revenue.grants};s.lastPurchase=p.lastPurchase;s.eventReports=p.eventReports
    } else {
      s.announcements=s.announcements.map(a=>{
        const tech=UPGRADES.find(u=>a.kind==='technology'&&a.title.startsWith(u.name))
        return {...a,illustration:tech?.id??(a.kind==='incident'?s.incident?.kind:undefined),tip:tech?TECHNOLOGY_TIPS[tech.id]:undefined}
      })
    }
    if(p.version>=5){
      if(!finite(p.storageUsedGiB)||typeof p.rentalsEnabled!=='boolean'||!p.provisioning||!Number.isInteger(p.provisioning.target)||!finite(p.provisioning.target,0,p.version===6?1e12:8)||!Number.isInteger(p.provisioning.gpuTarget)||!finite(p.provisioning.gpuTarget,0,p.version===6?1e12:4)||!finite(p.provisioning.remaining,0,2))return null
      if(!Number.isInteger(s.cloudProvisioned)||!Number.isInteger(s.aiProvisioned)||(!owned(s,'cloud')&&s.cloudProvisioned!==0)||(!owned(s,'ai')&&s.aiProvisioned!==0)||(!p.rentalsEnabled&&(s.cloudProvisioned!==0||s.aiProvisioned!==0)))return null
      if(!['purchases','rewards'].every(k=>finite(p.revenue[k]))||!finite(p.revenue.opening,-1e15))return null
      s.revenue={...s.revenue,purchases:p.revenue.purchases,rewards:p.revenue.rewards,opening:p.revenue.opening}
      const balance=s.revenue.opening+s.revenue.gross+s.revenue.grants+s.revenue.rewards-s.revenue.purchases-s.revenue.expenses
      if(Math.abs(balance-s.cash)>.01)return null
      s.storageUsedGiB=p.storageUsedGiB;s.rentalsEnabled=p.rentalsEnabled;s.provisioning={...p.provisioning}
      if(p.version<6&&s.storageUsedGiB>getHardware(s).storageGiB)return null
    }else{
      // Preserve all purchases and funds. Opening balance bridges accounting that old saves never recorded.
      s.revenue.opening=s.cash-s.revenue.gross-s.revenue.grants+s.revenue.expenses
      s.cloudProvisioned=owned(s,'cloud')?clamp(Math.ceil(s.cloudProvisioned/24),1,8):0
      s.aiProvisioned=owned(s,'ai')?clamp(Math.ceil(s.aiProvisioned/8),1,4):0
      s.lastPurchase=null
      s.announcements=s.announcements.map(a=>({...a,impact:undefined}))
      addLog(s,'Lab upgraded to real hardware units. Your funds and purchases were preserved.','good')
    }
    if(p.version===6){
      if(!Number.isSafeInteger(p.companyLevel)||!finite(p.companyLevel,1,Number.MAX_SAFE_INTEGER)||!finite(p.levelQuota,.001)||!finite(p.levelProgress,0,p.levelQuota+.001)||Math.abs(p.levelQuota-quotaForLevel(p.companyLevel))>Math.max(.001,p.levelQuota*1e-10))return null
      if(!p.fleet||!['servers','storageGroups','networkLinks'].every(k=>Number.isSafeInteger(p.fleet[k])&&finite(p.fleet[k],1,1e12)))return null
      if(p.fleet.servers>1&&!owned(s,'server2'))return null
      if(!p.budgetGuard||typeof p.budgetGuard.enabled!=='boolean'||!finite(p.budgetGuard.lossSeconds)||!['healthy','warning','recovering'].includes(p.budgetGuard.status))return null
      if(!Array.isArray(p.claimedAchievementIDs)||new Set(p.claimedAchievementIDs).size!==p.claimedAchievementIDs.length||p.claimedAchievementIDs.some((id:string)=>!s.achievementIDs.includes(id)))return null
      if(!Number.isSafeInteger(p.claimedCheckpointLevel)||!finite(p.claimedCheckpointLevel,0,p.companyLevel-1)||p.claimedCheckpointLevel%5!==0)return null
      if(!Number.isSafeInteger(p.eventCheckpoint)||!finite(p.eventCheckpoint,0,p.companyLevel)||p.eventCheckpoint%5!==0||!finite(p.eventQuietSeconds,0,45)||!finite(p.activeSeconds)||!finite(p.workloadOffset,0,p.companyLevel-1)||(p.aiLaunchLevel!==null&&!finite(p.aiLaunchLevel,-100,p.companyLevel)))return null
      s.companyLevel=p.companyLevel;s.levelQuota=p.levelQuota;s.levelProgress=p.levelProgress;s.fleet={...p.fleet};s.budgetGuard={...p.budgetGuard};s.claimedAchievementIDs=[...p.claimedAchievementIDs];s.claimedCheckpointLevel=p.claimedCheckpointLevel;s.eventCheckpoint=p.eventCheckpoint;s.eventQuietSeconds=p.eventQuietSeconds;s.activeSeconds=p.activeSeconds;s.aiLaunchLevel=p.aiLaunchLevel;s.workloadOffset=p.workloadOffset
      if(s.storageUsedGiB>getHardware(s).storageGiB)return null
    }else{
      const previousDemand=finite(p.metrics?.demand)?p.metrics.demand:45
      const quietDemand=previousDemand/(s.incident?.kind==='marketing'?1.5:1)/(s.challenge.active?2:1)
      s.companyLevel=Math.max(1,Math.floor(Math.max(0,quietDemand/45-1)/.07)+1);s.levelQuota=quotaForLevel(s.companyLevel);s.levelProgress=0;s.workloadOffset=s.companyLevel-1
      s.fleet={servers:owned(s,'server2')?2:1,storageGroups:1,networkLinks:1};s.claimedAchievementIDs=[...s.achievementIDs];s.claimedCheckpointLevel=Math.floor((s.companyLevel-1)/5)*5;s.eventCheckpoint=Math.floor(s.companyLevel/5)*5;s.activeSeconds=s.elapsed/s.speed;s.aiLaunchLevel=owned(s,'ai')?s.companyLevel-9:null
      if(s.incident){const old=s.incident,fraction=old.remaining/old.total,replacement=makeIncident(old.kind,s);replacement.remaining=replacement.total*fraction;replacement.stats=old.stats?{...old.stats,missedByStage:{...old.stats.missedByStage},durationSeconds:old.stats.durationSeconds??old.stats.duration/s.speed,partial:true}:emptyEventStats(true);s.incident=replacement}
      const mapping:Record<number,number>={0:0,1:1,2:2,3:3,4:6,5:7,6:8,7:10};s.tutorial.step=mapping[s.tutorial.step]??10
      if(s.tutorial.status==='active'){if(s.tutorial.phase==='demo'||s.tutorial.demonstrated)moveTutorial(s,Math.min(10,s.tutorial.step+1));else{s.tutorial.phase=[1,2,4,5,8,9].includes(s.tutorial.step)?'action':s.tutorial.phase;s.paused=s.tutorial.phase==='explain'}}
      s.announcements=[];s.acknowledgedAnnouncements=[];s.incidentQueue=[];s.lastPurchase=null;if(s.incident)announceIncident(s);syncTutorial(s)
      addLog(s,'Your company now has reliable-work levels and fleet expansion. Earlier rewards stay claimed.','good')
    }
    if(p.uiRevision!==undefined&&p.uiRevision!==2)return null
    if(p.uiRevision!==2&&p.version===6){
      s.acknowledgedAnnouncements=[...new Set([...s.acknowledgedAnnouncements,...s.announcements.map(a=>a.id)])]
      s.announcements=[]
      if(s.tutorial.status==='active'){
        const t=s.tutorial
        if(t.phase==='demo'||t.demonstrated)moveTutorial(s,Math.min(10,t.step+1))
        else if([1,2,4,5,8,9].includes(t.step)){t.phase='action';s.paused=false}
        else s.paused=t.phase==='explain'
      }
      if(s.incident)announceIncident(s)
      addLog(s,'Interface updated. Earlier notifications remain in event history.','info')
    }
    s.uiRevision=2;s.acknowledgedAnnouncements=[]
    s.metrics = calculateMetrics(s)
    return s
  } catch { return null }
}
