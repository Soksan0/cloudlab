import type {GameState} from './sim/types'
import {componentReadings} from './sim/diagnostics'
import type {MonitorSample} from './useLiveFeed'
import {useState} from 'react'
import ResourceMeter from './ResourceMeter'
export default function ComponentDiagnostics({state,id,samples}:{state:GameState;id:string;samples:MonitorSample[]}){
 const readings=componentReadings(state,id),[page,setPage]=useState(()=>Math.max(0,readings.findIndex(r=>r.rejected>0))),index=Math.min(page,Math.max(0,readings.length-1));if(!readings.length)return null
 const reading=id==='cloud'?{...readings[index],name:`${state.metrics.hardware.cloudInstances} VM · ${readings[index].id==='cloud-memory'?'RAM':'CPU'}`}:readings[index]
 return <section className="component-reading" aria-label="Component diagnostics"><ResourceMeter reading={reading} samples={samples}/>{readings.length>1&&<div className="reading-tabs">{readings.map((r,i)=><button key={r.id} aria-pressed={index===i} onClick={()=>setPage(i)}>{r.id==='space'?'Space':r.id==='iops'?'IOPS':r.id==='transfer'?'MiB/s':r.id==='cloud'?'CPU':r.id==='cloud-memory'?'RAM':r.name}</button>)}</div>}</section>
}
