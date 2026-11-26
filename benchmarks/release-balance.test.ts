import {it,expect} from 'vitest'
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs'
import {balanceGrid,ACTIVE_BALANCE} from '../src/sim/balance'
import {createInitialState,skipTutorial,stepGame,calculateMetrics,getNextAnnouncement,acknowledgeAnnouncement,purchaseUpgrade,purchaseEquipment,expandFleet,getClaimableRewards,claimRewards} from '../src/sim/engine'
import {getInterventions} from '../src/sim/interventions'
import {UPGRADES} from '../src/sim/upgrades'
import type {BalanceConfig,EquipmentId,FleetPool,UpgradeId} from '../src/sim/types'
type Run={config:BalanceConfig;strategy:string;delay:number;level:number;active:number;firstUpgrade:number;maxWait:number;reserveFailures:number;purchases:number;healthy:number;ledgerError:number;checkpoints:unknown[]}
function run(config:BalanceConfig,strategy:string,delay:number,end:number):Run{
 let s=skipTutorial(createInitialState());s.balance=config;s.metrics=calculateMetrics(s)
 let active=0,purchases=0,firstUpgrade=Infinity,wait=0,maxWait=0,nextDecision=delay,offered=0,served=0,reserveFailures=0;const recent:number[]=[],checkpoints:unknown[]=[]
 while(s.companyLevel<=end&&active<end*90+600){
  let notice;while(notice=getNextAnnouncement(s))s=acknowledgeAnnouncement(s,notice.id)
  const m=s.metrics,resource=({compute:'cpu',memory:'memory',storage:'ssd',network:'network',ai:'ai'} as Record<string,string>)[m.bottleneck]
  if(active>=nextDecision){
   let options=resource?getInterventions(s,resource):[]
   if(resource&&strategy==='rental'&&s.upgrades.includes('cloud')){const remote=getInterventions(s,'cloud').filter(o=>o.after.served>m.served+.001);options=[...remote,...options]}
   let option=(strategy==='cache'?options.find(o=>o.id==='cache'):undefined)??options[0]
   if(!resource){const tech=UPGRADES.find(u=>!['cpu','memory','ssd','cache'].includes(u.id)&&!s.upgrades.includes(u.id)&&u.prerequisites.every(id=>s.upgrades.includes(id)));if(tech)option=getInterventions(s,tech.id)[0]}
   if(option&&!(s.provisioning.remaining>0&&['cloud','ai'].includes(option.id))){
    // Claims are deliberate funding actions; no automatic checkpoint payout loop.
    if(s.cash<option.cost&&getClaimableRewards(s).amount>0){s=claimRewards(s);nextDecision=active+Math.max(1,delay)}
    else if(s.cash>=option.cost){const before=s; s=option.kind==='fleet'?expandFleet(s,option.id as FleetPool):option.kind==='equipment'?purchaseEquipment(s,option.id as EquipmentId):purchaseUpgrade(s,option.id as UpgradeId);if(s!==before){purchases++;firstUpgrade=Math.min(firstUpgrade,active);recent.push(s.cash/Math.max(1,s.revenue.opening+s.revenue.gross+s.revenue.rewards));recent.splice(0,Math.max(0,recent.length-3))}}
   }
   nextDecision=Math.max(nextDecision,active+Math.max(1,delay))
  }
  const dt=Math.min(2,Math.max(.001,(s.levelQuota-s.levelProgress)/(Math.max(.001,s.metrics.served)*60)))
  const level=s.companyLevel,beforeActive=s.activeSeconds,ordinary=!s.incident;s=stepGame(s,dt);const used=s.activeSeconds-beforeActive;active+=used
  if(m.successRate<.98&&ordinary){wait+=used;maxWait=Math.max(maxWait,wait)}else wait=0
  offered+=m.demand*used;served+=m.served*used
  if(s.companyLevel!==level&&[5,10,20,40,100,1000,10000].includes(level)){if(level>=40&&recent.length===3&&recent.every(r=>r>.6))reserveFailures++;checkpoints.push({level,cash:s.cash,reserves:[...recent],active,purchases,maxWait})}
  if(maxWait>45||reserveFailures>0||firstUpgrade>30&&active>30)break
 }
 const r=s.revenue,error=Math.abs(s.cash-(r.opening+r.gross+r.grants+r.rewards-r.purchases-r.expenses));expect(error).toBeLessThan(.001)
 return {config,strategy,delay,level:s.companyLevel,active,firstUpgrade:Number.isFinite(firstUpgrade)?firstUpgrade:-1,maxWait,reserveFailures,purchases,healthy:served/Math.max(1,offered),ledgerError:error,checkpoints}
}
it.runIf(['1','revised'].includes(process.env.CLOUDLAB_RELEASE_BALANCE??''))('screens 36 economy configurations without activating failures',()=>{
 const rows:Run[]=[],survivors:BalanceConfig[]=[]
 for(const base of balanceGrid){const config:BalanceConfig=process.env.CLOUDLAB_RELEASE_BALANCE==='revised'?{...base,rentalLimits:true}:base;let viable=0;for(const strategy of ['capacity','cache','rental']){let pass=true;for(const delay of [0,5,10]){const r=run(config,strategy,delay,100);rows.push(r);if(r.level<=100||r.firstUpgrade>30||r.maxWait>45||r.reserveFailures>0)pass=false}if(pass)viable++}if(viable>=2)survivors.push(config)}
 mkdirSync('benchmarks/results',{recursive:true});writeFileSync('benchmarks/results/'+(process.env.CLOUDLAB_RELEASE_BALANCE==='revised'?'revised-screen.json':'release-screen.json'),JSON.stringify({rows,survivors},null,2))
 console.info(JSON.stringify({screened:balanceGrid.length,runs:rows.length,survivors}))
},600000)

