import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createInitialState, loadGame, serializeGame, stepGame, purchaseUpgrade, canPurchase, setPolicy, setSpeed, togglePause, startChallenge, getChallengeReadiness, startTutorial, advanceTutorial, skipTutorial, replayTutorial, getTutorialLesson, getRecommendation, getEffectiveUpgrades, getEquipmentQuote, purchaseEquipment, getNextAnnouncement, acknowledgeAnnouncement, EQUIPMENT, ACHIEVEMENTS } from './sim/engine'
import { UPGRADES } from './sim/upgrades'
import type { EquipmentId, EventReport, GameState, Hardware, PolicyState, PurchaseImpact, UpgradeId } from './sim/types'
import Workshop from './Workshop'
import ServerInterior from './ServerInterior'
import InfrastructureMap from './InfrastructureMap'
import {getHardware,hardwareSummary,getHardwareExplanation,getMilestone,setRentalsEnabled} from './sim/engine'
import TechArt from './TechArt'
import {equipmentMetric,impactRows,impactSummary,STAGE_NAMES} from './sim/feedback'
import {previewEquipmentImpact} from './sim/engine'
import {useEarnings} from './useEarnings'
import './app-panels.css'

const SAVE_KEY = 'cloudlab-save-v1'
const BACKUP_KEY = 'cloudlab-save-pre-v5'
function legacyBackup(){try{return localStorage.getItem(BACKUP_KEY)}catch{return null}}
function preserveLegacySave(value:string){
  const parsed=JSON.parse(value)
  if(parsed.version<5&&!localStorage.getItem(BACKUP_KEY))localStorage.setItem(BACKUP_KEY,value)
}
const money = (n:number) => (n<0?'−$':'$') + Math.abs(n).toLocaleString(undefined,{maximumFractionDigits:2})
const num = (n:number) => n.toLocaleString(undefined,{maximumFractionDigits:1})
const equipmentIds: EquipmentId[] = ['cpu','memory','ssd','network','cloud','ai']
const equipmentNames: Record<EquipmentId,string> = {cpu:'CPU',memory:'Memory',ssd:'Storage',network:'Network',cloud:'Cloud capacity',ai:'AI capacity'}
type Drawer = 'Hint'|'Diagnostics'|'Finance'|'Operations'|'Achievements'|'Events'|null
type View = 'Workshop'|'Server Interior'|'Service Flow'

function useGame(suspended:boolean) {
  const [notice,setNotice] = useState('')
  const [state,setState] = useState<GameState>(() => {
    try { const save=localStorage.getItem(SAVE_KEY); const loaded=save?loadGame(save):null; if(loaded&&save){try{preserveLegacySave(save)}catch{/* Keep a valid loaded lab even when backup storage is unavailable. */}} return loaded??createInitialState() } catch {return createInitialState()}
  })
  const current=useRef(state); current.current=state
  const blocked=useRef(suspended); blocked.current=suspended
  const save=useCallback(() => {try{localStorage.setItem(SAVE_KEY,serializeGame(current.current))}catch{setNotice('Autosave unavailable. Export your lab from Save.')}},[])
  useEffect(() => {
    let frame:number,previous=performance.now(),accumulator=0
    const loop=(now:number) => {
      const dt=Math.max(0,(now-previous)/1000);previous=now
      if(document.hidden||blocked.current)accumulator=0
      else {accumulator+=Math.min(dt,1);if(accumulator>=.1){const delta=accumulator;accumulator=0;setState(s=>stepGame(s,delta))}}
      frame=requestAnimationFrame(loop)
    }
    const visibility=()=>{previous=performance.now();accumulator=0;if(document.hidden)save()}
    frame=requestAnimationFrame(loop);document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',save)
    const timer=setInterval(save,10000)
    return()=>{cancelAnimationFrame(frame);clearInterval(timer);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',save)}
  },[save])
  const discrete=JSON.stringify([state.equipmentLevels,state.upgrades,state.paused,state.speed,state.tutorial,state.policies,state.achievementIDs,state.announcements,state.acknowledgedAnnouncements,state.challenge.result])
  useEffect(save,[save,discrete])
  return {state,setState,notice}
}

function Modal({title,eyebrow,children,close,symbol,illustration}:{title:string;eyebrow:string;children:ReactNode;close?:()=>void;symbol?:string;illustration?:string}) {
  const ref=useRef<HTMLElement>(null)
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null,node=ref.current!
    const controls=()=>[...node.querySelectorAll<HTMLElement>('button:not(:disabled),textarea,a[href]')]
    ;(node.querySelector<HTMLElement>('.primary')??controls()[0]??node).focus({preventScroll:true})
    const handler=(e:KeyboardEvent)=>{
      if(e.key==='Escape'&&close){e.preventDefault();close()}
      if(e.key==='Tab'){const c=controls();if(e.shiftKey&&document.activeElement===c[0]){e.preventDefault();c.at(-1)?.focus()}else if(!e.shiftKey&&document.activeElement===c.at(-1)){e.preventDefault();c[0]?.focus()}}
    }
    node.addEventListener('keydown',handler)
    return()=>{node.removeEventListener('keydown',handler);previous?.focus()}
  },[close])
  return <div className="modal-shade"><section ref={ref} className={'modal-window '+(symbol?'event-window':'')} role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1}>
    <header className="modal-head"><span className="eyebrow">{eyebrow}</span>{close&&<button className="close-button" onClick={close} aria-label="Close">×</button>}</header>
    {illustration?<TechArt id={illustration} hero/>:symbol&&<div className="event-symbol" aria-hidden="true">{symbol}</div>}<h2 id="modal-title">{title}</h2>{children}
  </section></div>
}

