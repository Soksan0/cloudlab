import {Component,type ReactNode} from 'react'
import {loadGame} from './sim/engine'
export function downloadSave(raw:string){const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='cloudlab-recovery.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export default class ErrorBoundary extends Component<{children:ReactNode;onClose?:()=>void;save?:()=>string},{failed:boolean;notice:string}>{
 state={failed:false,notice:''}
 static getDerivedStateFromError(){return {failed:true}}
 export=()=>{try{const raw=this.props.save?.()??localStorage.getItem('cloudlab-save-v1');if(!raw||!loadGame(raw)){this.setState({notice:'No valid save available to export.'});return}downloadSave(raw)}catch{this.setState({notice:'Save storage is unavailable.'})}}
 render(){return this.state.failed?<section className="recovery-panel" role="alert"><h2>Shroud · Display interrupted</h2><p>Your lab encountered a display error. Export your save before reloading.</p><button onClick={()=>location.reload()}>Reload</button><button onClick={this.export}>Export save</button>{this.props.onClose&&<button onClick={this.props.onClose}>Close dashboard</button>}<p>{this.state.notice}</p></section>:this.props.children}
}
