import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import type { GameState, UpgradeId } from './sim/types'
import { getEffectiveUpgrades } from './sim/engine'

type Props = { state: GameState; selected: string; setSelected: (id: string) => void; flow: boolean; pulse?: string; beginner?: boolean; highlight?: string; earningPulse?:boolean;presentationPaused?:boolean }

function Machine({ id, label, x, y, selected, setSelected, children, locked, level = 1, pulse, highlight }: {
  id: string; label: string; x: number; y: number; selected: string; setSelected: (id: string) => void; children: ReactNode; locked?: boolean; level?: number; pulse?: string; highlight?: string
}) {
  const key = (event: KeyboardEvent<SVGGElement>) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(id) } }
  const colors=['#718093','#9ba4b5','#70e79b','#60e9ef','#799cff','#b28aff','#f07cdd','#ffab65','#ffdd77','#d9ffff','#7cf6e4']
  const tier=Math.min(10,Math.max(0,level))
  const height=id==='cpu'?218:id==='memory'?168:id==='ssd'?105:id==='ai'?211:80
  return <g role="button" tabIndex={0} aria-label={`Select ${label}`} aria-pressed={selected === id} onClick={() => setSelected(id)} onKeyDown={key} transform={`translate(${x} ${y})`} style={{'--tier-color':colors[tier],'--growth':1+tier*.008,'--base-y':height+'px'} as CSSProperties} data-tier={tier} className={`machine tier-${tier} ${selected === id ? 'machine-selected' : ''} ${locked ? 'machine-locked' : ''} ${pulse === id ? 'machine-pulse' : ''} ${highlight === id ? 'machine-highlight' : ''}`}>
    <title>{label} · {locked ? 'Future technology — select to learn more' : `Level ${level} — select to upgrade`}</title><g className="machine-model">{children}<path className="tier-trim" d={`M1 14V1h14M92 1h14v13M1 ${height-13}v13h14m77 0h14v-13`} fill="none" stroke="var(--tier-color)" strokeWidth="3"/></g><g className="machine-tag" transform="translate(0 -24)"><rect width="108" height="21" rx="0"/><text x="7" y="14">{label.toUpperCase()}</text><text x="100" y="14" textAnchor="end">{locked ? '◇' : `L${level}`}</text></g>
  </g>
}

function Rack({ width = 108, height = 218, tint = '#55d4cf', units = 6 }: { width?: number; height?: number; tint?: string; units?: number }) {
  return <><path d={`M0 0h${width}v${height}H0Z`} fill="#171b28" stroke="#475062" strokeWidth="3"/><path d={`M${width} 0l13 -8v${height}l-13 8Z`} fill="#10131e"/><rect x="8" y="8" width={width - 16} height={height - 16} fill="#080e19"/>{Array.from({ length: units }, (_, index) => <g key={index} transform={`translate(13 ${17 + index * (height - 33) / units})`}><rect width={width - 26} height={(height - 33) / units - 6} rx="2" fill="#293443"/><path d={`M9 7h${width - 57}M9 12h${width - 57}`} stroke="#111e2a" strokeWidth="3"/><rect className="equipment-led" x={width - 37} y="7" width="5" height="5" fill={tint} style={{ animationDelay: `${index * .31}s` }}/><rect x="5" y={(height - 33) / units - 13} width={width - 38} height="2" fill="#4a5763" opacity=".5"/></g>)}<rect x="12" y={height - 5} width="17" height="10" fill="#070b13"/><rect x={width - 29} y={height - 5} width="17" height="10" fill="#070b13"/></>
}

