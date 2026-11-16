import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createInitialState, loadGame, serializeGame, stepGame, purchaseUpgrade, canPurchase, setPolicy, setSpeed, togglePause, startChallenge, getChallengeReadiness, startTutorial, advanceTutorial, skipTutorial, replayTutorial, getTutorialLesson, getRecommendation, getEffectiveUpgrades, getEquipmentQuote, purchaseEquipment, getNextAnnouncement, acknowledgeAnnouncement, EQUIPMENT, ACHIEVEMENTS } from './sim/engine'
import { UPGRADES } from './sim/upgrades'
import type { EquipmentId, EventReport, GameState, PolicyState, PurchaseImpact, UpgradeId } from './sim/types'
import Workshop from './Workshop'
import TechArt from './TechArt'
import {EQUIPMENT_UNITS,equipmentMetric,impactRows,impactSummary,STAGE_NAMES} from './sim/feedback'
import {previewEquipmentImpact} from './sim/engine'
import {useEarnings} from './useEarnings'

const SAVE_KEY = 'cloudlab-save-v1'
const money = (n:number) => (n<0?'−$':'$') + Math.abs(n).toLocaleString(undefined,{maximumFractionDigits:2})
const num = (n:number) => n.toLocaleString(undefined,{maximumFractionDigits:1})
const equipmentIds: EquipmentId[] = ['cpu','memory','ssd','network','cloud','ai']
const equipmentNames: Record<EquipmentId,string> = {cpu:'CPU',memory:'Memory',ssd:'Storage',network:'Network',cloud:'Cloud capacity',ai:'AI capacity'}
type Drawer = 'Hint'|'Diagnostics'|'Operations'|'Achievements'|'Events'|null