function ImpactDetails({impact}:{impact:PurchaseImpact}){
  return <div className="impact-details"><div className="impact-values">{impactRows(impact).map(row=><div key={row.label}><span>{row.label}</span><strong>{num(row.before)} → {num(row.after)}</strong><small>{row.unit}</small></div>)}</div><p>{impactSummary(impact)}</p></div>
}
function EventDetails({report}:{report:EventReport}){
  const total=report.standardRequests+report.aiRequests,rate=total?report.served/total:1,missed=Math.max(0,report.potentialGross-report.gross)
  return <div className="event-results" data-testid="event-report">
    <div className="report-grade"><strong>{rate>=.98?'Handled successfully':rate>=.8?'Service was strained':'Your system was overloaded'}</strong><span>{num(report.duration)} minutes · {num(rate*100)}% served</span></div>
    {report.partial&&<p className="partial-note">Partial report: measured from your save migration onward.</p>}
    <div className="report-grid"><div><span>Customer requests</span><strong>{num(total)}</strong></div><div><span>Served / dropped</span><strong>{num(report.served)} / {num(report.dropped)}</strong></div><div><span>Actual gross earnings</span><strong className="positive">{money(report.gross)}</strong></div><div><span>Potential gross earnings</span><strong>{money(report.potentialGross)}</strong></div><div><span>Operating expenses</span><strong>{money(report.expenses)}</strong></div><div><span>Net income</span><strong>{money(report.gross-report.expenses)}</strong></div></div>
    {report.kind==='marketing'&&<p className="extra-traffic">The campaign brought +{num(report.extraRequests)} additional customer requests.</p>}
    {report.dominantStage&&missed>.01?<p className="missed-revenue">{money(missed)} in missed revenue. <strong>{STAGE_NAMES[report.dominantStage]}</strong> was the main limit. {report.dominantStage==='network'?'Expand your network uplink':report.dominantStage==='storage'?'Improve storage data operations':report.dominantStage==='compute'?'Add CPU processing':report.dominantStage==='memory'?'Add memory-supported throughput':'Expand AI inference'} to catch more of the next event.</p>:<p>Your infrastructure captured the available customer revenue.</p>}
    <small>Potential gross means serving every arriving paid request. It is a revenue ceiling, not guaranteed profit. Rewards, purchases, and grants are excluded.</small>
  </div>
}

function SaveDialog({state,close,restore}:{state:GameState;close:()=>void;restore:(s:GameState)=>void}){
  const [text,setText]=useState(()=>serializeGame(state)),[message,setMessage]=useState('Autosaved locally. Keep a backup or restore another lab.')
  return <Modal title="Save your lab" eyebrow="LOCAL SNAPSHOT" close={close}><p role="status">{message}</p><textarea aria-label="Save data" value={text} onChange={e=>setText(e.target.value)} spellCheck={false}/><div className="modal-actions">
    <button onClick={async()=>{try{await navigator.clipboard.writeText(serializeGame(state));setMessage('Save copied.')}catch{setText(serializeGame(state));setMessage('Select the text and copy manually.')}}}>Copy save</button>
    <button className="primary" onClick={()=>{const loaded=loadGame(text);if(loaded){try{preserveLegacySave(text)}catch{/* Import remains possible without local storage. */}restore(loaded);close()}else setMessage('Invalid save. Your current lab is unchanged.')}}>Import save</button>
  {legacyBackup()&&<button onClick={()=>{const backup=legacyBackup(),loaded=backup&&loadGame(backup);if(loaded){restore(loaded);close()}}}>Load pre-migration backup</button>}</div></Modal>
}

function Cash({value,reduced}:{value:number;reduced:boolean}){
  const [shown,setShown]=useState(value),current=useRef(value)
  useEffect(()=>{
    if(reduced||value<current.current){current.current=value;setShown(value);return}
    let frame:number; const start=performance.now(),from=current.current
    const update=(now:number)=>{const t=Math.min(1,(now-start)/80);current.current=from+(value-from)*t;setShown(current.current);if(t<1)frame=requestAnimationFrame(update)}
    frame=requestAnimationFrame(update);return()=>cancelAnimationFrame(frame)
  },[value,reduced])
  return <strong>{money(shown)}</strong>
}

