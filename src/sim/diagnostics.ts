import type {GameState,ResourceReading,ResourceState} from './types'
export const resourceState=(r:ResourceReading):ResourceState=>r.availability!=='online'?r.availability:r.rejected>.000001?'limiting':r.pressure>.95?'headroom':'healthy'
export const stateLabel:Record<ResourceState,string>={healthy:'Target met',strained:'Strained',headroom:'Low headroom',limiting:'Limiting service',starting:'Starting',stopped:'Stopped',unavailable:'Unavailable'}
export const stateIcon:Record<ResourceState,string>={healthy:'✓',strained:'△',headroom:'△',limiting:'◆',starting:'◷',stopped:'Ⅱ',unavailable:'∕'}
export function diagnostics(s:GameState){return s.metrics.resources.map(r=>({...r,status:resourceState(r)}))}
export function componentReadings(s:GameState,id:string){const ids=id==='server'||id==='server2'?['cpu','memory']:id==='ssd'?['space','iops','transfer']:id==='cache'||id==='load_balancer'?['cpu','memory','network']:id==='security'?['network']:id==='cloud'?['cloud','cloud-memory']:id==='autoscaling'?['cloud','ai']:[id];return s.metrics.resources.filter(r=>ids.includes(r.id))}
