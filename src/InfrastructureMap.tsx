import type {KeyboardEvent} from 'react'
import type {GameState} from './sim/types'
import {diagnostics} from './sim/diagnostics'
import {getHardware} from './sim/engine'
import {useSceneCamera} from './useSceneCamera'
type Props={state:GameState;selected:string;setSelected:(id:string)=>void;highlight?:string;beginner?:boolean;focus?:string;focusKey?:number;compact?:boolean}
const n=(v:number)=>v.toLocaleString(undefined,{notation:v>=10000?'compact':'standard',maximumFractionDigits:1})
export default function InfrastructureMap({state,selected,setSelected,focus,focusKey,compact=false,highlight}:Props){
 const {svgRef,viewBox}=useSceneCamera(1120,590,focus,compact,focusKey)
 const canonical=(id:string)=>id==='gateway'?'network':id==='storage'?'ssd':id
 const mapped=(id:string)=>['cpu','memory','virtualization','server2'].includes(id)?'server':id==='security'?'network':canonical(id)
 const picked=mapped(highlight??selected)
 const m=state.metrics,h=getHardware(state),has=(id:string)=>state.upgrades.includes(id as never)
 const node=(id:string,x:number,y:number,title:string,value:string,enabled=true,w=150)=>{
  id=canonical(id)
  const diagnostic=diagnostics(state).find(d=>d.id===id);if(diagnostic)value=String(Math.round(diagnostic.utilization*100))+'% · '+(diagnostic.status==='bottleneck'?'CONSTRAINT':diagnostic.status)
  const key=(e:KeyboardEvent<SVGGElement>)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(id)}}
  const warn=(id==='network'&&m.bottleneck==='network')||(id==='server'&&['compute','memory'].includes(m.bottleneck))||(id==='ssd'&&m.bottleneck==='storage')||(id==='ai'&&m.bottleneck==='ai')
  return <g data-component-id={id} transform={`translate(${x} ${y})`} className={`service-node ${enabled?'':'inactive'} ${warn?'warning':''} ${picked===id?'selected':''}`} role="button" tabIndex={0} aria-label={`Inspect ${title}`} aria-pressed={picked===id} onClick={()=>setSelected(id)} onKeyDown={key}>{(id==='server'?['cpu','memory','virtualization','server2']:id==='network'?['gateway','security']:id==='ssd'?['storage']:[]).map(alias=><rect key={alias} data-component-id={alias} width={w} height="82" fill="transparent" pointerEvents="none"/>)}<rect x="4" y="5" width={w} height="82" fill="#07101d"/><rect width={w} height="82" className="service-node-body"/><path d={`M9 12h${w-18}M9 67h${w-18}`} stroke="currentColor" strokeOpacity=".3"/><text x="12" y="34" className="service-node-name">{title}</text><text x="12" y="55" className="service-node-value">{value}</text><rect x={w-17} y="9" width="5" height="5" fill="currentColor"/></g>
 }
 const path=(d:string,active:boolean,tone='request')=><path d={d} className={`service-route ${tone} ${active?'route-active':''}`} markerEnd={`url(#arrow-${tone})`}/>
 return <section className={`service-map ${state.paused?'scene-paused':''}`} aria-label="Service flow" style={compact?{height:'100%',width:'100%',minHeight:0,overflow:'hidden'}:undefined}>
 <svg ref={svgRef} viewBox={viewBox} preserveAspectRatio="xMidYMid meet" className="service-svg" role="group" aria-label="Sampled traffic through network, application, shared storage and responses" shapeRendering="crispEdges" style={compact?{width:'100%',height:'100%',minHeight:0}:undefined}>
 <defs>{['request','response','ai','rejected'].map(t=><marker key={t} id={`arrow-${t}`} markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0 0 6 3 0 6Z" fill={t==='response'?'#a4f7b3':t==='ai'?'#e99be8':t==='rejected'?'#fa9c9c':'#5bdddc'}/></marker>)}</defs>
 {path('M925 59V24H96V230',m.served>0,'response')}<text x="240" y="43" className="route-note response">RESPONSES RETURN TO CUSTOMERS</text>{path('M171 272H210',m.demand>0)}{path('M360 272H410',m.demand>0)}
 {path('M285 230V100H410',m.cacheHits>0)}{path('M560 100H850',m.cacheHits>0,'response')}
 {path('M560 272H590V212H625',m.served-m.cacheHits>0)}
 {path('M560 272H590V390H625',h.cloudInstances>0&&m.cloudUsed>0)}
 {path('M785 212H815V260H850',m.served-m.cacheHits>0)}{path('M785 390H815V291H850',h.cloudInstances>0&&m.cloudUsed>0)}
 {path('M925 230V141',m.routes.origin>0,'response')}
 {path('M925 312V445',m.aiServed>0,'ai')}{path('M1000 486H1060V100H1000',m.aiServed>0,'ai')}
 {path('M285 313V445',m.losses.network>0,'rejected')}{path('M625 253H603V424H285V445',m.dropped-m.losses.network>0,'rejected')}
 <text x="36" y="206" className="route-note">ARRIVE</text><text x="579" y="85" className="route-note response">CACHE HIT / RETURN</text><text x="589" y="321" className="route-note">APP ROUTES</text><text x="936" y="373" className="route-note">AI ONLY</text><text x="361" y="447" className="route-note">REJECTIONS FROM CAPACITY LIMITS</text>{!compact&&<text x="46" y="562" className="route-note">Each moving segment represents sampled traffic, not one request.</text>}
 {node('customers',21,230,'CUSTOMERS',`${n(m.demand)} requests/s`)}{node('network',210,230,'NETWORK',has('security')?'Protected uplink':'Customer uplink')}
 {node('cache',410,59,'EDGE CACHE',`${n(m.cacheHits)} hits/s`,has('cache'))}{node('load_balancer',410,230,has('load_balancer')?'BALANCER':'DIRECT ROUTE',has('load_balancer')?'Healthy targets':'One server')}
 {node('server',625,171,'APPLICATION',`${n(h.serverCount)} physical servers`,true,160)}{node('cloud',625,349,'CLOUD APP',state.provisioning.remaining>0&&state.provisioning.target>h.cloudInstances?'Starting…':`${n(h.cloudInstances)} rented VMs`,has('cloud'),160)}
 {node('ssd',850,230,'STORAGE (SSD)',`${n(h.storageIOPS)} IOPS`)}{node('ai',850,445,'AI / GPU',state.provisioning.remaining>0&&state.provisioning.gpuTarget>h.gpuCount?'Starting…':`${n(m.aiServed)} responses/s`,has('ai'))}{node('response',850,59,'RESPONSES',`${n(m.served)} completed/s`)}{node('rejected',210,445,'REJECTED',`${n(m.dropped)} requests/s`,m.dropped>0)}
 </svg></section>
}
