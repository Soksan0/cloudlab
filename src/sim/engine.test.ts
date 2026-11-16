import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS, acknowledgeAnnouncement, advanceTutorial, calculateMetrics, canPurchase, createInitialState, getChallengeReadiness, getEquipmentQuote, getHardware, getMilestone, getNextAnnouncement, getRecommendation, loadGame, previewEquipmentImpact, purchaseEquipment, purchaseUpgrade, replayTutorial, serializeGame, setPolicy, setRentalsEnabled, skipTutorial, startChallenge, startTutorial, stepGame, triggerIncident } from './engine'
import { UPGRADES } from './upgrades'
import { AI_PRICE, MAX_LEVELS, STANDARD_PRICE, WORKLOAD } from './hardware'
import type { EquipmentId, GameState } from './types'
function fund(s:GameState,cash=1e6){s.revenue.opening+=cash-s.cash;s.cash=cash;return s}
function lab(){const s=skipTutorial(createInitialState());s.nextIncidentAt=1e9;return s}
function full(){let s=fund(lab());for(const u of UPGRADES)s=purchaseUpgrade(s,u.id);return stepGame(s,2.1)}
function balance(s:GameState){const r=s.revenue;expect(s.cash).toBeCloseTo(r.opening+r.gross+r.grants+r.rewards-r.purchases-r.expenses,6)}
function prepared(){let s=full();for(const id of ['cpu','memory','ssd','network'] as EquipmentId[])s=purchaseEquipment(s,id,'max');s=purchaseEquipment(s,'ai','max');s=stepGame(s,2.1);s.reputation=90;return s}

describe('guided learning',()=>{
 it('leaves a fresh company paused until the welcome choice',()=>{const s=createInitialState();expect(stepGame(s,30)).toEqual(s);expect(s.tutorial.status).toBe('welcome');expect(canPurchase(s,'cpu').ok).toBe(false)})
 it('completes funded actions with observable CPU, RAM and storage constraints',()=>{
  let s=startTutorial(createInitialState());s=advanceTutorial(s);s=stepGame(s,4.1);s=advanceTutorial(s);s=advanceTutorial(s);s=stepGame(s,4.1)
  expect(s.metrics.bottleneck).toBe('compute');s=advanceTutorial(s)
  for(const [id,next] of [['cpu','memory'],['memory','healthy'],['ssd','healthy']] as const){
   s=advanceTutorial(s);expect(s.tutorial.phase).toBe('action');expect(canPurchase(s,id).ok).toBe(true)
   s=purchaseEquipment(s,id);expect(s.tutorial.phase).toBe('demo');balance(s)
   if(id==='cpu')expect(s.metrics.bottleneck).toBe(next)
   s=stepGame(s,4.1);expect(s.paused).toBe(true);s=advanceTutorial(s)
   if(id==='memory')expect(s.metrics.bottleneck).toBe('storage')
  }
  s=advanceTutorial(s);s=advanceTutorial(s);expect(s.tutorialComplete).toBe(true);expect(s.paused).toBe(false);balance(s)
 })
 it('replays a baseline without changing live finances, data or achievements',()=>{
  let s=prepared();s.paused=true;const original={cash:s.cash,revenue:s.revenue,used:s.storageUsedGiB,achievements:s.achievementIDs}
  s=replayTutorial(s);expect(s.metrics.compute).toBe(40);expect(s.metrics.cloud).toBe(0)
  s=stepGame(advanceTutorial(s),4.1);expect(s.cash).toBe(original.cash);expect(s.revenue).toEqual(original.revenue);expect(s.storageUsedGiB).toBe(original.used);expect(s.achievementIDs).toEqual(original.achievements)
 })
 it('round trips a pending funded lesson without duplicate grants',()=>{let s=startTutorial(createInitialState());for(let i=0;i<2;i++)s=advanceTutorial(stepGame(advanceTutorial(s),4.1));s=advanceTutorial(s);const loaded=loadGame(serializeGame(s))!;expect(loaded.tutorial).toEqual(s.tutorial);expect(loaded.cash).toBe(s.cash);balance(loaded)})
})

