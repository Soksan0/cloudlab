import {useEffect,useRef} from 'react'
import './camera.css'

type Frame={x:number;y:number;width:number;height:number}
type Geometry={width:number;height:number;free:number;fit:number}
type Camera={frame:Frame;manual:boolean;target?:string;requestedFocus?:string;focusKey?:number;geometry?:Geometry}
const cameras=new Map<string,Camera>()
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n))
const format=(f:Frame)=>`${f.x.toFixed(3)} ${f.y.toFixed(3)} ${f.width.toFixed(3)} ${f.height.toFixed(3)}`

/** SVG camera changes are imperative: panning never rerenders the artwork tree. */
export function useSceneCamera(width:number,height:number,focus:string|undefined,compact:boolean,focusKey=0){
 const svgRef=useRef<SVGSVGElement>(null)
 const key=`${width}:${height}`
 const initial=useRef(format(cameras.get(key)?.frame??{x:0,y:0,width,height}))
 useEffect(()=>{
  const svg=svgRef.current
  if(!svg)return
  const saved=cameras.get(key)
  const camera:Camera=saved?{...saved,frame:{...saved.frame}}:{frame:{x:0,y:0,width,height},manual:false}
  let animation=0,scheduled=0,suppressClickUntil=0,keyboardNavigation=false
  let gesture:{pointer:number;x:number;y:number;frame:Frame;dragged:boolean}|undefined
  const touches=new Map<number,{x:number;y:number}>()
  let pinch:{distance:number;x:number;y:number}|undefined
  svg.style.touchAction='none'
  svg.classList.add('navigable-scene')
  svg.setAttribute('tabindex','0')
  svg.setAttribute('aria-keyshortcuts','ArrowLeft ArrowRight ArrowUp ArrowDown + - 0')
  const geometry=():Geometry=>{
   const rect=svg.getBoundingClientRect(),console=svg.closest('.compact-stage')?.querySelector<HTMLElement>('[data-floating-console]')
   const box=console?.getBoundingClientRect(),closed=/^0(px)?$/.test(getComputedStyle(svg).getPropertyValue('--console-width').trim())
   const reserved=!compact||closed?0:box&&box.left<rect.right&&box.bottom>rect.top?rect.right-Math.max(rect.left,box.left)+18:0
   const free=Math.max(rect.width*.42,rect.width-reserved)
   return {width:Math.max(1,rect.width),height:Math.max(1,rect.height),free,fit:Math.max(.001,Math.min(Math.max(1,free-24)/width,Math.max(1,rect.height-24)/height))}
  }
  const bounded=(frame:Frame,g:Geometry):Frame=>{
   const scale=g.width/frame.width,freeWidth=g.free/scale,worldHeight=g.height/scale
   const limit=(center:number,worldSize:number,visible:number)=>{
    const low=visible*.25-worldSize*.12,high=worldSize*1.12-visible*.25
    return low>high?worldSize/2:clamp(center,low,high)
   }
   const cx=limit(frame.x+freeWidth/2,width,freeWidth),cy=limit(frame.y+worldHeight/2,height,worldHeight)
   return {...frame,x:cx-freeWidth/2,y:cy-worldHeight/2}
  }
  const apply=(frame:Frame,g=geometry())=>{
   camera.frame=frame;camera.geometry=g;cameras.set(key,camera)
   svg.setAttribute('viewBox',format(frame))
   svg.dataset.cameraMode=camera.manual?'manual':'focused'
   svg.dataset.cameraZoom=(g.width/frame.width/g.fit).toFixed(2)
  }
  const animate=(next:Frame,g=geometry())=>{
   cancelAnimationFrame(animation)
   if(svg.closest('.reduced-motion')||matchMedia('(prefers-reduced-motion: reduce)').matches){apply(next,g);return}
   const from={...camera.frame},start=performance.now()
   const tick=(now:number)=>{
    const t=Math.min(1,(now-start)/300),eased=1-(1-t)**3
    apply({x:from.x+(next.x-from.x)*eased,y:from.y+(next.y-from.y)*eased,width:from.width+(next.width-from.width)*eased,height:from.height+(next.height-from.height)*eased},g)
    if(t<1)animation=requestAnimationFrame(tick)
   }
   animation=requestAnimationFrame(tick)
  }
  const fitted=(target:string|undefined,g=geometry()):Frame=>{
   let scale=g.fit,cx=width/2,cy=height/2
   const node=target?svg.querySelector<SVGGraphicsElement>(`[data-component-id="${target}"]`):null
   if(node){
    const box=node.getBBox(),matrix=node.getCTM(),root=svg.getCTM()
    if(matrix&&root&&box.width&&box.height){
     const transform=root.inverse().multiply(matrix),center=new DOMPoint(box.x+box.width/2,box.y+box.height/2).matrixTransform(transform)
     cx=center.x;cy=center.y
     const w=Math.abs(box.width*transform.a)+Math.abs(box.height*transform.c),h=Math.abs(box.width*transform.b)+Math.abs(box.height*transform.d)
     scale=Math.max(g.fit,Math.min(g.fit*1.85,g.free/Math.max(280,w*1.9),g.height/Math.max(230,h*1.9)))
    }
   }
   return {x:cx-g.free*.49/scale,y:cy-g.height*.5/scale,width:g.width/scale,height:g.height/scale}
  }
  const fit=()=>{camera.manual=false;camera.target=undefined;animate(fitted(undefined))}
  const pan=(dx:number,dy:number)=>{
   cancelAnimationFrame(animation);const g=geometry(),scale=g.width/camera.frame.width
   camera.manual=true;camera.target=undefined
   apply(bounded({...camera.frame,x:camera.frame.x+dx/scale,y:camera.frame.y+dy/scale},g),g)
  }
  const zoom=(factor:number,clientX?:number,clientY?:number)=>{
   cancelAnimationFrame(animation);const rect=svg.getBoundingClientRect(),g=geometry(),oldScale=g.width/camera.frame.width
   const x=clientX===undefined?g.free/2:clientX-rect.left,y=clientY===undefined?g.height/2:clientY-rect.top
   const scale=clamp(oldScale*factor,g.fit*.65,g.fit*3)
   const wx=camera.frame.x+x/oldScale,wy=camera.frame.y+y/oldScale
   camera.manual=true;camera.target=undefined
   apply(bounded({x:wx-x/scale,y:wy-y/scale,width:g.width/scale,height:g.height/scale},g),g)
  }
  const resize=()=>{
   const g=geometry(),old=camera.geometry
   if(!compact){apply({x:0,y:0,width,height},g);return}
   if(old&&Math.abs(g.width-old.width)+Math.abs(g.height-old.height)+Math.abs(g.free-old.free)<.5){apply(camera.frame,g);return}
   if(camera.manual&&old){
    const oldScale=old.width/camera.frame.width,ratio=clamp(oldScale/old.fit,.65,3),scale=g.fit*ratio
    const cx=camera.frame.x+old.free/(oldScale*2),cy=camera.frame.y+old.height/(oldScale*2)
    apply(bounded({x:cx-g.free/(scale*2),y:cy-g.height/(scale*2),width:g.width/scale,height:g.height/scale},g),g)
   }else apply(fitted(camera.target,g),g)
  }
  const schedule=()=>{cancelAnimationFrame(scheduled);scheduled=requestAnimationFrame(resize)}
  const pointerDown=(e:PointerEvent)=>{
   keyboardNavigation=false
   if(e.pointerType==='touch'){
    touches.set(e.pointerId,{x:e.clientX,y:e.clientY})
    if(touches.size===2){const [a,b]=[...touches.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),x:(a.x+b.x)/2,y:(a.y+b.y)/2};gesture=undefined;suppressClickUntil=performance.now()+500;return}
   }
   if(e.button!==0||(!e.isPrimary&&e.pointerType!=='touch'))return
   suppressClickUntil=0
   gesture={pointer:e.pointerId,x:e.clientX,y:e.clientY,frame:{...camera.frame},dragged:false}
  }
  const pointerMove=(e:PointerEvent)=>{
   if(e.pointerType==='touch'&&touches.has(e.pointerId))touches.set(e.pointerId,{x:e.clientX,y:e.clientY})
   if(pinch&&touches.size===2){
    e.preventDefault();const [a,b]=[...touches.values()],distance=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),x=(a.x+b.x)/2,y=(a.y+b.y)/2
    zoom(distance/Math.max(1,pinch.distance),pinch.x,pinch.y);pan(pinch.x-x,pinch.y-y);pinch={distance,x,y};suppressClickUntil=performance.now()+500;return
   }
   if(!gesture||gesture.pointer!==e.pointerId)return
   const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y
   if(!gesture.dragged&&Math.hypot(dx,dy)<5)return
   if(!gesture.dragged){gesture.dragged=true;cancelAnimationFrame(animation);try{svg.setPointerCapture(e.pointerId)}catch{/* Pointer may have ended during resize. */}svg.classList.add('camera-dragging')}
   e.preventDefault();const g=geometry(),scale=g.width/gesture.frame.width
   camera.manual=true;camera.target=undefined
   apply(bounded({...gesture.frame,x:gesture.frame.x-dx/scale,y:gesture.frame.y-dy/scale},g),g)
  }
  const pointerUp=(e:PointerEvent)=>{
   touches.delete(e.pointerId);if(touches.size<2)pinch=undefined
   if(gesture?.pointer===e.pointerId){if(gesture.dragged)suppressClickUntil=performance.now()+300;gesture=undefined}
   svg.classList.remove('camera-dragging');if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId)
  }
  const click=(e:MouseEvent)=>{if(performance.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation();suppressClickUntil=0}}
  const wheel=(e:WheelEvent)=>{
   e.preventDefault();const unit=e.deltaMode===1?16:e.deltaMode===2?svg.clientHeight*.8:1
   if(e.ctrlKey||e.metaKey)zoom(Math.exp(-e.deltaY*unit*.008),e.clientX,e.clientY)
   else pan(e.deltaX*unit,e.deltaY*unit)
  }
  const keyDown=(e:KeyboardEvent)=>{
   if(e.altKey||e.ctrlKey||e.metaKey)return
   const distance=e.shiftKey?100:42
   const direction:Record<string,[number,number]>={ArrowLeft:[-distance,0],ArrowRight:[distance,0],ArrowUp:[0,-distance],ArrowDown:[0,distance]}
   if(direction[e.key]){e.preventDefault();pan(...direction[e.key])}
   else if(e.key==='+'||e.key==='='){e.preventDefault();zoom(1.2)}
   else if(e.key==='-'||e.key==='_'){e.preventDefault();zoom(1/1.2)}
   else if(e.key==='0'||e.key==='Home'){e.preventDefault();fit()}
  }
  const documentKey=(e:KeyboardEvent)=>{if(e.key==='Tab')keyboardNavigation=true}
  const focusIn=(e:FocusEvent)=>{
   if(!keyboardNavigation||!(e.target instanceof Element))return
   const target=e.target.closest('[data-component-id][tabindex]')
   if(!target||!svg.contains(target))return
   const id=target.getAttribute('data-component-id')??undefined
   camera.manual=false;camera.target=id;animate(fitted(id))
  }
  const command=(e:Event)=>{
   if(!svg.isConnected)return
   const action=(e as CustomEvent<{action:string}>).detail?.action
   if(action==='fit')fit();else if(action==='zoom-in')zoom(1.2);else if(action==='zoom-out')zoom(1/1.2)
  }
  svg.addEventListener('pointerdown',pointerDown)
  svg.addEventListener('pointermove',pointerMove)
  svg.addEventListener('pointerup',pointerUp)
  svg.addEventListener('pointercancel',pointerUp)
  svg.addEventListener('click',click,true)
  svg.addEventListener('wheel',wheel,{passive:false})
  svg.addEventListener('keydown',keyDown)
  svg.addEventListener('focusin',focusIn)
  document.addEventListener('keydown',documentKey,true)
  window.addEventListener('cloudlab-camera',command)
  window.addEventListener('resize',schedule)
  const observer=new ResizeObserver(schedule);observer.observe(svg)
  const console=svg.closest('.compact-stage')?.querySelector('[data-floating-console]');if(console)observer.observe(console)
  const changes=new MutationObserver(schedule)
  let parent:Element|null=svg.parentElement
  for(let depth=0;parent&&depth<5;depth++,parent=parent.parentElement)changes.observe(parent,{attributes:true,attributeFilter:['style','class']})
  const explicit=!!focus&&(!saved||saved.requestedFocus!==focus||saved.focusKey!==focusKey)
  camera.requestedFocus=focus;camera.focusKey=focusKey
  if(!compact)apply({x:0,y:0,width,height})
  else if(explicit){camera.manual=false;camera.target=focus;animate(fitted(focus))}
  else if(!saved){apply(fitted(undefined))}
  else resize()
  return()=>{
   cancelAnimationFrame(animation);cancelAnimationFrame(scheduled);observer.disconnect();changes.disconnect()
   svg.removeEventListener('pointerdown',pointerDown);svg.removeEventListener('pointermove',pointerMove);svg.removeEventListener('pointerup',pointerUp);svg.removeEventListener('pointercancel',pointerUp);svg.removeEventListener('click',click,true);svg.removeEventListener('wheel',wheel);svg.removeEventListener('keydown',keyDown);svg.removeEventListener('focusin',focusIn)
   document.removeEventListener('keydown',documentKey,true);window.removeEventListener('cloudlab-camera',command);window.removeEventListener('resize',schedule)
  }
 },[width,height,focus,compact,focusKey,key])
 return {svgRef,viewBox:initial.current}
}
