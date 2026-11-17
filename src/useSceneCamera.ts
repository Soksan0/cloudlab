import {useEffect,useRef,useState} from 'react'

type Frame={x:number;y:number;width:number;height:number}
const equal=(a:Frame,b:Frame)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y)+Math.abs(a.width-b.width)+Math.abs(a.height-b.height)<.1

/** Frame the artwork in the space left beside the floating tuning console. */
export function useSceneCamera(width:number,height:number,focus:string|undefined,compact:boolean){
 const svgRef=useRef<SVGSVGElement>(null)
 const [frame,setFrame]=useState<Frame>({x:0,y:0,width,height})
 const shown=useRef(frame)
 useEffect(()=>{
  const svg=svgRef.current
  if(!svg)return
  let animation=0,scheduled=0,keyboardMode=false
  // Keyboard focus may inspect a visible part without purchasing or changing the selected card.
  // This local target resets whenever an explicit console focus prop changes.
  let keyboardTarget:string|undefined
  const parents:Element[]=[]
  for(let node:Element|null=svg.parentElement;node&&parents.length<5;node=node.parentElement)parents.push(node)
  const update=()=>{
   cancelAnimationFrame(animation)
   const rect=svg.getBoundingClientRect()
   if(!compact||rect.width<1||rect.height<1){const next={x:0,y:0,width,height};shown.current=next;setFrame(next);return}
   const consoleNode=document.querySelector<HTMLElement>('[data-floating-console], [data-testid="tuning-console"], .tuning-console')
   const consoleRect=consoleNode?.getBoundingClientRect()
   const reserveValue=getComputedStyle(svg).getPropertyValue('--console-width').trim()
   const explicitlyClosed=reserveValue==='0px'||reserveValue==='0'
   const fallback=explicitlyClosed?0:Math.min(320,Math.max(240,rect.width*.27))+24
   const overlap=consoleRect&&consoleRect.width>0&&consoleRect.left<rect.right&&consoleRect.right>rect.left&&consoleRect.bottom>rect.top&&consoleRect.top<rect.bottom
   const reserved=explicitlyClosed?0:overlap?rect.right-Math.max(rect.left,consoleRect!.left)+18:fallback
   const free=Math.max(rect.width*.44,rect.width-reserved)
   const baseScale=Math.min(Math.max(1,free-24)/width,Math.max(1,rect.height-24)/height)
   let scale=baseScale,cx=width/2,cy=height/2
   const cameraTarget=keyboardTarget??focus
   if(cameraTarget){
    const target=svg.querySelector<SVGGraphicsElement>(`[data-component-id="${cameraTarget}"]`)??svg.querySelector<SVGGraphicsElement>(`[data-component-aliases~="${cameraTarget}"]`)
    if(target){
     // getBBox is in local coordinates; transform the center through the SVG's world matrix.
     const box=target.getBBox(),matrix=target.getCTM(),svgMatrix=svg.getCTM()
     if(matrix&&svgMatrix&&box.width>0&&box.height>0){
      const transform=svgMatrix.inverse().multiply(matrix)
      const p=new DOMPoint(box.x+box.width/2,box.y+box.height/2).matrixTransform(transform)
      cx=p.x;cy=p.y
      const targetWidth=Math.abs(box.width*transform.a)+Math.abs(box.height*transform.c)
      const targetHeight=Math.abs(box.width*transform.b)+Math.abs(box.height*transform.d)
      scale=Math.min(baseScale*1.85,free/Math.max(280,targetWidth*1.9),rect.height/Math.max(230,targetHeight*1.9))
      scale=Math.max(baseScale,scale)
     }
    }
   }
   const next={x:cx-free*.49/scale,y:cy-rect.height*.5/scale,width:rect.width/scale,height:rect.height/scale}
   if(equal(shown.current,next))return
   const reduced=!!svg.closest('.reduced-motion')||matchMedia('(prefers-reduced-motion: reduce)').matches
   if(reduced){shown.current=next;setFrame(next);return}
   const from=shown.current,start=performance.now()
   const tick=(now:number)=>{
    const elapsed=Math.min(1,(now-start)/360),t=1-(1-elapsed)**3
    const value={x:from.x+(next.x-from.x)*t,y:from.y+(next.y-from.y)*t,width:from.width+(next.width-from.width)*t,height:from.height+(next.height-from.height)*t}
    shown.current=value;setFrame(value)
    if(elapsed<1)animation=requestAnimationFrame(tick)
   }
   animation=requestAnimationFrame(tick)
  }
  const schedule=()=>{cancelAnimationFrame(scheduled);scheduled=requestAnimationFrame(update)}
  const keyboard=(event:KeyboardEvent)=>{if(event.key==='Tab')keyboardMode=true}
  const pointer=()=>{keyboardMode=false;if(keyboardTarget){keyboardTarget=undefined;schedule()}}
  const focused=(event:FocusEvent)=>{
   if(!keyboardMode||!(event.target instanceof Element))return
   const hotspot=event.target.closest('[data-component-id][tabindex]')
   if(!hotspot||!svg.contains(hotspot))return
   const id=hotspot.getAttribute('data-component-id')??undefined
   if(id!==keyboardTarget){keyboardTarget=id;schedule()}
  }
  const blurred=(event:FocusEvent)=>{
   if(event.relatedTarget instanceof Node&&svg.contains(event.relatedTarget))return
   if(keyboardTarget){keyboardTarget=undefined;schedule()}
  }
  document.addEventListener('keydown',keyboard,true)
  document.addEventListener('pointerdown',pointer,true)
  svg.addEventListener('focusin',focused)
  svg.addEventListener('focusout',blurred)
  const observer=new ResizeObserver(schedule)
  observer.observe(svg)
  const consoleNode=document.querySelector('[data-floating-console], [data-testid="tuning-console"], .tuning-console')
  if(consoleNode)observer.observe(consoleNode)
  const changes=new MutationObserver(schedule)
  parents.forEach(node=>changes.observe(node,{attributes:true,attributeFilter:['style','class']}))
  window.addEventListener('resize',schedule)
  update()
  return()=>{cancelAnimationFrame(animation);cancelAnimationFrame(scheduled);observer.disconnect();changes.disconnect();window.removeEventListener('resize',schedule);document.removeEventListener('keydown',keyboard,true);document.removeEventListener('pointerdown',pointer,true);svg.removeEventListener('focusin',focused);svg.removeEventListener('focusout',blurred)}
 },[width,height,focus,compact])
 return {svgRef,viewBox:`${frame.x.toFixed(2)} ${frame.y.toFixed(2)} ${frame.width.toFixed(2)} ${frame.height.toFixed(2)}`}
}
