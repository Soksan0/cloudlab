import type { KeyboardEvent, ReactNode } from 'react'
import type { GameState, UpgradeId } from './sim/types'
import { getEffectiveUpgrades } from './sim/engine'

type Props = { state: GameState; selected: string; setSelected: (id: string) => void; flow: boolean; pulse?: string; beginner?: boolean; highlight?: string; earningPulse?:boolean; presentationPaused?:boolean }

function Selectable({id,label,x,y,w=130,h=40,selected,setSelected,locked=false,pulse,children}:{id:string;label:string;x:number;y:number;w?:number;h?:number;selected:string;setSelected:(id:string)=>void;locked?:boolean;pulse?:string;children:ReactNode}) {
  const key=(e:KeyboardEvent<SVGGElement>)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(id)}}
  return <g className={`machine ${selected===id?'machine-selected':''} ${locked?'machine-locked':''} ${pulse===id?'machine-pulse':''}`} transform={`translate(${x} ${y})`} role="button" aria-label={`Select ${label}`} aria-pressed={selected===id} tabIndex={0} onClick={()=>setSelected(id)} onKeyDown={key}>
    <title>{label}{locked?' · not installed':' · select to inspect or upgrade'}</title>{children}<g className="machine-tag" transform="translate(0 -29)"><rect width={w} height="24"/><text x="8" y="17">{label.toUpperCase()}</text></g><rect className="machine-hit" x="-4" y="-32" width={w+8} height={h+36} fill="transparent"/>
  </g>
}
function Rack({x=0,y=0,w=130,h=210,rows=6,tone='#5ef0d1'}:{x?:number;y?:number;w?:number;h?:number;rows?:number;tone?:string}){
 return <g transform={`translate(${x} ${y})`}><path d={`M0 0h${w}v${h}H0Z`} fill="#121627" stroke="#526179" strokeWidth="4"/><path d={`M${w} 0l12-10v${h}l-12 10Z`} fill="#080d19" stroke="#2b344e" strokeWidth="2"/><rect x="8" y="9" width={w-16} height={h-20} fill="#080e1c"/>{Array.from({length:rows},(_,i)=><g key={i} transform={`translate(14 ${17+i*(h-32)/rows})`}><rect width={w-28} height={(h-32)/rows-7} fill="#243147" stroke="#3b4b63"/><path d={`M8 7h${w-67}m-${w-67} 6h${w-67}`} stroke="#101928" strokeWidth="3"/>{[0,1,2].map(n=><rect key={n} x={w-51+n*7} y="7" width="3" height="3" fill={tone} className="equipment-led" style={{animationDelay:`${i*.2+n*.3}s`}}/>)}</g>)}<path d={`M10 ${h}v9m${w-20}-9v9`} stroke="#070c18" strokeWidth="9"/></g>
}
function Building({x,y,w,h,i}:{x:number;y:number;w:number;h:number;i:number}){
 return <g><rect x={x} y={y} width={w} height={h} fill={['#17283b','#172035','#25223c','#122638'][i%4]} stroke="#33485d" strokeWidth="2"/><rect x={x+5} y={y+6} width={w-10} height={h-6} fill="url(#city-windows)"/><path d={`M${x-3} ${y}h${w+6}M${x+8} ${y-4}v-8h${w/3}v8`} stroke="#4f586f" strokeWidth="3" fill="none"/>{Array.from({length:Math.floor(h/54)},(_,n)=><path key={n} d={`M${x} ${y+36+n*54}h${w}`} stroke="#081729" strokeWidth="5"/>)}</g>
}
function Neon({x,y,w,text,color='#ff71b8',vertical=false}:{x:number;y:number;w:number;text:string;color?:string;vertical?:boolean}){
 const h=vertical?text.length*24+20:44
 return <g transform={`translate(${x} ${y})`} className="neon-sign" style={{color}}><path d={`M-12 9H0m-12 ${h-18}H0`} stroke="#60708a" strokeWidth="5"/><rect width={w} height={h} fill="#161c32" stroke="#4e3658" strokeWidth="4"/><rect x="5" y="5" width={w-10} height={h-10} fill="none" stroke={color} strokeWidth="2" className="neon-tube"/>{vertical?[...text].map((letter,i)=><text key={i} x={w/2} y={27+i*24} textAnchor="middle" fill={color} className="neon-letters">{letter}</text>):<text x={w/2} y="30" textAnchor="middle" fill={color} className="neon-letters">{text}</text>}</g>
}
export default function Workshop({state,selected,setSelected,flow,pulse,beginner,highlight,earningPulse,presentationPaused}:Props){
 const has=(id:UpgradeId)=>getEffectiveUpgrades(state).includes(id)
 const rooftop=has('server2')&&has('load_balancer'),dc=has('cloud')&&has('autoscaling'),ai=has('ai')
 const era=ai?'ai':dc?'datacenter':rooftop?'rooftop':'workshop'
 const running=!state.paused&&!presentationPaused
 const props=(id:string,label:string,x:number,y:number,w=130,h=40,locked=false)=>({id,label,x,y,w,h,selected,setSelected,locked,pulse})
 const tier=Math.min(5,state.equipmentLevels.cpu+state.equipmentLevels.memory+state.equipmentLevels.ssd)
 return <div className={`workshop-stage era-${era} ${earningPulse?'billing-active':''} ${!running?'scene-paused':''} ${beginner?'beginner-workshop':''}`} data-era={era} aria-label="CloudLab workshop">
  <svg className="workshop-room" viewBox="0 0 1280 720" role="group" aria-label={`${dc?'Data-center operations room':rooftop?'Rooftop server facility':'Street-level server workshop'} overlooking a neon city`} shapeRendering="crispEdges">
   <defs>
    <linearGradient id="city-sky" x2="0" y2="1"><stop stopColor="#0b0e27"/><stop offset=".65" stopColor="#252441"/><stop offset="1" stopColor="#9a4654"/></linearGradient>
    <linearGradient id="room-floor" x2="0" y2="1"><stop stopColor="#393141"/><stop offset="1" stopColor="#111729"/></linearGradient>
    <linearGradient id="window-haze"><stop stopColor="#d145a0" stopOpacity=".16"/><stop offset=".5" stopColor="#45f0d2" stopOpacity=".03"/><stop offset="1" stopColor="#f6b461" stopOpacity=".15"/></linearGradient>
    <pattern id="city-windows" width="21" height="25" patternUnits="userSpaceOnUse"><rect x="5" y="5" width="4" height="8" fill="#5ac9cb" opacity=".75"/><rect x="13" y="5" width="3" height="8" fill="#ed6baa" opacity=".55"/><rect x="5" y="15" width="4" height="4" fill="#f9c579" opacity=".38"/></pattern>
    <pattern id="room-panels" width="160" height="120" patternUnits="userSpaceOnUse"><path d="M0 0h160v120H0Z" fill="#171e32" stroke="#30344c" strokeWidth="3"/><path d="M8 8h144m-144 104h144" stroke="#101529" strokeWidth="2"/><rect x="11" y="12" width="3" height="3" fill="#5c5368"/><rect x="146" y="104" width="3" height="3" fill="#5c5368"/></pattern>
    <clipPath id="city-view"><rect x="40" y="62" width={dc?640:570} height="402"/></clipPath>
    <filter id="neon-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="soft-light" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter>
   </defs>
   <rect width="1280" height="720" fill="url(#room-panels)"/>
   {dc&&<g opacity=".65"><path d="M696 37h584v520H696Z" fill="#102d3a"/><path d="M709 44h556v490H709Z" fill="none" stroke="#326576" strokeWidth="5"/>{[0,1,2,3].map(i=><g key={i} transform={`translate(${705+i*143} 45)`}><rect width="132" height="95" fill="#132032" stroke="#356e7b" strokeWidth="2"/><path d="M10 64 23 44l15 7 20-25 22 11 18-16 23 12" fill="none" stroke="#6bdcc7" strokeWidth="3"/><path d="M10 77h111" stroke="#4f8390" strokeWidth="2"/></g>)}</g>}
   {rooftop&&!dc&&<g><path d="M0 37h690v25H0Z" fill="#293242"/><path d="M12 43h665" stroke="#8a778c" strokeWidth="3"/><path d="M641 58v333m-14-300h32m-38 18h44m-18-34 16-20" stroke="#6d7390" strokeWidth="5"/><rect x="625" y="282" width="42" height="103" fill="#2d3c50" stroke="#647a8d" strokeWidth="3"/><path d="M630 296h30m-30 14h30m-30 14h30m-30 14h30m-30 14h30" stroke="#162639" strokeWidth="5"/></g>}<path d="M0 0h1280v35H0Z" fill="#080f21"/><path d="M0 35h1280" stroke="#3e3951" strokeWidth="5"/>
   <g clipPath="url(#city-view)">
    <rect x="40" y="62" width="650" height="402" fill="url(#city-sky)"/>
    <circle cx="450" cy="126" r="39" fill="#acc9d5" opacity=".7"/><circle cx="464" cy="115" r="37" fill="#20233c"/>
    {Array.from({length:12},(_,i)=><g key={i}><rect x={30+i*55} y={120+(i*29)%95} width={38+(i%3)*10} height="350" fill="#111c32"/><path d={`M${47+i*55} ${116+(i*29)%95}v-28`} stroke="#425677" strokeWidth="2"/><rect x={46+i*55} y={85+(i*29)%95} width="3" height="4" fill="#f373a9" className="equipment-led"/></g>)}
    {[{x:15,y:251,w:78,h:245},{x:106,y:171,w:82,h:320},{x:200,y:295,w:61,h:200},{x:275,y:219,w:106,h:300},{x:396,y:273,w:73,h:240},{x:478,y:144,w:108,h:360},{x:600,y:218,w:75,h:300}].map((b,i)=><Building key={i} {...b} i={i}/>)}
    <g opacity=".5"><path d="M96 250h94M190 337h90M383 278h94" stroke="#91b4b6" strokeWidth="5"/><path d="M107 250v-6h72v6M398 278v-7h59v7" stroke="#4d6578" strokeWidth="2"/></g>
    <Neon x={128} y={213} w={41} text="OPEN" vertical/>
    <Neon x={287} y={269} w={145} text="BYTE BAR" color="#6dffe6"/>
    <Neon x={495} y={164} w={61} text="209" color="#ffcd75"/>
    <path d="M40 416H680M40 426H680" stroke="#152035" strokeWidth="9"/><path d="M40 414H680" stroke="#b66a95" strokeWidth="2"/>
    <g className="city-train"><rect x="65" y="386" width="168" height="25" fill="#3f506b"/><path d="M73 391h149" stroke="#89ffeb" strokeWidth="6"/><path d="M90 386v26m29-26v26m29-26v26m29-26v26m29-26v26" stroke="#152039" strokeWidth="4"/><rect x="227" y="397" width="7" height="4" fill="#ffc884"/></g>
    <g className="city-rain">{Array.from({length:25},(_,i)=><path key={i} d={`M${55+(i*71)%620} ${64+(i*43)%360}l-8 29`} stroke="#abd1eb" strokeOpacity={i%3===0?'.24':'.1'} strokeWidth="2"/>)}</g>
    <g className="sky-traffic"><path d="M356 158h45l16 10h-71Z" fill="#405576"/><path d="M359 164h29" stroke="#ffdc9f" strokeWidth="3"/><rect x="403" y="164" width="8" height="3" fill="#f58fcb"/></g>
    <Neon x={30} y={314} w={80} text="RAMEN" color="#ffb076"/>
    <rect x="43" y="331" width="65" height="112" fill="#ef6b9e" opacity=".08"/>
    <rect x="283" y="311" width="145" height="103" fill="#52eec9" opacity=".07"/>
    <path d="M174 156h25v106h-25Z" fill="#244356"/><path d="M186 165v88m-7-74h14m-14 27h14m-14 27h14" stroke="#51d5d7" strokeWidth="3"/>
    <rect x="40" y="62" width="650" height="402" fill="url(#window-haze)"/>
    <path d="M44 460h625" stroke="#74d8de" strokeOpacity=".3" strokeWidth="9"/>
   </g>
   <rect x="35" y="57" width={dc?650:580} height="412" fill="none" stroke="#080e1c" strokeWidth="14"/><rect x="40" y="62" width={dc?640:570} height="402" fill="none" stroke="#626078" strokeWidth="3"/><path d={`M${dc?360:324} 63v400M40 353h${dc?640:570}`} stroke="#11182a" strokeWidth="10"/><path d="M29 476h666" stroke="#464259" strokeWidth="10"/>
   {rooftop&&<g className="rooftop-details"><path d="M40 424h570" stroke="#7a8496" strokeWidth="5"/><path d="M70 421v-55m50 55v-55m50 55v-55m50 55v-55m50 55v-55m50 55v-55m50 55v-55m50 55v-55m50 55v-55m50 55v-55m50 55v-55" stroke="#45516a" strokeWidth="3"/><path d="M64 368h540" stroke="#7d7c91" strokeWidth="3"/></g>}
   <path d="M0 550h1280v170H0Z" fill="url(#room-floor)"/><path d="M0 556h1280M0 656h1280M0 713h1280" stroke="#080e20" strokeWidth="3"/><path d="m150 550-90 170m230-170-50 170m200-170-20 170m200-170 20 170m170-170 50 170m170-170 90 170" stroke="#4b3e53" strokeWidth="2" opacity=".5"/>
   <path d="M0 583h1280" stroke="#65e6de" strokeOpacity=".08" strokeWidth="16"/>
   <g transform="translate(730 57)"><rect width="360" height="45" fill="#0c1629" stroke="#415168" strokeWidth="3"/><text x="18" y="30" className="room-sign" fill="#80ffe6">CLOUDLAB // 209</text><path d="M8 38h344" stroke="#4ccdbd" strokeWidth="2"/></g>
   <path d="M704 119h520v84M713 132h498v72" stroke="#3e455a" strokeWidth="7" fill="none"/><path d="M704 119h520" stroke="#a18196" strokeWidth="2"/>
   <g><rect x="825" y="17" width="227" height="15" fill="#070d1e"/><rect x="833" y="30" width="210" height="6" fill="#ffd590"/><path d="m845 39-154 515h501L1034 39Z" fill="#ffc17a" opacity=".035"/></g>
   <g transform="translate(66 499)"><rect x="0" y="47" width="560" height="14" fill="#aa7255"/><rect x="0" y="61" width="560" height="16" fill="#50394b"/><path d="M20 77v101m509-101v101" stroke="#121a2a" strokeWidth="17"/><path d="M25 78v91m500-91v91" stroke="#456075" strokeWidth="3"/>
    <rect x="24" y="-66" width="175" height="111" fill="#111a2a" stroke="#52617a" strokeWidth="5"/><rect x="32" y="-58" width="159" height="92" fill="#0b2e3a"/><path d="m41 14 18-22 18 8 24-27 20 12 23-31 17 11 20-22" stroke="#74f9d5" strokeWidth="3" fill="none"/><path d="M41 24h140M42-44h49M42-36h28" stroke="#3b7b83" strokeWidth="2"/><text x="41" y="-22" className="monitor-small">SERVICE / LIVE</text><path d="M110 46v10" stroke="#3c465d" strokeWidth="13"/>
    <rect x="241" y="-43" width="144" height="88" className="billing-terminal" fill="#111c2e" stroke="#5a8b8a" strokeWidth="4"/><rect x="248" y="-36" width="130" height="69" fill="#123333"/><text x="259" y="-18" className="billing-label">RESPONSE / BILLING</text><path d="m260 7 10 10 18-23" stroke="#78f9c9" fill="none" strokeWidth="4"/><text x="323" y="23" className="billing-dollar">$</text><rect x="364" y="37" width="7" height="4" className="billing-led" fill="#72f8cd"/><path d="M310 46v10" stroke="#3b465c" strokeWidth="13"/>
    <path d="M45 67h135m75 0h115" stroke="#201d32" strokeWidth="5"/><rect x="438" y="17" width="24" height="29" fill="#c6b99c"/><path d="M462 23h10v16h-10" stroke="#c6b99c" fill="none" strokeWidth="5"/><text x="443" y="34" className="mug-label">209</text><path d="M443 8v-15m11 14v-17" stroke="#bcb5b8" strokeOpacity=".3" strokeWidth="2"/>
   </g>
   <Selectable {...props('server','Server 01',740,291,150,259)}><Rack w={150} h={259} rows={Math.min(8,4+tier)}/><path d="M22 255h106" stroke="#68f3d3" strokeWidth="2"/></Selectable>
   <Selectable {...props('server2','Server 02',930,312,130,238,!has('server2'))}><Rack h={238} rows={6} tone="#b395ff"/></Selectable>
   <Selectable {...props('ai','GPU Pool',1104,347,112,203,!has('ai'))}><rect width="112" height="203" fill="#17213b" stroke="#a87fbc" strokeWidth="3" strokeDasharray="5 4"/><rect x="9" y="9" width="94" height="179" fill="#102435"/>{[0,1].map(i=><g key={i} transform={`translate(56 ${62+i*73})`}><circle r="28" fill="#2b2545" stroke="#9c70b3" strokeWidth="3"/><g className="cooling-fan"><path d="M-18 0h36M0-18v36m-13-13 26 26m-26 0 26-26" stroke="#bb7fc4" strokeWidth="6"/></g><circle r="7" fill="#e3b0e2"/></g>)}<text x="15" y="26" className="equipment-label">REMOTE VIEW</text><text x="9" y="224" className="equipment-label" fill="#ec98dc">{ai?'RENTED · REMOTE':'FUTURE CAPABILITY'}</text></Selectable>
   <Selectable {...props('network','Network',726,183,150,61)}><rect width="150" height="61" fill="#27374d" stroke="#62788d" strokeWidth="3"/><rect x="9" y="10" width="131" height="30" fill="#101e30"/>{Array.from({length:8},(_,i)=><rect key={i} x={16+i*15} y="18" width="8" height="12" fill="#46bcb0"/>)}<path d="M16 50h117" stroke="#506a7d" strokeWidth="3"/></Selectable>
   <Selectable {...props('security','Firewall / IAM',925,179,156,65,!has('security'))}><rect width="156" height="65" fill="#233248" stroke="#5c6b85" strokeWidth="3"/><path d="M15 13h29v18c0 12-15 19-15 19s-14-7-14-19Z" stroke="#d9b17b" strokeWidth="3" fill="none"/><path d="M59 18h78m-78 13h54m-54 13h72" stroke="#617c8b" strokeWidth="3"/></Selectable>
   <Selectable {...props('cloud','Remote Cloud',1114,182,130,71,!has('cloud'))}><rect width="130" height="71" fill="#27324a" stroke="#6e7198" strokeWidth="3"/><rect x="7" y="7" width="116" height="54" fill="#10273b"/><path d="M25 43h81V27H93V18H73V11H54v10H35v9H25Z" fill="#416f92" stroke="#7dc0d0" strokeWidth="2"/><text x="12" y="88" className="equipment-label">RENTED INSTANCES</text></Selectable>
   <Selectable {...props('load_balancer','Balancer',725,610,152,43,!has('load_balancer'))}><rect width="152" height="43" fill="#25354a" stroke="#60728c" strokeWidth="3"/><path d="M12 21h40l15-11h63M52 21l15 11h63" stroke="#6beed1" strokeWidth="3" fill="none"/></Selectable>
   <Selectable {...props('cache','Edge Cache',920,610,136,43,!has('cache'))}><rect width="136" height="43" fill="#243e48" stroke="#547d83" strokeWidth="3"/><path d="m34 7-15 18h14l-4 12 20-19H35Z" fill="#ffd083"/><path d="M65 13h53m-53 12h43" stroke="#79c4b6" strokeWidth="3"/></Selectable>
   <Selectable {...props('backup','Backups',1100,610,130,43,!has('backup'))}><rect width="130" height="43" fill="#30374c" stroke="#69758b" strokeWidth="3"/><rect x="10" y="9" width="109" height="23" fill="#141d31"/><path d="M18 18h68" stroke="#8992ac" strokeWidth="5"/><rect x="103" y="18" width="6" height="6" fill="#eec382"/></Selectable>
   <g className="room-cables"><path d="M802 244V260H812V280M810 552v22h185V552m-185 22v25M1180 552v33h-173v14" stroke="#091121" strokeWidth="9" fill="none"/><path d="M802 244V260H812V280M810 552v22h185V552" stroke="#497d89" strokeWidth="3" fill="none"/></g>
   {flow&&running&&state.metrics.served>0&&<g className="scene-flow" aria-hidden="true"><path d="M802 244V260H812V280"/><rect x="798" y="247" width="7" height="7" fill="#75ffe0" className="workshop-data-packet"/></g>}
   <g className="pixel-person" transform="translate(628 477)"><path d="M10 0h17v8H10Z" fill="#242033"/><rect x="12" y="8" width="13" height="14" fill="#c98a70"/><path d="M8 23h21v37H6Z" fill="#4e455f"/><path d="M11 31h14v21H11Z" fill="#94605e"/><path d="M8 60h9v35H7m14-35h9v35h-9" fill="#172437"/><path d="M3 95h16m1 0h15" stroke="#0b1527" strokeWidth="6"/><path d="M7 25 2 59h8m18-34 7 32h-9" fill="#41415b"/></g>
   <g className="room-sticker"><rect x="58" y="671" width="271" height="25" fill="#12323a"/><text x="68" y="688">NO COFFEE ON RACKS / EST. 209</text></g>
   <text x="718" y="696" className="facility-readout">{ai?'04 / AI SERVICE ONLINE':dc?'03 / CLOUD OPERATIONS':rooftop?'02 / ROOFTOP FACILITY':'01 / BORROWED SERVER, BIG IDEAS'}</text>
   {highlight&&<text x="45" y="38" className="equipment-label" fill="#9ef1c9">TRAINING TARGET / {highlight.toUpperCase()}</text>}
  </svg>
  <div className="scene-caption"><span className="scene-status-dot"/>{running?'Systems running':'Lab paused'}<span>Inspect the server to see its components</span></div>
 </div>
}
