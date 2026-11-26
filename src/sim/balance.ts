import type {BalanceConfig,EquipmentId,GameState} from './types'
// Qualified through 10,000 levels: benchmarks/results/revised-deep.json.
export const ACTIVE_BALANCE:BalanceConfig|null={hardware:2,fleet:16,coefficient:.2,maintenance:.1,rentalLimits:true}
export const balanceGrid:BalanceConfig[]=[]
for(const hardware of [2,4] as const)for(const fleet of [8,16,32] as const)for(const coefficient of [.1,.2,.3] as const)for(const maintenance of [.05,.1] as const)balanceGrid.push({hardware,fleet,coefficient,maintenance})
export const affectedUnits=(s:GameState,id:EquipmentId)=>id==='cpu'||id==='memory'?s.fleet.servers:id==='ssd'?s.fleet.storageGroups:id==='network'?s.fleet.networkLinks:1
export const rentalRates=(s:GameState)=>({cloud:s.balance?5.32:.65,ai:s.balance?3.6:1.2})
/** A configured scaling-group ceiling, not a physical limit of a cloud provider. */
export const rentalLimit=(s:GameState,id:'cloud'|'ai')=>s.balance?.rentalLimits?Math.max(1+s.equipmentLevels[id],s.legacyTerms?.[id]??0):Infinity
export const checkpointSum=(start:number,end:number,capped:boolean)=>{
 if(!capped)return (end-start)*100+25*(end*(end+1)-start*(start+1))
 const low=Math.min(end,18),from=Math.min(start,18)
 return (low-from)*100+25*(low*(low+1)-from*(from+1))+Math.max(0,end-Math.max(start,18))*1000
}
export function checkpointReward(s:GameState){const start=Math.floor(s.claimedCheckpointLevel/5),end=Math.floor((s.companyLevel-1)/5),legacy=Math.min(end,s.legacyTerms?.checkpointEnd??start);return checkpointSum(start,Math.max(start,legacy),false)+checkpointSum(Math.max(start,legacy),end,!!s.balance)}
export const validBalance=(b:unknown):b is BalanceConfig|null=>b===null||!!b&&typeof b==='object'&&[2,4].includes((b as BalanceConfig).hardware)&&[8,16,32].includes((b as BalanceConfig).fleet)&&[.1,.2,.3].includes((b as BalanceConfig).coefficient)&&[.05,.1].includes((b as BalanceConfig).maintenance)&&((b as BalanceConfig).rentalLimits===undefined||(b as BalanceConfig).rentalLimits===true)
