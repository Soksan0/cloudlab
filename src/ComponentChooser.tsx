import {useEffect,useRef,useState} from 'react'
import type {KeyboardEvent} from 'react'
type Choice={id:string;name:string}
export default function ComponentChooser({value,options,onChange,fallbackLabel}:{value:string;options:Choice[];onChange:(id:string)=>void;fallbackLabel?:string}){
 const [open,setOpen]=useState(false),[active,setActive]=useState(0),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null)
 const selected=Math.max(0,options.findIndex(option=>option.id===value))
 useEffect(()=>{const pointer=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false)};document.addEventListener('pointerdown',pointer);return()=>document.removeEventListener('pointerdown',pointer)},[])
 useEffect(()=>{setOpen(false)},[value])
 const pick=(index:number)=>{const option=options[index];if(option)onChange(option.id);setOpen(false);trigger.current?.focus({preventScroll:true})}
 function key(e:KeyboardEvent){if(['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End','Enter',' ','Escape'].includes(e.key))e.preventDefault();else return;if(e.key==='Escape'){setOpen(false);return}if(!open){setActive(selected);setOpen(true);return}if(e.key==='Enter'||e.key===' '){pick(active);return}const step=e.key==='ArrowDown'?2:e.key==='ArrowUp'?-2:e.key==='ArrowLeft'?-1:1;setActive(e.key==='Home'?0:e.key==='End'?options.length-1:Math.max(0,Math.min(options.length-1,active+step)))}
 return <div className="game-chooser" ref={root}><button ref={trigger} role="combobox" aria-label="Component" aria-controls="component-options" aria-haspopup="listbox" aria-expanded={open} aria-activedescendant={open?'component-option-'+active:undefined} data-value={value} onKeyDown={key} onClick={()=>{setActive(selected);setOpen(v=>!v)}}>{options.find(option=>option.id===value)?.name??fallbackLabel??'Choose a component'}<span aria-hidden="true">{open?'▴':'▾'}</span></button>{open&&<div className="game-options" role="listbox" id="component-options" aria-label="Components">{options.map((option,i)=><button key={option.id} id={'component-option-'+i} data-value={option.id} role="option" aria-selected={value===option.id} className={i===active?'is-active':''} tabIndex={-1} onPointerMove={()=>setActive(i)} onClick={()=>pick(i)}>{option.name}</button>)}</div>}</div>
}
