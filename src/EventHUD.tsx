import type {GameState} from './sim/types'
import {encounterPhase,encounterObjective} from './sim/encounters'
import {clock} from './StatusDashboard'
import {n} from './components'
export default function EventHUD({state}:{state:GameState}){const i=state.incident;if(!i)return null;return <section className="encounter-hud" aria-label="Active infrastructure encounter" data-testid="encounter-hud"><div><strong>{i.title}</strong><b>{clock(i.remaining)}</b></div><progress aria-label="Event time remaining" value={i.remaining} max={i.total}/><small>{encounterPhase(i)} · {n(state.metrics.successRate*100)}% served <em>· {n(Math.min(15,i.encounter?.finalStreak??0))}/15s stable</em></small><span>{i.encounter?encounterObjective:'Keep service running until recovery'}</span></section>}