function UpgradeTray({state,selected,select,tab,setTab,quantity,setQuantity,buyEquipment,buyTechnology,pulse}:{state:GameState;selected:string;select:(s:string)=>void;tab:'equipment'|'technology';setTab:(s:'equipment'|'technology')=>void;quantity:1|'max';setQuantity:(n:1|'max')=>void;buyEquipment:(id:EquipmentId)=>void;buyTechnology:(id:UpgradeId)=>void;pulse:string}){
  const guided=state.tutorial.status==='active'||state.tutorial.status==='welcome',lesson=getTutorialLesson(state)
  const available=guided?equipmentIds.filter(id=>['cpu','memory','ssd'].includes(id)&&(getEffectiveUpgrades(state).includes(id as UpgradeId)||id===lesson.requiredUpgrade)):equipmentIds
  return <aside className="upgrade-tray" id="upgrade-console" aria-label="Upgrade console">
    <div className="tray-head"><span className="eyebrow">{guided?'TRAINING BENCH':'BUILD SOMETHING BETTER'}</span><h2>{guided?'Your next upgrade':'Upgrade workbench'}</h2></div>
    {!guided&&<div className="tray-tabs"><button onClick={()=>setTab('equipment')} aria-pressed={tab==='equipment'}>Equipment</button><button onClick={()=>setTab('technology')} aria-pressed={tab==='technology'}>Technology <small>{state.upgrades.filter(x=>!['cpu','memory','ssd'].includes(x)).length}/9</small></button></div>}
    {(!guided&&tab==='equipment')&&<div className="quantity-toggle"><span>BUY AMOUNT</span><button aria-pressed={quantity===1} onClick={()=>setQuantity(1)}>1</button><button aria-pressed={quantity==='max'} onClick={()=>setQuantity('max')}>Max</button></div>}
    <div className="upgrade-list">
      {(guided||tab==='equipment')&&available.map(id=>{
        const definition=EQUIPMENT.find(x=>x.id===id)!,quote=getEquipmentQuote(state,id,guided?1:quantity)
        const required=guided&&lesson.requiredUpgrade===id,level=state.equipmentLevels[id]
        const guidedInstalled=guided&&getEffectiveUpgrades(state).includes(id as UpgradeId)
        const preview=previewEquipmentImpact(state,id,quote.count||1)
        const increase=equipmentMetric(id,preview.after)-equipmentMetric(id,preview.before)
        return <article id={'upgrade-'+id} data-testid={'equipment-card-'+id} data-upgrade-id={id} data-tier={Math.min(10,level)} key={id} className={'equipment-card '+(selected===id?'is-selected ':'')+(required?'tutorial-target ':'')+(pulse===id?'purchased':'')} onClick={()=>select(id)}>
          <div className="upgrade-line"><h3>{equipmentNames[id]}</h3><span className="level-tag" data-testid={'equipment-level-'+id}>LV {level}</span></div>
          <p className="hardware-spec" data-testid={'hardware-spec-'+id}>{hardwareSummary(id,state)}</p><div className="upgrade-line"><span className="capacity-gain">{quantity==='max'&&!guided&&quote.count===0?'No affordable levels':<>+{num(increase)} requests/second{quantity==='max'&&!guided?' · '+quote.count+' upgrades':''}</>}</span><strong>{money(quote.cost||quote.nextCost)}</strong></div><p className="upgrade-preview">{preview.after.hardware&&physicalSpec(id,preview.after.hardware)}<br/>{(id==='cloud'||id==='ai')&&<>After 2-minute startup: </>}{num(preview.before.served)} → {num(preview.after.served)} served/s · {money(preview.before.net)} → {money(preview.after.net)} net/minute<br/>After: {preview.after.bottleneck==='healthy'?'Current demand served':STAGE_NAMES[preview.after.bottleneck]+' limits service'}</p>
          <button className="buy-button" disabled={!quote.available||guidedInstalled} aria-label={guided?'Purchase '+(id==='cpu'?'CPU Module':id==='memory'?'Memory Bank':'SSD Array'):'Upgrade '+equipmentNames[id]} onClick={e=>{e.stopPropagation();buyEquipment(id)}}>{guidedInstalled?'Installed ✓':quote.available?'Upgrade '+(quantity==='max'&&!guided?'×'+quote.count:'↑'):(definition.unlock&&!state.upgrades.includes(definition.unlock)?'Unlock '+UPGRADES.find(x=>x.id===definition.unlock)?.name:guided?'Follow the lesson': quote.reason)}</button>
          <details><summary>Why?</summary><p>{getHardwareExplanation(id,state)}</p></details>
        </article>
      })}
      {!guided&&tab==='technology'&&UPGRADES.filter(x=>!['cpu','memory','ssd'].includes(x.id)).map(item=>{
        const installed=state.upgrades.includes(item.id),permit=canPurchase(state,item.id)
        return <article id={'upgrade-'+item.id} key={item.id} className={'technology-card '+(selected===item.id?'is-selected ':'')+(pulse===item.id?'purchased':'')}>
          <div className="technology-heading"><TechArt id={item.id}/><div><h3>{item.name}</h3><small>{installed?'ONLINE ✓':item.icon}</small></div></div><small>{item.effect}</small>
          <button className="buy-button" disabled={!permit.ok} aria-label={'Unlock '+item.name} onClick={()=>buyTechnology(item.id)}>{installed?'Online ✓':permit.ok?'Unlock · '+money(item.cost):permit.reason}</button>
          <details><summary>Why?</summary><p>{item.lesson}</p></details>
        </article>
      })}
      {guided&&available.length===0&&<div className="tray-empty"><span>01 / ORIENTATION</span><p>Follow the request. Your first upgrade will appear here.</p></div>}
      {guided&&<div className="future-note">ONE MACHINE. THEN A WHOLE CLOUD.<br/><small>More equipment unlocks after orientation.</small></div>}
    </div>
  </aside>
}

