import type { KeyboardEvent, ReactNode } from 'react'
import type { GameState, EquipmentId } from './sim/types'
import { getHardware, hardwareSummary, getHardwareExplanation } from './sim/engine'

type Props={state:GameState;selected:string;setSelected:(id:string)=>void}
const parts:Record<string,{name:string;why:string}>={
 motherboard:{name:'Motherboard',why:'The motherboard connects the CPU, RAM, storage controllers, and network interface. These parts communicate over buses; they are components of one physical server, not separate cloud services.'},
 power:{name:'Power supply',why:'The power supply converts incoming electrical power into the voltages the components require. Redundant power supplies help when one unit fails; they cannot protect against every upstream outage.'},
 cooling:{name:'Cooling',why:'Fans and heatsinks carry heat away from the processor and other components. Cooling enables reliable operation; this lab represents it visually rather than making temperature another management task.'},
}
function Part({id,label,x,y,w,h,selected,onSelect,children}:{id:string;label:string;x:number;y:number;w:number;h:number;selected:string;onSelect:(id:string)=>void;children:ReactNode}){
 const key=(e:KeyboardEvent<SVGGElement>)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(id)}}
 return <g role="button" tabIndex={0} aria-label={`Inspect ${label}`} aria-pressed={selected===id} onClick={()=>onSelect(id)} onKeyDown={key} transform={`translate(${x} ${y})`} className={`interior-part ${selected===id?'selected':''}`}>
  <rect className="part-outline" x="-7" y="-7" width={w+14} height={h+14} fill="transparent" stroke="#4b667b" strokeWidth="2"/>{children}<text x="0" y={h+28} className="part-label">{label.toUpperCase()}</text>
 </g>
}
export default function ServerInterior({state,selected,setSelected}:Props){
 const h=getHardware(state),id=selected==='server'?'cpu':selected
 const equip=(['cpu','memory','ssd','network','ai'] as string[]).includes(id)?id as EquipmentId:undefined
 const info=parts[id]??parts.motherboard
 const explanation=equip?getHardwareExplanation(equip,state):info.why
 const summary=equip?hardwareSummary(equip,state):'Part of the physical server'
 const title=equip?({cpu:'CPU',memory:'Working memory',ssd:'Storage',network:'Network interface',ai:'GPU inference'}[equip as 'cpu'|'memory'|'ssd'|'network'|'ai']):info.name
 return <section className={`interior-shell ${state.paused?'scene-paused':''}`} aria-label="Server interior">
  <header className="inspection-heading"><div><span className="eyebrow">PHYSICAL LAYER / SERVER 01</span><h2>Inside the chassis</h2></div><span>Click a component</span></header>
  <svg viewBox="0 0 1080 610" className="interior-svg" role="group" aria-label="Server cutaway with CPU, memory, storage, NIC, motherboard, power supply and cooling" shapeRendering="crispEdges">
   <defs><pattern id="board-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M0 16h16V0m0 16h16v16" stroke="#39716d" strokeWidth="2" fill="none"/></pattern></defs>
   <rect x="26" y="25" width="1026" height="556" fill="#111c2d" stroke="#647389" strokeWidth="6"/><path d="M26 25 41 10h1026v556l-15 15" fill="#1d2c40" stroke="#34455e" strokeWidth="3"/><rect x="26" y="25" width="1026" height="556" fill="#121f30"/>
   <Part id="motherboard" label="Motherboard" x={67} y={67} w={638} h={396} selected={id} onSelect={setSelected}><rect width="638" height="396" fill="#193b3e" stroke="#62837e" strokeWidth="3"/><rect x="9" y="9" width="620" height="378" fill="url(#board-grid)"/><path d="M24 52h142v82h44m186 181h187m-502-63h88v83h120m131-280h141" stroke="#92a476" strokeWidth="4" fill="none"/>{[0,1,2,3].map(i=><g key={i}><rect x={25+i*26} y="337" width="17" height="31" fill="#101f2a" stroke="#8ba58c" strokeWidth="2"/><rect x={451+i*27} y="30" width="18" height="28" fill="#2b4860" stroke="#7799a4"/></g>)}</Part>
   <Part id="cpu" label="CPU" x={267} y={173} w={157} h={150} selected={id} onSelect={setSelected}><path d="M0 0h157v150H0Z" fill="#abb7ac" stroke="#d4cfb0" strokeWidth="4"/>{Array.from({length:8},(_,i)=><path key={i} d={`M${10+i*19} -8v-13m0 179v13M-8 ${9+i*18}h-13m186 0h13`} stroke="#d9b779" strokeWidth="5"/>)}<rect x="13" y="13" width="131" height="124" fill="#263a4b" stroke="#6acbc1" strokeWidth="3"/><rect x="29" y="30" width="99" height="90" fill="#112638"/><path d="M42 47h72m-72 17h72m-72 17h72m-72 17h72" stroke="#63d4c0" strokeWidth="6"/><text x="78" y="76" textAnchor="middle" className="chip-text">CPU</text></Part>
   <Part id="memory" label="RAM" x={510} y={156} w={145} h={198} selected={id} onSelect={setSelected}>{[0,1,2,3].map(i=><g key={i} transform={`translate(${i*38} 0)`}><rect width="27" height="198" fill="#27655b" stroke="#75b9a0" strokeWidth="2"/>{[0,1,2,3].map(j=><rect key={j} x="4" y={13+j*43} width="19" height="30" fill="#112b33" stroke="#4f7972"/>)}<path d="M5 188v14m5-14v14m5-14v14m5-14v14" stroke="#d0ad6d" strokeWidth="3"/></g>)}</Part>
   <Part id="network" label="NIC" x={104} y={161} w={92} h={173} selected={id} onSelect={setSelected}><rect width="92" height="173" fill="#254e55" stroke="#63a8aa" strokeWidth="3"/><rect x="12" y="12" width="68" height="58" fill="#142b3e" stroke="#7f9da9" strokeWidth="3"/><path d="M24 39h44m-44 13h44" stroke="#69e1c5" strokeWidth="4"/><rect x="21" y="91" width="50" height="51" fill="#213644" stroke="#b49a71" strokeWidth="2"/><path d="M15 166h62" stroke="#d4b778" strokeWidth="9"/></Part>
   <Part id="ssd" label="Storage bays" x={759} y={300} w={240} h={165} selected={id} onSelect={setSelected}>{[0,1,2].map(i=><g key={i} transform={`translate(0 ${i*57})`}><rect width="240" height="49" fill="#344255" stroke="#748299" strokeWidth="3"/><rect x="10" y="8" width="193" height="29" fill="#132439"/><path d="M22 18h130m-130 9h130" stroke="#4d677c" strokeWidth="4"/><rect x="216" y="17" width="8" height="8" fill="#d9b26f" className="equipment-led"/></g>)}</Part>
   <Part id="power" label="Power supply" x={759} y={77} w={240} h={128} selected={id} onSelect={setSelected}><rect width="240" height="128" fill="#354051" stroke="#8b8d9d" strokeWidth="3"/>{Array.from({length:9},(_,i)=><path key={i} d={`M13 ${13+i*11}h129`} stroke="#172639" strokeWidth="5"/>)}<rect x="165" y="35" width="51" height="53" fill="#101c2c" stroke="#b9ab91" strokeWidth="3"/><path d="m191 46-11 20h11l-3 14 16-22h-12Z" fill="#f6c974"/></Part>
   <Part id="cooling" label="Cooling bank" x={106} y={507} w={564} h={34} selected={id} onSelect={setSelected}><rect width="564" height="34" fill="#314252" stroke="#72919d" strokeWidth="2"/>{[0,1,2,3,4,5,6,7].map(i=><g key={i} transform={`translate(${20+i*71} 17)`}><circle r="13" fill="#0e2433" stroke="#589a9d" strokeWidth="2"/><g className="cooling-fan"><path d="M-8-8 8 8m-16 0L8-8M0-12v24m-12-12h24" stroke="#588d98" strokeWidth="3"/></g><circle r="3" fill="#a8d7c9"/></g>)}</Part>
   <path d="M737 139h-16v-97H33M737 150h-20v329h286" fill="none" stroke="#e0a96d" strokeWidth="5"/><text x="832" y="550" className="part-label">POWER ≠ COMPUTE CAPACITY</text>
  </svg>
  <div className="component-inspector" aria-live="polite"><div><span className="eyebrow">SELECTED COMPONENT</span><h3>{title}</h3></div><strong>{summary}</strong><p>{explanation}</p><small>{h.serverCount} physical server{h.serverCount===1?'':'s'} · cloud resources are rented remotely. Physical components are shown as a representative chassis.</small></div>
 </section>
}
