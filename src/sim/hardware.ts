import type { EquipmentId, GameState, Hardware } from './types'
export const STANDARD_PRICE = .004
export const AI_PRICE = .012
export const WORKLOAD = { instructions:120_000_000, memoryMiB:256, residenceSeconds:.25, operations:3, ioMiB:.125, networkKiB:256, writeFraction:.2, writeKiB:4, aiInstructions:240_000_000, aiMemoryMiB:512, aiOperations:5, aiIoMiB:.25, aiNetworkKiB:512, gpuSeconds:.05, modelVRAMGiB:8 }
export const MAX_LEVELS:Record<EquipmentId,number>={cpu:6,memory:6,ssd:6,network:6,cloud:7,ai:3}
const at=(values:number[],level:number)=>values[Math.min(values.length-1,Math.max(0,Math.floor(level)))]
export function getHardware(s:GameState):Hardware {
  const l=s.equipmentLevels,servers=s.fleet?.servers??(s.upgrades.includes('server2')?2:1),groups=s.fleet?.storageGroups??1,links=s.fleet?.networkLinks??1
  const unitStorageGiB=at([256,512,1024,2048,4096,8192,16384],l.ssd),unitStorageIOPS=at([150,3000,6000,12000,24000,48000,80000],l.ssd),unitStorageMiBs=at([100,125,250,500,1000,2000,4000],l.ssd),unitNetworkMbps=at([100,250,500,1000,2500,5000,10000],l.network)
  return {cpuCores:at([2,4,8,16,32,48,64],l.cpu),cpuGHz:at([2.4,2.4,2.8,3,3.2,3.4,3.6],l.cpu),instructionsPerCycle:1,ramGiB:at([4,8,16,32,64,128,256],l.memory),reservedRamGiB:1,storageGiB:unitStorageGiB*groups,storageUsedGiB:s.storageUsedGiB,storageIOPS:unitStorageIOPS*groups,storageMiBs:unitStorageMiBs*groups,networkMbps:unitNetworkMbps*links,gpuCount:s.rentalsEnabled&&s.upgrades.includes('ai')?s.aiProvisioned:0,gpuVRAMGiB:16,serverCount:servers,cloudInstances:s.rentalsEnabled&&s.upgrades.includes('cloud')?s.cloudProvisioned:0,cloudInstanceCores:4,cloudInstanceRamGiB:8,storageGroupCount:groups,networkLinkCount:links,unitStorageGiB,unitStorageIOPS,unitStorageMiBs,unitNetworkMbps}
}
export function levelDemand(level:number){return 45*(1+.07*(Math.max(1,level)-1))}
export function quotaForLevel(level:number){return levelDemand(level)*60*25}
export function workloadMix(s:GameState){
 const level=Math.max(1,(s.companyLevel??1)-(s.workloadOffset??0))
 return {cpuHeavy:level<10?0:Math.min(.25,.05*(1+Math.floor((level-10)/5))),dataHeavy:level<15?0:Math.min(.25,.05*(1+Math.floor((level-15)/5))),ai:s.upgrades.includes('ai')&&s.aiLaunchLevel!==null?Math.min(.2,Math.max(0,s.companyLevel-s.aiLaunchLevel)*.02):0}
}

const fmt=(n:number)=>n.toLocaleString(undefined,{maximumFractionDigits:2})
export function hardwareSummary(id:string,s:GameState):string {
  const h=getHardware(s)
  const values:Record<string,string>={cpu:`${h.cpuCores} cores × ${h.cpuGHz} GHz`,memory:`${h.ramGiB} GiB RAM / server`,ssd:`${fmt(h.storageUsedGiB)} / ${fmt(h.storageGiB)} GiB · ${fmt(h.storageIOPS)} IOPS · ${fmt(h.storageMiBs)} MiB/s`,network:h.networkMbps>=1000?`${fmt(h.networkMbps/1000)} Gbps uplink`:`${h.networkMbps} Mbps uplink`,cloud:`${h.cloudInstances} rented VMs · 4 vCPU / 8 GiB each`,ai:`${h.gpuCount} rented GPUs · 16 GiB VRAM each`}
  return values[id]??'Service capability'
}
export function getHardwareExplanation(id:string,s:GameState):string {
  const h=getHardware(s)
  const text:Record<string,string>={cpu:`${h.cpuGHz} GHz means ${h.cpuGHz} billion clock cycles per second per core, not the same number of operations. Our workload assumes 1 instruction per cycle and 120 million instructions per standard request: ${h.cpuCores} × ${h.cpuGHz} billion ÷ 120 million ≈ ${fmt(h.cpuCores*h.cpuGHz*1e9/WORKLOAD.instructions)} requests/second before overhead. Real performance depends on architecture, instructions, and workload.`,memory:`RAM is working space, not a request rate. Each server reserves 1 GiB for its OS. A standard request holds 256 MiB for an assumed 0.25 seconds; available memory therefore bounds concurrent work. AI requests hold 512 MiB.`,ssd:`Capacity stores the dataset; IOPS counts individual reads/writes and MiB/s measures bytes transferred. Standard requests average 3 operations and 128 KiB of I/O; 20% write 4 KiB of persistent data. Full storage rejects writes, while reads and cached responses continue. This is shared data storage, so more application servers do not multiply its capacity.`,network:`Bandwidth measures bits per second. Standard requests transfer an assumed 256 KiB round trip, AI requests 512 KiB. Divide bits/second by bytes/request × 8 to estimate request capacity. A load balancer cannot upgrade this uplink.`,cloud:`These are rented virtual machines, each with 4 vCPUs at a modeled 2.8 GHz and 8 GiB RAM. They share the same data service and ingress limits. Provisioned machines cost money even while idle. Additional capacity takes 2 minutes to start. Prices are fictional game prices.`,ai:`Each rented GPU has 16 GiB VRAM; the assumed inference model needs 8 GiB and 0.05 GPU-seconds per request, giving an upper bound of 20 inferences/second per GPU. AI requests also require CPU, RAM, storage, and network resources. This is a workload estimate, not a universal GPU benchmark.`}
  return text[id]??'Inspect the service topology to see how this capability changes routing and reliability.'
}
export function getMilestone(s:GameState){
  const has=(id:string)=>s.upgrades.includes(id as never)
  const eras=['workshop','rooftop','datacenter','ai'] as const
  const era=has('ai')?'ai':has('cloud')&&has('autoscaling')?'datacenter':has('server2')&&has('load_balancer')?'rooftop':'workshop'
  const goals=[{id:'rooftop',title:'Build a resilient rooftop facility',ids:['server2','load_balancer'],requirements:['Install a second server','Connect a load balancer'],next:'Rooftop facility'},{id:'datacenter',title:'Open cloud operations',ids:['cloud','autoscaling'],requirements:['Provision cloud instances','Enable autoscaling'],next:'Data-center operations room'},{id:'ai',title:'Launch intelligent services',ids:['ai'],requirements:['Deploy the AI inference pool'],next:'AI service district'}]
  const goal=goals.find(g=>!g.ids.every(has))
  if(goal)return {...goal,era:eras[eras.indexOf(era)],requirements:goal.requirements.map((r,i)=>(has(goal.ids[i])?'✓ ':'○ ')+r),progress:goal.ids.filter(has).length/goal.ids.length}
  return {id:'launch',title:s.completed?'Launch complete · keep growing':'Prove your architecture on Launch Day',requirements:[s.completed?'✓ Launch Day passed':'○ Serve 90% of launch traffic'],progress:s.completed?1:0,era,next:'Endless lab'}
}
