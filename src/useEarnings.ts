import {useEffect,useRef,useState} from 'react'
import type {GameState} from './sim/types'
export type EarningsBurst={id:number;amount:number}

// Presentation observes the ledger; it never credits cash or invents payments.
export function useEarnings(state:GameState,active:boolean,epoch:number){
  const [bursts,setBursts]=useState<EarningsBurst[]>([])
  const [shown,setShown]=useState(0)
  const observed=useRef(state.revenue.gross),pending=useRef(0),counter=useRef(0),total=useRef(0),oldEpoch=useRef(epoch)
  const running=useRef(active);running.current=active
  useEffect(()=>{
    if(oldEpoch.current!==epoch||state.revenue.gross<observed.current){
      observed.current=state.revenue.gross;pending.current=0;total.current=0;oldEpoch.current=epoch;setBursts([]);setShown(0);return
    }
    const delta=Math.max(0,state.revenue.gross-observed.current)
    observed.current=state.revenue.gross
    total.current+=delta;setShown(total.current)
    if(active)pending.current+=delta
  },[state.revenue.gross,epoch,active])
  useEffect(()=>{
    if(!active){pending.current=0;setBursts([]);return}
    const timer=window.setInterval(()=>{
      if(!running.current||document.hidden)return
      const amount=Math.floor((pending.current+1e-9)*100)/100
      if(amount>0){pending.current-=amount;setBursts([{id:++counter.current,amount}])}
      else setBursts([])
    },200)
    return()=>clearInterval(timer)
  },[active,epoch])
  return {bursts,shown}
}