function useGame(suspended:boolean) {
  const [notice,setNotice] = useState('')
  const [state,setState] = useState<GameState>(() => {
    try { const save=localStorage.getItem(SAVE_KEY); return save ? loadGame(save) ?? createInitialState() : createInitialState() } catch {return createInitialState()}
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
    <div className="report-grade"><strong>{rate>=.98?'Handled successfully':rate>=.8?'Service was strained':'Your system was overloaded'}</strong><span>{num(report.duration)} game minutes · {num(rate*100)}% served</span></div>
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
    <button className="primary" onClick={()=>{const loaded=loadGame(text);if(loaded){restore(loaded);close()}else setMessage('Invalid save. Your current lab is unchanged.')}}>Import save</button>
  </div></Modal>
}

function Cash({value,reduced}:{value:number;reduced:boolean}){
  const [shown,setShown]=useState(value),current=useRef(value)
  useEffect(()=>{
    if(reduced){current.current=value;setShown(value);return}
    let frame:number; const start=performance.now(),from=current.current
    const update=(now:number)=>{const t=Math.min(1,(now-start)/150);current.current=from+(value-from)*t;setShown(current.current);if(t<1)frame=requestAnimationFrame(update)}
    frame=requestAnimationFrame(update);return()=>cancelAnimationFrame(frame)
  },[value,reduced])
  return <strong>{money(Math.floor(shown))}</strong>
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
        const increase=definition.unlock&&!state.upgrades.includes(definition.unlock)?definition.increase:equipmentMetric(id,preview.after)-equipmentMetric(id,preview.before)
        return <article id={'upgrade-'+id} data-testid={'equipment-card-'+id} data-upgrade-id={id} data-tier={Math.min(10,level)} key={id} className={'equipment-card '+(selected===id?'is-selected ':'')+(required?'tutorial-target ':'')+(pulse===id?'purchased':'')} onClick={()=>select(id)}>
          <div className="upgrade-line"><h3>{equipmentNames[id]}</h3><span className="level-tag" data-testid={'equipment-level-'+id}>LV {level}</span></div>
          <div className="upgrade-line"><span className="capacity-gain">{quantity==='max'&&!guided&&quote.count===0?'No affordable levels':<>+{num(increase)} {EQUIPMENT_UNITS[id]}{quantity==='max'&&!guided?' · '+quote.count+' levels':''}</>}</span><strong>{money(quote.cost||quote.nextCost)}</strong></div>
          <button className="buy-button" disabled={!quote.available||guidedInstalled} aria-label={guided?'Purchase '+(id==='cpu'?'CPU Module':id==='memory'?'Memory Bank':'SSD Array'):'Upgrade '+equipmentNames[id]} onClick={e=>{e.stopPropagation();buyEquipment(id)}}>{guidedInstalled?'Installed ✓':quote.available?'Upgrade '+(quantity==='max'&&!guided?'×'+quote.count:'↑'):(definition.unlock&&!state.upgrades.includes(definition.unlock)?'Unlock '+UPGRADES.find(x=>x.id===definition.unlock)?.name:guided?'Follow the lesson': 'Short '+money(Math.max(0,(quote.cost||quote.nextCost)-state.cash)))}</button>
          <details><summary>Why?</summary><p>{id==='network'?'More ingress lets requests enter your system.':id==='cloud'?'Permanent managed capacity is added to rented elastic capacity.':id==='ai'?'Permanent GPU capacity is added to the elastic inference pool.':UPGRADES.find(x=>x.id===id)?.lesson} These are simplified workload rates, not literal GHz, GB, or storage volume. Modifiers can change the effective rate.</p></details>
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

function Diagnostics({state}:{state:GameState}){
  const m=state.metrics
  return <><div className="diagnostic-overview"><span>DEMAND <strong>{num(m.demand)}/m</strong></span><span>DROPPED <strong>{num(m.dropped)}/m</strong></span><span>LATENCY <strong>{Math.round(m.latency)}ms</strong></span></div>
    <div className="capacity-list">{(['network','compute','memory','storage','ai'] as const).filter(k=>k!=='ai'||m.aiCapacity).map(k=><div className={'capacity-row '+(m.bottleneck===k?'hot':'')} key={k}><label>{k==='compute'?'CPU':k.toUpperCase()}</label><div className="capacity-track"><i style={{width:m.utilizations[k]*100+'%'}}/></div><strong>{num(k==='ai'?m.aiCapacity:m[k])}/m</strong></div>)}</div>
    <div className="economy-summary"><span>Revenue <strong>{money(m.gross)}/m</strong></span><span>Operating costs <strong>{money(m.expenses)}/m</strong></span><span>Permanent cloud <strong>{state.upgrades.includes('cloud')?24+state.equipmentLevels.cloud*6:0}/m</strong></span><span>Elastic cloud <strong>{num(Math.max(0,state.cloudProvisioned-(state.upgrades.includes('cloud')?24+state.equipmentLevels.cloud*6:0)))}/m</strong></span></div><p className="fine-print">The slowest required stage sets your throughput. A standard request earns $4; AI earns $12.</p>
  </>
}

function Operations({state,policy,launch}:{state:GameState;policy:(k:keyof PolicyState,v:string)=>void;launch:()=>void}){
  const cooldown=state.elapsed<state.policyCooldownUntil,ready=getChallengeReadiness(state)
  return <>{([
    ['loadBalancer','load_balancer','Traffic',['efficiency','redundancy'],'Throughput or fault tolerance.'],
    ['firewall','security','Firewall',['balanced','strict'],'Strict uses more CPU to filter attacks.'],
    ['autoscaling','autoscaling','Autoscaling',['economy','resilient'],'Economy reacts in 10 game minutes; Resilient in 3.'],
  ] as const).filter(([,id])=>state.upgrades.includes(id)).map(([key,,name,options,help])=><div className="policy-block" key={key}><label>{name}</label><div className="segmented">{options.map(v=><button key={v} aria-label={name+' '+v} aria-pressed={state.policies[key]===v} disabled={cooldown} onClick={()=>policy(key,v)}>{v}</button>)}</div><small>{help}</small></div>)}
    {!state.upgrades.includes('load_balancer')&&<p>Unlock load balancing to configure traffic policies.</p>}
    {state.upgrades.includes('ai')&&<div className="launch-card"><h3>{state.completed?'Launch Day passed':'Launch Day'}</h3><p>{state.completed?'The lab is yours. Keep building.':'90 game minutes. Serve 90% of peak traffic. Finish with reputation 65+.'}</p>{!state.completed&&!state.challenge.active&&<><small>{ready.ready?'Architecture ready.':ready.reasons.join(' ')}</small><button className="primary" disabled={state.elapsed<state.challenge.retryAt} onClick={launch}>{state.elapsed<state.challenge.retryAt?'Cooling down…':'Start Launch Day'}</button></>}{state.challenge.result==='failed'&&<p>Launch missed its target. Improve capacity or reputation and retry.</p>}</div>}
  </>
}

export default function App(){
  const [saveOpen,setSaveOpen]=useState(false),[helpOpen,setHelpOpen]=useState(false),[drawer,setDrawer]=useState<Drawer>(null)
  const [historyReport,setHistoryReport]=useState<EventReport|null>(null)
  const {state,setState,notice}=useGame(saveOpen||helpOpen||!!historyReport)
  const [selected,setSelected]=useState('cpu'),[tab,setTab]=useState<'equipment'|'technology'>('equipment'),[quantity,setQuantity]=useState<1|'max'>(1)
  const [flow,setFlow]=useState(false),[muted,setMuted]=useState(true),[reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [pulse,setPulse]=useState(''),[purchaseText,setPurchaseText]=useState(''),[reward,setReward]=useState<{name:string;cash:number}|null>(null)
  const [purchaseImpact,setPurchaseImpact]=useState<PurchaseImpact|null>(null),[epoch,setEpoch]=useState(0),[pageVisible,setPageVisible]=useState(!document.hidden)
  const audio=useRef<AudioContext|null>(null),timers=useRef<number[]>([])
  const seenAchievements=useRef(new Set(state.achievementIDs))
  const guided=state.tutorial.status==='active',welcome=state.tutorial.status==='welcome',lesson=getTutorialLesson(state)
  const announcement=getNextAnnouncement(state),recommendation=getRecommendation(state)
  const blocked=!!announcement||welcome||saveOpen||helpOpen||!!historyReport
  const earningActive=!blocked&&!state.paused&&pageVisible&&state.metrics.served>0&&!(guided&&state.tutorial.replay)
  const earnings=useEarnings(state,earningActive,epoch)
  const report=announcement?.reportId?state.eventReports.find(r=>r.id===announcement.reportId):undefined
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
  const select=(id:string)=>{setSelected(id);setTab(equipmentIds.includes(id as EquipmentId)?'equipment':'technology');window.setTimeout(()=>document.getElementById('upgrade-'+id)?.scrollIntoView({block:'nearest',behavior:'smooth'}),30)}
  const flash=(id:string,text:string,kind:'purchase'|'unlock')=>{setPulse(id);setPurchaseText(text);sound(kind);timers.current.push(window.setTimeout(()=>{setPulse('');setPurchaseText('')},1800))}
  const buyEquipment=(id:EquipmentId)=>{const next=purchaseEquipment(state,id,guided?1:quantity);if(next===state)return;setState(next);setPurchaseImpact(next.lastPurchase);const increase=next.lastPurchase?equipmentMetric(id,next.lastPurchase.after)-equipmentMetric(id,next.lastPurchase.before):0;flash(id,'+'+num(increase)+' '+EQUIPMENT_UNITS[id],'purchase')}
  const buyTechnology=(id:UpgradeId)=>{if(!canPurchase(state,id).ok)return;const next=purchaseUpgrade(state,id);setState(next);setPurchaseImpact(next.lastPurchase);flash(id,'Technology online','unlock')}
  const closeSave=useCallback(()=>setSaveOpen(false),[]),closeHelp=useCallback(()=>setHelpOpen(false),[])
  const reset=()=>{if(confirm('Reset this lab? Export a save first to keep your progress.')){seenAchievements.current=new Set();setState(createInitialState());setDrawer(null);setEpoch(e=>e+1);setPurchaseImpact(null)}}
  const restore=(s:GameState)=>{seenAchievements.current=new Set(s.achievementIDs);setReward(null);setState(s);setEpoch(e=>e+1);setPurchaseImpact(null)}
  const closeHistory=useCallback(()=>setHistoryReport(null),[])
  const progress=state.challenge.totalDemand?state.challenge.totalServed/state.challenge.totalDemand:1
  return <div className={'app '+(reduced?'reduced-motion ':'')+(guided?'training':'')}>
    <a className="skip-link" href="#upgrade-console">Skip to upgrades</a>
    <div className="game-shell" inert={blocked}>
      <header className="hud"><div className="brand"><span className="brand-mark">▥</span><div className="brand-word">CLOUD<span>LAB</span><small>AFTER HOURS / INFRASTRUCTURE TYCOON</small></div></div>
        <div className="cash-display"><label>AVAILABLE FUNDS</label><Cash value={state.cash} reduced={reduced}/></div>
        <div className="hud-stat income"><label>NET / MIN</label><strong>{state.metrics.net>=0?'+':''}{money(state.metrics.net)}</strong><small className="expense-rate">−{money(state.metrics.expenses)}/min costs</small></div>
        <div className="hud-stat"><label>REQUESTS SERVED</label><strong>{Math.round(state.metrics.successRate*100)}<small>%</small></strong></div>
        <div className="hud-stat"><label>REPUTATION</label><strong>{Math.round(state.reputation)}<small>/100</small></strong></div>
      </header>
      {notice&&<div className="storage-notice" role="status">{notice}</div>}
      {guided&&<section className="tutorial-strip" data-testid="tutorial-banner" data-step={state.tutorial.step} data-phase={state.tutorial.phase}><div><span className="eyebrow">ORIENTATION / {state.tutorial.step+1} OF 8</span><h2>{lesson.title}</h2><p>{lesson.body}</p>{state.tutorial.replay&&<small>Training preview. Your real lab is preserved.</small>}</div><div className="tutorial-actions">{state.tutorial.phase==='demo'?<strong>Observing… {Math.ceil(state.tutorial.demoRemaining)}s</strong>:state.tutorial.phase==='action'?<strong>Install the highlighted equipment →</strong>:<button data-testid="tutorial-next" className="primary" onClick={()=>setState(advanceTutorial)}>{lesson.actionLabel}</button>}<button className="quiet" onClick={()=>setState(skipTutorial)}>Skip tutorial</button></div></section>}
      <main className="workspace">
        <section className="workshop-column">
          <div className="scene-toolbar"><div className="location-label"><i/>DISTRICT 09 <span>/ YOUR WORKSHOP</span></div><button aria-pressed={flow} onClick={()=>setFlow(v=>!v)}>{flow?'Flow on':'Flow off'}</button><button aria-label="Hint" className={needsHint?'hint-ready':''} aria-pressed={drawer==='Hint'} onClick={()=>setDrawer(d=>d==='Hint'?null:'Hint')}>? Hint{needsHint&&<i/>}</button></div>
          <div className="scene-wrap"><Workshop state={state} selected={selected} setSelected={select} flow={flow||guided&&state.tutorial.phase==='demo'} pulse={pulse} beginner={guided||welcome} highlight={guided?lesson.target:undefined} earningPulse={earningActive&&earnings.bursts.length>0} presentationPaused={!earningActive}/>{purchaseText&&<div className="purchase-float" key={purchaseText} role="status">{purchaseText}</div>}<div className="billing-bursts" data-testid="billing-earnings" data-total={earnings.shown.toFixed(2)} aria-label="Customer revenue at the response terminal">{earningActive&&earnings.bursts.map(b=><span key={b.id} className="earning-burst" data-amount={b.amount.toFixed(2)}>+${b.amount.toFixed(2)}</span>)}</div></div>
          {purchaseImpact&&<section className="purchase-result" role="status"><header><strong>Upgrade applied</strong><button aria-label="Dismiss upgrade feedback" onClick={()=>setPurchaseImpact(null)}>×</button></header><ImpactDetails impact={purchaseImpact}/></section>}
          <div className="workshop-footer"><div className="selection-readout"><i/>{equipmentNames[selected as EquipmentId]??selected.replace('_',' ')} <span>{equipmentIds.includes(selected as EquipmentId)?'LV '+state.equipmentLevels[selected as EquipmentId]:'SYSTEM CONTROL'}</span></div><div>{state.incident?<span className="incident-badge">⚠ {state.incident.title} · {Math.ceil(state.incident.remaining)}m</span>:state.challenge.active?<span className="incident-badge">LAUNCH DAY · {Math.ceil(state.challenge.remaining)}m · {Math.round(progress*100)}% served</span>:<span className="scene-caption">Click equipment to upgrade it.</span>}</div></div>
          <nav className="nav-tabs" aria-label="Lab details">{(['Diagnostics','Operations','Achievements','Events'] as const).map(name=><button key={name} aria-pressed={drawer===name} onClick={()=>setDrawer(d=>d===name?null:name)}>{name}{name==='Achievements'&&<small>{state.achievementIDs.length}/10</small>}</button>)}</nav>
          {drawer&&<section className="context-drawer" aria-label={drawer}><header><div><span className="eyebrow">LAB / {drawer.toUpperCase()}</span><h2>{drawer==='Hint'?'Need a direction?':drawer}</h2></div><button aria-label="Close details" onClick={()=>setDrawer(null)}>×</button></header><div className="drawer-body">
            {drawer==='Hint'&&<><h3>{recommendation.title.replace('Current priority: ','')}</h3><p>{recommendation.reason}</p>{recommendation.upgradeId&&<button className="primary" onClick={()=>{select(recommendation.upgradeId!);setDrawer(null)}}>Show upgrade →</button>}</>}
            {drawer==='Diagnostics'&&<Diagnostics state={state}/>}
            {drawer==='Operations'&&<Operations state={state} policy={(k,v)=>setState(s=>setPolicy(s,k,v))} launch={()=>setState(startChallenge)}/>}
            {drawer==='Achievements'&&<div className="achievement-list">{ACHIEVEMENTS.map(a=><article key={a.id} className={state.achievementIDs.includes(a.id)?'earned':''}><span>{state.achievementIDs.includes(a.id)?'✓':'◇'}</span><div><h3>{a.name}</h3><p>{a.description}</p></div><strong>{state.achievementIDs.includes(a.id)?'Earned':money(a.reward)}</strong></article>)}</div>}
            {drawer==='Events'&&<><div className="event-report-list">{state.eventReports.map(r=><button key={r.id} onClick={()=>setHistoryReport(r)}><strong>{r.title}</strong><span>{num(r.duration)} game minutes · {money(r.gross)} gross → View report</span></button>)}</div><div className="event-list">{state.logs.map(l=><div key={l.id} className={l.tone}><time>{Math.floor(l.time)}m</time><p>{l.text}</p></div>)}</div></>}
          </div></section>}
        </section>
        <UpgradeTray state={state} selected={selected} select={select} tab={tab} setTab={setTab} quantity={quantity} setQuantity={setQuantity} buyEquipment={buyEquipment} buyTechnology={buyTechnology} pulse={pulse}/>
      </main>
      <footer className="bottom-bar"><div className="sim-controls"><button disabled={guided} onClick={()=>setState(togglePause)}>{state.paused?'▶ Resume':'Ⅱ Pause'}</button>{([1,2,4]as const).map(n=><button disabled={guided} key={n} aria-pressed={state.speed===n} onClick={()=>setState(s=>setSpeed(s,n))}>{n}×</button>)}</div><span className="game-time">{Math.floor(state.elapsed)} GAME MINUTES <i/> {state.paused?'PAUSED':state.speed+'× SPEED'}</span><div className="settings-controls"><button onClick={()=>setMuted(v=>!v)}>Sound {muted?'off':'on'}</button><button onClick={()=>setReduced(v=>!v)}>Motion {reduced?'off':'on'}</button><button onClick={()=>setHelpOpen(true)}>Help</button><button onClick={()=>setSaveOpen(true)}>Save</button><button onClick={reset}>Reset</button></div></footer>
      {reward&&<div className="reward-toast" data-testid="achievement-toast" role="status"><span>✦ ACHIEVEMENT UNLOCKED</span><strong>{reward.name}</strong><b>+{money(reward.cash)}</b></div>}
    </div>
    {welcome&&<Modal title="Your cloud starts here." eyebrow="WELCOME TO CLOUDLAB" symbol="▥"><p>A borrowed server. A city full of customers.<br/>Build the infrastructure that keeps them connected.</p><div className="welcome-path"><span>PROCESS</span><i>→</i><span>EARN</span><i>→</i><span>UPGRADE</span></div><small>Learn the basics with funded upgrades, or jump straight into your workshop.</small><div className="modal-actions"><button onClick={()=>setState(skipTutorial)}>Skip to sandbox</button><button className="primary" onClick={()=>setState(startTutorial)}>Start tutorial</button></div></Modal>}
    {!welcome&&announcement&&<Modal title={announcement.title} eyebrow={announcement.kind==='incident'?'CITY FEED / INCOMING':announcement.kind==='report'?'EVENT / RESULTS':announcement.kind==='challenge'?'LAUNCH / RESULTS':'NEW TECHNOLOGY / ACQUIRED'} illustration={announcement.illustration} symbol={announcement.illustration?undefined:'✦'}>{report?<EventDetails report={report}/>:<><p>{announcement.body}</p>{announcement.impact&&<ImpactDetails impact={announcement.impact}/>} {announcement.tip&&<p className="technology-tip">{announcement.tip}</p>}</>}<div className="modal-actions"><button className="primary" onClick={()=>setState(s=>acknowledgeAnnouncement(s,announcement.id))}>Continue</button></div></Modal>}
    {historyReport&&<Modal title={historyReport.title} eyebrow="EVENT / ARCHIVE" illustration={historyReport.kind} close={closeHistory}><EventDetails report={historyReport}/><div className="modal-actions"><button className="primary" onClick={closeHistory}>Continue</button></div></Modal>}
    {saveOpen&&<SaveDialog state={state} close={closeSave} restore={restore}/>}
    {helpOpen&&<Modal title="Field guide" eyebrow="LEARN AS YOU BUILD" close={closeHelp}><p><strong>CPU</strong> processes requests. <strong>Memory</strong> holds active work. <strong>Storage</strong> reads and writes data. <strong>Network</strong> controls how many requests can enter.</p><p>Equipment levels increase permanent capacity. Technology unlocks new ways to route, protect, and scale your service. Use Hint whenever you want a recommendation.</p><small>Replay uses a training preview and preserves your live lab.</small><div className="modal-actions"><button onClick={closeHelp}>Back to lab</button><button className="primary" onClick={()=>{setHelpOpen(false);setState(replayTutorial)}}>Replay tutorial</button></div></Modal>}
  </div>
}
