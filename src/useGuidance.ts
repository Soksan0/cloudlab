import {useEffect,useRef,useState} from 'react'
export function useGuidance(running:boolean,key:string,epoch:number,onlyAsked:boolean){
 const clock=useRef(0),last=useRef(-45),problem=useRef({key:'',seconds:0,dismissed:false}),[notice,setNotice]=useState('')
 useEffect(()=>{problem.current={key,seconds:0,dismissed:false};setNotice('')},[key,epoch])
 useEffect(()=>{if(!running)return;const timer=setInterval(()=>{clock.current++;const p=problem.current;if(!p.key||onlyAsked||p.dismissed)return;p.seconds++;if(p.seconds>=15&&clock.current-last.current>=45){last.current=clock.current;p.dismissed=true;setNotice(p.key)}},1000);return()=>clearInterval(timer)},[running,onlyAsked])
 return {visible:notice===key&&!!key&&!onlyAsked,dismiss:()=>{problem.current.dismissed=true;setNotice('')}}
}
