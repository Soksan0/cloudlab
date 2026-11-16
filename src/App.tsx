import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createInitialState, inspectDiagnostics, loadGame, purchaseUpgrade, serializeGame,
  setPolicy, setSpeed, startChallenge, stepGame, togglePause,
} from './sim/engine'
import { UPGRADES, upgradeById } from './sim/upgrades'
import type { GameState, Metrics, PolicyState, UpgradeId } from './sim/types'

const SAVE_KEY = 'cloudlab-save-v1'

const money = (value: number) => {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (Math.abs(value) >= 10_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: value < 100 ? 1 : 0 })}`
}
const num = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 })
const clock = (elapsed: number) => `DAY ${Math.floor(elapsed / 24) + 1} · ${String(Math.floor(elapsed % 24)).padStart(2, '0')}:00`

function useGame() {
  const [state, setState] = useState<GameState>(() => {
    const saved = localStorage.getItem(SAVE_KEY)
    return saved ? loadGame(saved) ?? createInitialState() : createInitialState()
  })
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    let frame = 0
    let previous = performance.now()
    let accumulator = 0
    const loop = (now: number) => {
      const elapsed = Math.min(.5, (now - previous) / 1000)
      previous = now; accumulator += elapsed
      if (accumulator >= .1) {
        const dt = accumulator; accumulator = 0
        setState((current) => stepGame(current, dt))
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const save = () => localStorage.setItem(SAVE_KEY, serializeGame(stateRef.current))
    const timer = window.setInterval(save, 10_000)
    window.addEventListener('pagehide', save)
    return () => { window.clearInterval(timer); window.removeEventListener('pagehide', save) }
  }, [])

  useEffect(() => {
    localStorage.setItem(SAVE_KEY, serializeGame(state))
  }, [state.upgrades.length, state.tutorialComplete, state.challenge.result, state.policies])

  return { state, setState }
}

function Stat({ label, value, hint, tone = '' }: { label: string; value: string; hint?: string; tone?: string }) {
  return <div className={`stat ${tone}`} title={hint}><span>{label}</span><strong>{value}</strong></div>
}

const tutorialContent = [
  { eyebrow: 'ORIENTATION 1/4', title: 'Watch the traffic', text: 'Let 20 requests travel through the office server. Every successful response earns revenue.' },
  { eyebrow: 'ORIENTATION 2/4', title: 'Fix the red bottleneck', text: 'CPU capacity is below demand. Install the CPU Module from the upgrade console.' },
  { eyebrow: 'ORIENTATION 3/4', title: 'Read the diagnostics', text: 'Upgrading one stage can expose the next constraint. Inspect the stage meters below.' },
  { eyebrow: 'ORIENTATION 4/4', title: 'Add working memory', text: 'Install the Memory Bank, then the lab is yours to grow and experiment with.' },
]

function ObjectiveCard({ state, onInspect }: { state: GameState; onInspect: () => void }) {
  if (state.tutorialComplete) {
    const next = UPGRADES.find((upgrade) => !state.upgrades.includes(upgrade.id))
    return <section className="objective-card complete-card">
      <div className="eyebrow">OPEN LAB</div>
      <h2>{state.completed ? 'Endless Lab online' : next ? `Next capability: ${next.name}` : 'Architecture complete'}</h2>
      <p>{state.completed ? 'Keep tuning policies and testing the architecture against rising demand.' : next?.lesson ?? 'Prepare the AI service for Launch Day.'}</p>
      <div className="objective-progress"><i style={{ width: `${state.upgrades.length / 12 * 100}%` }} /></div>
      <small>{state.upgrades.length} / 12 technologies installed</small>
    </section>
  }
  const content = tutorialContent[state.tutorialStep] ?? tutorialContent[3]
  const progress = state.tutorialStep === 0 ? Math.min(100, state.totalServed / 20 * 100) : 100
  return <section className="objective-card">
    <div className="eyebrow">{content.eyebrow}</div>
    <h2>{content.title}</h2>
    <p>{content.text}</p>
    {state.tutorialStep === 0 && <><div className="objective-progress"><i style={{ width: `${progress}%` }} /></div><small>{Math.min(20, Math.floor(state.totalServed))} / 20 served</small></>}
    {state.tutorialStep === 2 && <button className="primary small" onClick={onInspect}>Inspect diagnostics <span>→</span></button>}
  </section>
}

type NodeProps = { x: number; y: number; title: string; code: string; active?: boolean; warning?: boolean; locked?: boolean; onClick: () => void; variant?: string }
function MapNode({ x, y, title, code, active = true, warning, locked, onClick, variant = '' }: NodeProps) {
  const keyDown = (event: React.KeyboardEvent<SVGGElement>) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick() }
  }
  return <g className={`map-node ${active ? 'active' : ''} ${warning ? 'warning' : ''} ${locked ? 'locked' : ''} ${variant}`} transform={`translate(${x} ${y})`} role="button" tabIndex={0} aria-label={`${title}${locked ? ', locked' : ''}`} onClick={onClick} onKeyDown={keyDown}>
    <rect className="node-shadow" x="5" y="6" width="122" height="78" rx="4" />
    <rect className="node-body" width="122" height="78" rx="4" />
    <rect className="node-top" x="8" y="9" width="106" height="36" rx="2" />
    <text className="node-code" x="61" y="33" textAnchor="middle">{locked ? '???' : code}</text>
    <circle className="node-light" cx="16" cy="62" r="4" />
    <rect className="node-slot" x="27" y="58" width="53" height="7" rx="2" />
    <text className="node-title" x="61" y="99" textAnchor="middle">{title}</text>
    {warning && <g className="warn-badge" transform="translate(105 -8)"><path d="M0 19 11 0l11 19Z"/><text x="11" y="15" textAnchor="middle">!</text></g>}
  </g>
}

function InfrastructureMap({ state, selected, setSelected }: { state: GameState; selected: string; setSelected: (value: string) => void }) {
  const has = (id: UpgradeId) => state.upgrades.includes(id)
  const bottleneck = state.metrics.bottleneck
  const packetClass = state.metrics.successRate < .85 ? 'packet packet-warn' : 'packet'
  return <section className="map-shell" aria-label="Infrastructure map">
    <header className="panel-heading">
      <div><span className="eyebrow">LIVE ARCHITECTURE</span><h2>Request flow</h2></div>
      <div className={`health-pill ${state.metrics.successRate >= .98 ? 'healthy' : 'strained'}`}><i />{state.metrics.successRate >= .98 ? 'ALL SYSTEMS NOMINAL' : 'CAPACITY STRAIN'}</div>
    </header>
    <div className="map-stage">
      <div className="map-grid" />
      <svg viewBox="0 0 1030 520" role="img" aria-label="Customer requests flowing through the CloudLab infrastructure">
        <defs>
          <filter id="glow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <linearGradient id="cloudGlow" x1="0" x2="1"><stop stopColor="#44d9c5"/><stop offset="1" stopColor="#6e8dff"/></linearGradient>
        </defs>
        <path className="flow-line active-line" d="M128 267H204" />
        <path className={`flow-line ${has('cache') ? 'active-line' : ''}`} d="M326 267H380" />
        <path className={`flow-line ${has('load_balancer') ? 'active-line' : ''}`} d="M502 267H558" />
        <path className="flow-line active-line" d="M680 267H752" />
        <path className="flow-line active-line" d="M874 267H940" />
        <path className={`flow-line cloud-line ${has('cloud') ? 'active-line' : ''}`} d="M619 223V132H752" />
        <path className={`flow-line cloud-line ${has('ai') ? 'active-line' : ''}`} d="M874 90H940" />
        <path className={`flow-line ${has('server2') ? 'active-line' : ''}`} d="M619 311v78h133" />

        <g className={state.paused ? 'packets paused' : 'packets'} aria-hidden="true">
          {[0, .7, 1.4].map((delay) => <circle key={`a${delay}`} className={packetClass} r="5"><animateMotion dur="2.2s" begin={`${delay}s`} repeatCount="indefinite" path="M128 267H940" /></circle>)}
          {has('cloud') && <circle className="packet packet-cloud" r="5"><animateMotion dur="2.7s" repeatCount="indefinite" path="M502 267H619V90H940" /></circle>}
        </g>

        <g className="internet-node" transform="translate(35 222)">
          <circle cx="46" cy="44" r="42"/><path d="M10 44h72M46 4c17 18 17 62 0 80M46 4c-17 18-17 62 0 80M16 22h60M16 66h60"/>
          <text x="46" y="106" textAnchor="middle">CUSTOMERS</text>
        </g>

        <MapNode x={204} y={228} title="Gateway" code="NET" warning={bottleneck === 'network'} onClick={() => setSelected('gateway')} />
        <MapNode x={380} y={228} title="Edge cache" code="CDN" active={has('cache')} locked={!has('cache')} onClick={() => setSelected('cache')} />
        <MapNode x={558} y={228} title="Load balancer" code="LB" active={has('load_balancer')} locked={!has('load_balancer')} onClick={() => setSelected('load_balancer')} />
        <MapNode x={752} y={228} title="Office server" code="SRV-1" warning={['compute','memory'].includes(bottleneck)} onClick={() => setSelected('server')} />
        <MapNode x={752} y={350} title="Second server" code="SRV-2" active={has('server2')} locked={!has('server2')} onClick={() => setSelected('server2')} />
        <MapNode x={940} y={228} title="Storage" code="DATA" warning={bottleneck === 'storage'} onClick={() => setSelected('storage')} />
        <MapNode x={752} y={50} title="Cloud compute" code="CLD" active={has('cloud')} locked={!has('cloud')} onClick={() => setSelected('cloud')} variant="cloud-node" />
        <MapNode x={940} y={50} title="AI inference" code="GPU" active={has('ai')} locked={!has('ai')} warning={bottleneck === 'ai'} onClick={() => setSelected('ai')} variant="ai-node" />
      </svg>
      <div className="map-legend"><span><i className="legend-live"/>request</span><span><i className="legend-cloud"/>cloud route</span><span><i className="legend-warn"/>bottleneck</span></div>
      <div className="selected-readout">SELECTED // <strong>{selected.replace('_', ' ').toUpperCase()}</strong></div>
    </div>
  </section>
}

function CapacityBar({ label, value, utilization, warning }: { label: string; value: string; utilization: number; warning?: boolean }) {
  return <div className={`capacity-row ${warning ? 'hot' : ''}`}>
    <div><span>{label}</span><strong>{value}</strong></div>
    <div className="capacity-track"><i style={{ width: `${Math.max(3, utilization * 100)}%` }} /></div>
    <small>{Math.round(utilization * 100)}%</small>
  </div>
}

function Diagnostics({ metrics }: { metrics: Metrics }) {
  const bottleneckLabel = metrics.bottleneck === 'compute' ? 'CPU' : metrics.bottleneck.toUpperCase()
  return <section className="diagnostics panel">
    <header className="panel-heading compact"><div><span className="eyebrow">DIAGNOSTICS</span><h2>Capacity stages</h2></div><span className={`bottleneck-tag ${metrics.bottleneck === 'healthy' ? 'ok' : ''}`}>{metrics.bottleneck === 'healthy' ? 'BALANCED' : `${bottleneckLabel} LIMITED`}</span></header>
    <div className="capacity-list">
      <CapacityBar label="NETWORK" value={`${num(metrics.network)} req/m`} utilization={metrics.utilizations.network} warning={metrics.bottleneck === 'network'} />
      <CapacityBar label="CPU" value={`${num(metrics.compute)} req/m`} utilization={metrics.utilizations.compute} warning={metrics.bottleneck === 'compute'} />
      <CapacityBar label="MEMORY" value={`${num(metrics.memory)} req/m`} utilization={metrics.utilizations.memory} warning={metrics.bottleneck === 'memory'} />
      <CapacityBar label="STORAGE" value={`${num(metrics.storage)} req/m`} utilization={metrics.utilizations.storage} warning={metrics.bottleneck === 'storage'} />
      {metrics.aiCapacity > 0 && <CapacityBar label="AI / GPU" value={`${num(metrics.aiCapacity)} req/m`} utilization={metrics.utilizations.ai} warning={metrics.bottleneck === 'ai'} />}
    </div>
  </section>
}

function UpgradePanel({ state, onBuy }: { state: GameState; onBuy: (id: UpgradeId) => void }) {
  const [category, setCategory] = useState<'all' | 'hardware' | 'reliability' | 'cloud' | 'advanced'>('all')
  const list = category === 'all' ? UPGRADES : UPGRADES.filter((item) => item.category === category)
  return <section className="upgrade-panel panel">
    <header className="panel-heading"><div><span className="eyebrow">PROCUREMENT</span><h2>Upgrade console</h2></div><span className="upgrade-count">{state.upgrades.length}/12</span></header>
    <div className="filter-tabs" role="tablist" aria-label="Upgrade categories">
      {(['all','hardware','reliability','cloud','advanced'] as const).map((value) => <button key={value} className={category === value ? 'active' : ''} onClick={() => setCategory(value)}>{value === 'reliability' ? 'SAFE' : value.slice(0,4).toUpperCase()}</button>)}
    </div>
    <div className="upgrade-list">
      {list.map((item) => {
        const installed = state.upgrades.includes(item.id)
        const missing = item.prerequisites.filter((id) => !state.upgrades.includes(id))
        const affordable = state.cash >= item.cost
        const enabled = !installed && missing.length === 0 && affordable
        const reason = installed ? 'INSTALLED' : missing.length ? `LOCKED · ${missing.map((id) => upgradeById[id].name).join(' + ')}` : affordable ? 'READY TO INSTALL' : `${money(item.cost - state.cash)} NEEDED`
        return <article className={`upgrade-card ${installed ? 'installed' : ''} ${enabled ? 'ready' : ''}`} key={item.id}>
          <div className="upgrade-icon">{installed ? '✓' : item.icon}</div>
          <div className="upgrade-copy"><div className="upgrade-title"><h3>{item.name}</h3><strong>{installed ? 'OWNED' : money(item.cost)}</strong></div><p>{item.short}</p><small>{item.effect}</small><div className="lesson">{item.lesson}</div></div>
          <button disabled={!enabled} onClick={() => onBuy(item.id)} aria-label={`Purchase ${item.name}`}>{reason}</button>
        </article>
      })}
    </div>
  </section>
}

function PolicySelect<T extends string>({ label, value, options, disabled, onChange }: { label: string; value: T; options: {value:T; label:string; help:string}[]; disabled: boolean; onChange: (value:T) => void }) {
  return <div className="policy-block"><label>{label}</label><div className="segmented">{options.map((option) => <button key={option.value} className={value === option.value ? 'active' : ''} disabled={disabled} onClick={() => onChange(option.value)} title={option.help}>{option.label}</button>)}</div><p>{options.find((x) => x.value === value)?.help}</p></div>
}

function Operations({ state, onPolicy, onChallenge }: { state: GameState; onPolicy: (group: keyof PolicyState, value: string) => void; onChallenge: () => void }) {
  const cooldown = Math.max(0, Math.ceil(state.policyCooldownUntil - state.elapsed))
  const has = (id: UpgradeId) => state.upgrades.includes(id)
  return <section className="operations panel">
    <header className="panel-heading compact"><div><span className="eyebrow">OPERATIONS</span><h2>Runtime policies</h2></div>{cooldown > 0 && <span className="cooldown">SYNC {cooldown}s</span>}</header>
    {!has('load_balancer') && <div className="empty-state"><span>◈</span><p>Install a load balancer to unlock live operating policies.</p></div>}
    {has('load_balancer') && <PolicySelect label="TRAFFIC" value={state.policies.loadBalancer} disabled={cooldown > 0} onChange={(v) => onPolicy('loadBalancer', v)} options={[{value:'efficiency',label:'EFFICIENCY',help:'+10% capacity; greater outage impact.'},{value:'redundancy',label:'REDUNDANCY',help:'−10% capacity; hardware faults hurt less.'}]} />}
    {has('security') && <PolicySelect label="FIREWALL" value={state.policies.firewall} disabled={cooldown > 0} onChange={(v) => onPolicy('firewall', v)} options={[{value:'balanced',label:'BALANCED',help:'Strong protection without a compute penalty.'},{value:'strict',label:'STRICT',help:'Maximum protection; uses 8% on-prem compute.'}]} />}
    {has('autoscaling') && <PolicySelect label="AUTOSCALING" value={state.policies.autoscaling} disabled={cooldown > 0} onChange={(v) => onPolicy('autoscaling', v)} options={[{value:'economy',label:'ECONOMY',help:'Runs hotter to keep the cloud bill low.'},{value:'resilient',label:'RESILIENT',help:'Keeps extra headroom for sudden demand.'}]} />}
    {has('ai') && <div className={`challenge-card ${state.completed ? 'passed' : ''}`}><span className="eyebrow">FINAL VALIDATION</span><h3>{state.completed ? 'Launch Day passed' : 'Launch Day'}</h3><p>{state.completed ? 'Endless Lab is active. Demand and incidents will continue.' : '90-minute peak: serve 90% of traffic and finish with 65 reputation.'}</p>{!state.completed && <button className="primary" onClick={onChallenge} disabled={state.challenge.active || state.elapsed < state.challenge.retryAt}>{state.challenge.active ? `${Math.ceil(state.challenge.remaining)}m remaining` : state.elapsed < state.challenge.retryAt ? `Retry in ${Math.ceil(state.challenge.retryAt-state.elapsed)}m` : 'Start Launch Day'}</button>}{state.challenge.result === 'failed' && <small>Last attempt missed the target. Review diagnostics and retry.</small>}</div>}
  </section>
}

function EventLog({ state }: { state: GameState }) {
  return <section className="event-log panel"><header className="panel-heading compact"><div><span className="eyebrow">SYSTEM LOG</span><h2>Recent events</h2></div><span className="live-dot">LIVE</span></header><div className="log-list">{state.logs.map((entry) => <div className={entry.tone} key={entry.id}><time>D{Math.floor(entry.time/24)+1}:{String(Math.floor(entry.time%24)).padStart(2,'0')}</time><p>{entry.text}</p></div>)}</div></section>
}

function SaveDialog({ state, onClose, onImport }: { state: GameState; onClose: () => void; onImport: (state: GameState) => void }) {
  const [value, setValue] = useState(() => serializeGame(state))
  const [message, setMessage] = useState('Paste a save here to import, or copy the current snapshot.')
  const copy = async () => { await navigator.clipboard.writeText(serializeGame(state)); setMessage('Save copied to clipboard.') }
  const load = () => { const parsed = loadGame(value); if (parsed) { onImport(parsed); onClose() } else setMessage('That save is invalid or incompatible.') }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}><section className="save-dialog" role="dialog" aria-modal="true" aria-labelledby="save-title"><header><div><span className="eyebrow">LOCAL SAVE</span><h2 id="save-title">Export / import lab</h2></div><button className="icon-button" onClick={onClose} aria-label="Close">×</button></header><p>{message}</p><textarea value={value} onChange={(e) => setValue(e.target.value)} spellCheck={false} aria-label="Save data"/><div className="dialog-actions"><button onClick={copy}>Copy current save</button><button className="primary" onClick={load}>Import pasted save</button></div></section></div>
}

function App() {
  const { state, setState } = useGame()
  const [selected, setSelected] = useState('server')
  const [saveOpen, setSaveOpen] = useState(false)
  const [muted, setMuted] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)

  const beep = useCallback((frequency = 520) => {
    if (muted) return
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const context = new AudioContextClass(); const osc = context.createOscillator(); const gain = context.createGain()
    osc.type = 'square'; osc.frequency.value = frequency; gain.gain.setValueAtTime(.035, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .09)
    osc.connect(gain); gain.connect(context.destination); osc.start(); osc.stop(context.currentTime + .1)
  }, [muted])

  const buy = (id: UpgradeId) => setState((current) => { const next = purchaseUpgrade(current, id); if (next !== current) beep(700); return next })
  const reset = () => { if (window.confirm('Reset CloudLab? This permanently replaces your local progress.')) { localStorage.removeItem(SAVE_KEY); setState(createInitialState()) } }
  const challengeRate = state.challenge.totalDemand ? state.challenge.totalServed / state.challenge.totalDemand : 1
  const incidentProgress = state.incident ? 1 - state.incident.remaining / state.incident.total : 0
  const topTone = state.metrics.net >= 0 ? 'positive' : 'negative'
  const accessibleStatus = useMemo(() => `${Math.round(state.metrics.successRate*100)} percent of requests served. ${state.metrics.bottleneck === 'healthy' ? 'No bottleneck' : `${state.metrics.bottleneck === 'compute' ? 'CPU' : state.metrics.bottleneck} is the current bottleneck`}.`, [state.metrics])

  return <div className={`app ${reducedMotion ? 'reduce-motion' : ''}`}>
    <a className="skip-link" href="#upgrade-console">Skip to upgrades</a>
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><i/><i/><i/><i/></div><div><h1>CLOUD<span>LAB</span></h1><small>INFRASTRUCTURE TYCOON</small></div></div>
      <div className="status-strip" aria-live="polite">
        <Stat label="CASH" value={money(state.cash)} tone="cash" />
        <Stat label="DEMAND" value={`${num(state.metrics.demand)}/m`} hint="Incoming customer requests per in-game minute" />
        <Stat label="SERVED" value={`${Math.round(state.metrics.successRate*100)}%`} tone={state.metrics.successRate >= .98 ? 'positive' : 'warning'} />
        <Stat label="LATENCY" value={`${Math.round(state.metrics.latency)}ms`} tone={state.metrics.latency > 400 ? 'warning' : ''} />
        <Stat label="NET INCOME" value={`${state.metrics.net >= 0 ? '+' : ''}${money(state.metrics.net)}/m`} tone={topTone} />
        <Stat label="REPUTATION" value={`${Math.round(state.reputation)}`} tone={state.reputation >= 65 ? 'positive' : ''} />
      </div>
      <div className="clock-block"><span>{clock(state.elapsed)}</span><strong>{state.paused ? 'PAUSED' : `${state.speed}× SPEED`}</strong></div>
    </header>

    <main>
      <aside className="left-column">
        <ObjectiveCard state={state} onInspect={() => setState(inspectDiagnostics)} />
        {state.incident && <section className="incident-card" aria-live="assertive"><div className="incident-head"><span>⚠ ACTIVE INCIDENT</span><strong>{Math.ceil(state.incident.remaining)}m</strong></div><h2>{state.incident.title}</h2><p>{state.incident.detail}</p><div className="incident-track"><i style={{width:`${incidentProgress*100}%`}}/></div><small>{state.incident.kind === 'hardware' ? 'Recovery and redundancy reduce outage duration.' : state.incident.kind === 'bot' ? 'Firewall policy reduces attack impact.' : state.incident.kind === 'billing' ? 'Watch net income and autoscaling policy.' : 'Capacity upgrades and caching absorb spikes.'}</small></section>}
        {state.challenge.active && <section className="incident-card challenge-live"><div className="incident-head"><span>◆ LAUNCH DAY</span><strong>{Math.ceil(state.challenge.remaining)}m</strong></div><h2>Service target: 90%</h2><div className="challenge-number">{Math.round(challengeRate*100)}<small>% served</small></div><div className="incident-track"><i style={{width:`${Math.min(100, challengeRate*100)}%`}}/></div><p>Finish with reputation 65+. Current: {Math.round(state.reputation)}</p></section>}
        <Operations state={state} onPolicy={(group, value) => setState((s) => setPolicy(s, group, value))} onChallenge={() => setState(startChallenge)} />
        <EventLog state={state} />
      </aside>

      <div className="center-column">
        <div className="sr-only" aria-live="polite">{accessibleStatus}</div>
        <InfrastructureMap state={state} selected={selected} setSelected={setSelected} />
        <Diagnostics metrics={state.metrics} />
        <section className="economy-panel panel"><header><span>ECONOMY FLOW</span><small>per game minute</small></header><div className="economy-flow"><div><span>SUCCESSFUL REQUESTS</span><strong>{num(state.metrics.served)}</strong></div><b>×</b><div><span>REVENUE</span><strong>{money(state.metrics.gross)}</strong></div><b>−</b><div><span>OPERATING COST</span><strong>{money(state.metrics.expenses)}</strong></div><b>=</b><div className={state.metrics.net >= 0 ? 'profit' : 'loss'}><span>NET INCOME</span><strong>{state.metrics.net >= 0 ? '+' : ''}{money(state.metrics.net)}</strong></div></div>{state.metrics.cacheHits > 0 && <footer>Edge cache served <strong>{num(state.metrics.cacheHits)}</strong> requests without origin compute.</footer>}</section>
      </div>

      <aside className="right-column" id="upgrade-console"><UpgradePanel state={state} onBuy={buy} /></aside>
    </main>

    <footer className="controlbar">
      <div className="sim-controls"><button className={state.paused ? 'active' : ''} onClick={() => setState(togglePause)}>{state.paused ? '▶ RESUME' : 'Ⅱ PAUSE'}</button>{([1,2,4] as const).map((speed) => <button key={speed} className={state.speed === speed ? 'active' : ''} onClick={() => setState((s) => setSpeed(s, speed))}>{speed}×</button>)}</div>
      <div className="ticker"><span>LIVE</span><p>{state.logs[0]?.text}</p></div>
      <div className="utility-controls"><button onClick={() => setReducedMotion((x) => !x)} className={reducedMotion ? 'active' : ''} title="Toggle reduced motion">MOTION {reducedMotion ? 'OFF' : 'ON'}</button><button onClick={() => setMuted((x) => !x)} title="Toggle sound">{muted ? 'SOUND OFF' : 'SOUND ON'}</button><button onClick={() => setSaveOpen(true)}>SAVE</button><button onClick={reset}>RESET</button></div>
    </footer>
    {saveOpen && <SaveDialog state={state} onClose={() => setSaveOpen(false)} onImport={setState} />}
  </div>
}

export default App
