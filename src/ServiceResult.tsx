import {useEffect,useRef,useState} from 'react'
import type {GameState,PurchaseImpact} from './sim/types'
import {money,n} from './components'
export const workloadSignature=(s:GameState)=>JSON.stringify([s.metrics.demand,s.metrics.workloadMix,s.metrics.standardPrice,s.metrics.aiPrice])
export function observedRates(before:GameState,after:GameState){const minutes=after.elapsed-before.elapsed;return minutes>0?{served:(after.totalServed-before.totalServed)/(minutes*60),profit:((after.revenue.gross-before.revenue.gross)-(after.revenue.expenses-before.revenue.expenses))/minutes}:null}
export default function ServiceResult({impact,state,activated=false,changed=false}:{impact:PurchaseImpact;state:GameState;activated?:boolean;changed?:boolean}){
 const latest=useRef(state);latest.current=state;const baseline=useRef(state),[observed,setObserved]=useState<ReturnType<typeof observedRates>>(null)
 const a=impact.after,b=impact.before,delay=['cloud','ai'].includes(impact.id)&&a.hardware.cloudInstances===b.hardware.cloudInstances&&a.hardware.gpuCount===b.hardware.gpuCount
 useEffect(()=>{if(delay&&!activated||state.tutorial.replay)return;const timer=setInterval(()=>{if(latest.current.activeSeconds-baseline.current.activeSeconds>=1){setObserved(observedRates(baseline.current,latest.current));clearInterval(timer)}},100);return()=>clearInterval(timer)},[])
 if(delay&&!activated)return <small className="service-result">Starting… service feedback arrives when capacity is online.</small>
 if(changed||workloadSignature(state)!==workloadSignature(baseline.current))return <small className="service-result">Traffic changed—compare current performance in Monitor.</small>
 const served=observed?.served??(activated?state.metrics.served:a.served),profit=observed?.profit??(activated?state.metrics.net:a.net),serviceChanged=Math.abs(served-b.served)>.001
 return <small className="service-result">{serviceChanged?`${n(b.served)} → ${n(served)} requests completed/s`:['backup','security','load_balancer'].includes(impact.id)?'Protection added · throughput may stay unchanged':'More headroom · current service unchanged'}<span>{money(b.net)} → {money(profit)}/min operating profit · {observed?'observed after activation':'same-workload prediction'}</span></small>
}
