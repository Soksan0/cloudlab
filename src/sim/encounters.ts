import type {Incident} from './types'
export function encounterPhase(i:Incident){const spent=i.total-i.remaining+1e-8;return !i.encounter?'Active':i.kind!=='marketing'?'Response':spent<15?'Incoming wave':spent<55?'Peak traffic':'Stabilize'}
export function encounterSurge(i:Incident,level:number){if(!i.encounter)return level<10?1.3:1.5;const peak=i.total-i.remaining+1e-8>=15&&i.total-i.remaining+1e-8<55;return i.encounter.early?(peak?1.3:1.15):(peak?1.5:1.25)}
export function encounterBoundary(i:Incident){if(!i.encounter||i.kind!=='marketing')return i.remaining;const spent=i.total-i.remaining+1e-8;return spent<15?15-spent:spent<55?55-spent:i.remaining}
export const encounterObjective='Finish with 15 seconds at ≥98% served · ≥90% overall'