function physicalSpec(id:EquipmentId,h:Hardware){
  if(id==='cpu')return `${h.cpuCores} cores × ${h.cpuGHz} GHz`
  if(id==='memory')return `${h.ramGiB} GiB RAM`
  if(id==='ssd')return `${h.storageGiB} GiB · ${num(h.storageIOPS)} IOPS · ${num(h.storageMiBs)} MiB/s`
  if(id==='network')return h.networkMbps>=1000?`${num(h.networkMbps/1000)} Gbps`:`${h.networkMbps} Mbps`
  if(id==='cloud')return `${h.cloudInstances} rented VMs · ${h.cloudInstanceCores} vCPU / ${h.cloudInstanceRamGiB} GiB each`
  return `${h.gpuCount} rented GPUs · ${h.gpuVRAMGiB} GiB VRAM each`
}

function Diagnostics({state}:{state:GameState}){
  const m=state.metrics,h=getHardware(state)
  return <><div className="diagnostic-overview"><span>DEMAND <strong>{num(m.demand)}/s</strong></span><span>REJECTED <strong>{num(m.dropped)}/s</strong></span><span>EST. LATENCY <strong>{Math.round(m.latency)}ms</strong></span></div>
    <div className="capacity-list">{(['network','compute','memory','storage','ai'] as const).filter(k=>k!=='ai'||state.upgrades.includes('ai')).map(k=><div className={'capacity-row '+(m.bottleneck===k?'hot':'')} key={k}><label>{k==='compute'?'CPU':k.toUpperCase()}</label><div className="capacity-track"><i style={{width:m.utilizations[k]*100+'%'}}/></div><strong>{num(k==='ai'?m.aiCapacity:m[k])}/s</strong></div>)}</div>
    <p className="fine-print">Throughput estimates for the current workload. CPU, RAM, network and the shared data tier must all support a response.</p>
    <div className="physical-grid">{equipmentIds.filter(id=>!['cloud','ai'].includes(id)||state.upgrades.includes(id as UpgradeId)).map(id=><div key={id}><span>{equipmentNames[id]}</span><strong>{physicalSpec(id,h)}</strong></div>)}</div>
    <div className="storage-usage"><label>DATA VOLUME <strong>{num(h.storageUsedGiB)} / {num(h.storageGiB)} GiB</strong></label><progress max={h.storageGiB} value={h.storageUsedGiB}/><small>Persisted writes: {num(m.writeRateGiB*60*1024)} MiB/minute · stored data stays when rentals stop.</small></div>
  </>
}

function Finance({state}:{state:GameState}){
  const r=state.revenue
  const rows:[string,number][]=[['Opening funds',r.opening],['Customer revenue',r.gross],['Rewards',r.rewards],['Training grants',r.grants],['Equipment & technology',-r.purchases],['Operating expenses',-r.expenses],['Available funds',state.cash]]
  return <div data-testid="cash-ledger" className="cash-ledger"><p>Every response, purchase and operating charge appears in the same ledger. Prices are fictional game prices.</p><dl>{rows.map(([name,value])=><div key={name}><dt>{name}</dt><dd className={value<0?'negative':''}>{money(value)}</dd></div>)}</dl><div className="finance-rates"><span>Gross <strong>{money(state.metrics.gross)}/minute</strong></span><span>Costs <strong>{money(state.metrics.expenses)}/minute</strong></span><span>Net <strong>{money(state.metrics.net)}/minute</strong></span></div><small>Standard responses earn $4 per 1,000; AI responses earn $12 per 1,000. Rejected work earns nothing. Rewards and grants are separate from customer revenue.</small>{state.cash<0&&<p className="negative">Unpaid operating costs remain in your balance. Stop rentals in Operations to reduce costs while local service earns recovery funds.</p>}</div>
}

