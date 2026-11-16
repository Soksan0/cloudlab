import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  createInitialState, loadGame, purchaseUpgrade, serializeGame, setPolicy, setSpeed,
  startChallenge, stepGame, togglePause, startTutorial, advanceTutorial, skipTutorial,
  replayTutorial, getTutorialLesson, getRecommendation, getPurchaseAdvice, getChallengeReadiness,
  canPurchase, getEffectiveUpgrades,
} from './sim/engine'
import { UPGRADES, upgradeById } from './sim/upgrades'
import type { GameState, PolicyState, UpgradeId } from './sim/types'
import InfrastructureMap from './InfrastructureMap'

const SAVE_KEY = 'cloudlab-save-v1'
const money = (n: number) => '$' + n.toLocaleString(undefined, { maximumFractionDigits: Math.abs(n) < 100 ? 1 : 0 })
const num = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 })
const stageName = (s: string) => s === 'compute' ? 'CPU' : s.charAt(0).toUpperCase() + s.slice(1)

function useGame(suspended: boolean) {
  const [notice, setNotice] = useState('')
  const [state, setState] = useState<GameState>(() => {
    try { const save = localStorage.getItem(SAVE_KEY); return save ? loadGame(save) ?? createInitialState() : createInitialState() }
    catch { return createInitialState() }
  })
  const current = useRef(state); current.current = state
  const suspension = useRef(suspended); suspension.current = suspended
  const save = useCallback(() => {
    try { localStorage.setItem(SAVE_KEY, serializeGame(current.current)) }
    catch { setNotice('Autosave is unavailable. Use Save to copy an export before leaving.') }
  }, [])
  useEffect(() => {
    let frame: number, previous = performance.now(), accumulator = 0
    const loop = (now: number) => {
      const dt = Math.max(0, (now - previous) / 1000); previous = now
      if (document.hidden || suspension.current) accumulator = 0
      else {
        accumulator += Math.min(dt, 1)
        if (accumulator >= .1) { const delta = accumulator; accumulator = 0; setState(s => stepGame(s, delta)) }
      }
      frame = requestAnimationFrame(loop)
    }
    const visibility = () => { previous = performance.now(); accumulator = 0; if (document.hidden) save() }
    frame = requestAnimationFrame(loop)
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', save)
    const timer = window.setInterval(save, 10_000)
    return () => { cancelAnimationFrame(frame); clearInterval(timer); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', save) }
  }, [save])
  useEffect(save, [save, state.upgrades.length, state.paused, state.speed, state.tutorial.status, state.tutorial.step, state.tutorial.phase, state.challenge.active, state.challenge.result, state.policies])
  return { state, setState, notice }
}

function Modal({ title, eyebrow, children, close }: { title: string; eyebrow: string; children: ReactNode; close?: () => void }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const node = ref.current!
    const focusable = () => [...node.querySelectorAll<HTMLElement>('button:not(:disabled),textarea,a[href],[tabindex="0"]')]
    ;(node.querySelector<HTMLElement>('.primary') ?? focusable()[0] ?? node).focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && close) { e.preventDefault(); close() }
      if (e.key === 'Tab') {
        const items = focusable(); const first = items[0], last = items.at(-1)
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }
    node.addEventListener('keydown', key)
    return () => { node.removeEventListener('keydown', key); previous?.focus() }
  }, [close])
  return <div className="modal-backdrop"><section ref={ref} className="save-dialog welcome-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabIndex={-1}>
    <header><div><span className="eyebrow">{eyebrow}</span><h2 id="dialog-title">{title}</h2></div>{close && <button className="icon-button" onClick={close} aria-label="Close">×</button>}</header>{children}
  </section></div>
}

function SaveDialog({ state, close, onImport }: { state: GameState; close: () => void; onImport: (s: GameState) => void }) {
  const [value, setValue] = useState(() => serializeGame(state))
  const [message, setMessage] = useState('Your game saves automatically. Copy a backup, or paste a save to restore it.')
  return <Modal title="Export / import lab" eyebrow="LOCAL SAVE" close={close}><p role="status">{message}</p>
    <textarea aria-label="Save data" value={value} onChange={e => setValue(e.target.value)} spellCheck={false}/>
    <div className="dialog-actions"><button onClick={async () => { try { await navigator.clipboard.writeText(serializeGame(state)); setMessage('Save copied to clipboard.') } catch { setMessage('Clipboard unavailable. Select the save text and copy it manually.'); setValue(serializeGame(state)) } }}>Copy current save</button>
    <button className="primary" onClick={() => { const parsed = loadGame(value); if (parsed) { onImport(parsed); close() } else setMessage('That save is invalid or incompatible. Your current game is unchanged.') }}>Import pasted save</button></div>
  </Modal>
}

