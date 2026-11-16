import {useEffect,useRef,useState} from 'react'
import type {GameState} from './sim/types'
export type EarningsBurst={id:number;amount:number}
export function useEarnings(state:GameState,active:boolean,epoch:number){
  const [bursts,setBursts]=useState<EarningsBurst[]>([])
  const [shown,setShown]=useState(0)
  const observed=useRef(state.revenue.gross),pending=useRef(0),elapsed=useRef(0),counter=useRef(0),total=useRef(0),oldEpoch=useRef(epoch)
  const gross=useRef(state.revenue.gross);gross.current=state.revenue.gross
  const running=useRef(active);running.current=active
  useEffect(()=>{
    if(oldEpoch.current!==epoch||state.revenue.gross<observed.current){observed.current=state.revenue.gross;pending.current=0;elapsed.current=0;total.current=0;oldEpoch.current=epoch;setBursts([]);setShown(0)}
    pending.current+=Math.max(0,state.revenue.gross-observed.current);observed.current=state.revenue.gross
  },[state.revenue.gross,epoch])
  useEffect(()=>{if(!active)setBursts([])},[active])
  useEffect(()=>{
    let frame:number,previous=performance.now()
    const loop=(now:number)=>{
      const delta=Math.min(100,Math.max(0,now-previous));previous=now
      if(!running.current||document.hidden)elapsed.current=0
      else{
        elapsed.current+=delta
        if(elapsed.current>=1000){
          elapsed.current%=1000
          const cents=Math.floor((pending.current+1e-9)*100),amount=cents/100
          if(amount>0){pending.current-=amount;total.current+=amount;setShown(total.current);setBursts(v=>[...v.slice(-1),{id:++counter.current,amount}])}
        }
      }
      frame=requestAnimationFrame(loop)
    }
    frame=requestAnimationFrame(loop);return()=>cancelAnimationFrame(frame)
  },[])
  return {bursts,shown}
}