describe('physical resources and derived workload limits',()=>{
 it('derives baseline capacities with dimensionally consistent conversions',()=>{
  const s=lab(),m=calculateMetrics(s),h=getHardware(s)
  expect(h.cpuCores).toBe(2);expect(h.cpuGHz).toBe(2.4);expect(m.compute).toBe(40)
  expect(m.memory).toBe(48);expect(m.storage).toBe(50);expect(m.network).toBeCloseTo(100e6/(256*1024*8))
  expect(m.hardware.storageUsedGiB).toBe(32);expect(m.gross).toBeCloseTo(m.served*60*STANDARD_PRICE)
 })
 it('virtualizes existing hardware without creating cores or RAM',()=>{const s=full();const without={...s,upgrades:s.upgrades.filter(x=>x!=='virtualization')};expect(getHardware(s)).toEqual(getHardware(without));expect(calculateMetrics(s).compute).toBeLessThan(calculateMetrics(without).compute);expect(calculateMetrics(s).memory).toBeLessThanOrEqual(calculateMetrics(without).memory)})
 it('load balancing activates the second server without increasing network or storage',()=>{const s=full();s.rentalsEnabled=false;const without={...s,upgrades:s.upgrades.filter(x=>x!=='load_balancer')};const a=calculateMetrics(without),b=calculateMetrics(s);expect(b.compute).toBeGreaterThan(a.compute);expect(b.network).toBe(a.network);expect(b.storage).toBe(a.storage)})
 it('rented compute remains constrained by the shared data volume',()=>{const s=full();s.equipmentLevels.network=6;s.equipmentLevels.ssd=0;s.totalServed=1e7;s.cloudProvisioned=8;const m=calculateMetrics(s);expect(m.bottleneck).toBe('storage');expect(m.routes.origin+m.routes.ai*WORKLOAD.aiOperations/WORKLOAD.operations).toBeLessThanOrEqual(m.storage+.001)})
 it('AI requires application capacity as well as GPUs',()=>{const s=full();s.equipmentLevels.network=6;s.totalServed=1e9;s.cloudProvisioned=0;s.aiProvisioned=4;const m=calculateMetrics(s);expect(m.aiServed).toBeLessThan(m.aiCapacity);expect(m.losses.compute+m.losses.memory).toBeGreaterThan(0)})
 it('strict filtering improves bot ingress while consuming CPU',()=>{let s=full();s.nextIncidentAt=0;s=triggerIncident(s,'bot');const balanced=calculateMetrics(s);s=setPolicy(s,'firewall','strict');const strict=calculateMetrics(s);expect(strict.network).toBeGreaterThan(balanced.network);expect(strict.compute).toBeLessThan(balanced.compute)})
 it('persistent writes grow storage and ordinary pause freezes it',()=>{const s=lab(),next=stepGame(s,2);expect(next.storageUsedGiB).toBeGreaterThan(s.storageUsedGiB);next.paused=true;expect(stepGame(next,5).storageUsedGiB).toBe(next.storageUsedGiB)})
 it('a full disk rejects writes and continues reads, including cached reads',()=>{const s=prepared();s.totalServed=0;s.storageUsedGiB=getHardware(s).storageGiB;const m=calculateMetrics(s);expect(m.writeRateGiB).toBe(0);expect(m.served).toBeGreaterThan(0);expect(m.cacheHits).toBeGreaterThan(0);expect(m.losses.storage).toBeCloseTo(m.demand*WORKLOAD.writeFraction);expect(m.served+m.dropped).toBeCloseTo(m.demand)})
 it('storage transfer bandwidth is independent of IOPS',()=>{const s=prepared();s.totalServed=1e15;s.equipmentLevels.ssd=6;const m=calculateMetrics(s);expect(m.routes.origin*WORKLOAD.ioMiB+m.aiServed*WORKLOAD.aiIoMiB).toBeLessThanOrEqual(m.hardware.storageMiBs+.001)})
 it.each([lab,full,prepared])('accounts for every arriving request across all routes',make=>{const s=make();s.totalServed=1e7;const m=calculateMetrics(s);expect(m.routes.cache+m.routes.origin+m.routes.ai+m.routes.rejected+m.routes.pending).toBeCloseTo(m.routes.arrived,8);expect(Object.values(m.losses).reduce((a,b)=>a+b,0)).toBeCloseTo(m.dropped,8)})
})

