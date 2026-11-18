import type {EquipmentId,GameState,Hardware,UpgradeId} from './sim/types'
import {getHardwareExplanation} from './sim/engine'
import {UPGRADES} from './sim/upgrades'
export type SceneView='Workshop'|'Server Interior'|'Service Flow'
export type ComponentInfo={id:string;name:string;brief:string;view:SceneView;focus?:string}
export const EQUIPMENT_IDS:EquipmentId[]=['cpu','memory','ssd','network','cloud','ai']
export const COMPONENTS:Record<string,ComponentInfo>={
 autoscaling:{id:'autoscaling',name:'Autoscaling',brief:'Matches rented capacity to admitted traffic.',view:'Service Flow'},
 cpu:{id:'cpu',name:'CPU',brief:'Processes the work behind customer requests.',view:'Server Interior'},
 memory:{id:'memory',name:'Memory',brief:'Keeps active work ready while the server processes it.',view:'Server Interior'},
 ssd:{id:'ssd',name:'Storage (SSD)',brief:'Stores customer data and supplies it when requests need it.',view:'Server Interior'},
 network:{id:'network',name:'Network',brief:'Connects your servers to customers. More bandwidth carries more traffic.',view:'Server Interior'},
 cloud:{id:'cloud',name:'Cloud capacity',brief:'Rents extra application servers when your own machines need help.',view:'Service Flow'},
 ai:{id:'ai',name:'AI capacity',brief:'Rents GPUs to run your AI service.',view:'Service Flow'},
 virtualization:{id:'virtualization',name:'Virtualization',brief:'Runs isolated virtual machines on your existing hardware.',view:'Server Interior',focus:'motherboard'},
 server2:{id:'server2',name:'Second Server',brief:'Adds another physical machine to share the work.',view:'Workshop'},
 load_balancer:{id:'load_balancer',name:'Load Balancer',brief:'Sends requests to healthy servers and spreads the workload.',view:'Service Flow'},
 backup:{id:'backup',name:'Backup & Recovery',brief:'Keeps recovery copies so you can restore service sooner.',view:'Workshop'},
 security:{id:'security',name:'Firewall & IAM',brief:'Filters unwanted traffic and controls access to your systems.',view:'Workshop'},
 cache:{id:'cache',name:'Edge Cache',brief:'Answers repeated reads without asking your servers to do the work again.',view:'Service Flow'},
 motherboard:{id:'motherboard',name:'Motherboard',brief:'Connects the processor, memory, drives, and network card.',view:'Server Interior'},
 power:{id:'power',name:'Power supply',brief:'Supplies electricity to the server’s components.',view:'Server Interior'},
 cooling:{id:'cooling',name:'Cooling',brief:'Carries heat away so the hardware can run reliably.',view:'Server Interior'},
 server:{id:'server',name:'Server 01',brief:'A complete physical computer with CPU, memory, storage, and networking.',view:'Server Interior'},
 customers:{id:'customers',name:'Customers',brief:'Send requests to your service. Completed responses earn revenue.',view:'Service Flow'},
 response:{id:'response',name:'Completed responses',brief:'Successful responses return to customers and earn revenue.',view:'Service Flow'},
 rejected:{id:'rejected',name:'Rejected work',brief:'Requests your infrastructure cannot handle earn no revenue.',view:'Service Flow'},
}
export function componentId(id:string){return ({gateway:'network',storage:'ssd',psu:'power'} as Record<string,string>)[id]??id}
export const n=(v:number)=>v.toLocaleString(undefined,{maximumFractionDigits:1})
export const money=(v:number,decimals=2)=>(v<0?'−$':'$')+Math.abs(v).toLocaleString(undefined,{minimumFractionDigits:decimals,maximumFractionDigits:decimals})
export function primarySpec(id:string,h:Hardware){
 switch(id){case'cpu':return `${h.cpuCores} cores × ${h.cpuGHz} GHz`;case'memory':return `${h.ramGiB} GiB RAM`;case'ssd':return `${n(h.storageGiB)} GiB · ${new Intl.NumberFormat(undefined,{notation:'compact',maximumFractionDigits:0}).format(h.storageIOPS)} IOPS`;case'network':return h.networkMbps>=1000?`${n(h.networkMbps/1000)} Gbps`:`${n(h.networkMbps)} Mbps`;case'cloud':return `${h.cloudInstances} VMs online`;case'ai':return `${h.gpuCount} GPUs online`;default:return 'Online'}
}
export function componentStats(id:string,h:Hardware):[string,string][]{
 if(id==='ssd')return [['Stored',`${n(h.storageUsedGiB)} / ${n(h.storageGiB)} GiB`],['Access speed',`${n(h.storageIOPS)} IOPS`],['Transfer',`${n(h.storageMiBs)} MiB/s`]]
 if(id==='cloud')return [['Online',`${h.cloudInstances} rented VMs`],['Each VM',`${h.cloudInstanceCores} vCPU · ${h.cloudInstanceRamGiB} GiB`]]
 if(id==='ai')return [['Online',`${h.gpuCount} rented GPUs`],['VRAM per GPU',`${h.gpuVRAMGiB} GiB`]]
 if(id==='cpu')return [['Cores',`${h.cpuCores}`],['Clock per core',`${h.cpuGHz} GHz`]]
 if(id==='memory')return [['Working memory',`${h.ramGiB} GiB`]]
 if(id==='network')return [['Bandwidth',primarySpec(id,h)]]
 return []
}
export function learnPages(id:string,s:GameState):string[]{
 const text=EQUIPMENT_IDS.includes(id as EquipmentId)?getHardwareExplanation(id,s):UPGRADES.find(u=>u.id===id)?.lesson??COMPONENTS[id]?.brief??'Select a component to learn what it does.'
 const pages:string[]=[];let page=''
 for(const word of text.split(' ')){if((page+' '+word).length>230){pages.push(page);page=word}else page+=(page?' ':'')+word}if(page)pages.push(page)
 return pages
}
export function prerequisiteName(id:UpgradeId){return COMPONENTS[id]?.name??id}
