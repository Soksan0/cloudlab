import type { KeyboardEvent } from 'react'
import type { GameState, UpgradeId } from './sim/types'

type Props = { state: GameState; selected: string; setSelected: (value: string) => void; highlight?: string; beginner?: boolean }
const number = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 })

function MapNode({ x, y, name, code, active = true, warning = false, selected = false, highlight = false, onClick }: {
  x: number; y: number; name: string; code: string; active?: boolean; warning?: boolean; selected?: boolean; highlight?: boolean; onClick: () => void
}) {
  const keyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick() }
  }
  return <g className={`map-node ${active ? 'active' : 'locked'} ${warning ? 'warning' : ''} ${selected ? 'selected' : ''} ${highlight ? 'map-highlight' : ''}`} transform={`translate(${x} ${y})`} role="button" tabIndex={0} aria-label={`${name}${active ? '' : ', locked'}`} aria-pressed={selected} onClick={onClick} onKeyDown={keyDown}>
    <rect className="node-shadow" x="5" y="6" width="122" height="78" rx="4" />
    <rect className="node-body" width="122" height="78" rx="4" />
    <rect className="node-top" x="8" y="9" width="106" height="36" rx="2" />
    <text className="node-code" x="61" y="33" textAnchor="middle">{active ? code : 'FUTURE'}</text>
    <circle className="node-light" cx="16" cy="62" r="4" />
    <rect className="node-slot" x="27" y="58" width="53" height="7" rx="2" />
    <text className="node-title" x="61" y="101" textAnchor="middle">{name}</text>
    {warning && <g className="warn-badge" transform="translate(105 -8)"><path d="M0 19 11 0l11 19Z"/><text x="11" y="15" textAnchor="middle">!</text></g>}
  </g>
}