describe('purchases, previews, and finances',()=>{
 it('records purchases and one-time rewards separately from completed-service revenue',()=>{let s=fund(lab(),1000);s=purchaseEquipment(s,'cpu');expect(s.revenue.purchases).toBe(80);expect(s.revenue.rewards).toBe(100);expect(s.revenue.gross).toBe(0);balance(s);s=stepGame(s,1);balance(s);expect(s.revenue.gross).toBeGreaterThan(0)})
 it('retains unpaid operating costs rather than silently clamping cash',()=>{const s=full();s.revenue.opening-=s.cash;s.cash=0;s.cloudProvisioned=8;s.aiProvisioned=4;s.achievementIDs=ACHIEVEMENTS.map(a=>a.id);s.incident={kind:'billing',title:'Price spike',detail:'Test',remaining:10,total:10};const next=stepGame(s,1);expect(next.cash).toBeLessThan(0);balance(next);expect(loadGame(serializeGame(next))?.cash).toBe(next.cash)})
 it('does not increase demand from purchases or elapsed time alone',()=>{const s=fund(lab());const before=calculateMetrics(s).demand;const next=purchaseEquipment(s,'cpu');expect(next.metrics.demand).toBe(before);next.elapsed+=10000;expect(calculateMetrics(next).demand).toBe(before);next.totalServed+=1e6;expect(calculateMetrics(next).demand).toBeGreaterThan(before)})
 it('offers independent hardware purchases with exact rounded prices',()=>{let s=fund(lab());const prices:number[]=[];for(let i=0;i<4;i++){prices.push(getEquipmentQuote(s,'cpu',1).cost);s=purchaseEquipment(s,'cpu')}expect(prices).toEqual([80,108,146,198]);expect(purchaseEquipment(fund(lab()),'memory').equipmentLevels.memory).toBe(1)})
 it.each(['cpu','memory','ssd','network','cloud','ai'] as EquipmentId[])('Max respects funds and bounded %s tiers',id=>{let s=id==='cloud'||id==='ai'?full():fund(lab());s=purchaseEquipment(s,id,'max');expect(s.equipmentLevels[id]).toBe(MAX_LEVELS[id]);expect(getEquipmentQuote(s,id,1).available).toBe(false);expect(s.cash).toBeGreaterThanOrEqual(0);expect(getHardware(s).cpuGHz).toBeLessThanOrEqual(3.6);balance(s)})
 it('predicts hardware upgrades without mutating or spending in the preview',()=>{const s=fund(lab());const original=serializeGame(s);const p=previewEquipmentImpact(s,'cpu',2);expect(serializeGame(s)).toBe(original);const next=purchaseEquipment(s,'cpu');expect(next.metrics.compute).toBe(previewEquipmentImpact(s,'cpu').after.compute);expect(p.after.hardware.cpuCores).toBe(8);expect(p.before.net).toBe(calculateMetrics(s).net)})
 it('prevents unaffordable and locked purchases without changing state',()=>{const s=lab();expect(purchaseEquipment(s,'cpu')).toBe(s);expect(purchaseEquipment(fund(s),'cloud')).toBe(s);expect(canPurchase(s,'ai').ok).toBe(false)})
 it('only grows demand after completed service, including after all unlocks',()=>{let s=prepared();const before=s.metrics.demand;s=stepGame(s,100);expect(s.metrics.demand).toBeGreaterThan(before);balance(s)})
})

describe('rental lifecycle and continuous play',()=>{
 it('new rented capacity waits two minutes before it can serve requests',()=>{const s=full();const before=s.cloudProvisioned;const preview=previewEquipmentImpact(s,'cloud');const next=purchaseEquipment(s,'cloud');expect(next.cloudProvisioned).toBe(before);expect(next.provisioning.remaining).toBe(2);expect(stepGame(next,1).cloudProvisioned).toBe(before);const ready=stepGame(next,2.1);expect(ready.cloudProvisioned).toBe(before+1);expect(ready.metrics.cloud).toBe(preview.after.cloud)})
 it('stops billing rented pools and restarts only after provisioning',()=>{const s=full(),stop=setRentalsEnabled(s,false);expect(stop.metrics.cloud).toBe(0);expect(stop.metrics.aiCapacity).toBe(0);expect(stop.metrics.expenses).toBeLessThan(s.metrics.expenses);expect(stop.storageUsedGiB).toBe(s.storageUsedGiB);const start=setRentalsEnabled(stop,true);expect(start.metrics.cloud).toBe(0);expect(stepGame(start,2.1).metrics.cloud).toBeGreaterThan(0);balance(start)})
 it('resilient autoscaling checks sooner and provisions integer instances',()=>{let s=prepared();s.equipmentLevels.cloud=0;s.equipmentLevels.cpu=1;s.equipmentLevels.memory=1;s.cloudProvisioned=1;s.totalServed=1e8;s.scaleTimer=0;s.provisioning={target:1,gpuTarget:s.aiProvisioned,remaining:0};s.policyCooldownUntil=0;const resilient=setPolicy(s,'autoscaling','resilient');const a=stepGame(s,5.2),b=stepGame(resilient,5.2);expect(a.cloudProvisioned).toBe(1);expect(b.cloudProvisioned).toBeGreaterThan(1);expect(Number.isInteger(b.cloudProvisioned)).toBe(true);expect(b.cloudProvisioned).toBeLessThanOrEqual(8)})
 it('incident and technology announcements do not block service',()=>{let s=full();s.nextIncidentAt=0;s=triggerIncident(s,'marketing');expect(getNextAnnouncement(s)).toBeDefined();const next=stepGame(s,1);expect(next.elapsed).toBeGreaterThan(s.elapsed);expect(next.totalServed).toBeGreaterThan(s.totalServed)})
 it('acknowledging an alert preserves a manual pause',()=>{let s=full();s.paused=true;s=acknowledgeAnnouncement(s,getNextAnnouncement(s)!.id);expect(s.paused).toBe(true);expect(stepGame(s,5)).toBe(s)})
 it('fixed substeps give matching results for equivalent frame and speed inputs',()=>{const s=lab();const a=stepGame(s,4);let b=s;for(let i=0;i<40;i++)b=stepGame(b,.1);expect(a.cash).toBeCloseTo(b.cash,8);expect(a.totalServed).toBeCloseTo(b.totalServed,7);expect(stepGame({...s,speed:4},1).cash).toBeCloseTo(a.cash,8)})
 it('backup recovery shortens an outage without increasing healthy throughput',()=>{const s=full(),without={...s,upgrades:s.upgrades.filter(x=>x!=='backup')};expect(calculateMetrics(s).served).toBe(calculateMetrics(without).served);s.nextIncidentAt=0;without.nextIncidentAt=0;expect(triggerIncident(s,'hardware').incident!.total).toBeLessThan(triggerIncident(without,'hardware').incident!.total)})
})