export default function Workshop({ state, selected, setSelected, flow, pulse, beginner, highlight,earningPulse,presentationPaused }: Props) {
  const effective = getEffectiveUpgrades(state)
  const has = (id: UpgradeId) => effective.includes(id)
  const levels = state.tutorial.status === 'active' && state.tutorial.replay
    ? { cpu: has('cpu') ? 1 : 0, memory: has('memory') ? 1 : 0, ssd: has('ssd') ? 1 : 0, network: 0, cloud: 0, ai: 0 } as Record<string, number>
    : (state as GameState & { equipmentLevels?: Record<string, number> }).equipmentLevels ?? {}
  const props = (id: string, label: string, x: number, y: number, locked = false) => ({ id, label, x, y, selected, setSelected, locked, level: levels[id] ?? 1, pulse, highlight })
  const running = !state.paused&&!presentationPaused
  const tier=(id:string)=>Math.min(10,levels[id]??0)
  return <div className={`workshop-stage ${has('cloud')?'cloud-era':''} ${earningPulse?'billing-active':''} ${flow ? 'flow-visible' : ''} ${!running ? 'scene-paused' : ''} ${beginner ? 'beginner-workshop' : ''}`} aria-label="CloudLab workshop">
    <svg className="workshop-room" viewBox="0 0 1280 720" aria-label="A neon-lit server workshop overlooking the city" shapeRendering="crispEdges">
      <defs>
        <linearGradient id="night" x2="0" y2="1"><stop stopColor="#080d23"/><stop offset="1" stopColor="#27344a"/></linearGradient>
        <linearGradient id="wall" x2="0" y2="1"><stop stopColor="#1e2435"/><stop offset="1" stopColor="#141c2b"/></linearGradient>
        <linearGradient id="floor" x2="0" y2="1"><stop stopColor="#2d2d3a"/><stop offset="1" stopColor="#141824"/></linearGradient>
        <radialGradient id="amber-glow"><stop stopColor="#ffba5a" stopOpacity=".28"/><stop offset="1" stopColor="#ffba5a" stopOpacity="0"/></radialGradient>
        <radialGradient id="cyan-glow"><stop stopColor="#19ead6" stopOpacity=".2"/><stop offset="1" stopColor="#19ead6" stopOpacity="0"/></radialGradient>
        <pattern id="window-lights" width="25" height="29" patternUnits="userSpaceOnUse"><rect x="7" y="8" width="5" height="9" fill="#51b3bd" opacity=".45"/><rect x="17" y="8" width="4" height="9" fill="#ca7ca9" opacity=".3"/></pattern>
        <pattern id="floor-tiles" width="100" height="53" patternUnits="userSpaceOnUse"><path d="M0 0H100V53" fill="none" stroke="#46505c" strokeOpacity=".18"/></pattern>
        <clipPath id="city-window"><rect x="48" y="76" width="480" height="344"/></clipPath>
      </defs>
      <rect width="1280" height="720" fill="url(#wall)"/>
      <path d="M0 0H1280V45H0Z" fill="#101522"/><path d="M0 45H1280" stroke="#47505b" strokeWidth="5"/>
      <path d="M0 540H1280V720H0Z" fill="url(#floor)"/><path d="M0 540H1280V720H0Z" fill="url(#floor-tiles)"/>
      <path d="M0 540H1280M0 548H1280" stroke="#070c17" strokeWidth="5"/>
      <path d="M1198 45L1280 0V720L1198 540Z" fill="#101623"/>
      <g clipPath="url(#city-window)"><rect x="48" y="76" width="480" height="344" fill="url(#night)"/>
        <circle cx="420" cy="126" r="28" fill="#b5c6d9" opacity=".48"/><circle cx="434" cy="117" r="28" fill="#111b32"/>
        {[{x:35,y:220,w:80},{x:120,y:140,w:72},{x:198,y:252,w:55},{x:260,y:170,w:100},{x:368,y:221,w:66},{x:438,y:123,w:78}].map((building,i)=><g key={i}><rect x={building.x} y={building.y} width={building.w} height="310" fill={i%2 ? '#131e32' : '#18243a'}/><rect x={building.x+5} y={building.y+8} width={building.w-10} height="290" fill="url(#window-lights)"/><path d={`M${building.x} ${building.y}h${building.w}`} stroke="#42506c" strokeWidth="3"/></g>)}
        <rect x="146" y="178" width="22" height="109" fill="#423148" stroke="#d67fa7" strokeWidth="2"/><text x="162" y="195" className="city-sign" transform="rotate(90 162 195)" fill="#ff91c7">OPEN 24H</text>
        <rect x="285" y="230" width="84" height="24" fill="#133445" stroke="#34cfc5" strokeWidth="2"/><text x="294" y="246" className="city-sign" fill="#76f5e1">BYTE BAR</text>
        <path d="M45 349H528M45 357H528" stroke="#304766" strokeWidth="4"/><g className="city-train"><rect x="61" y="326" width="118" height="20" fill="#33455b"/><path d="M69 332h96" stroke="#e7ab81" strokeWidth="5"/></g>
        <path d="M90 91l-19 60m110-66-27 85m202-75-19 64m133-16-29 93m-346 39-18 59m244-4-30 91" stroke="#bad8ed" strokeOpacity=".12" strokeWidth="2"/>
        <g className="cloud-scenery"><rect x="48" y="76" width="480" height="344" fill="#7ce8ef" opacity=".16"/><g className="drifting-cloud cloud-one"><path d="M35 160h35v-18h70v18h42v35H35Z" fill="#b9f8ff" opacity=".38"/></g><g className="drifting-cloud cloud-two"><path d="M310 245h25v-22h68v22h50v34H310Z" fill="#eacbff" opacity=".35"/></g><path d="M52 404h470" stroke="#8eeaff" strokeWidth="4"/></g>
      </g>
      <rect x="43" y="71" width="490" height="354" fill="none" stroke="#0a111d" strokeWidth="14"/><rect x="48" y="76" width="480" height="344" fill="none" stroke="#4e6475" strokeWidth="3"/>
      <path d="M287 77V420M48 291H528" stroke="#0d1625" strokeWidth="9"/><path d="M48 426H538" stroke="#576170" strokeWidth="11"/>
      <rect x="552" y="62" width="213" height="31" fill="#101925"/><text x="566" y="83" className="room-sign" fill="#65e1cf">CLOUDLAB // 209</text>
      <path d="M561 106h607v53M548 135h605v54" fill="none" stroke="#36394a" strokeWidth="8"/><path d="M561 106h607" stroke="#536071" strokeWidth="2"/>
      <g><rect x="680" y="16" width="234" height="18" fill="#0a101a"/><rect x="693" y="30" width="209" height="7" fill="#f4c17a"/><path d="M703 40L568 538H1040L893 40Z" fill="url(#amber-glow)"/></g>
      <ellipse cx="394" cy="548" rx="300" ry="176" fill="url(#cyan-glow)"/>
      <ellipse cx="912" cy="497" rx="350" ry="202" fill="url(#amber-glow)"/>
      <g className="room-detail"><path d="M99 568V654H684V541M376 567V617H870V544M559 276V603H1090V540" fill="none" stroke="#080e19" strokeWidth="12"/><path d="M99 568V654H684V541" fill="none" stroke="#ab7044" strokeWidth="3"/><path d="M376 567V617H870V544" fill="none" stroke="#395f67" strokeWidth="3"/>
        <path d="M74 692H1165" stroke="#2f3a49" strokeWidth="4"/><path d="M94 688h22m15 0h22m15 0h22m15 0h22m15 0h22m15 0h22m15 0h22" stroke="#73614e" strokeWidth="4"/>
      </g>
      <g transform="translate(91 449)"><rect x="0" y="59" width="453" height="22" fill="#6b4a3c"/><rect x="0" y="55" width="453" height="9" fill="#ac7751"/><rect x="15" y="81" width="18" height="84" fill="#272735"/><rect x="415" y="81" width="18" height="84" fill="#272735"/>
        <rect x="23" y="-50" width="150" height="96" fill="#101824" stroke="#586479" strokeWidth="5"/><rect x="32" y="-41" width="132" height="75" fill="#0b303b"/><path d="M43 -25h43m-43 13h79M43 1h58m-58 13h94" stroke="#52b7b1" strokeWidth="3"/><path d="M98 46V57" stroke="#464a58" strokeWidth="12"/>
        <rect x="201" y="-30" width="115" height="75" className="billing-terminal" fill="#101824" stroke="#6c9b91" strokeWidth="4"/><rect x="209" y="-22" width="99" height="58" fill="#10393a"/><text x="217" y="-7" className="billing-label">RESPONSE / BILLING</text><path d="m220 13 8 8 14-19" fill="none" stroke="#72efbb" strokeWidth="4"/><text x="267" y="24" className="billing-dollar">$</text><rect className="billing-led" x="301" y="37" width="6" height="5" fill="#78ffd5"/>
        <path d="M259 45V57" stroke="#464a58" strokeWidth="10"/><path d="M53 68h100m57 0h82" stroke="#2c2d38" strokeWidth="7"/>
        <rect x="338" y="21" width="24" height="31" fill="#cfc2a6"/><path d="M362 27h10v16h-10" fill="none" stroke="#cfc2a6" strokeWidth="5"/><path d="M345 14v-13m9 12V-1" stroke="#9b9aa1" strokeWidth="2" opacity=".35"/>
      </g>
      <Machine {...props('network','Network',555,196)}><rect width="101" height="63" fill="#30394a" stroke="#647084" strokeWidth="3"/><rect x="8" y="11" width="85" height="35" fill="#0d1926"/>{Array.from({length:6},(_,i)=><rect key={i} x={15+i*12} y="20" width="7" height="11" fill="#347c7b"/>)}<path d="M17 63v14m20-14v14m20-14v14m20-14v14" stroke="#bd8655" strokeWidth="3"/></Machine>
      <Machine {...props('cpu','CPU',665,302)}><rect width="104" height="218" fill="#122a32" stroke="#627e85" strokeWidth="3"/><path d="M15 16v25h22M90 18H67v35M16 191v-41h18m55 41v-37H73" fill="none" stroke="#487363" strokeWidth="4"/><path d="M32 51V35m14 16V35m14 16V35m14 16V35M32 136v16m14-16v16m14-16v16m14-16v16M17 69H4m13 16H4m13 16H4M87 69h13M87 85h13m-13 16h13" stroke="#c2a66e" strokeWidth="4"/><rect x="18" y="51" width="68" height="85" fill="#343544" stroke="#91a1b3" strokeWidth="4"/><rect x="29" y="65" width="46" height="55" fill="#1a1d2e"/>{Array.from({length:4},(_,i)=><path key={i} d={`M34 ${74+i*11}h36`} stroke="var(--tier-color)" strokeWidth="5"/>)}<text x="52" y="178" textAnchor="middle" className="equipment-label">PROCESSOR</text>{Array.from({length:Math.min(5,1+Math.floor(tier('cpu')/2))},(_,i)=><rect key={i} x={12+i*17} y="193" width="12" height="12" fill="var(--tier-color)"/>)}</Machine>
      <Machine {...props('server2','Server II',792,273,!has('server2'))}><Rack height={247} units={7}/></Machine>
      <Machine {...props('memory','Memory',920,352)}><rect y="142" width="100" height="26" fill="#2c3947" stroke="#617282" strokeWidth="3"/>{Array.from({length:Math.min(4,2+Math.floor(tier('memory')/3))},(_,i)=><g key={i} transform={`translate(${5+i*24} 12)`}><rect width="18" height="140" fill="#21604e" stroke="var(--tier-color)" strokeWidth="2"/>{[0,1,2,3].map(j=><rect key={j} x="3" y={12+j*27} width="12" height="18" fill="#172331"/>)}<path d="M3 139v11m4-11v11m4-11v11m4-11v11" stroke="#d8b36c" strokeWidth="2"/></g>)}</Machine>
      <Machine {...props('ssd','Storage',1048,415)}><g className="storage-stack">{Array.from({length:Math.min(5,2+Math.floor(tier('ssd')/2))},(_,i)=><g key={i} transform={`translate(0 ${80-i*25})`}><rect width={76+Math.min(10,tier('ssd'))*2} height="23" fill="#26364e" stroke="var(--tier-color)" strokeWidth="2"/><rect x="7" y="5" width="46" height="12" fill="#101c2d"/><path d="M12 10h28m-28 4h28" stroke="#6b82a1" strokeWidth="2"/><rect className="equipment-led" x="62" y="7" width="6" height="6" fill="#f8cc77"/></g>)}</g></Machine>
      <Machine {...props('ai','AI',1162,309,!has('ai'))}><rect width="80" height="211" fill="#362940" stroke="#a77aa8" strokeWidth="3"/><path d="M10 16h60m-60 6h60M10 190h60" stroke="#8b6392" strokeWidth="4"/>{[66,143].map(y=><g key={y}><circle cx="40" cy={y} r="29" fill="#121e31" stroke="var(--tier-color)" strokeWidth="3"/><g className="gpu-fan" style={{transformOrigin:`40px ${y}px`}}><path d={`M40 ${y-23}v46m-23-23h46m-39-16 32 32m-32 0 32-32`} stroke="#845995" strokeWidth="7"/></g><circle cx="40" cy={y} r="7" fill="#e5a8db"/></g>)}<path d="M6 211v9m8-9v9m8-9v9m8-9v9m8-9v9m8-9v9m8-9v9m8-9v9" stroke="#d8b66b" strokeWidth="3"/></Machine>
      <Machine {...props('cloud','Cloud',1007,146,!has('cloud'))}><rect width="135" height="86" fill="#293345" stroke="#526275" strokeWidth="3"/><rect x="9" y="9" width="117" height="59" fill="#131d31"/><path d="M35 46h66c15-3 9-22-4-22-8-24-37-22-43-1-22-10-36 19-19 23Z" fill="none" stroke="#65b5b7" strokeWidth="3"/><path d="M42 74h53" stroke="#dfa56b" strokeWidth="3"/></Machine>
      <Machine {...props('load_balancer','Balancer',554,335,!has('load_balancer'))}><rect width="82" height="58" fill="#323849" stroke="#586375" strokeWidth="3"/><path d="M14 29h19m0 0 17-15h18M33 29l17 15h18" stroke="#679eaa" strokeWidth="3" fill="none"/></Machine>
      <Machine {...props('cache','Cache',544,458,!has('cache'))}><rect width="94" height="60" fill="#293746" stroke="#526675" strokeWidth="3"/><rect x="12" y="13" width="70" height="31" fill="#142b31"/><path d="M24 29h13m8 0h13m8 0h6" stroke="#79b299" strokeWidth="4"/></Machine>
      <Machine {...props('security','Security',553,113,!has('security'))}><rect width="82" height="45" fill="#282f3e" stroke="#4d5e6f" strokeWidth="3"/><path d="M28 11h25v13c0 10-12 15-12 15s-13-6-13-15Z" fill="none" stroke="#aa997b" strokeWidth="2"/></Machine>
      <Machine {...props('backup','Backup',1039,576,!has('backup'))}><rect width="111" height="55" fill="#2a303d" stroke="#536073" strokeWidth="3"/><rect x="12" y="12" width="86" height="23" fill="#121b28"/><rect x="20" y="20" width="56" height="5" fill="#7c7c8d"/><circle cx="89" cy="23" r="3" fill="#b79a6c"/></Machine>
      {flow && <g className="scene-flow" aria-hidden="true"><path d="M603 260V287H719V302M719 520V558H974V520M974 520V553H1102V520"/><path d="M603 260V287H719V302" className="flow-travel"/>{has('cloud')&&<path d="M605 196V176H1007" className="cloud-travel"/>}<circle r="5" fill="#72f8db"><animateMotion dur={`${2/state.speed}s`} repeatCount="indefinite" path="M603 260V287H719V302"/></circle></g>}
      {running&&<g className="billing-route" aria-hidden="true"><path d="M719 520V588H350V498" fill="none" stroke="#4fe7c5" strokeOpacity=".24" strokeWidth="3"/><rect width="9" height="7" fill="#8effcc" className="billing-packet"><animateMotion dur={`${2/state.speed}s`} repeatCount="indefinite" path="M719 520V588H350V498"/></rect></g>}
      <g className="room-sticker"><rect x="65" y="617" width="153" height="27" fill="#172f35"/><text x="77" y="635">NO COFFEE ON RACKS</text></g>
    </svg>
    <div className="scene-caption"><span className="scene-status-dot"/>{state.paused ? 'Lab paused' : 'Systems running'}<span>Click equipment to inspect</span></div>
  </div>
}
