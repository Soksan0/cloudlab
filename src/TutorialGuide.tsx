import {useEffect,useRef,useState} from 'react'
import {tutorialTargets} from './tutorialTargets'

export default function TutorialGuide({step,running}:{step:number;running:boolean}){
 const outline=useRef<HTMLDivElement>(null),arrow=useRef<HTMLDivElement>(null),[seconds,setSeconds]=useState(0),[detour,setDetour]=useState(''),target=tutorialTargets[step]
 useEffect(()=>{setSeconds(0);setDetour('')},[step])
 useEffect(()=>{if(!running)return;const timer=setInterval(()=>setSeconds(n=>n+1),1000);return()=>clearInterval(timer)},[running,step])
 useEffect(()=>{
  if(!target)return
  let frame=0,instruction=''
  const place=()=>{
   frame=0
   const cue=[target,...target.fallbacks??[]].find(c=>{const n=document.querySelector(c.selector),r=n?.getBoundingClientRect();return r&&r.width>0&&r.height>0}),node=cue?document.querySelector(cue.selector):null,a=arrow.current,o=outline.current
   if(!a||!o)return
   if(!node){a.hidden=true;o.hidden=true;return}
   const next=cue===target?'':cue!.instruction
   if(instruction!==next){instruction=next;setDetour(next)}
   const r=node.getBoundingClientRect();o.hidden=false;a.hidden=false
   o.style.cssText='left:'+(r.left-4)+'px;top:'+(r.top-4)+'px;width:'+(r.width+8)+'px;height:'+(r.height+8)+'px'
   const above=r.top>120
   a.style.left=Math.min(innerWidth-36,Math.max(12,r.left+r.width/2-12))+'px'
   a.style.top=(above?r.top-34:r.bottom+10)+'px';a.dataset.direction=above?'down':'up'
  }
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(place)},resize=new ResizeObserver(schedule),mutation=new MutationObserver(place)
  resize.observe(document.documentElement)
  mutation.observe(document.querySelector('.compact-app')!,{subtree:true,childList:true,attributes:true,attributeFilter:['viewBox','class','open','data-selected']})
  window.addEventListener('resize',schedule);schedule()
  return()=>{cancelAnimationFrame(frame);resize.disconnect();mutation.disconnect();window.removeEventListener('resize',schedule)}
 },[target,step])
 if(!target)return null
 return <div className={'tutorial-guide '+(seconds>=8?'guide-repeat':'')} data-testid="tutorial-guide" data-step={step}><div className="guide-outline" ref={outline}/><div className="guide-arrow" ref={arrow}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 0h8v12h8L12 24 0 12h8z" fill="#ffe0a2" stroke="#142c3e" strokeWidth="2"/></svg></div>{(detour||seconds>=20)&&<div className="guide-reminder" role="status">Shroud: {detour||target.instruction}</div>}</div>
}
