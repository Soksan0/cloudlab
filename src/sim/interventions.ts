import {calculateMetrics,canPurchase,expandFleet,getEquipmentQuote,getExpansionQuote,purchaseEquipment,purchaseUpgrade} from './engine'
import {MAX_LEVELS} from './hardware'
import {UPGRADES} from './upgrades'
import type {EquipmentId,FleetPool,GameState,Metrics,UpgradeId} from './types'
export type Intervention={key:string;name:string;kind:'equipment'|'technology'|'fleet';id:string;cost:number;available:boolean;reason:string;after:Metrics;delay:boolean;protection:boolean;tags:string[]}
const equipment=['cpu','memory','ssd','network','cloud','ai']
const pools:Record<string,FleetPool>={cpu:'servers',memory:'servers',ssd:'storage',network:'network',cloud:'cloud',ai:'ai'}
const names:Record<string,string>={cpu:'CPU upgrade',memory:'RAM upgrade',ssd:'Storage upgrade',network:'Network upgrade',cloud:'Cloud worker',ai:'GPU worker',servers:'Add server',storage:'Add storage group'}
export function getInterventions(state:GameState,component:string,quantity:1|'max'=1):Intervention[]{
 const candidates:{kind:Intervention['kind'];id:string}[]=[]
 if(equipment.includes(component)&&!(['cloud','ai'].includes(component)&&!state.upgrades.includes(component as UpgradeId)))candidates.push(state.equipmentLevels[component as EquipmentId]>=MAX_LEVELS[component as EquipmentId]?{kind:'fleet',id:pools[component]}:{kind:'equipment',id:component})
 else if(UPGRADES.some(u=>u.id===component)&&!state.upgrades.includes(component as UpgradeId))candidates.push({kind:'technology',id:component})
 if(state.metrics.successRate<.98&&['cpu','memory','ssd','server'].includes(component)){
  if(!state.upgrades.includes('cache'))candidates.push({kind:'technology',id:'cache'})
  if(['cpu','memory','server'].includes(component))candidates.push({kind:'fleet',id:'servers'})
 }
 const results:Intervention[]=[]
 for(const [index,c]of candidates.entries()){
  if(results.some(r=>r.key===c.kind+c.id))continue
  const funded=structuredClone(state);funded.cash=quantity==='max'&&index===0?state.cash:Math.max(state.cash,1e12)
  const quote=c.kind==='fleet'?getExpansionQuote(state,c.id as FleetPool,index===0?quantity:1):c.kind==='equipment'?getEquipmentQuote(state,c.id as EquipmentId):{cost:UPGRADES.find(u=>u.id===c.id)!.cost,available:canPurchase(state,c.id as UpgradeId).ok,reason:canPurchase(state,c.id as UpgradeId).reason}
  const next=c.kind==='fleet'?expandFleet(funded,c.id as FleetPool,index===0?quantity:1):c.kind==='equipment'?purchaseEquipment(funded,c.id as EquipmentId):purchaseUpgrade(funded,c.id as UpgradeId)
  if(next===funded){if(index===0)results.push({key:c.kind+c.id,name:names[c.id]??UPGRADES.find(u=>u.id===c.id)?.name??c.id,...c,cost:quote.cost,available:false,reason:quote.reason,after:state.metrics,delay:false,protection:false,tags:[]});continue}
  const delay=(c.id==='cloud'||c.id==='ai')&&next.rentalsEnabled&&next.provisioning.remaining>0
  if(delay){next.cloudProvisioned=next.provisioning.target;next.aiProvisioned=next.provisioning.gpuTarget;next.provisioning.remaining=0}
  const after=calculateMetrics(next),protection=['backup','security','load_balancer'].includes(c.id)
  if(index>0&&after.served<=state.metrics.served+.000001)continue
  results.push({key:c.kind+c.id,name:c.kind==='fleet'?(c.id==='network'?'Add network link':c.id==='cloud'?'Add cloud worker':c.id==='ai'?'Add GPU worker':names[c.id]):names[c.id]??UPGRADES.find(u=>u.id===c.id)?.name??c.id,...c,cost:quote.cost,available:quote.available,reason:quote.reason,after,delay,protection,tags:[]})
 }
 const useful=results.filter(r=>r.after.served>state.metrics.served+.000001)
 const best=(compare:(a:Intervention,b:Intervention)=>number)=>[...useful].sort((a,b)=>compare(a,b)||a.cost-b.cost||results.indexOf(a)-results.indexOf(b))[0]
 const awards:[string,Intervention|undefined][]=[['Lowest purchase cost',best((a,b)=>a.cost-b.cost)],['Largest service improvement',best((a,b)=>b.after.served-a.after.served)],['Lowest operating cost',best((a,b)=>a.after.expenses-b.after.expenses)]]
 for(const [tag,r]of awards)if(r)r.tags.push(tag)
 return results.slice(0,3)
}