describe('progression, launch, and saved companies',()=>{
 it('advances facility milestones from capabilities',()=>{let s=fund(lab());expect(getMilestone(s).era).toBe('workshop');for(const u of UPGRADES){s=purchaseUpgrade(s,u.id);if(u.id==='load_balancer')expect(getMilestone(s).era).toBe('rooftop');if(u.id==='autoscaling')expect(getMilestone(s).era).toBe('datacenter')}expect(getMilestone(s).era).toBe('ai')})
 it('a prepared launch passes and rewards once; poor reputation can retry',()=>{let s=prepared();expect(getChallengeReadiness(s).ready).toBe(true);s=stepGame(startChallenge(s),91);expect(s.challenge.result).toBe('passed');expect(s.achievementIDs.filter(x=>x==='launch')).toHaveLength(1);const rewards=s.revenue.rewards;s=stepGame(s,5);expect(s.revenue.rewards).toBe(rewards);let bad=prepared();bad.reputation=10;bad=stepGame(startChallenge(bad),91);expect(bad.challenge.result).toBe('failed');expect(startChallenge(bad)).toBe(bad);bad=stepGame(bad,31);expect(startChallenge(bad).challenge.active).toBe(true)})
 it('round trips complete state, manual pause and reports without offline earnings',()=>{const s=prepared();s.paused=true;const restored=loadGame(serializeGame(s))!;expect(restored).not.toBeNull();expect(restored.cash).toBe(s.cash);expect(restored.paused).toBe(true);expect(restored.revenue).toEqual(s.revenue);balance(restored)})
 it.each([1,2,3,4])('migrates version %i without losing funds or purchases',version=>{const s=full();const legacy={...s,version,cash:4321};if(version<3){legacy.equipmentLevels={...s.equipmentLevels};legacy.announcements=[]}const restored=loadGame(JSON.stringify(legacy))!;expect(restored).not.toBeNull();expect(restored.version).toBe(5);expect(restored.cash).toBe(4321);expect(restored.upgrades).toEqual(s.upgrades);balance(restored)})
 it('rejects malformed saves and tampered financial totals',()=>{const s=lab();for(const value of ['invalid','null',JSON.stringify({...s,cash:1e30}),JSON.stringify({...s,revenue:{...s.revenue,gross:-1}}),JSON.stringify({...s,cash:s.cash+100}),JSON.stringify({...s,equipmentLevels:{...s.equipmentLevels,cpu:-1}}),JSON.stringify({...s,provisioning:{target:1.5,gpuTarget:0,remaining:0}})])expect(loadGame(value)).toBeNull()})
 it('does not award achievements again after save restoration',()=>{const s=stepGame(purchaseEquipment(fund(lab()),'cpu'),1);const restored=loadGame(serializeGame(s))!;const again=stepGame(restored,.1);expect(again.revenue.rewards).toBe(s.revenue.rewards);expect(again.achievementIDs).toEqual(s.achievementIDs)})
 it('recommends the measured constraint rather than an unrelated purchase',()=>{const s=prepared();s.equipmentLevels.network=0;s.totalServed=1e7;const r=getRecommendation(s);expect(r.priority).toBe('capacity');expect(r.upgradeId).toBe('network')})
})
