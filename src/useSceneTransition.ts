import {useEffect,useState} from 'react'
import type {SceneView} from './components'
export function useSceneTransition(requested:SceneView,reduced:boolean){
 const [scene,setScene]=useState({view:requested,phase:'idle'})
 useEffect(()=>{if(reduced||scene.view===requested){setScene({view:requested,phase:'idle'});return}setScene(s=>({...s,phase:'leaving'}));let finish:ReturnType<typeof setTimeout>;const change=setTimeout(()=>{setScene({view:requested,phase:'entering'});finish=setTimeout(()=>setScene({view:requested,phase:'idle'}),350)},110);return()=>{clearTimeout(change);clearTimeout(finish)}},[requested,reduced])
 return scene
}