function Operations({state,policy,launch,rentals}:{state:GameState;policy:(k:keyof PolicyState,v:string)=>void;launch:()=>void;rentals:(enabled:boolean)=>void}){
  const cooldown=state.elapsed<state.policyCooldownUntil,ready=getChallengeReadiness(state),h=getHardware(state)
  return <>{([
    ['loadBalancer','load_balancer','Traffic',['efficiency','redundancy'],'Distribute work across healthy machines or keep a failover reserve.'],
    ['firewall','security','Firewall',['balanced','strict'],'Strict filtering uses more application CPU; IAM controls identities and permissions.'],
    ['autoscaling','autoscaling','Autoscaling',['economy','resilient'],'Economy checks every 10 minutes; Resilient every 3. New instances take time to start.'],
  ] as const).filter(([,id])=>state.upgrades.includes(id)).map(([key,,name,options,help])=><div className="policy-block" key={key}><label>{name}</label><div className="segmented">{options.map(v=><button key={v} aria-label={name+' '+v} aria-pressed={state.policies[key]===v} disabled={cooldown} onClick={()=>policy(key,v)}>{v}</button>)}</div><small>{help}</small></div>)}
    {!state.upgrades.includes('load_balancer')&&<p>Unlock load balancing to configure traffic policies.</p>}
    {state.upgrades.includes('cloud')&&<div className="rental-controls"><h3>Rented infrastructure</h3><p>{h.cloudInstances} CPU instances · {h.gpuCount} GPU instances online</p>{state.provisioning.remaining>0&&<p role="status">Provisioning capacity · {num(state.provisioning.remaining)} minutes remaining</p>}<button onClick={()=>rentals(!state.rentalsEnabled)}>{state.rentalsEnabled?'Stop rentals':'Resume rentals'}</button><small>{state.rentalsEnabled?'Running instances incur recurring costs, including idle capacity.':'Compute rentals stopped. Local servers and stored data remain.'}</small></div>}
    {state.upgrades.includes('ai')&&<div className="launch-card"><h3>{state.completed?'Launch Day passed':'Launch Day'}</h3><p>{state.completed?'The lab is yours. Keep building.':'90 minutes. Serve 90% of peak traffic. Finish with reputation 65+.'}</p>{!state.completed&&!state.challenge.active&&<><small>{ready.ready?'Architecture ready.':ready.reasons.join(' ')}</small><button className="primary" disabled={state.elapsed<state.challenge.retryAt} onClick={launch}>{state.elapsed<state.challenge.retryAt?'Cooling down…':'Start Launch Day'}</button></>}{state.challenge.result==='failed'&&<p>Launch missed its target. Improve capacity or reputation and retry.</p>}</div>}
  </>
}

