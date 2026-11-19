import {expect,it} from 'vitest'
import {writeFileSync,mkdirSync} from 'node:fs'
import {acknowledgeAnnouncement,calculateMetrics,claimRewards,createInitialState,expandFleet,getNextAnnouncement,getRecommendation,purchaseEquipment,purchaseUpgrade,skipTutorial,stepGame} from '../src/sim/engine'
import {getInterventions} from '../src/sim/interventions'
import {levelDemand} from '../src/sim/hardware'
import {UPGRADES} from '../src/sim/upgrades'
import type {EquipmentId,FleetPool,GameState,UpgradeId} from '../src/sim/types'
// Opt-in only. No experimental constant enters the production simulation.
it.runIf((globalThis as unknown as {process:{env:Record<string,string>}}).process.env.CLOUDLAB_BALANCE==='1')('compares quota and linear fleet costs through level 1000',()=>{
 const checkpoints=[5,10,20,40,100,1000],rows:unknown[]=[]
 for(const quotaSeconds of [25,35,45])for(const coefficient of [.02,.04,.06])for(const strategy of ['capacity','cache']){
  let s=skipTutorial(createInitialState()),active=0,purchases=0,wait=0,maxWait=0,offered=0,served=0,opportunities=0,fundingWait=0,maxFundingWait=0,totalFundingWait=0;const reserves:number[]=[]
  while(s.companyLevel<=1000&&active<200000){
   let a;while(a=getNextAnnouncement(s))s=acknowledgeAnnouncement(s,a.id)
   s=claimRewards(s);s.levelQuota=levelDemand(s.companyLevel)*60*quotaSeconds
   const before=calculateMetrics(s),resource=({compute:'cpu',memory:'memory',storage:'ssd',network:'network',ai:'ai'} as Record<string,string>)[before.bottleneck]
   let option=resource?getInterventions(s,resource)[0]:undefined
   if(resource&&strategy==='cache')option=getInterventions(s,resource).find(o=>o.id==='cache')??option
   if(!resource){const next=UPGRADES.find(u=>!['cpu','memory','ssd','cache'].includes(u.id)&&!s.upgrades.includes(u.id)&&u.prerequisites.every(id=>s.upgrades.includes(id)));if(next)option=getInterventions(s,next.id)[0]}
   let bought=false,needsFunds=false
   if(option&&!(s.provisioning.remaining>0&&['cloud','ai'].includes(option.id))){opportunities++;let cost=option.cost;if(option.kind==='fleet'){const pool=option.id as FleetPool,count=pool==='servers'?s.fleet.servers:pool==='storage'?s.fleet.storageGroups:pool==='network'?s.fleet.networkLinks:1+s.equipmentLevels[pool],base={servers:1000,storage:600,network:300,cloud:800,ai:1200}[pool];cost=Math.ceil(base*(1+coefficient*Math.max(0,count-1)))}needsFunds=s.cash<cost;if(s.cash>=cost){const previous=s,next=option.kind==='fleet'?expandFleet(s,option.id as FleetPool):option.kind==='equipment'?purchaseEquipment(s,option.id as EquipmentId):purchaseUpgrade(s,option.id as UpgradeId);if(next!==previous){s=next;s.cash-=cost-option.cost;s.revenue.purchases+=cost-option.cost;purchases++;bought=true;reserves.push(s.cash/Math.max(1,s.revenue.opening+s.revenue.gross+s.revenue.rewards));}}}
   const dt=before.successRate>=.98?Math.min(5,Math.max(.001,(s.levelQuota-s.levelProgress)/(Math.max(.001,s.metrics.served)*60))):1
   if(needsFunds&&before.successRate<.98){fundingWait+=dt;totalFundingWait+=dt;maxFundingWait=Math.max(maxFundingWait,fundingWait)}else fundingWait=0
   if(before.successRate<.98){wait+=dt;maxWait=Math.max(maxWait,wait)}else wait=0
   offered+=before.demand*dt*60;served+=before.served*dt*60
   const oldLevel=s.companyLevel;s=stepGame(s,dt);active+=dt
   if(s.companyLevel!==oldLevel&&checkpoints.includes(oldLevel)){const r=s.revenue;expect(Math.abs(s.cash-(r.opening+r.gross+r.rewards+r.grants-r.purchases-r.expenses))).toBeLessThan(.001);rows.push({quotaSeconds,coefficient,strategy,level:oldLevel,activeSeconds:Math.round(active),cash:Math.round(s.cash),purchases,purchaseOpportunities:opportunities,maxFundingWaitSeconds:Math.round(maxFundingWait),totalFundingWaitSeconds:Math.round(totalFundingWait),lastThreeReserves:reserves.slice(-3).map(v=>Number(v.toFixed(3))),maxRecoverySeconds:Math.round(maxWait),servedPercent:Number((served/Math.max(1,offered)*100).toFixed(2)),recentReserve:Number((reserves.slice(-3).reduce((a,b)=>a+b,0)/Math.max(1,reserves.slice(-3).length)).toFixed(3))})}
   if(!bought&&before.net<=0&&before.successRate<.98&&wait>120)break
  }
  expect(s.companyLevel).toBeGreaterThan(1000)
 }
 mkdirSync('benchmarks/results',{recursive:true});writeFileSync('benchmarks/results/balance-matrix.json',JSON.stringify(rows,null,2));console.info('BALANCE_MATRIX '+JSON.stringify(rows))
},180000)
