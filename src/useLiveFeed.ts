import {useEffect,useRef,useState} from 'react'
import type {GameState} from './sim/types'
export type MonitorSample={demand:number;served:number;success:number;profit:number;utilizations:GameState["metrics"]["utilizations"]}
export type ProfitReceipt={id:number;amount:number;lane:number;createdAt:number}
export function useLiveFeed(state:GameState,running:boolean,epoch:number){
 const latest=useRef(state);latest.current=state;const active=useRef(running);active.current=running
 const observed=useRef(state.revenue.gross-state.revenue.expenses),remainder=useRef(0),sequence=useRef(0)
 const [samples,setSamples]=useState<MonitorSample[]>([]),[receipts,setReceipts]=useState<ProfitReceipt[]>([])
 useEffect(()=>{observed.current=latest.current.revenue.gross-latest.current.revenue.expenses;remainder.current=0;setReceipts([])},[running,epoch])
 useEffect(()=>{setSamples([])},[epoch])
 useEffect(()=>{const timer=setInterval(()=>{const s=latest.current,current=s.revenue.gross-s.revenue.expenses;if(!active.current||document.hidden){observed.current=current;return}setSamples(previous=>[...previous.slice(-59),{demand:s.metrics.demand,served:s.metrics.served,success:s.metrics.successRate,profit:s.metrics.net,utilizations:{...s.metrics.utilizations}}]);remainder.current+=current-observed.current;observed.current=current;const amount=Math.trunc((remainder.current+Math.sign(remainder.current)*1e-8)*100)/100,now=performance.now();if(Math.abs(amount)>=.01){remainder.current-=amount;const id=++sequence.current;setReceipts(previous=>[...previous.filter(receipt=>now-receipt.createdAt<3200).slice(-2),{id,amount,lane:id%3,createdAt:now}])}else setReceipts(previous=>previous.filter(receipt=>now-receipt.createdAt<3200))},1000);return()=>clearInterval(timer)},[])
 return {samples,receipts}
}
