import {useEffect,useRef} from 'react'
/** Reposition presentation overlays without rerendering the scene or simulation. */
export function useCollisionAnchor(target?:string){
 const ref=useRef<HTMLElement>(null)
 useEffect(()=>{const node=ref.current,stage=node?.closest('.compact-stage');if(!node||!stage)return;let frame=0
 const place=()=>{const bounds=stage.getBoundingClientRect(),box=node.getBoundingClientRect(),reserved=[...stage.querySelectorAll('[data-floating-console],.live-dashboard,.stage-toolbar,.performance-hud,.encounter-hud,.pressure-rail,.objective-chip,.purchase-feedback,.tutorial-coach,.shroud-message')].filter(n=>n!==node&&!n.contains(node));const selected=target?stage.querySelector(`[data-component-id="${target}"]`):stage.querySelector('.machine-selected,.interior-part.selected,.service-node.selected');if(selected)reserved.push(selected)
 const obstacles=reserved.map(n=>n.getBoundingClientRect()),positions=[{x:14,y:bounds.height-box.height-74},{x:14,y:88},{x:bounds.width-box.width-14,y:88},{x:bounds.width-box.width-14,y:bounds.height-box.height-74}],overlap=(p:{x:number;y:number})=>obstacles.reduce((sum,r)=>sum+Math.max(0,Math.min(bounds.left+p.x+box.width,r.right+8)-Math.max(bounds.left+p.x,r.left-8))*Math.max(0,Math.min(bounds.top+p.y+box.height,r.bottom+8)-Math.max(bounds.top+p.y,r.top-8)),0)
 positions.sort((a,b)=>overlap(a)-overlap(b));const x=`${Math.max(8,positions[0].x)}px`,y=`${Math.max(85,positions[0].y)}px`;if(node.style.left!==x)node.style.left=x;if(node.style.top!==y)node.style.top=y;node.style.bottom='auto';node.style.right='auto'}
 const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(place)},resize=new ResizeObserver(schedule),changes=new MutationObserver(schedule);resize.observe(node);resize.observe(stage);changes.observe(stage,{subtree:true,childList:true,attributes:true,attributeFilter:['viewBox','class']});window.addEventListener('resize',schedule);schedule();return()=>{cancelAnimationFrame(frame);resize.disconnect();changes.disconnect();window.removeEventListener('resize',schedule)}
 },[target]);return ref
}