export default function App(){
  const [saveOpen,setSaveOpen]=useState(false),[helpOpen,setHelpOpen]=useState(false),[drawer,setDrawer]=useState<Drawer>(null)
  const [historyReport,setHistoryReport]=useState<EventReport|null>(null)
  const {state,setState,notice}=useGame(saveOpen||helpOpen||!!historyReport)
  const [selected,setSelected]=useState('cpu'),[tab,setTab]=useState<'equipment'|'technology'>('equipment'),[quantity,setQuantity]=useState<1|'max'>(1)
  const [view,setView]=useState<View>('Workshop')
  const [flow,setFlow]=useState(false),[muted,setMuted]=useState(true),[reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [pulse,setPulse]=useState(''),[purchaseText,setPurchaseText]=useState(''),[reward,setReward]=useState<{name:string;cash:number}|null>(null)
  const [purchaseImpact,setPurchaseImpact]=useState<PurchaseImpact|null>(null),[epoch,setEpoch]=useState(0),[pageVisible,setPageVisible]=useState(!document.hidden)
  const audio=useRef<AudioContext|null>(null),timers=useRef<number[]>([])
  const seenAchievements=useRef(new Set(state.achievementIDs))
  const guided=state.tutorial.status==='active',welcome=state.tutorial.status==='welcome',lesson=getTutorialLesson(state)
  const announcement=getNextAnnouncement(state),recommendation=getRecommendation(state)
  const blocked=welcome||saveOpen||helpOpen||!!historyReport
  const presentationActive=!blocked&&!state.paused&&pageVisible
  const earningActive=presentationActive&&state.metrics.served>0&&!(guided&&state.tutorial.replay)
  const earnings=useEarnings(state,earningActive,epoch)
  const report=announcement?.reportId?state.eventReports.find(r=>r.id===announcement.reportId):undefined
  const milestone=getMilestone(state)
  useEffect(()=>{const visible=()=>setPageVisible(!document.hidden);document.addEventListener('visibilitychange',visible);return()=>document.removeEventListener('visibilitychange',visible)},[])
  const bottleneckSince=useRef({key:'',since:state.elapsed})
  if(bottleneckSince.current.key!==state.metrics.bottleneck)bottleneckSince.current={key:state.metrics.bottleneck,since:state.elapsed}
  const needsHint=!guided&&state.metrics.bottleneck!=='healthy'&&state.elapsed-bottleneckSince.current.since>=6
  const sound=useCallback((kind:'purchase'|'unlock'|'reward')=>{
    if(muted)return
    try{const ctx=audio.current??=new AudioContext();void ctx.resume();const tones=kind==='purchase'?[440,660]:kind==='unlock'?[330,495,660]:[660,880,1100]
      tones.forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=f;const at=ctx.currentTime+i*.07;g.gain.setValueAtTime(.045,at);g.gain.exponentialRampToValueAtTime(.001,at+.14);o.connect(g);g.connect(ctx.destination);o.start(at);o.stop(at+.15)})
    }catch{setMuted(true)}
  },[muted])
  useEffect(()=>()=>{timers.current.forEach(clearTimeout);void audio.current?.close()},[])
  useEffect(()=>{
    const earned=state.achievementIDs.filter(id=>!seenAchievements.current.has(id))
    seenAchievements.current=new Set(state.achievementIDs)
    if(earned.length){const definitions=ACHIEVEMENTS.filter(a=>earned.includes(a.id));setReward({name:definitions.length===1?definitions[0].name:definitions.length+' achievements unlocked',cash:definitions.reduce((n,a)=>n+a.reward,0)});sound('reward');timers.current.push(window.setTimeout(()=>setReward(null),4200))}
  },[state.achievementIDs,sound])
  useEffect(()=>{if(guided){setTab('equipment');const target=lesson.target==='gateway'?'network':lesson.target==='server'?'cpu':lesson.target==='storage'?'ssd':lesson.target;if(equipmentIds.includes(target as EquipmentId))setSelected(target);setDrawer(lesson.target==='diagnostics'||lesson.target==='economy'?'Diagnostics':null)}},[guided,state.tutorial.step,lesson.target])
  const select=(id:string)=>{
    setSelected(id)
    const control=({gateway:'network',storage:'ssd',server:'cpu'} as Record<string,string>)[id]??id
    if(!equipmentIds.includes(control as EquipmentId)&&!UPGRADES.some(u=>u.id===control))return
    setTab(equipmentIds.includes(control as EquipmentId)?'equipment':'technology')
    window.setTimeout(()=>document.getElementById('upgrade-'+control)?.scrollIntoView({block:'nearest',behavior:'smooth'}),30)
  }
  const flash=(id:string,text:string,kind:'purchase'|'unlock')=>{setPulse(id);setPurchaseText(text);sound(kind);timers.current.push(window.setTimeout(()=>{setPulse('');setPurchaseText('')},1800))}
  const buyEquipment=(id:EquipmentId)=>{const next=purchaseEquipment(state,id,guided?1:quantity);if(next===state)return;setState(current=>purchaseEquipment(current,id,guided?1:quantity));setPurchaseImpact(next.lastPurchase);flash(id,id==='cloud'||id==='ai'?'Capacity provisioning · 2 minutes':hardwareSummary(id,next),'purchase')}
  const buyTechnology=(id:UpgradeId)=>{if(!canPurchase(state,id).ok)return;const next=purchaseUpgrade(state,id);setState(current=>purchaseUpgrade(current,id));setPurchaseImpact(next.lastPurchase);flash(id,'Technology online','unlock')}
  const closeSave=useCallback(()=>setSaveOpen(false),[]),closeHelp=useCallback(()=>setHelpOpen(false),[])
  const reset=()=>{if(confirm('Reset this lab? Export a save first to keep your progress.')){seenAchievements.current=new Set();setState(createInitialState());setDrawer(null);setEpoch(e=>e+1);setPurchaseImpact(null)}}
  const restore=(s:GameState)=>{seenAchievements.current=new Set(s.achievementIDs);setReward(null);setState(s);setEpoch(e=>e+1);setPurchaseImpact(null)}
  const closeHistory=useCallback(()=>setHistoryReport(null),[])
  const progress=state.challenge.totalDemand?state.challenge.totalServed/state.challenge.totalDemand:1
  return <div className={'app '+(reduced?'reduced-motion ':'')+(guided?'training':'')}>
    <a className="skip-link" href="#upgrade-console">Skip to upgrades</a>
    <div className="game-shell" inert={blocked}>
      <header className="hud"><div className="brand"><span className="brand-mark">▥</span><div className="brand-word">CLOUD<span>LAB</span><small>AFTER HOURS / INFRASTRUCTURE TYCOON</small></div></div>
        <div className="cash-display"><label>AVAILABLE FUNDS</label><Cash key={epoch} value={state.cash} reduced={reduced||!presentationActive}/></div>
        <div className="hud-stat income"><label>NET / MIN</label><strong>{state.metrics.net>=0?'+':''}{money(state.metrics.net)}</strong><small className="expense-rate">−{money(state.metrics.expenses)}/min costs</small></div>
        <div className="hud-stat"><label>REQUESTS SERVED</label><strong>{Math.round(state.metrics.successRate*100)}<small>%</small></strong></div>
        <div className="hud-stat"><label>REPUTATION</label><strong>{Math.round(state.reputation)}<small>/100</small></strong></div>
      </header>
      {notice&&<div className="storage-notice" role="status">{notice}</div>}
      {guided&&<section className="tutorial-strip" data-testid="tutorial-banner" data-step={state.tutorial.step} data-phase={state.tutorial.phase}><div><span className="eyebrow">ORIENTATION / {state.tutorial.step+1} OF 8</span><h2>{lesson.title}</h2><p>{lesson.body}</p>{state.tutorial.replay&&<small>Training preview. Your real lab is preserved.</small>}</div><div className="tutorial-actions">{state.tutorial.phase==='demo'?<strong>Observing… {Math.ceil(state.tutorial.demoRemaining)}s</strong>:state.tutorial.phase==='action'?<strong>Install the highlighted equipment →</strong>:<button data-testid="tutorial-next" className="primary" onClick={()=>setState(advanceTutorial)}>{lesson.actionLabel}</button>}<button className="quiet" onClick={()=>setState(skipTutorial)}>Skip tutorial</button></div></section>}
      {!welcome&&<section className="milestone-strip" data-testid="milestone-strip" aria-label="Current milestone"><div><span className="eyebrow">NEXT / {milestone.era.toUpperCase()}</span><strong>{milestone.title}</strong><p>{milestone.requirements.join(' · ')}</p></div><div><progress max={1} value={milestone.progress} aria-label="Milestone progress"/><small>{milestone.next}</small>{recommendation.upgradeId&&<button className="milestone-action" onClick={()=>select(recommendation.upgradeId!)}>Show next step →</button>}</div></section>}
    {!welcome&&announcement&&<aside className="live-alert" data-testid="live-alert" role="status"><div><span className="eyebrow">{announcement.kind==='incident'?'CITY FEED / INCIDENT':announcement.kind==='report'?'EVENT / RESULTS':'LAB / UPDATE'}</span><strong>{announcement.title}</strong><p>{announcement.body}</p>{announcement.tip&&<small>{announcement.tip}</small>}</div><div>{report&&<button onClick={()=>{setHistoryReport(report);setState(s=>acknowledgeAnnouncement(s,announcement.id))}}>View report</button>}<button aria-label="Dismiss notification" onClick={()=>setState(s=>acknowledgeAnnouncement(s,announcement.id))}>×</button></div></aside>}
      <main className="workspace">
        <section className="workshop-column">
          <div className="scene-toolbar"><div className="location-label"><i/>DISTRICT 09 <span>/ YOUR WORKSHOP</span></div><button aria-pressed={flow} onClick={()=>{setFlow(v=>!v);setView('Service Flow')}}>{flow?'Flow on':'Flow off'}</button><button aria-label="Hint" className={needsHint?'hint-ready':''} aria-pressed={drawer==='Hint'} onClick={()=>setDrawer(d=>d==='Hint'?null:'Hint')}>? Hint{needsHint&&<i/>}</button></div>
          <nav className="view-tabs" aria-label="Lab views">{(['Workshop','Server Interior','Service Flow'] as View[]).map(name=><button key={name} aria-pressed={view===name} onClick={()=>setView(name)}>{name}</button>)}</nav>
          {view==='Server Interior'?<ServerInterior state={{...state,paused:!presentationActive}} selected={selected} setSelected={select}/>:view==='Service Flow'?<InfrastructureMap state={{...state,paused:!presentationActive}} selected={selected} setSelected={select} highlight={guided?lesson.target:undefined}/>:<div className="scene-wrap"><Workshop state={state} selected={selected} setSelected={id=>{select(id);if(id==='server')setView('Server Interior')}} flow={flow||guided&&state.tutorial.phase==='demo'} pulse={pulse} beginner={guided||welcome} highlight={guided?lesson.target:undefined} earningPulse={earningActive&&earnings.bursts.length>0} presentationPaused={!presentationActive}/>{purchaseText&&<div className="purchase-float" key={purchaseText} role="status">{purchaseText}</div>}<div className="billing-bursts" data-testid="billing-earnings" data-total={earnings.shown.toFixed(2)} aria-label="Customer revenue at the response terminal">{earningActive&&earnings.bursts.map(b=><span key={b.id} className="earning-burst" data-amount={b.amount.toFixed(2)}>+${b.amount.toFixed(2)}</span>)}</div></div>}
          {purchaseImpact&&<section className="purchase-result" role="status"><header><strong>Upgrade applied</strong><button aria-label="Dismiss upgrade feedback" onClick={()=>setPurchaseImpact(null)}>×</button></header><ImpactDetails impact={purchaseImpact}/></section>}
          <div className="workshop-footer"><div className="selection-readout"><i/>{equipmentNames[selected as EquipmentId]??selected.replace('_',' ')} <span>{equipmentIds.includes(selected as EquipmentId)?'LV '+state.equipmentLevels[selected as EquipmentId]:'SYSTEM CONTROL'}</span></div><div>{state.incident?<span className="incident-badge">⚠ {state.incident.title} · {Math.ceil(state.incident.remaining)}m</span>:state.challenge.active?<span className="incident-badge">LAUNCH DAY · {Math.ceil(state.challenge.remaining)}m · {Math.round(progress*100)}% served</span>:<span className="scene-caption">Click equipment to upgrade it.</span>}</div></div>
          <nav className="nav-tabs" aria-label="Lab details">{(['Diagnostics','Finance','Operations','Achievements','Events'] as const).map(name=><button key={name} aria-pressed={drawer===name} onClick={()=>setDrawer(d=>d===name?null:name)}>{name}{name==='Achievements'&&<small>{state.achievementIDs.length}/10</small>}</button>)}</nav>
          {drawer&&<section className="context-drawer" aria-label={drawer}><header><div><span className="eyebrow">LAB / {drawer.toUpperCase()}</span><h2>{drawer==='Hint'?'Need a direction?':drawer}</h2></div><button aria-label="Close details" onClick={()=>setDrawer(null)}>×</button></header><div className="drawer-body">
            {drawer==='Hint'&&<><h3>{recommendation.title.replace('Current priority: ','')}</h3><p>{recommendation.reason}</p>{recommendation.upgradeId&&<button className="primary" onClick={()=>{select(recommendation.upgradeId!);setDrawer(null)}}>Show upgrade →</button>}</>}
            {drawer==='Diagnostics'&&<Diagnostics state={state}/>}
            {drawer==='Finance'&&<Finance state={state}/>}
            {drawer==='Operations'&&<Operations state={state} policy={(k,v)=>setState(s=>setPolicy(s,k,v))} launch={()=>setState(startChallenge)} rentals={(enabled)=>setState(s=>setRentalsEnabled(s,enabled))}/>}
            {drawer==='Achievements'&&<div className="achievement-list">{ACHIEVEMENTS.map(a=><article key={a.id} className={state.achievementIDs.includes(a.id)?'earned':''}><span>{state.achievementIDs.includes(a.id)?'✓':'◇'}</span><div><h3>{a.name}</h3><p>{a.description}</p></div><strong>{state.achievementIDs.includes(a.id)?'Earned':money(a.reward)}</strong></article>)}</div>}
            {drawer==='Events'&&<><div className="event-report-list">{state.eventReports.map(r=><button key={r.id} onClick={()=>setHistoryReport(r)}><strong>{r.title}</strong><span>{num(r.duration)} minutes · {money(r.gross)} gross → View report</span></button>)}</div><div className="event-list">{state.logs.map(l=><div key={l.id} className={l.tone}><time>{Math.floor(l.time)}m</time><p>{l.text}</p></div>)}</div></>}
          </div></section>}
        </section>
        <UpgradeTray state={state} selected={selected} select={select} tab={tab} setTab={setTab} quantity={quantity} setQuantity={setQuantity} buyEquipment={buyEquipment} buyTechnology={buyTechnology} pulse={pulse}/>
      </main>
      <footer className="bottom-bar"><div className="sim-controls"><button disabled={guided} onClick={()=>setState(togglePause)}>{state.paused?'▶ Resume':'Ⅱ Pause'}</button>{([1,2,4]as const).map(n=><button disabled={guided} key={n} aria-pressed={state.speed===n} onClick={()=>setState(s=>setSpeed(s,n))}>{n}×</button>)}</div><span className="game-time">{Math.floor(state.elapsed)} MINUTES <i/> {state.paused?'PAUSED':state.speed+'× SPEED'}</span><div className="settings-controls"><button onClick={()=>setMuted(v=>!v)}>Sound {muted?'off':'on'}</button><button onClick={()=>setReduced(v=>!v)}>Motion {reduced?'off':'on'}</button><button onClick={()=>setHelpOpen(true)}>Help</button><button onClick={()=>setSaveOpen(true)}>Save</button><button onClick={reset}>Reset</button></div></footer>
      {reward&&<div className="reward-toast" data-testid="achievement-toast" role="status"><span>✦ ACHIEVEMENT UNLOCKED</span><strong>{reward.name}</strong><b>+{money(reward.cash)}</b></div>}
    </div>
    {welcome&&<Modal title="Your cloud starts here." eyebrow="WELCOME TO CLOUDLAB" symbol="▥"><p>A borrowed server. A city full of customers.<br/>Build the infrastructure that keeps them connected.</p><div className="welcome-path"><span>PROCESS</span><i>→</i><span>EARN</span><i>→</i><span>UPGRADE</span></div><small>Learn the basics with funded upgrades, or jump straight into your workshop.</small><div className="modal-actions"><button onClick={()=>setState(skipTutorial)}>Skip to sandbox</button><button className="primary" onClick={()=>setState(startTutorial)}>Start tutorial</button></div></Modal>}

    {historyReport&&<Modal title={historyReport.title} eyebrow="EVENT / ARCHIVE" illustration={historyReport.kind} close={closeHistory}><EventDetails report={historyReport}/><div className="modal-actions"><button className="primary" onClick={closeHistory}>Continue</button></div></Modal>}
    {saveOpen&&<SaveDialog state={state} close={closeSave} restore={restore}/>}
    {helpOpen&&<Modal title="Field guide" eyebrow="LEARN AS YOU BUILD" close={closeHelp}><p><strong>CPU</strong> processes requests. <strong>Memory</strong> holds active work. <strong>Storage</strong> reads and writes data. <strong>Network</strong> controls how many requests can enter.</p><p>Inspect the server interior to see physical hardware. Service Flow traces sampled requests and highlights rejected work. Cloud and GPU instances are rented and keep costing money while running.</p><p>At 1× speed, one real second advances one simulated minute. Hardware and traffic rates use seconds; financial rates use minutes. All prices are fictional game prices. Revenue is $4 per 1,000 standard responses and $12 per 1,000 AI responses.</p><p>Why? explains the workload assumptions behind each capacity estimate. This is an educational throughput model, not a benchmark of a particular CPU or GPU.</p><small>Replay uses a training preview and preserves your live lab.</small><div className="modal-actions"><button onClick={closeHelp}>Back to lab</button><button className="primary" onClick={()=>{setHelpOpen(false);setState(replayTutorial)}}>Replay tutorial</button></div></Modal>}
  </div>
}