function Stat({ label, value, tone = '', hint }: { label: string; value: string; tone?: string; hint?: string }) {
  return <div className={'stat ' + tone} title={hint}><span>{label}</span><strong>{value}</strong></div>
}

function UpgradePanel({ state, buy, focusId }: { state: GameState; buy: (id: UpgradeId) => void; focusId?: string }) {
  const guided = state.tutorial.status === 'active' || state.tutorial.status === 'welcome'
  const lesson = getTutorialLesson(state)
  const [category, setCategory] = useState('all')
  const list = guided ? UPGRADES.filter(x => getEffectiveUpgrades(state).includes(x.id) || x.id === lesson.requiredUpgrade)
    : UPGRADES.filter(x => category === 'all' || x.category === category)
  useEffect(() => {
    if (focusId && !guided) setCategory('all')
    const timer = window.setTimeout(() => { if (focusId) document.getElementById('upgrade-' + focusId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, 30)
    return () => clearTimeout(timer)
  }, [focusId, guided])
  return <section className="upgrade-panel panel" aria-label="Upgrade console">
    <header className="panel-heading"><div><span className="eyebrow">{guided ? 'YOUR TRAINING WORKBENCH' : 'PROCUREMENT'}</span><h2>Upgrade console</h2></div><span className="upgrade-count">{state.upgrades.length}/12</span></header>
    {!guided && <div className="filter-tabs" aria-label="Upgrade categories">{['all','hardware','reliability','cloud','advanced'].map(c => <button key={c} aria-pressed={category === c} className={category === c ? 'active' : ''} onClick={() => setCategory(c)}>{c === 'reliability' ? 'SAFETY' : c.toUpperCase()}</button>)}</div>}
    <div className="upgrade-list">
      {list.length === 0 && <div className="empty-state"><span>◇</span><p>First, follow your guide. Your first upgrade appears when you learn what it fixes.</p></div>}
      {list.map(item => {
        const installed = state.upgrades.includes(item.id), permission = canPurchase(state, item.id)
        const required = guided && lesson.requiredUpgrade === item.id
        const waiting = !installed && item.cost > state.cash && state.metrics.net > 0
        const wait = Math.ceil((item.cost - state.cash) / (state.metrics.net * state.speed))
        return <article id={'upgrade-' + item.id} data-upgrade-id={item.id} key={item.id} className={'upgrade-card ' + (installed ? 'installed ' : permission.ok ? 'ready ' : '') + (required || focusId === item.id ? ' upgrade-target' : '')}>
          <div className="upgrade-icon">{installed ? '✓' : item.icon}</div><div className="upgrade-copy">
            <div className="upgrade-title"><h3>{item.name}</h3><strong>{installed ? 'OWNED' : money(item.cost)}</strong></div><p>{item.short}</p><small>{item.effect}</small>
            <details><summary>Why this helps</summary><p>{item.lesson}</p></details>
          </div>
          <button disabled={!permission.ok} onClick={() => buy(item.id)} aria-label={'Purchase ' + item.name}>{installed ? 'INSTALLED' : permission.ok ? 'INSTALL · ' + money(item.cost) : permission.reason}</button>
          {waiting && !guided && <small className="wait-estimate">About {wait < 60 ? wait + ' seconds' : Math.ceil(wait / 60) + ' minutes'} at {state.speed}×, if income stays steady.</small>}
        </article>
      })}
      {guided && <div className="future-milestones"><strong>LATER IN YOUR LAB</strong><p>More servers → load balancing → security → cloud → AI</p><small>Unlocked after orientation. One concept at a time.</small></div>}
    </div>
  </section>
}

function Diagnostics({ state, highlight }: { state: GameState; highlight: boolean }) {
  const m = state.metrics
  return <section id="diagnostics" className={'diagnostics panel' + (highlight ? ' tutorial-highlight' : '')}>
    <header className="panel-heading compact"><div><span className="eyebrow">FIND THE LIMIT</span><h2>Capacity stages</h2></div><span className={'bottleneck-tag ' + (m.bottleneck === 'healthy' ? 'ok' : '')}>{m.bottleneck === 'healthy' ? 'BALANCED' : stageName(m.bottleneck).toUpperCase() + ' LIMITED'}</span></header>
    <p className="diagnostic-help">Requests can only move as fast as the slowest required stage. A full meter means that stage has little spare capacity.</p>
    <div className="capacity-list">{(['network','compute','memory','storage','ai'] as const).filter(k => k !== 'ai' || m.aiCapacity > 0).map(k => {
      const cap = k === 'ai' ? m.aiCapacity : m[k]
      return <div key={k} className={'capacity-row ' + (m.bottleneck === k ? 'hot' : '')}><div><span>{stageName(k).toUpperCase()}</span><strong>{num(cap)} req/m</strong></div><div className="capacity-track"><i style={{ width: Math.max(2, m.utilizations[k] * 100) + '%' }}/></div><small>{Math.round(m.utilizations[k]*100)}%</small></div>
    })}</div><div className="request-summary"><span>✓ Served: <strong>{num(m.served)}/min</strong></span><span>! Dropped: <strong>{num(m.dropped)}/min</strong></span></div>
  </section>
}

function Operations({ state, policy, challenge }: { state: GameState; policy: (key: keyof PolicyState, value: string) => void; challenge: () => void }) {
  const has = (id: UpgradeId) => state.upgrades.includes(id), cooldown = Math.ceil(Math.max(0,state.policyCooldownUntil-state.elapsed))
  const readiness = getChallengeReadiness(state)
  return <section className="operations panel"><header className="panel-heading compact"><div><span className="eyebrow">OPERATIONS</span><h2>Runtime policies</h2></div>{cooldown > 0 && <span className="cooldown">SYNC {cooldown}m</span>}</header>
    {!has('load_balancer') && <div className="empty-state"><p>Load balancing unlocks your first operating choice. Start by improving the office server.</p></div>}
    {([
      ['loadBalancer','load_balancer','TRAFFIC',['efficiency','redundancy'],'Efficiency gives more capacity. Redundancy reduces the impact of hardware faults.'],
      ['firewall','security','FIREWALL',['balanced','strict'],'Strict blocks more malicious traffic, but uses 8% of on-premise compute.'],
      ['autoscaling','autoscaling','AUTOSCALING',['economy','resilient'],'Economy reacts in 10 game minutes. Resilient reacts in 3 and pays for extra headroom.'],
    ] as const).filter(([,id]) => has(id)).map(([key,,label,options,explanation]) => <div className="policy-block" key={key}><label>{label}</label><div className="segmented">{options.map(v => <button key={v} aria-label={label + ' ' + v} aria-pressed={state.policies[key] === v} className={state.policies[key] === v ? 'active' : ''} disabled={cooldown > 0} onClick={() => policy(key,v)}>{v.toUpperCase()}</button>)}</div><p>{explanation}</p></div>)}
    {has('ai') && <div className={'challenge-card ' + (state.completed ? 'passed' : '')}><span className="eyebrow">FINAL VALIDATION</span><h3>{state.completed ? 'Launch Day passed' : 'Launch Day'}</h3><p>{state.completed ? 'Endless Lab is active. Keep experimenting.' : 'Serve at least 90% of peak traffic over 90 game minutes, and finish with reputation 65+.'}</p>
      {!state.challenge.active && !state.completed && <><p className="readiness">{readiness.ready ? '✓ Architecture ready for the launch test.' : readiness.reasons.join(' ')}</p><button className="primary" onClick={challenge} disabled={state.elapsed < state.challenge.retryAt}>{state.elapsed < state.challenge.retryAt ? 'Retry in ' + Math.ceil(state.challenge.retryAt-state.elapsed) + 'm' : 'Start Launch Day'}</button></>}
      {state.challenge.result === 'failed' && <p>Last launch missed the target. Review your priority card, warm up capacity, then retry.</p>}
    </div>}
  </section>
}

export default function App() {
  const [saveOpen, setSaveOpen] = useState(false), [helpOpen, setHelpOpen] = useState(false)
  const [pendingBuy, setPendingBuy] = useState<UpgradeId | null>(null)
  const { state, setState, notice } = useGame(saveOpen || helpOpen || !!pendingBuy)
  const [selected, setSelected] = useState('server'), [focusId, setFocusId] = useState<string>()
  const [muted, setMuted] = useState(true), [reducedMotion, setReducedMotion] = useState(false)
  const [hint, setHint] = useState<{ id: string; title: string; reason: string } | null>(null)
  const [dismissed, setDismissed] = useState<string[]>([])
  const hintCandidate = useRef({ id: '', since: 0 })
  const audio = useRef<AudioContext | null>(null)
  const guided = state.tutorial.status === 'active', welcome = state.tutorial.status === 'welcome'
  const lesson = getTutorialLesson(state), recommendation = getRecommendation(state)
  useEffect(() => {
    if (guided) {
      window.scrollTo({ top: 0, behavior: 'instant' })
      const target = lesson.target === 'cpu' || lesson.target === 'memory' ? 'server' : lesson.target === 'ssd' ? 'storage' : lesson.target
      if (['server','gateway','storage'].includes(target)) setSelected(target)
    }
  }, [guided, state.tutorial.step, state.tutorial.phase, lesson.target])
  useEffect(() => {
    if (guided || welcome) return
    if (hintCandidate.current.id !== recommendation.id) hintCandidate.current = { id: recommendation.id, since: state.elapsed }
    if (state.metrics.successRate < .95 && state.elapsed - hintCandidate.current.since >= 6 && !dismissed.includes(recommendation.id)) {
      setHint({ id: recommendation.id, title: recommendation.title, reason: recommendation.reason })
    } else if (state.metrics.successRate >= .98) setHint(null)
  }, [recommendation.id, recommendation.title, recommendation.reason, state.elapsed, state.metrics.successRate, guided, welcome, dismissed])
  useEffect(() => () => { void audio.current?.close() }, [])
  const beep = () => {
    if (muted) return
    try {
      const ctx = audio.current ??= new AudioContext()
      void ctx.resume()
      const oscillator = ctx.createOscillator(), gain = ctx.createGain()
      oscillator.type = 'square'; oscillator.frequency.value = 660; gain.gain.setValueAtTime(.025,ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.12)
      oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(); oscillator.stop(ctx.currentTime+.13)
    } catch { setMuted(true) }
  }
  const confirmBuy = (id: UpgradeId) => { setState(s => purchaseUpgrade(s,id)); setPendingBuy(null); beep() }
  const buy = (id: UpgradeId) => { if (!guided && getPurchaseAdvice(state,id)) setPendingBuy(id); else confirmBuy(id) }
  const viewRecommendation = () => {
    setPendingBuy(null)
    if (recommendation.upgradeId) setFocusId(recommendation.upgradeId)
    window.setTimeout(() => {
      document.getElementById(recommendation.upgradeId ? 'upgrade-' + recommendation.upgradeId : 'upgrade-console')?.scrollIntoView({block:'nearest', behavior:'smooth'})
    }, 50)
  }
  const closeSave = useCallback(() => setSaveOpen(false), [])
  const closeHelp = useCallback(() => setHelpOpen(false), [])
  const closeBuy = useCallback(() => setPendingBuy(null), [])
  const reset = () => { if (window.confirm('Reset CloudLab? Export a save first if you want to keep this lab.')) { setState(createInitialState()); setHint(null); setDismissed([]) } }
  const dismissHint = () => { if(hint) setDismissed(x => [...x,hint.id]); setHint(null) }
  const minutes = Math.floor(state.elapsed), rate = state.challenge.totalDemand ? state.challenge.totalServed/state.challenge.totalDemand : 1

  return <div className={'app ' + (guided ? 'tutorial-layout ' : '') + (reducedMotion ? 'reduce-motion' : '')}>
    <a className="skip-link" href="#upgrade-console">Skip to upgrades</a>
    <div className="game-surface" inert={welcome || saveOpen || helpOpen || !!pendingBuy}>
      <header className="topbar"><div className="brand"><div className="brand-mark"><i/><i/><i/><i/></div><div><h1>CLOUD<span>LAB</span></h1><small>BUILD · LEARN · SCALE</small></div></div>
        <div className="status-strip">
          <Stat label="CASH" value={money(state.cash)} tone="cash"/>
          <Stat label="DEMAND" value={num(state.metrics.demand)+'/m'} hint="Requests arriving each game minute"/>
          <Stat label="SERVED" value={Math.round(state.metrics.successRate*100)+'%'} tone={state.metrics.successRate >= .98 ? 'positive' : 'warning'}/>
          <Stat label="LATENCY" value={Math.round(state.metrics.latency)+'ms'} hint="How long customers wait for a response"/>
          <Stat label="NET INCOME" value={(state.metrics.net >= 0 ? '+' : '')+money(state.metrics.net)+'/m'} tone={state.metrics.net >= 0 ? 'positive' : 'negative'}/>
          <Stat label="REPUTATION" value={Math.round(state.reputation)+'/100'}/>
        </div><div className="clock-block"><span>DAY {Math.floor(minutes/1440)+1} · {String(Math.floor(minutes/60)%24).padStart(2,'0')}:{String(minutes%60).padStart(2,'0')}</span><strong>{state.paused ? 'PAUSED' : state.speed+'× SPEED'}</strong></div>
      </header>
      {notice && <div className="storage-notice" role="status">{notice}</div>}
      {guided && <section className="tutorial-banner" data-testid="tutorial-banner" data-step={state.tutorial.step} data-phase={state.tutorial.phase} aria-label="Guided tutorial">
        <div><span className="eyebrow">LESSON {state.tutorial.step+1} / 8 · {state.tutorial.phase === 'demo' ? 'LIVE DEMONSTRATION' : 'TAKE YOUR TIME'}</span><h2 className="lesson-title">{lesson.title}</h2><p>{lesson.body}</p>{state.tutorial.replay && <small>Training preview: your real upgrades and money are preserved. Return to your live lab when you finish or skip.</small>}</div>
        <div className="lesson-actions">{state.tutorial.phase === 'demo' ? <span role="status">Observing… {Math.ceil(state.tutorial.demoRemaining)}s</span> : state.tutorial.phase === 'action' ? <strong>↓ Use the highlighted upgrade</strong> : <button className="primary" data-testid="tutorial-next" onClick={() => setState(advanceTutorial)}>{lesson.actionLabel}</button>}<button className="plain-button" onClick={() => setState(skipTutorial)}>Skip tutorial</button></div>
      </section>}
      <main>
        <aside className="left-column">
          <section className="advisor-card objective-card" data-testid="advisor-card">
            <span className="eyebrow">{guided ? 'YOUR GUIDE' : 'YOUR CURRENT PRIORITY'}</span>
            <h2>{guided ? lesson.title : recommendation.title}</h2><p>{guided ? 'Follow the highlighted instruction. The lab pauses while you read, and training grants fund your required upgrades.' : recommendation.reason}</p>
            {!guided && recommendation.upgradeId && <button className="primary small" onClick={viewRecommendation}>View recommendation →</button>}
            <div className="objective-progress"><i style={{width:(guided ? (state.tutorial.step+1)/8 : state.upgrades.length/12)*100+'%'}}/></div><small>{guided ? 'Guided orientation' : state.upgrades.length+' / 12 technologies installed'}</small>
          </section>
          {state.incident && <section className="incident-card" aria-live="polite"><div className="incident-head"><span>⚠ ACTIVE INCIDENT</span><strong>{Math.ceil(state.incident.remaining)}m</strong></div><h2>{state.incident.title}</h2><p>{state.incident.detail}</p><div className="incident-track"><i style={{width:(1-state.incident.remaining/state.incident.total)*100+'%'}}/></div><small>Your priority card explains which mitigation can help.</small></section>}
          {state.challenge.active && <section className="incident-card challenge-live"><div className="incident-head"><span>◆ LAUNCH DAY</span><strong>{Math.ceil(state.challenge.remaining)}m</strong></div><h2>Service target: 90%</h2><div className="challenge-number">{Math.round(rate*100)}<small>% served</small></div><p>Reputation: {Math.round(state.reputation)} / target 65</p></section>}
          {!guided && <Operations state={state} policy={(k,v) => setState(s => setPolicy(s,k,v))} challenge={() => setState(startChallenge)}/>}
          {!guided && <section className="event-log panel"><header className="panel-heading compact"><h2>Recent events</h2><span className="live-dot">LIVE</span></header><div className="log-list">{state.logs.map(entry => <div key={entry.id} className={entry.tone}><time>{Math.floor(entry.time)}m</time><p>{entry.text}</p></div>)}</div></section>}
        </aside>
        <div className="center-column">
          <InfrastructureMap state={guided && state.tutorial.replay ? { ...state, upgrades: getEffectiveUpgrades(state) } : state} selected={selected} setSelected={setSelected} beginner={guided || welcome} highlight={guided ? lesson.target : undefined}/>
          <Diagnostics state={state} highlight={guided && lesson.target === 'diagnostics'}/>
          <section id="economy" className={'economy-panel panel'+(guided && lesson.target === 'economy' ? ' tutorial-highlight' : '')}><header><span>HOW YOUR BUSINESS EARNS</span><small>per game minute</small></header>
            <div className="economy-flow"><div><span>REQUESTS SERVED</span><strong>{num(state.metrics.served)}</strong></div><b>→</b><div><span>REVENUE</span><strong>{money(state.metrics.gross)}</strong></div><b>−</b><div><span>RUNNING COST</span><strong>{money(state.metrics.expenses)}</strong></div><b>=</b><div className="profit"><span>NET INCOME</span><strong>{money(state.metrics.net)}</strong></div></div>
            <footer>Each served request earns $4; an AI request earns $12. Dropped requests earn nothing. One real second = one game minute at 1×.</footer>
          </section>
        </div>
        <aside className="right-column" id="upgrade-console"><UpgradePanel state={state} buy={buy} focusId={guided ? lesson.requiredUpgrade : focusId}/></aside>
      </main>
      <footer className="controlbar"><div className="sim-controls"><button disabled={guided || welcome} onClick={() => setState(togglePause)}>{state.paused ? '▶ RESUME' : 'Ⅱ PAUSE'}</button>{([1,2,4] as const).map(speed => <button key={speed} disabled={guided || welcome} className={state.speed === speed ? 'active' : ''} onClick={() => setState(s=>setSpeed(s,speed))}>{speed}×</button>)}</div><div className="ticker"><span>{guided ? 'GUIDE' : 'LIVE'}</span><p>{state.logs[0]?.text}</p></div><div className="utility-controls"><button onClick={() => setHelpOpen(true)}>HELP</button><button onClick={() => setReducedMotion(v=>!v)}>MOTION {reducedMotion ? 'OFF':'ON'}</button><button onClick={() => setMuted(v=>!v)}>SOUND {muted ? 'OFF':'ON'}</button><button onClick={() => setSaveOpen(true)}>SAVE</button><button onClick={reset}>RESET</button></div></footer>
      {hint && !guided && <section className="hint-toast" role="status"><button aria-label="Dismiss hint" className="icon-button" onClick={dismissHint}>×</button><span className="eyebrow">LAB HINT</span><h3>{hint.title}</h3><p>{hint.reason}</p><button className="primary small" onClick={() => { viewRecommendation(); dismissHint() }}>Show me</button></section>}
    </div>
    {welcome && <Modal title="Welcome to CloudLab" eyebrow="YOUR FIRST INFRASTRUCTURE LAB">
      <p>Start with a small office server. Learn how a customer request reaches your system, why bottlenecks happen, and how to fix them.</p>
      <ol className="welcome-steps"><li><strong>Follow a request</strong><span>See what your gateway, server, and storage do.</span></li><li><strong>Find and fix the bottleneck</strong><span>Install CPU, memory, and storage with training funds.</span></li><li><strong>Build your own architecture</strong><span>Expand into reliable cloud services and AI.</span></li></ol>
      <p>The tutorial pauses while you read. Required upgrades are funded, and nothing happens until you begin.</p>
      <div className="dialog-actions"><button onClick={() => setState(skipTutorial)}>Skip to sandbox</button><button className="primary" onClick={() => setState(startTutorial)}>Start tutorial</button></div>
    </Modal>}
    {saveOpen && <SaveDialog state={state} close={closeSave} onImport={setState}/>}
    {pendingBuy && <Modal title="Before you buy" eyebrow="ARCHITECTURE ADVICE" close={closeBuy}><p>{getPurchaseAdvice(state,pendingBuy)}</p><p><strong>Current priority: {recommendation.title}</strong></p><p>{recommendation.reason}</p><div className="dialog-actions"><button onClick={closeBuy}>Cancel</button><button onClick={() => confirmBuy(pendingBuy)}>Buy anyway</button><button className="primary" onClick={viewRecommendation}>View recommendation</button></div></Modal>}
    {helpOpen && <Modal title="Your infrastructure field guide" eyebrow="LEARN AT YOUR OWN PACE" close={closeHelp}><p><strong>A bottleneck</strong> is the stage with too little capacity for the work reaching it. Improve that stage first to serve more requests.</p><p><strong>Vertical scaling</strong> upgrades one machine. <strong>Horizontal scaling</strong> adds machines; a load balancer distributes their traffic.</p><p><strong>Reliability and security</strong> protect your service during failures and attacks. They do not always raise normal throughput.</p><p><strong>Caching</strong> reuses responses. <strong>Autoscaling</strong> rents capacity as demand changes, balancing cost with response time.</p><p>Replay the lessons on this lab without losing your money or installed upgrades.</p><div className="dialog-actions"><button onClick={closeHelp}>Back to lab</button><button className="primary" onClick={() => { setHelpOpen(false); setState(replayTutorial) }}>Replay tutorial</button></div></Modal>}
  </div>
}
