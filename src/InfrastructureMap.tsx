import type {KeyboardEvent} from 'react'
import type {GameState} from './sim/types'
import {getHardware,hardwareSummary} from './sim/engine'
import {STAGE_NAMES} from './sim/feedback'
type Props={state:GameState;selected:string;setSelected:(id:string)=>void;highlight?:string;beginner?:boolean}
const n=(v:number)=>v.toLocaleString(undefined,{maximumFractionDigits:1})
export default function InfrastructureMap({state,selected,setSelected}:Props){
 const m=state.metrics,h=getHardware(state),has=(id:string)=>state.upgrades.includes(id as never)
 const details:Record<string,[string,string]>={
  customers:['Customer demand',`${n(m.demand)} requests/second arrive. Completed standard service earns $4 per 1,000 responses; AI earns $12. These are fictional game prices.`],
  gateway:['Network + access',`${hardwareSummary('network',state)}. All traffic uses ingress and response bandwidth. ${has('security')?'Firewall rules filter unwanted traffic. IAM separately controls who may access resources.':'Firewall and IAM protection can be added in Technology.'}`],
  cache:['Edge cache',`${n(m.cacheHits)} requests/second are answered here. 35% of eligible standard reads can reuse a cached response. Writes and AI requests still need the application and data service.`],
  load_balancer:['Traffic distribution',`${has('load_balancer')?'The load balancer distributes traffic to healthy application servers.':'The starting gateway routes directly to Server 01; load balancing is not installed.'} This changes routing and availability, not physical bandwidth.`],
  server:['Application servers',`Application CPU and working RAM process both standard and AI requests. ${h.serverCount} physical server${h.serverCount===1?'':'s'} installed. Select the server in Workshop to inspect its internal components.`],
  cloud:['Rented application instances',`${h.cloudInstances} VMs online, each with 4 vCPUs and 8 GiB RAM. They share the ingress and data tier. New capacity takes 2 minutes to start and incurs ongoing costs once running.`],
  storage:['Shared data service',`${n(h.storageUsedGiB)} / ${n(h.storageGiB)} GiB stored. ${n(h.storageIOPS)} IOPS and ${n(h.storageMiBs)} MiB/s limit reads and writes. Both local and cloud application servers use this logical data tier; adding compute cannot bypass it.`],
  ai:['AI inference pool',`${h.gpuCount} rented GPUs with 16 GiB VRAM each. AI requests first require application CPU, RAM and data access, then GPU inference. ${n(m.aiServed)} AI responses/second complete.`],
  response:['Completed responses',`${n(m.served)} successful responses/second return to customers. Only completed service credits customer revenue: $${m.gross.toFixed(2)}/minute. This terminal acknowledges service; money is not a network packet.`],
  rejected:['Rejected work',`${n(m.dropped)} requests/second cannot complete with the present resources. ${m.bottleneck==='healthy'?'Current demand is served.':STAGE_NAMES[m.bottleneck]+' is the main constraint.'} This simplified model rejects excess work immediately; it has no hidden queue or offline backlog.`],
 }
 const detail=details[selected]??details.server
 const node=(id:string,x:number,y:number,title:string,value:string,enabled=true,w=150)=>{
  const key=(e:KeyboardEvent<SVGGElement>)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(id)}}
  const warn=(id==='gateway'&&m.bottleneck==='network')||(id==='server'&&['compute','memory'].includes(m.bottleneck))||(id==='storage'&&m.bottleneck==='storage')||(id==='ai'&&m.bottleneck==='ai')
  return <g transform={`translate(${x} ${y})`} className={`service-node ${enabled?'':'inactive'} ${warn?'warning':''} ${selected===id?'selected':''}`} role="button" tabIndex={0} aria-label={`Inspect ${title}`} aria-pressed={selected===id} onClick={()=>setSelected(id)} onKeyDown={key}><rect x="4" y="5" width={w} height="82" fill="#07101d"/><rect width={w} height="82" className="service-node-body"/><path d={`M9 12h${w-18}M9 67h${w-18}`} stroke="currentColor" strokeOpacity=".3"/><text x="12" y="34" className="service-node-name">{title}</text><text x="12" y="55" className="service-node-value">{value}</text><rect x={w-17} y="9" width="5" height="5" fill="currentColor"/></g>
 }
 const path=(d:string,active:boolean,tone='request')=><path d={d} className={`service-route ${tone} ${active?'route-active':''}`} markerEnd={`url(#arrow-${tone})`}/>
 return <section className={`service-map ${state.paused?'scene-paused':''}`} aria-label="Infrastructure map"><header className="inspection-heading"><div><span className="eyebrow">SERVICE LAYER / LIVE TOPOLOGY</span><h2>Follow the request</h2></div><span>{state.paused?'PAUSED':`${n(m.served)} responses/s`}</span></header>
 <svg viewBox="0 0 1120 590" className="service-svg" aria-label="Sampled traffic through network, application, shared storage and responses" shapeRendering="crispEdges">
 <defs>{['request','response','ai','rejected'].map(t=><marker key={t} id={`arrow-${t}`} markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0 0 6 3 0 6Z" fill={t==='response'?'#a4f7b3':t==='ai'?'#e99be8':t==='rejected'?'#fa9c9c':'#5bdddc'}/></marker>)}</defs>
 {path('M925 59V24H96V230',m.served>0,'response')}<text x="240" y="43" className="route-note response">RESPONSES RETURN TO CUSTOMERS</text>{path('M171 272H210',m.demand>0)}{path('M360 272H410',m.demand>0)}
 {path('M285 230V100H410',m.cacheHits>0)}{path('M560 100H850',m.cacheHits>0,'response')}
 {path('M560 272H590V212H625',m.served-m.cacheHits>0)}
 {path('M560 272H590V390H625',h.cloudInstances>0&&m.cloudUsed>0)}
 {path('M785 212H815V260H850',m.served-m.cacheHits>0)}{path('M785 390H815V291H850',h.cloudInstances>0&&m.cloudUsed>0)}
 {path('M925 230V141',m.routes.origin>0,'response')}
 {path('M925 312V445',m.aiServed>0,'ai')}{path('M1000 486H1060V100H1000',m.aiServed>0,'ai')}
 {path('M285 313V445',m.losses.network>0,'rejected')}{path('M625 253H603V424H285V445',m.dropped-m.losses.network>0,'rejected')}
 <text x="36" y="206" className="route-note">ARRIVE</text><text x="579" y="85" className="route-note response">CACHE HIT / RETURN</text><text x="589" y="321" className="route-note">APP ROUTES</text><text x="936" y="373" className="route-note">AI ONLY</text><text x="361" y="447" className="route-note">REJECTIONS FROM CAPACITY LIMITS</text><text x="46" y="562" className="route-note">Each moving segment represents sampled traffic, not one request.</text>
 {node('customers',21,230,'CUSTOMERS',`${n(m.demand)} requests/s`)}{node('gateway',210,230,'NETWORK',has('security')?'Firewall + IAM':'Gateway / uplink')}
 {node('cache',410,59,'EDGE CACHE',`${n(m.cacheHits)} hits/s`,has('cache'))}{node('load_balancer',410,230,has('load_balancer')?'BALANCER':'DIRECT ROUTE',has('load_balancer')?'Healthy targets':'One server')}
 {node('server',625,171,'APPLICATION',`${h.serverCount} physical servers`,true,160)}{node('cloud',625,349,'CLOUD APP',`${h.cloudInstances} rented VMs`,has('cloud'),160)}
 {node('storage',850,230,'SHARED DATA',`${n(h.storageIOPS)} IOPS`)}{node('ai',850,445,'AI / GPU',`${n(m.aiServed)} responses/s`,has('ai'))}{node('response',850,59,'RESPONSES',`${n(m.served)} completed/s`)}{node('rejected',210,445,'REJECTED',`${n(m.dropped)} requests/s`,m.dropped>0)}
 </svg><div className="service-legend"><span>◼ Requests</span><span>◼ Completed responses</span><span>◼ GPU branch</span><span>◼ Rejected work</span></div>
 <div className="component-inspector" aria-live="polite"><div><span className="eyebrow">SELECT A COMPONENT OR ROUTE</span><h3>{detail[0]}</h3></div><strong>{n(m.served)} served/s · {n(m.dropped)} rejected/s</strong><p>{detail[1]}</p><small>Capacity estimates use explicit workload assumptions. Links show service relationships; the workshop shows physical components.</small></div></section>
}
