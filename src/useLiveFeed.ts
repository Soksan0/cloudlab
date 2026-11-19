import {useEffect,useRef,useState} from 'react'
import type {GameState,ResourceReading,ResourceId,ResourceState} from './sim/types'
import {resourceState} from './sim/diagnostics'
export type MonitorSample={at:number;demand:number;served:number;success:number;profit:number;utilizations:GameState["metrics"]["utilizations"];resources:ResourceReading[];states:Partial<Record<ResourceId,ResourceState>>}
export function nextResourceStates(readings:ResourceReading[],history:MonitorSample[]):Partial<Record<ResourceId,ResourceState>>{return Object.fromEntries(readings.map(r=>{let state=resourceState(r);const previous=history.at(-1)?.states[r.id];if(state==='healthy'){const recent=history.slice(-2);if(r.pressure>=.8&&recent.length===2&&recent.every(s=>(s.resources.find(x=>x.id===r.id)?.pressure??0)>=.8))state='strained';else if((previous==='strained'||previous==='headroom')&&!(r.pressure<.75&&history.slice(-4).length===4&&history.slice(-4).every(s=>(s.resources.find(x=>x.id===r.id)?.pressure??1)<.75)))state='strained'}if(r.id==='space'&&state==='healthy'&&r.pressure>=.85)state='strained';return [r.id,state]}))}
export type ProfitReceipt={id:number;amount:number;lane:number;createdAt:number}
export function useLiveFeed(state:GameState,running:boolean,epoch:number){
 const latest=useRef(state);latest.current=state;const active=useRef(running);active.current=running
 const observed=useRef(state.revenue.gross-state.revenue.expenses),remainder=useRef(0),sequence=useRef(0)
 const [samples,setSamples]=useState<MonitorSample[]>([]),[receipts,setReceipts]=useState<ProfitReceipt[]>([])
 const seconds=useRef(0),sampleElapsed=useRef(0)
 useEffect(()=>{observed.current=latest.current.revenue.gross-latest.current.revenue.expenses;remainder.current=0;setReceipts([])},[running,epoch])
 useEffect(()=>{setSamples([]);seconds.current=0;sampleElapsed.current=0},[epoch])
 useEffect(()=>{if(!running)return;let last=performance.now();const timer=setInterval(()=>{const nowTick=performance.now(),elapsed=Math.max(0,Math.min(1000,nowTick-last));last=nowTick;if(document.hidden)return;sampleElapsed.current+=elapsed;if(sampleElapsed.current<999.999)return;sampleElapsed.current-=1000;const s=latest.current,current=s.revenue.gross-s.revenue.expenses;if(!active.current||document.hidden){observed.current=current;return}const at=++seconds.current;setSamples(previous=>[...previous.slice(-59),{at,demand:s.metrics.demand,served:s.metrics.served,success:s.metrics.successRate,profit:s.metrics.net,utilizations:{...s.metrics.utilizations},resources:s.metrics.resources,states:nextResourceStates(s.metrics.resources,previous)}]);remainder.current+=current-observed.current;observed.current=current;const amount=Math.trunc((remainder.current+Math.sign(remainder.current)*1e-8)*100)/100,now=performance.now();if(Math.abs(amount)>=.01){remainder.current-=amount;const id=++sequence.current;setReceipts(previous=>[...previous.filter(receipt=>now-receipt.createdAt<3200).slice(-2),{id,amount,lane:id%3,createdAt:now}])}else setReceipts(previous=>previous.filter(receipt=>now-receipt.createdAt<3200))},100);return()=>clearInterval(timer)},[running,epoch])
 return {samples,receipts}
}
