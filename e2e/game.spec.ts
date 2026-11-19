import {expect,test,type Page,type Locator} from '@playwright/test'
import {readFile} from 'node:fs/promises'
import {acknowledgeAnnouncement,calculateMetrics,createInitialState,getNextAnnouncement,purchaseEquipment,purchaseUpgrade,serializeGame,skipTutorial,stepGame,triggerIncident} from '../src/sim/engine'
import {UPGRADES} from '../src/sim/upgrades'
import {quotaForLevel} from '../src/sim/hardware'
import type {GameState,UpgradeId} from '../src/sim/types'
const SAVE_KEY='cloudlab-save-v1'
test('supporting hardware inspection names the part without inventing live meters',async({page})=>{const s=sandbox();s.paused=true;await page.setViewportSize({width:780,height:600});await openGame(page,s);await choose(page,'cpu');for(const name of ['Motherboard','Power supply','Cooling bank']){await page.getByRole('button',{name:'Inspect '+name,exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('combobox',{name:'Component',exact:true})).toContainText(name==='Cooling bank'?'Cooling':name);await expect(page.getByTestId('tuning-console').getByRole('meter')).toHaveCount(0);await fits(page)}})
test('guided learning remains playable at the compact desktop size',async({page})=>{await page.setViewportSize({width:780,height:600});await openGame(page);await page.getByRole('button',{name:'Start tutorial',exact:true}).click();await finishTutorial(page);expect((await snapshot(page)).tutorialComplete).toBe(true);await fits(page)})
for(const scene of ['street','rooftop','operations','ai'])test(`progression artwork ${scene} keeps the new HUD and monitor usable`,async({page})=>{let s=scene==='street'?sandbox():scene==='rooftop'?sandbox(['cpu','memory','ssd','virtualization','server2','load_balancer']):scene==='operations'?ack(stepGame(sandbox(UPGRADES.filter(u=>u.id!=='ai').map(u=>u.id)),2.1)):full();s.paused=true;await page.setViewportSize({width:1440,height:900});await openGame(page,s);await fits(page);await page.screenshot({path:`test-results/cloudlab-scene-${scene}.png`})
})
test('view lifecycle keeps global listeners and DOM size bounded',async({page})=>{
 await page.addInitScript(()=>{const active=new Map<EventTarget,Map<string,Set<EventListenerOrEventListenerObject>>>(),add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener;EventTarget.prototype.addEventListener=function(type,listener,options){if(listener&&(this===window||this===document)){let types=active.get(this);if(!types)active.set(this,types=new Map());let listeners=types.get(type);if(!listeners)types.set(type,listeners=new Set());listeners.add(listener)}return add.call(this,type,listener,options)};EventTarget.prototype.removeEventListener=function(type,listener,options){if(listener)active.get(this)?.get(type)?.delete(listener);return remove.call(this,type,listener,options)};(window as unknown as {listenerCount:()=>number}).listenerCount=()=>[...active.values()].reduce((sum,types)=>sum+[...types.values()].reduce((n,ls)=>n+ls.size,0),0)})
 const s=healthy();s.paused=true;await openGame(page,s);const count=()=>page.evaluate(()=>(window as unknown as {listenerCount:()=>number}).listenerCount()),before=await count(),nodes=await page.locator('*').count()
 for(let i=0;i<15;i++){await page.getByRole('button',{name:['Server Interior','Service Flow','Workshop'][i%3],exact:true}).click();await dashboard(page);await closeDashboard(page)}expect(await count()).toBeLessThanOrEqual(before);expect(await page.locator('*').count()).toBeLessThanOrEqual(nodes+20)
})
test('Only when asked persists but manual Shroud remains available without covering the purchase',async({page})=>{
 await openGame(page,sandbox());await utility(page,'Settings');await page.getByRole('switch',{name:'Only when asked'}).click();await page.keyboard.press('Escape');await page.clock.runFor(60000);await expect(page.getByTestId('shroud-message')).toHaveCount(0)
 await choose(page,'cpu');await page.getByRole('button',{name:'Shroud',exact:true}).click();const bubble=page.getByTestId('shroud-message');await expect(bubble).toBeVisible();await page.clock.runFor(100)
 const a=await bubble.boundingBox(),b=await page.getByTestId('tuning-console').boundingBox();expect(Math.max(0,Math.min(a!.x+a!.width,b!.x+b!.width)-Math.max(a!.x,b!.x))*Math.max(0,Math.min(a!.y+a!.height,b!.y+b!.height)-Math.max(a!.y,b!.y))).toBe(0)
 await snapshot(page);await page.reload();await utility(page,'Settings');await expect(page.getByRole('switch',{name:'Only when asked'})).toHaveAttribute('aria-checked','true')
})
test('compact policies, comparison options, storage pages and ledger fit without scrolling',async({page})=>{
 await page.setViewportSize({width:780,height:600});const s=healthy();s.companyLevel=100;s.levelQuota=quotaForLevel(100);s.paused=true;s.metrics=calculateMetrics(s);await openGame(page,s)
 for(const id of ['load_balancer','security','autoscaling','cloud','ai']){await choose(page,id,['cloud','ai'].includes(id)?'Equipment':'Technology');await page.getByText('Policies & running costs',{exact:true}).click();await fits(page)}
 await choose(page,'ssd');for(const name of ['Space','IOPS','MiB/s']){await page.getByTestId('tuning-console').getByRole('button',{name,exact:true}).click();await fits(page)}
 await choose(page,'cpu');const compare=page.getByRole('button',{name:/^Compare \d options/});if(await compare.isVisible()){await compare.click();await fits(page)}
 const panel=await dashboard(page);for(const name of ['Processing','Storage','Fleet']){await panel.locator('.resource-groups').getByRole('button',{name,exact:true}).click();await fits(page)}await dashboard(page,'Finance');await panel.getByRole('button',{name:'Ledger',exact:true}).click();await fits(page)
})
test('dashboard reserves scene space and meter text has accessible contrast',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await openGame(page,sandbox());const panel=await dashboard(page),scene=await page.getByTestId('scene-viewport').boundingBox(),dock=await panel.boundingBox();expect(scene!.y+scene!.height).toBeLessThanOrEqual(dock!.y)
 await page.setViewportSize({width:780,height:600});await expect(page.getByTestId('tuning-console')).toBeHidden();await fits(page);await page.setViewportSize({width:1440,height:900});await fits(page)
 const colors=await panel.locator('.meter-heading span,.meter-values,.resource-meter>small').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).color))
 const luminance=(rgb:number[])=>rgb.map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4}).reduce((s,c,i)=>s+c*[.2126,.7152,.0722][i],0),background=luminance([20,44,62]);for(const color of colors){const foreground=luminance(color.match(/[\d.]+/g)!.slice(0,3).map(Number));expect((Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05)).toBeGreaterThanOrEqual(4.5)}
})
test('Status uses live readings and removes hypothetical controls',async({page})=>{const s=full();s.paused=true;await openGame(page,s);const before=await snapshot(page),panel=await dashboard(page);await expect(panel.getByRole('button',{name:'+ traffic',exact:true})).toHaveCount(0);await expect(panel).toContainText('Estimated response');await expect(panel.getByRole('meter')).toHaveCount(3);expect(await snapshot(page)).toEqual(before)})
test('4x presentation keeps bounded nodes and a single camera through view changes',async({page})=>{test.setTimeout(90000);const s=healthy();s.speed=4;await openGame(page,s);await page.clock.resume();await page.evaluate(()=>{(window as unknown as {longTasks:number[]}).longTasks=[];new PerformanceObserver(list=>{for(const entry of list.getEntries())(window as unknown as {longTasks:number[]}).longTasks.push(entry.duration)}).observe({type:'longtask',buffered:false})});for(let second=0;second<60;second+=5){await page.waitForTimeout(5000);await continueMajor(page)}for(let i=0;i<12;i++){await page.getByRole('button',{name:['Workshop','Server Interior','Service Flow'][i%3],exact:true}).click()}await expect(page.locator('.navigable-scene')).toHaveCount(1);await expect(page.getByRole('button',{name:/Minimap:/})).toHaveCount(0);expect(await page.getByTestId('profit-receipt').count()).toBeLessThanOrEqual(3);expect(await page.getByTestId('shroud-message').count()).toBeLessThanOrEqual(1);expect(await page.evaluate(()=>(window as unknown as {longTasks:number[]}).longTasks)).toEqual([])})
test('Shroud warns once about stalled progress and respects dismissal',async({page})=>{await openGame(page,sandbox());await page.clock.runFor(16000);await expect(page.getByTestId('shroud-message')).toBeVisible();await expect(page.getByTestId('shroud-message')).toContainText(/CPU|processor|compute/i);await page.getByRole('button',{name:'Dismiss Shroud'}).click();await page.clock.runFor(20000);await expect(page.getByTestId('shroud-message')).toHaveCount(0);await expect(page.getByRole('button',{name:/Minimap:/})).toHaveCount(0)})
for(const advanced of [false,true])test(`Inspector policies render ${advanced?'advanced':'fresh'} company`,async({page})=>{await openGame(page,advanced?full():sandbox());for(const id of ['load_balancer','security','autoscaling']){await choose(page,id,'Technology');await expect(page.getByRole('heading',{name:'Shroud · Display interrupted'})).toHaveCount(0)}await choose(page,'cloud');await page.getByText('Policies & running costs',{exact:true}).click();await expect(page.getByRole('switch',{name:'Budget Guard'})).toBeVisible()})
const names:Record<string,string>={cpu:'CPU',memory:'Memory',ssd:'Storage (SSD)',network:'Network',cloud:'Cloud capacity',ai:'AI capacity'}
const errors=new WeakMap<Page,string[]>()
test.beforeEach(async({page})=>{const list:string[]=[];errors.set(page,list);page.on('pageerror',error=>list.push(error.message))})
test.afterEach(async({page})=>{expect(errors.get(page),'No unhandled browser errors').toEqual([])})
function ack(state:GameState){let s=state,next=getNextAnnouncement(s);while(next){s=acknowledgeAnnouncement(s,next.id);next=getNextAnnouncement(s)}return s}
function fund(s:GameState,cash=1_000_000){const r=s.revenue;r.opening=cash-r.gross-r.grants-r.rewards+r.purchases+r.expenses;s.cash=cash;return s}
function sandbox(upgrades:UpgradeId[]=[]){let s=fund(skipTutorial(createInitialState()));for(const id of upgrades)s=ack(purchaseUpgrade(s,id));s.incident=null;s.incidentQueue=[];s.nextIncidentAt=1e6;s.reputation=80;s.paused=false;s.metrics=calculateMetrics(s);return s}
function full(){return ack(stepGame(sandbox(UPGRADES.map(u=>u.id)),2.1))}
function healthy(){let s=full();for(const id of ['cpu','memory','ssd','network'] as const)s=purchaseEquipment(s,id,'max');return s}
async function openGame(page:Page,state?:GameState|string){await page.clock.install();await page.addInitScript(({key,save})=>{if(!sessionStorage.getItem('cloudlab-test-initialized')){localStorage.clear();if(save)localStorage.setItem(key,save);sessionStorage.setItem('cloudlab-test-initialized','yes')}},{key:SAVE_KEY,save:typeof state==='string'?state:state?serializeGame(state):null});await page.goto('/');await page.clock.runFor(450)}
async function snapshot(page:Page):Promise<GameState>{return page.evaluate(key=>{window.dispatchEvent(new Event('pagehide'));return JSON.parse(localStorage.getItem(key)!)},SAVE_KEY)}
function balanced(s:GameState){const r=s.revenue;expect(s.cash).toBeCloseTo(r.opening+r.gross+r.grants+r.rewards-r.purchases-r.expenses,6)}
async function utility(page:Page,name:string){await page.getByRole('button',{name:'Menu',exact:true}).click();await page.getByRole('button',{name,exact:true}).click()}
async function dashboard(page:Page,tab='Status'){if(!await page.getByTestId('performance-dashboard').isVisible())await page.getByRole('button',{name:'Performance & Operations',exact:true}).click();await page.getByTestId('performance-dashboard').getByRole('button',{name:tab,exact:true}).click();return page.getByTestId('performance-dashboard')}
async function closeDashboard(page:Page){if(await page.getByTestId('performance-dashboard').isVisible())await page.getByRole('button',{name:'Close dashboard',exact:true}).click()}
async function choose(page:Page,id:string,category:'Equipment'|'Technology'='Equipment'){
 await closeDashboard(page)
 if(await page.getByRole('button',{name:/^Tune components/}).isVisible())await page.getByRole('button',{name:/^Tune components/}).click()
 const panel=page.getByTestId('tuning-console');await panel.getByRole('button',{name:category,exact:true}).click()
 const chooser=panel.getByRole('combobox',{name:'Component',exact:true});await chooser.click()
 await page.locator('[role=option][data-value="'+id+'"]').click();await page.clock.runFor(450)
 await expect(chooser).toHaveAttribute('data-value',id)
}
async function continueMajor(page:Page){for(let i=0;i<20&&await page.getByTestId('major-announcement').isVisible();i++)await page.getByTestId('major-announcement').getByRole('button',{name:/^Continue/}).click()}
async function finishTutorial(page:Page,stopAt?:number){
 for(let i=0;i<50;i++){
  const coach=page.getByTestId('tutorial-coach');if(!await coach.isVisible())return
  const step=Number(await coach.getAttribute('data-step')),phase=await coach.getAttribute('data-phase')
  if(step===stopAt)return
  if(phase==='explain'||await coach.getByRole('button',{name:/^Continue tutorial/}).isVisible())await coach.getByRole('button',{name:/^Continue tutorial/}).click()
  else if(step===1)await page.getByRole('button',{name:'Select Server 01',exact:true}).click()
  else if(step===2)await page.getByRole('button',{name:'Inspect CPU',exact:true}).click()
  else if(step===3)await page.getByRole('button',{name:'Upgrade CPU',exact:true}).click()
  else if(step===4)await page.getByRole('button',{name:'Performance & Operations',exact:true}).click()
  else if(step===5)await page.getByTestId('performance-dashboard').getByRole('button',{name:/^Inspect options/}).click()
  else if(step===6)await page.getByRole('button',{name:'Upgrade Memory',exact:true}).click()
  else if(step===7)await page.getByRole('button',{name:'Upgrade Storage (SSD)',exact:true}).click()
  else if(step===8)await page.getByRole('button',{name:'Achievements',exact:true}).click()
  else if(step===9)await page.getByRole('button',{name:'Claim rewards',exact:true}).click()
  else await page.clock.runFor(500)
 }
 await expect(page.getByTestId('tutorial-coach')).toBeHidden()
}
async function fitsElement(page:Page,element:Locator,label:string){
 if(!await element.isVisible())return
 const box=await element.boundingBox(),viewport=page.viewportSize()!;expect(box,`${label} exists`).not.toBeNull()
 expect(box!.x,`${label} left`).toBeGreaterThanOrEqual(-1);expect(box!.y,`${label} top`).toBeGreaterThanOrEqual(-1)
 expect(box!.x+box!.width,`${label} right`).toBeLessThanOrEqual(viewport.width+1);expect(box!.y+box!.height,`${label} bottom`).toBeLessThanOrEqual(viewport.height+1)
 if(label==='Dashboard'){
  // Projection rays intentionally extend below the panel; interactive content must fit its housing.
  const content=await element.locator('.dashboard-content').boundingBox();expect(content!.y+content!.height,'Dashboard content fits its housing').toBeLessThanOrEqual(box!.y+box!.height+1)
  const clipped=await element.evaluate(node=>{const r=node.getBoundingClientRect();return [...node.querySelectorAll('button')].filter(button=>button.checkVisibility()).filter(button=>{const b=button.getBoundingClientRect();return b.width>0&&b.height>0&&(b.left<r.left-1||b.right>r.right+1||b.top<r.top-1||b.bottom>r.bottom+1)}).map(button=>button.getAttribute('aria-label')||button.textContent)})
  expect(clipped,'Dashboard controls stay inside the panel').toEqual([])
 }else{
  const dimensions=await element.evaluate(node=>({scroll:node.scrollHeight,client:node.clientHeight}))
  expect(dimensions.scroll,`${label} no inner scrolling ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(dimensions.client+1)
 }
}
async function fits(page:Page){
 const dimensions=await page.evaluate(()=>({w:innerWidth,h:innerHeight,scrollW:document.documentElement.scrollWidth,scrollH:document.documentElement.scrollHeight}))
 expect(dimensions.scrollW,'No horizontal page scrolling').toBeLessThanOrEqual(dimensions.w+1);expect(dimensions.scrollH,'No vertical page scrolling').toBeLessThanOrEqual(dimensions.h+1)
 await fitsElement(page,page.getByTestId('tuning-console'),'Console');await fitsElement(page,page.getByRole('listbox'),'Chooser');await fitsElement(page,page.getByTestId('performance-dashboard'),'Dashboard');await fitsElement(page,page.getByRole('dialog'),'Dialog')
 const panel=page.getByTestId('tuning-console')
 if(await panel.isVisible()){
  const clipped=await panel.evaluate(node=>{const panel=node.getBoundingClientRect();return [...node.querySelectorAll('button')].filter(control=>control.checkVisibility()&&!control.closest('[role="listbox"]')).filter(control=>{const r=control.getBoundingClientRect();return r.width>0&&r.height>0&&(r.left<panel.left-1||r.right>panel.right+1||r.top<panel.top-1||r.bottom>panel.bottom+1)}).map(control=>control.getAttribute('aria-label')||control.textContent)})
  expect(clipped,'Console controls not clipped').toEqual([])
 }
}

test('welcome requires a choice and reading time remains free',async({page})=>{
 await openGame(page);await expect(page.getByRole('dialog')).toContainText('cloud');await page.clock.runFor(5000);expect((await snapshot(page)).elapsed).toBe(0)
 await page.getByRole('button',{name:/Open sandbox|Skip to sandbox/}).click();await expect(page.getByTestId('tuning-console')).toBeVisible();await expect(page.getByTestId('company-level')).toContainText('1')
})

test('tutorial teaches live monitoring, upgrades and explicit reward claims',async({page})=>{
 await page.setViewportSize({width:1280,height:720});await openGame(page);await page.getByRole('button',{name:/^Start tutorial/}).click()
 const before=await snapshot(page);await page.clock.runFor(2000);expect((await snapshot(page)).elapsed).toBeGreaterThan(before.elapsed)
 await finishTutorial(page);const s=await snapshot(page);expect(s.tutorialComplete).toBe(true);expect(s.upgradeTimes.cpu).toBeLessThanOrEqual(30);expect(s.upgrades).toEqual(expect.arrayContaining(['cpu','memory','ssd']));balanced(s);await fits(page)
})

test('tutorial task reload and replay preserve company finances',async({page})=>{
 await openGame(page);await page.getByRole('button',{name:/^Start tutorial/}).click();await page.getByRole('button',{name:'Select Server 01',exact:true}).click()
 const step=await page.getByTestId('tutorial-coach').getAttribute('data-step');await snapshot(page);await page.reload();await expect(page.getByTestId('tutorial-coach')).toHaveAttribute('data-step',step!)
 await page.getByRole('button',{name:'Skip tutorial',exact:true}).click();await page.getByRole('button',{name:/Pause/}).click();const before=await snapshot(page)
 await utility(page,'Help');await page.getByRole('button',{name:'Replay tutorial',exact:true}).click();await page.clock.runFor(1500)
 const replay=await snapshot(page);expect(replay.cash).toBe(before.cash);expect(replay.revenue).toEqual(before.revenue);expect(replay.achievementIDs).toEqual(before.achievementIDs)
 await page.getByRole('button',{name:'Skip tutorial',exact:true}).click();expect((await snapshot(page)).paused).toBe(true)
})

test('complete tutorial replay changes no live inventory or reward ledger',async({page})=>{
 const s=full();s.paused=true;await openGame(page,s);const before=await snapshot(page)
 await utility(page,'Help');await page.getByRole('button',{name:'Replay tutorial',exact:true}).click();await finishTutorial(page)
 const after=await snapshot(page);expect(after.cash).toBe(before.cash);expect(after.revenue).toEqual(before.revenue);expect(after.equipmentLevels).toEqual(before.equipmentLevels);expect(after.claimedAchievementIDs).toEqual(before.claimedAchievementIDs);expect(after.paused).toBe(true);expect(after.elapsed).toBe(before.elapsed);expect(after.storageUsedGiB).toBe(before.storageUsedGiB);expect(after.companyLevel).toBe(before.companyLevel);expect(after.totalServed).toBe(before.totalServed)
})

test('tutorial component chooser advances the CPU task and reloading restores reward claim',async({page})=>{
 await openGame(page);await page.getByRole('button',{name:/^Start tutorial/}).click();await page.getByRole('button',{name:'Select Server 01',exact:true}).click()
 await choose(page,'cpu');await expect(page.getByTestId('tutorial-coach')).toHaveAttribute('data-step','3')
 await finishTutorial(page,9);await snapshot(page);await page.reload();await page.clock.runFor(450);await expect(page.getByRole('dialog')).toContainText('Achievements');await expect(page.getByRole('button',{name:'Claim rewards',exact:true})).toBeEnabled()
 await finishTutorial(page);expect((await snapshot(page)).tutorialComplete).toBe(true)
})

test('custom chooser uses pixel-styled options and keyboard controls',async({page})=>{
 const s=sandbox();s.paused=true;await openGame(page,s)
 const chooser=page.getByRole('combobox',{name:'Component',exact:true});await expect(page.locator('select')).toHaveCount(0)
 await chooser.click();const list=page.getByRole('listbox');await expect(list).toBeVisible();await fits(page)
 await page.keyboard.press('End');await page.keyboard.press('Enter');await page.clock.runFor(450);await expect(chooser).toHaveAttribute('data-value','ai');await expect(list).toBeHidden()
 await chooser.click();await page.keyboard.press('Home');await page.keyboard.press('Enter');await page.clock.runFor(450);await expect(chooser).toHaveAttribute('data-value','cpu')
 await chooser.click();await page.keyboard.press('Escape');await expect(list).toBeHidden();await expect(chooser).toBeFocused()
 await chooser.click();await page.getByRole('button',{name:'Shroud',exact:true}).click();await expect(list).toBeHidden()
})

test('performance history is live and bounded during sustained play',async({page})=>{
 await openGame(page,sandbox());const panel=await dashboard(page)
 const initial=Number(await panel.getAttribute('data-sample-count'))
 await page.clock.runFor(65_000)
 const count=Number(await panel.getAttribute('data-sample-count'))
 expect(count).toBeGreaterThan(initial);expect(count).toBeLessThanOrEqual(60)
 const after=await snapshot(page);expect(after.elapsed).toBeGreaterThan(60);expect(after.companyLevel).toBe(1)
})

test('component choices focus parts beside the console and preserve manual views',async({page})=>{
 const s=full();s.paused=true;await openGame(page,s)
 for(const id of ['cpu','memory','ssd','network']){
  await choose(page,id);await expect(page.getByRole('button',{name:'Server Interior',exact:true})).toHaveAttribute('aria-pressed','true')
  const part=await page.locator(`.scene-viewport [data-component-id="${id}"]`).first().boundingBox(),panel=await page.getByTestId('tuning-console').boundingBox()
  expect(part!.x).toBeGreaterThanOrEqual(0);expect(part!.x+part!.width).toBeLessThanOrEqual(panel!.x-3)
 }
 await page.getByRole('button',{name:'Service Flow',exact:true}).click();await page.locator('[data-component-id="network"]').first().click();await expect(page.getByRole('button',{name:'Service Flow',exact:true})).toHaveAttribute('aria-pressed','true')
 await expect(page.getByRole('combobox',{name:'Component',exact:true})).toHaveAttribute('data-value','network')
 for(const id of ['cloud','ai']){await choose(page,id);await expect(page.getByRole('button',{name:'Service Flow',exact:true})).toHaveAttribute('aria-pressed','true')}
})

test('manual camera pan and zoom persist until Fit without accidental selection',async({page})=>{
 const s=sandbox();s.paused=true;await openGame(page,s);await choose(page,'cpu')
 const svg=page.locator('.scene-viewport svg').first(),initial=await svg.getAttribute('viewBox')
 await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.clock.runFor(450);expect(await svg.getAttribute('viewBox')).not.toBe(initial)
 const stage=await page.getByTestId('scene-viewport').boundingBox();await page.mouse.move(stage!.x+80,stage!.y+stage!.height*.65);await page.mouse.down();await page.mouse.move(stage!.x+160,stage!.y+stage!.height*.72,{steps:8});await page.mouse.up()
 const manual=await svg.getAttribute('viewBox'),selected=await page.getByRole('combobox',{name:'Component',exact:true}).getAttribute('data-value')
 await page.clock.runFor(2000);expect(await svg.getAttribute('viewBox')).toBe(manual);expect(selected).toBe('cpu')
 await page.getByRole('button',{name:'Fit view',exact:true}).click();await page.clock.runFor(450);expect(await svg.getAttribute('viewBox')).not.toBe(manual)
 const before=await snapshot(page);const part=await page.locator('[data-component-id="memory"]').first().boundingBox();if(part){await page.mouse.move(part.x+part.width/2,part.y+part.height/2);await page.mouse.down();await page.mouse.move(part.x+part.width/2+60,part.y+part.height/2+30,{steps:6});await page.mouse.up()}
 expect((await snapshot(page)).revenue.purchases).toBe(before.revenue.purchases)
})

test('camera supports trackpad-style panning, Ctrl-wheel zoom and keyboard alternatives',async({page})=>{
 const s=sandbox();s.paused=true;await openGame(page,s);await choose(page,'cpu')
 const svg=page.locator('.scene-viewport svg').first(),box=await svg.boundingBox(),before=await svg.getAttribute('viewBox'),zoom=Number(await svg.getAttribute('data-camera-zoom'))
 await page.mouse.move(box!.x+100,box!.y+box!.height*.65);await page.mouse.wheel(40,60);await page.clock.runFor(50)
 expect(await svg.getAttribute('viewBox')).not.toBe(before);expect(Number(await svg.getAttribute('data-camera-zoom'))).toBeCloseTo(zoom,2)
 await page.keyboard.down('Control');await page.mouse.wheel(0,-60);await page.keyboard.up('Control');await page.clock.runFor(50)
 expect(Number(await svg.getAttribute('data-camera-zoom'))).toBeGreaterThan(zoom)
 await svg.focus();const panned=await svg.getAttribute('viewBox');await page.keyboard.press('ArrowRight');expect(await svg.getAttribute('viewBox')).not.toBe(panned)
 const zoomed=Number(await svg.getAttribute('data-camera-zoom'));await page.keyboard.press('Minus');expect(Number(await svg.getAttribute('data-camera-zoom'))).toBeLessThan(zoomed)
 await page.keyboard.press('0');await page.clock.runFor(450);await expect(svg).toHaveAttribute('data-camera-mode','focused')
})

test('clicking a visible component keeps a manually framed camera in place',async({page})=>{
 const s=sandbox();s.paused=true;await openGame(page,s);await choose(page,'cpu');await page.getByRole('button',{name:'Fit view',exact:true}).click();await page.clock.runFor(450)
 const svg=page.locator('.scene-viewport svg').first();await svg.focus();await page.keyboard.press('ArrowRight');const frame=await svg.getAttribute('viewBox')
 await page.getByRole('button',{name:'Inspect RAM',exact:true}).click();await page.clock.runFor(450)
 await expect(page.getByRole('combobox',{name:'Component',exact:true})).toHaveAttribute('data-value','memory');expect(await svg.getAttribute('viewBox')).toBe(frame);await expect(svg).toHaveAttribute('data-camera-mode','manual')
})

test('missing Storage prerequisite leads directly to an accessible upgrade',async({page})=>{
 const s=sandbox(['cpu','memory']);s.paused=true;await openGame(page,s);await choose(page,'virtualization','Technology')
 const panel=page.getByTestId('tuning-console');await panel.getByRole('button',{name:/^Inspect Storage \(SSD\)/}).click();await expect(page.getByRole('combobox',{name:'Component',exact:true})).toHaveAttribute('data-value','ssd')
 await panel.getByRole('button',{name:'Upgrade Storage (SSD)',exact:true}).click();await choose(page,'virtualization','Technology');await expect(panel.getByRole('button',{name:'Unlock Virtualization',exact:true})).toBeEnabled()
})

test('all technologies remain reachable and acquisition popups preserve pause',async({page})=>{
 const s=sandbox();s.paused=true;await openGame(page,s)
 for(const id of ['cpu','memory','ssd']){await choose(page,id);await page.getByRole('button',{name:`Upgrade ${names[id]}`,exact:true}).click()}
 for(const item of UPGRADES.filter(u=>!['cpu','memory','ssd'].includes(u.id))){await choose(page,item.id,'Technology');const button=page.getByRole('button',{name:`Unlock ${item.name}`,exact:true});await expect(button).toBeEnabled();await button.click();await expect(page.getByTestId('major-announcement')).toContainText(/Acquired/i);const before=await snapshot(page);await page.clock.runFor(1000);expect((await snapshot(page)).elapsed).toBe(before.elapsed);await continueMajor(page)}
 const after=await snapshot(page);expect(after.upgrades).toHaveLength(12);expect(after.paused).toBe(true);balanced(after)
})

test('upgrade feedback works in all views and rapid purchases retain the newest result',async({page})=>{
 const s=sandbox();s.paused=true;await openGame(page,s)
 for(const view of ['Workshop','Server Interior','Service Flow']){await page.getByRole('button',{name:view,exact:true}).click();await page.getByRole('button',{name:'Upgrade CPU',exact:true}).click();await expect(page.getByTestId('purchase-feedback')).toContainText(/LV.*→/);await expect(page.getByRole('button',{name:view,exact:true})).toHaveAttribute('aria-pressed','true')}
 await choose(page,'network');const button=page.getByRole('button',{name:'Upgrade Network',exact:true});await button.click();await page.clock.runFor(400);await button.click();await expect(page.getByTestId('purchase-feedback')).toContainText(/500 Mbps/);expect((await snapshot(page)).equipmentLevels.network).toBe(2)
})

test('maximum hardware offers a continued fleet expansion action',async({page})=>{
 let s=full();s=purchaseEquipment(s,'cpu','max');s.paused=true;await openGame(page,s);await choose(page,'cpu')
 const before=await snapshot(page);await page.getByRole('button',{name:'Add server',exact:true}).click();const after=await snapshot(page)
 expect(after.fleet.servers).toBeGreaterThan(before.fleet.servers);expect(after.metrics.hardware.cpuGHz).toBeLessThanOrEqual(3.6);balanced(after)
})

test('a capped-resource monitor diagnosis links to the repeatable expansion card',async({page})=>{
 const s=healthy();s.upgrades=s.upgrades.filter(id=>id!=='ai');s.equipmentLevels.ai=0;s.aiProvisioned=0;s.aiLaunchLevel=null;s.provisioning.gpuTarget=0;s.fleet.servers=100;s.companyLevel=2000;s.levelProgress=0;s.levelQuota=quotaForLevel(2000);s.eventCheckpoint=2000;s.metrics=calculateMetrics(s);s.paused=true;expect(s.metrics.bottleneck).toBe('network')
 await openGame(page,s);const panel=await dashboard(page);await panel.getByRole('button',{name:/^Inspect options/}).click();await expect(page.getByRole('combobox',{name:'Component',exact:true})).toHaveAttribute('data-value','network');await expect(page.getByRole('button',{name:'Add network link',exact:true})).toBeEnabled()
 const before=await snapshot(page);await page.getByRole('button',{name:'Add network link',exact:true}).click();const after=await snapshot(page);expect(after.fleet.networkLinks).toBe(before.fleet.networkLinks+1);await expect(page.getByTestId('purchase-feedback')).toContainText('FLEET');balanced(after)
})

test('rental feedback waits for provisioning before reporting online capacity',async({page})=>{
 let s=ack(stepGame(sandbox(UPGRADES.filter(u=>!['autoscaling','ai'].includes(u.id)).map(u=>u.id)),2.1));s.paused=true;await openGame(page,s);await choose(page,'cloud');const before=await snapshot(page)
 await page.getByRole('button',{name:'Upgrade Cloud capacity',exact:true}).click();await expect(page.getByTestId('purchase-feedback')).toContainText(/Starting/);expect((await snapshot(page)).cloudProvisioned).toBe(before.cloudProvisioned)
 await page.getByRole('button',{name:/Resume/}).click();await page.clock.runFor(1000);expect((await snapshot(page)).cloudProvisioned).toBe(before.cloudProvisioned)
 await page.clock.runFor(1300);const after=await snapshot(page);expect(after.cloudProvisioned).toBe(before.cloudProvisioned+1);await expect(page.getByTestId('purchase-feedback')).toContainText(/online/);balanced(after)
})

test('failed purchases and collapsed console do not lose selection',async({page})=>{
 const s=fund(sandbox(),0);s.paused=true;await openGame(page,s);await choose(page,'memory')
 await expect(page.getByRole('button',{name:'Upgrade Memory',exact:true})).toBeDisabled();await expect(page.getByTestId('tuning-console')).toContainText(/Need|Short/);await expect(page.getByTestId('purchase-feedback')).toBeHidden()
 await page.getByRole('button',{name:'Collapse tuning console',exact:true}).click();await expect(page.getByTestId('tuning-console')).toBeHidden();await page.getByRole('button',{name:/^Tune components/}).click();await expect(page.getByRole('combobox',{name:'Component',exact:true})).toHaveAttribute('data-value','memory')
})

test('monitor dashboard is obvious, live and available from every view',async({page})=>{
 await openGame(page,sandbox());await expect(page.getByRole('button',{name:'Workshop',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('button',{name:'Open Performance & Operations',exact:true})).toBeVisible();await page.getByRole('button',{name:'Open Performance & Operations',exact:true}).click()
 const panel=page.getByTestId('performance-dashboard');await expect(panel).toBeVisible();const before=await snapshot(page)
 await page.clock.runFor(3000);const after=await snapshot(page);expect(after.elapsed).toBeGreaterThan(before.elapsed+2.5);expect(after.totalServed).toBeGreaterThan(before.totalServed);await expect(panel).toContainText(/CPU|processor/i)
 await panel.getByRole('button',{name:/^Inspect options/}).click();await expect(panel).toBeHidden();await expect(page.getByRole('combobox',{name:'Component',exact:true})).toHaveAttribute('data-value','cpu')
 for(const view of ['Server Interior','Service Flow']){await page.getByRole('button',{name:view,exact:true}).click();await dashboard(page);await expect(panel).toBeVisible();await closeDashboard(page)}
 await expect(page.locator('.room-sticker')).toHaveCount(0)
})

test('Finance reconciles and inspector policies do not stop play',async({page})=>{await openGame(page,full());const panel=await dashboard(page,'Finance');await expect(panel).toContainText(/revenue|cost|balance/i);const before=await snapshot(page);await page.clock.runFor(1500);expect((await snapshot(page)).elapsed).toBeGreaterThan(before.elapsed);await choose(page,'cloud');await page.getByText('Policies & running costs',{exact:true}).click();const guard=page.getByRole('switch',{name:'Budget Guard',exact:true});await guard.click();expect((await snapshot(page)).budgetGuard.enabled).toBe(false);await guard.click();expect((await snapshot(page)).budgetGuard.enabled).toBe(true);await page.getByRole('button',{name:'Stop all rented workers',exact:true}).click();expect((await snapshot(page)).rentalsEnabled).toBe(false);await page.getByRole('button',{name:'Resume rented workers',exact:true}).click();await page.clock.runFor(2500);expect((await snapshot(page)).metrics.cloud).toBeGreaterThan(0);balanced(await snapshot(page))})

test('menu keeps only utility actions and trophy claims rewards exactly once',async({page})=>{
 await openGame(page,sandbox());await page.getByRole('button',{name:'Menu',exact:true}).click();const menu=page.getByRole('navigation',{name:'Lab menu',exact:true})
 for(const item of ['Finance','Operations','Events','Achievements'])await expect(menu.getByRole('button',{name:item,exact:true})).toHaveCount(0)
 await page.keyboard.press('Escape');const before=await snapshot(page);expect(before.revenue.rewards).toBe(0)
 await page.getByRole('button',{name:'Achievements',exact:true}).click();await page.getByRole('button',{name:'Claim rewards',exact:true}).click();const claimed=await snapshot(page);expect(claimed.revenue.rewards).toBeGreaterThan(0);balanced(claimed)
 const receipts=await page.getByTestId('profit-receipts').innerText();await page.keyboard.press('Escape');await page.reload();await page.clock.runFor(450);const reloaded=await snapshot(page);expect(reloaded.revenue.rewards).toBe(claimed.revenue.rewards);expect(receipts).not.toContain('Reward')
})

test('healthy service advances company level while overload stalls without escalating demand',async({page})=>{
 const s=sandbox(['cpu']);s.reputation=60;s.metrics=calculateMetrics(s);await openGame(page,s);await page.clock.runFor(26_000)
 const after=await snapshot(page);expect(after.companyLevel).toBeGreaterThan(1);expect(after.metrics.demand).toBeGreaterThan(s.metrics.demand);await expect(page.getByTestId('company-level')).toContainText(String(after.companyLevel));balanced(after)
 await page.reload();const current=await snapshot(page);const demand=current.metrics.demand;await page.clock.runFor(30_000);const stalled=await snapshot(page)
 if(current.metrics.successRate<.98){expect(stalled.companyLevel).toBe(current.companyLevel);expect(stalled.metrics.demand).toBe(demand);expect(stalled.levelProgress).toBeCloseTo(current.levelProgress,4)}
})

test('overloaded level preserves progress and does not create a reputation death spiral',async({page})=>{
 const s=sandbox();s.levelProgress=s.levelQuota*.3;s.paused=false;await openGame(page,s);const before=await snapshot(page);await page.clock.runFor(30_000);const after=await snapshot(page)
 expect(after.companyLevel).toBe(before.companyLevel);expect(after.metrics.demand).toBe(before.metrics.demand);expect(after.levelProgress).toBeCloseTo(before.levelProgress,6);expect(after.reputation).toBeGreaterThanOrEqual(before.reputation);balanced(after)
})

for(const speed of [1,2,4] as const){
 test(`event reaction time stays real at ${speed}× and result popups stop reading costs`,async({page})=>{
  let s=sandbox();s.speed=speed;s=triggerIncident(s,'marketing');await openGame(page,s);const notice=page.getByTestId('major-announcement');await expect(notice).toBeVisible();const before=await snapshot(page);await page.clock.runFor(3000);expect((await snapshot(page)).elapsed).toBe(before.elapsed)
  await continueMajor(page);await page.clock.runFor(30_000);let active=await snapshot(page);expect(active.incident).not.toBeNull();expect(active.incident!.remaining).toBeCloseTo(45,0)
  await dashboard(page,'History');await expect(page.getByTestId('performance-dashboard')).toContainText(/0:45|00:45|45/);await closeDashboard(page)
  await page.clock.runFor(46_000);await expect(page.getByTestId('event-summary')).toBeVisible();const ended=await snapshot(page),report=ended.eventReports[0];expect(report.durationSeconds).toBeCloseTo(75,1);await page.clock.runFor(3000);expect((await snapshot(page)).cash).toBe(ended.cash);balanced(ended)
 })
}

test('fifth-level checkpoint announces once across reload and no event backlog stacks',async({page})=>{
 let s=healthy();s.companyLevel=4;s.levelQuota=calculateMetrics(s).demand*60*25;s.levelProgress=s.levelQuota-1;s.eventCheckpoint=0;s.eventQuietSeconds=0;s.metrics=calculateMetrics(s);s=stepGame(s,.1);expect(s.companyLevel).toBe(5);expect(s.incident).not.toBeNull()
 await openGame(page,s);await expect(page.getByTestId('major-announcement')).toBeVisible();const id=(await snapshot(page)).announcements[0].id;await snapshot(page);await page.reload();await expect(page.getByTestId('major-announcement')).toBeVisible();expect((await snapshot(page)).announcements[0].id).toBe(id)
 await continueMajor(page);await page.clock.runFor(2000);const after=await snapshot(page);expect(after.eventReports).toHaveLength(0);expect(after.incidentQueue).toHaveLength(0)
})

test('subdued receipts show operating profit only and remain bounded',async({page})=>{
 await openGame(page,sandbox());await page.clock.runFor(4000);const receipts=page.getByTestId('profit-receipts');await expect(receipts).toContainText(/\+/);expect(await page.getByTestId('profit-receipt').count()).toBeLessThanOrEqual(3)
 await page.getByRole('button',{name:/Pause/}).click();const before=await snapshot(page);await choose(page,'memory');await page.getByRole('button',{name:'Upgrade Memory',exact:true}).click();await page.clock.runFor(2000);const after=await snapshot(page);expect(after.revenue.gross).toBe(before.revenue.gross);expect(after.revenue.rewards).toBe(0);expect(await page.getByTestId('profit-receipt').count()).toBe(0);balanced(after)
})

test('zero completed requests show negative profit and stable HUD dimensions',async({page})=>{
 let s=sandbox(['cpu','memory','ssd','virtualization']);s=ack(triggerIncident(s,'hardware'));s.metrics=calculateMetrics(s);expect(s.metrics.served).toBe(0);await openGame(page,s)
 const badge=page.getByTestId('profit-badge'),cash=page.getByTestId('cash-display'),before=await cash.boundingBox();await expect(badge).toContainText(/[−-]/)
 const channels=(await badge.evaluate(node=>getComputedStyle(node).color)).match(/[\d.]+/g)!.map(Number);expect(channels[0]).toBeGreaterThan(channels[1]);await page.clock.runFor(1500);const after=await cash.boundingBox();expect(after!.width).toBeCloseTo(before!.width,1);expect(after!.height).toBeCloseTo(before!.height,1);expect((await snapshot(page)).cash).toBeLessThan(s.cash)
})

test('legacy companies retain purchases and treat already paid achievements as claimed',async({page})=>{
 const s=sandbox(['cpu','memory','ssd']);s.paused=true;s.achievementIDs=['first-equipment'];s.revenue.rewards=100;fund(s,4321)
 const legacy={...s,version:5,announcements:[{id:'achievement-1',kind:'achievement',title:'Previously earned',body:'Already paid before migration.',actionLabel:'Continue'}],announcementSequence:1};await openGame(page,JSON.stringify(legacy));const after=await snapshot(page)
 expect(after.version).toBe(6);expect(after.cash).toBe(4321);expect(after.upgrades).toEqual(s.upgrades);expect(after.claimedAchievementIDs).toContain('first-equipment');await expect(page.getByTestId('major-announcement')).toBeHidden();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('cloudlab-save-pre-v6')!).version)).toBe(5);balanced(after)
})

test('Save exports snapshots and invalid imports preserve the company',async({page})=>{
 const s=sandbox(['cpu']);s.paused=true;await openGame(page,s);await utility(page,'Save');const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export save',exact:true}).click();const path=await(await download).path();const saved=JSON.parse(await readFile(path!,'utf8')) as GameState;expect(saved.upgrades).toContain('cpu');balanced(saved)
 await page.getByLabel('Import save file',{exact:true}).setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"version":6,"cash":0}')});await expect(page.getByRole('dialog')).toContainText(/invalid/i);await page.keyboard.press('Escape');expect((await snapshot(page)).cash).toBe(s.cash)
})

test('pause, speed and settings preserve the compact playfield',async({page})=>{
 await openGame(page,sandbox());await page.getByRole('button',{name:/Pause/}).click();const before=await snapshot(page);await page.clock.runFor(3000);expect((await snapshot(page)).cash).toBe(before.cash)
 await page.getByRole('button',{name:/Resume/}).click();await page.getByRole('button',{name:'4×',exact:true}).click();await page.clock.runFor(1000);expect((await snapshot(page)).elapsed).toBeGreaterThan(before.elapsed+3.5)
 await utility(page,'Settings');await page.getByRole('button',{name:'Motion on',exact:true}).click();await expect(page.locator('.compact-app')).toHaveClass(/reduced-motion/);await fits(page)
})

test('hidden pages freeze both financial and active event clocks',async({page})=>{
 let s=ack(triggerIncident(sandbox(),'marketing'));await openGame(page,s);const before=await snapshot(page)
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))});await page.clock.runFor(10_000);const hidden=await snapshot(page);expect(hidden.cash).toBeCloseTo(before.cash,1);expect(hidden.elapsed).toBeCloseTo(before.elapsed,1);expect(hidden.incident!.remaining).toBeCloseTo(before.incident!.remaining,1)
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'))});await page.clock.runFor(1000);expect((await snapshot(page)).elapsed).toBeGreaterThan(hidden.elapsed)
})

for(const viewport of [{width:780,height:600},{width:1024,height:600},{width:1280,height:720},{width:1440,height:900},{width:1920,height:1080}]){
 test(`desktop ${viewport.width}×${viewport.height} keeps views, chooser and live dashboard inside the viewport`,async({page})=>{
  await page.setViewportSize(viewport);const s=full();s.paused=true;await openGame(page,s)
  for(const view of ['Workshop','Server Interior','Service Flow']){await page.getByRole('button',{name:view,exact:true}).click();await page.clock.runFor(450);await fits(page);await page.screenshot({path:`test-results/cloudlab-endless-${viewport.width}-${view.toLowerCase().replaceAll(' ','-')}.png`})}
  for(const id of ['cpu','memory','ssd','network','cloud','ai']){await choose(page,id);await fits(page);const pages=page.getByTestId('tuning-console').locator('.reading-tabs button');for(let i=0;i<await pages.count();i++){await pages.nth(i).click();await fits(page)}}
  for(const item of UPGRADES.filter(u=>!['cpu','memory','ssd'].includes(u.id))){await choose(page,item.id,'Technology');await fits(page);const policies=page.locator('.inspector-policies');if(await policies.count()){await policies.locator('summary').click();await fits(page)}}
  await choose(page,'cpu');const chooser=page.getByRole('combobox',{name:'Component',exact:true});await chooser.click();await fits(page);await page.keyboard.press('Escape')
  for(const tab of ['Status','Finance','History']){await dashboard(page,tab);await fits(page);await page.screenshot({path:`test-results/cloudlab-dashboard-${viewport.width}-${tab.toLowerCase()}.png`})}
  await closeDashboard(page);await page.getByRole('button',{name:'Achievements',exact:true}).click();await fits(page);await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click()
  for(const name of ['Help','Save','Settings']){await utility(page,name);await fits(page);await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click()}
 })
}

test('all locked cards and highest storage tier stay compact',async({page})=>{
 await page.setViewportSize({width:780,height:600});const s=sandbox();s.paused=true;await openGame(page,s)
 for(const id of ['cpu','memory','ssd','network','cloud','ai']){await choose(page,id);await fits(page);const pages=page.getByTestId('tuning-console').locator('.reading-tabs button');for(let i=0;i<await pages.count();i++){await pages.nth(i).click();await fits(page)}}
 for(const item of UPGRADES.filter(u=>!['cpu','memory','ssd'].includes(u.id))){await choose(page,item.id,'Technology');await fits(page)}
})

test('capped equipment prerequisites and fleet cards fit the compact desktop',async({page})=>{
 await page.setViewportSize({width:780,height:600});let s=sandbox();for(const id of ['cpu','memory','ssd','network'] as const)s=purchaseEquipment(s,id,'max');s.paused=true;await openGame(page,s)
 for(const id of ['cpu','memory','ssd','network']){await choose(page,id);await fits(page)}
 await choose(page,'cpu');await page.getByRole('button',{name:'Inspect Load Balancer',exact:false}).click();await expect(page.getByRole('combobox',{name:'Component',exact:true})).toHaveAttribute('data-value','load_balancer');await fits(page)
})