it.runIf(['deep','revised-deep'].includes(process.env.CLOUDLAB_RELEASE_BALANCE??''))('validates the closest qualifying economy through 1000 and 10000 levels',()=>{
 const prefix=process.env.CLOUDLAB_RELEASE_BALANCE==='revised-deep'?'revised':'release',screen=JSON.parse(readFileSync('benchmarks/results/'+prefix+'-screen.json','utf8')) as {survivors:BalanceConfig[]},rows:Run[]=[];let selected:BalanceConfig|null=null
 const record=(r:Run,target:number)=>{rows.push(r);writeFileSync('benchmarks/results/'+prefix+'-deep-progress.json',JSON.stringify({target,rows,selected},null,2))}
 // A failed delay already disproves that strategy; prune its remaining delays.
 for(const config of screen.survivors){const viable:string[]=[];for(const strategy of ['capacity','cache','rental']){let pass=true;for(const delay of [0,5,10]){const r=run(config,strategy,delay,1000);record(r,1000);if(r.level<=1000||r.maxWait>45||r.reserveFailures){pass=false;break}}if(pass)viable.push(strategy)}
  if(viable.length>=2){let pass=true;for(const strategy of viable)for(const delay of [0,5,10]){const r=run(config,strategy,delay,10000);record(r,10000);if(r.level<=10000||r.maxWait>45||r.reserveFailures)pass=false}if(pass){selected=config;break}}
 }
 writeFileSync('benchmarks/results/'+prefix+'-deep.json',JSON.stringify({rows,selected},null,2));console.info(JSON.stringify({runs:rows.length,selected}))
},3600000)

it.runIf(process.env.CLOUDLAB_RELEASE_BALANCE==='selected')('rechecks the selected balance after final recovery fixes',()=>{expect(ACTIVE_BALANCE).not.toBeNull();const rows:Run[]=[];for(const strategy of ['capacity','cache','rental'])for(const delay of [0,5,10]){const r=run(ACTIVE_BALANCE!,strategy,delay,10000);rows.push(r);writeFileSync('benchmarks/results/selected-final.json',JSON.stringify({rows},null,2));expect(r.level).toBe(10001);expect(r.maxWait).toBeLessThanOrEqual(45);expect(r.reserveFailures).toBe(0);expect(r.firstUpgrade).toBeLessThanOrEqual(30)}},1800000)
