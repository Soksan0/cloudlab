import type {ResourceReading} from './sim/types'
import {resourceState,stateLabel,stateIcon} from './sim/diagnostics'
import type {MonitorSample} from './useLiveFeed'
import {n} from './components'
export default function ResourceMeter({reading,samples,compact=false}:{reading:ResourceReading;samples:MonitorSample[];compact?:boolean}){
 const immediate=resourceState(reading),status=['limiting','starting','stopped','unavailable'].includes(immediate)?immediate:samples.at(-1)?.states[reading.id]??immediate,values=samples.map(s=>s.resources.find(r=>r.id===reading.id)?.pressure??0),fresh=status==='limiting'&&samples.length>1&&samples.at(-2)?.states[reading.id]!=='limiting'
 const points=values.map((v,i)=>`${i*180/59},${30-Math.min(1,v)*27}`).join(' ')
 return <div className={'resource-meter state-'+status+(fresh?' new-constraint':'')} data-resource={reading.id} data-pressure={reading.pressure}>
 <div className="meter-heading"><strong>{reading.name}</strong><span aria-label={stateLabel[status]}>{stateIcon[status]} {!compact&&stateLabel[status]}</span></div>
 <div className="signal-bar" role="meter" aria-label={reading.name+' pressure'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(1,reading.pressure)*100)} aria-valuetext={`${n(reading.offered)} offered / ${n(reading.capacity)} ${reading.unit}; ${stateLabel[status]}`}><i style={{width:Math.min(100,reading.pressure*100)+'%'}}/></div>
 {!compact&&<><div className="meter-values">{n(reading.used)} / {n(reading.capacity)} {reading.unit}<small>Estimated use · {reading.scope}</small></div>{reading.reserved!==undefined&&<small>{n(reading.reserved)} GiB reserved · {n(Math.max(0,reading.capacity-reading.used))} GiB free</small>}<svg className="resource-history" viewBox="0 0 180 34" role="img" aria-label={reading.name+' pressure over the last 60 active seconds'}><path d="M0 31H180" stroke="#436174"/><polyline points={points} stroke="currentColor" fill="none" strokeWidth="2"/></svg><small>{reading.admitted!==undefined?`${n(reading.admitted)} admitted/s · ${n(reading.rejected)} rejected/s`:reading.rejected>.000001?`${n(reading.rejected)} rejected/s · ${samples.length<2?'collecting':Math.min(60,samples.length)+'s history'}`:samples.length<2?'Collecting history':`${Math.min(60,samples.length)} active seconds · pressure`}</small></>}
 </div>
}
