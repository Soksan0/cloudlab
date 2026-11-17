import type { EquipmentId, EventStatistics, LossStage, Metrics, PurchaseImpact, UpgradeId } from './types'

export const STAGES: LossStage[] = ['network','compute','memory','storage','ai']
export const EQUIPMENT_UNITS: Record<EquipmentId,string> = {
  cpu:'requests/second', memory:'requests/second', ssd:'requests/second',
  network:'requests/second', cloud:'requests/second', ai:'requests/second',
}
export const STAGE_NAMES: Record<LossStage,string> = {network:'Network ingress',compute:'CPU processing',memory:'Memory',storage:'Storage I/O',ai:'AI inference'}
export const TECHNOLOGY_TIPS: Record<string,string> = {
  virtualization:'Works well with: a second server. Watch out for network and storage limits.',
  server2:'Works well with: a load balancer to use the new machine fully.',
  load_balancer:'Works well with: caching to keep repeated work off your servers.',
  backup:'Watch out for: reduced capacity during recovery. Redundancy helps keep requests flowing.',
  security:'Watch out for: Strict mode uses more CPU. Compare protection and throughput.',
  cache:'Watch out for: caching bypasses origin processing, but every request still needs network ingress.',
  cloud:'Works well with: autoscaling. Watch the ongoing managed-capacity bill.',
  autoscaling:'Watch out for: scaling takes time. Resilient responds faster but rents more headroom.',
  ai:'Works well with: autoscaling. AI requests need their own GPU capacity.',
}
export const EVENT_STORIES = {
  marketing:{title:'Your campaign went viral!',body:'A midnight product clip hit the city feeds. Customer demand is 50% higher.',tip:'Use network headroom, compute, and caching to catch the surge.'},
  hardware:{title:'A rack went dark.',body:'A failing power module has degraded your on-premise machines.',tip:'Backups shorten recovery; redundancy reduces the capacity loss.'},
  bot:{title:'Someone brought a bot army.',body:'Automated traffic is crowding your gateway and reducing usable ingress.',tip:'Firewall protection filters the attack. Strict mode trades CPU for stronger filtering.'},
  billing:{title:'The cloud bill just landed.',body:'Burst pricing has tripled the cost of managed capacity and cloud requests.',tip:'Economy autoscaling carries less idle capacity. Keep an eye on net income.'},
}
export const emptyEventStats = (partial=false): EventStatistics => ({duration:0,durationSeconds:0,standardRequests:0,aiRequests:0,served:0,dropped:0,gross:0,expenses:0,potentialGross:0,extraRequests:0,missedByStage:{network:0,compute:0,memory:0,storage:0,ai:0},partial})
export function integrateEvent(stats:EventStatistics,m:Metrics,dt:number,extraDemand:number,realDt=dt) {
  stats.duration+=dt;stats.durationSeconds=(stats.durationSeconds??0)+realDt;stats.standardRequests+=m.standardDemand*dt*60;stats.aiRequests+=m.aiDemand*dt*60
  stats.served+=m.served*dt*60;stats.dropped+=m.dropped*dt*60;stats.gross+=m.gross*dt;stats.expenses+=m.expenses*dt
  stats.potentialGross+=(m.standardDemand*m.standardPrice+m.aiDemand*m.aiPrice)*dt*60;stats.extraRequests+=Math.max(0,extraDemand)*dt*60
  for(const stage of STAGES) stats.missedByStage[stage]+=m.missedRevenue[stage]*dt
}
export const equipmentMetric = (id:EquipmentId,m:Metrics) => id==='cpu'?m.compute:id==='ssd'?m.storage:id==='ai'?m.aiCapacity:m[id]
export function impactRows(impact:PurchaseImpact) {
  const rows: {label:string;unit:string;before:number;after:number}[]=[]
  for(const id of ['cpu','memory','ssd','network','cloud','ai'] as EquipmentId[]){
    const before=equipmentMetric(id,impact.before),after=equipmentMetric(id,impact.after)
    if(Math.abs(after-before)>.000001)rows.push({label:id==='ssd'?'Storage':id==='cpu'?'CPU':id==='ai'?'AI':id[0].toUpperCase()+id.slice(1),unit:EQUIPMENT_UNITS[id],before,after})
  }
  if(Math.abs(impact.after.expenses-impact.before.expenses)>.000001)rows.push({label:'Operating cost',unit:'$/minute',before:impact.before.expenses,after:impact.after.expenses})
  return rows
}
export function impactSummary(impact:PurchaseImpact) {
  const served=impact.after.served-impact.before.served, net=impact.after.net-impact.before.net
  if(Math.abs(served)<.000001&&Math.abs(net)<.000001)return impact.after.bottleneck==='healthy'?'More headroom; current demand is already served.':`More headroom; ${STAGE_NAMES[impact.after.bottleneck]} is still the limiting stage.`
  return `${served>=0?'+':''}${served.toFixed(2)} requests served/second · ${net>=0?'+':'−'}$${Math.abs(net).toFixed(2)}/minute net, at current demand.`
}
export const isTechnology = (id:string):id is UpgradeId => ['virtualization','server2','load_balancer','backup','security','cache','cloud','autoscaling','ai'].includes(id)