export default function InfrastructureMap({ state, selected, setSelected, highlight, beginner = false }: Props) {
  const has = (id: UpgradeId) => state.upgrades.includes(id)
  const m = state.metrics
  const compact = beginner && !['server2', 'load_balancer', 'cache', 'cloud', 'ai'].some((id) => has(id as UpgradeId))
  const serverX = compact ? 400 : 710
  const storageX = compact ? 610 : 920
  const details: Record<string, { name: string; explanation: string; capacity: string; upgrades: string }> = {
    gateway: { name: 'Network gateway', explanation: 'The front door of your system. Every request must pass through this connection before a server can answer it.', capacity: `${number(m.network)} requests/minute accepted`, upgrades: 'Load Balancer expands ingress to 20; Cloud Migration to 40; Autoscaling to 160.' },
    server: { name: 'Office server', explanation: 'CPU does the work; memory keeps active requests ready. The smaller limit determines how much work the machine can finish.', capacity: `CPU ${number(m.compute)} · Memory ${number(m.memory)} requests/minute`, upgrades: 'CPU Module → Memory Bank → Virtualization → Second Server.' },
    storage: { name: 'Storage', explanation: 'The application reads and writes customer data here. Slow storage can hold up a fast server.', capacity: `${number(m.storage)} reads/writes per minute`, upgrades: 'SSD Array speeds up data access. Backup & Recovery helps after a hardware fault.' },
    cache: { name: 'Edge cache', explanation: 'A saved copy answers repeated requests without asking the application server or storage to do the same work again.', capacity: has('cache') ? `${number(m.cacheHits)} requests/minute answered from cache` : 'Not installed yet', upgrades: 'Edge Cache answers 35% of standard traffic. It cannot bypass the network gateway.' },
    load_balancer: { name: 'Load balancer', explanation: 'Shares requests between machines so the second server can contribute all its capacity.', capacity: has('load_balancer') ? `Traffic policy: ${state.policies.loadBalancer}` : 'Not installed yet', upgrades: 'Requires Second Server. Efficiency favors throughput; redundancy reduces outage impact.' },
    server2: { name: 'Second server', explanation: 'Horizontal scaling means adding a machine. A load balancer is needed to distribute work efficiently.', capacity: has('server2') ? has('load_balancer') ? 'Full capacity connected' : 'Half capacity usable until load balancing' : 'Not installed yet', upgrades: 'Virtualization unlocks Second Server, followed by Load Balancer.' },
    cloud: { name: 'Cloud compute', explanation: 'Managed computers add capacity beyond your office. Provisioned capacity creates operating costs, even when some is idle.', capacity: `${number(m.cloud)} managed requests/minute available`, upgrades: 'Cloud Migration → Autoscaling. Economy responds slowly; Resilient keeps extra headroom.' },
    ai: { name: 'AI inference', explanation: 'A GPU runs the model that answers AI requests. AI traffic has its own capacity limit and earns a different price.', capacity: `${number(m.aiCapacity)} AI requests/minute available`, upgrades: 'AI Inference needs Autoscaling and Firewall & IAM. Allow elastic capacity time to warm up.' },
  }
  const detail = details[selected] ?? details.server
  const routeNodes = [{ x: 170, id: 'gateway' }, ...(has('cache') ? [{ x: 350, id: 'cache' }] : []), ...(has('load_balancer') ? [{ x: 530, id: 'load_balancer' }] : []), { x: serverX, id: 'server' }, { x: storageX, id: 'storage' }]
  const segments = routeNodes.slice(0, -1).map((node, index) => {
    const next = routeNodes[index + 1]
    const skipped = next.x - node.x > 220
    return `M${node.x + 122} 287${skipped ? `V211H${next.x + 61}V248` : `H${next.x}`}`
  })
  const fullPath = `M125 287H170 ${segments.join(' ')}`
  const node = (id: string, x: number, y: number, name: string, code: string, upgrade?: UpgradeId, warning = false) => {
    if (beginner && upgrade && !has(upgrade)) return null
    return <MapNode key={id} x={x} y={y} name={name} code={code} active={!upgrade || has(upgrade)} warning={warning} selected={selected === id} highlight={highlight === id || (['cpu', 'memory'].includes(highlight ?? '') && id === 'server') || (highlight === 'ssd' && id === 'storage')} onClick={() => setSelected(id)} />
  }
  return <section className="map-shell" aria-label="Infrastructure map">
    <header className="panel-heading"><div><span className="eyebrow">YOUR SYSTEM</span><h2>How requests travel</h2></div><div className={`health-pill ${m.successRate >= .98 ? 'healthy' : 'strained'}`}><i/>{state.paused ? beginner ? 'PAUSED FOR LEARNING' : 'SIMULATION PAUSED' : m.successRate >= .98 ? 'SERVING CUSTOMERS' : 'CAPACITY NEEDS ATTENTION'}</div></header>
    <div className={`map-stage ${beginner ? 'beginner-map' : ''} ${compact ? 'compact-map' : ''}`}>
      <div className="map-grid"/>
      <svg viewBox={compact ? '0 175 760 200' : '0 0 1100 510'} aria-label="Customers send requests through the gateway to compute and storage">
        <defs><filter id="glow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <path className="flow-line active-line" d="M125 287H170"/>
        {segments.map((path) => <path className="flow-line active-line" key={path} d={path}/>)}
        {has('cloud') && <path className="flow-line cloud-line active-line" d="M591 248V96H710"/>}
        {has('ai') && <path className="flow-line cloud-line active-line" d="M832 96H920"/>}
        {has('server2') && <path className="flow-line active-line" d={has('load_balancer') ? 'M591 326V403H710' : 'M771 326V364'}/>}
        <g className={`packets ${state.paused ? 'paused' : ''}`} aria-hidden="true">
          {[0, .8, 1.6].map((delay) => <circle key={delay} className={m.successRate < .85 ? 'packet packet-warn' : 'packet'} r="5"><animateMotion dur={`${2.8 / state.speed}s`} begin={`${delay / state.speed}s`} repeatCount="indefinite" path={fullPath}/></circle>)}
          {has('cloud') && <circle className="packet packet-cloud" r="5"><animateMotion dur={`${3 / state.speed}s`} repeatCount="indefinite" path="M591 248V96H710"/></circle>}
        </g>
        <g className="internet-node" transform="translate(35 243)"><circle cx="46" cy="44" r="42"/><path d="M10 44h72M46 4c17 18 17 62 0 80M46 4c-17 18-17 62 0 80M16 22h60M16 66h60"/><text x="46" y="106" textAnchor="middle">CUSTOMERS</text></g>
        {node('gateway',170,248,'Gateway','NET',undefined,m.bottleneck === 'network')}
        {node('cache',350,248,'Edge cache','CDN','cache')}
        {node('load_balancer',530,248,'Load balancer','LB','load_balancer')}
        {node('server',serverX,248,'Office server','SRV-1',undefined,['compute','memory'].includes(m.bottleneck))}
        {node('storage',storageX,248,'Storage','DATA',undefined,m.bottleneck === 'storage')}
        {node('server2',710,364,'Second server','SRV-2','server2')}
        {node('cloud',710,57,'Cloud compute','CLD','cloud')}
        {node('ai',920,57,'AI inference','GPU','ai',m.bottleneck === 'ai')}
      </svg>
      <div className="map-legend"><span><i className="legend-live"/>request</span><span><i className="legend-cloud"/>cloud route</span><span><i className="legend-warn"/>bottleneck</span></div>
    </div>
    <div className="component-inspector" aria-live="polite"><div><span className="eyebrow">CLICK A COMPONENT TO LEARN</span><h3>{detail.name}</h3></div><strong>{detail.capacity}</strong><p>{detail.explanation}</p><small>{detail.upgrades}</small></div>
  </section>
}
