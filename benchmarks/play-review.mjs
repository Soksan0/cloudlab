import {chromium} from '@playwright/test'
import {mkdirSync,writeFileSync} from 'node:fs'
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),log=[],errors=[]
page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4173');await page.getByRole('button',{name:'Start guided setup',exact:true}).click({timeout:1500})
const duration=Number(process.env.CLOUDLAB_REVIEW_SECONDS??1800),report=duration<1800?'test-results/first-session.json':'test-results/review-session.json'
const start=Date.now();let active=0,last=start,claimAt=0,viewAt=0,followingPrerequisite=false
try{while(active<duration){try{
 active=await page.evaluate(()=>{window.dispatchEvent(new Event('pagehide'));return JSON.parse(localStorage.getItem('cloudlab-save-v1')).activeSeconds});
 const now=Date.now(),coach=page.getByTestId('tutorial-coach');if(await coach.isVisible()){
  const step=Number(await coach.getAttribute('data-step')),phase=await coach.getAttribute('data-phase');if(phase==='explain')await coach.getByRole('button',{name:'Continue tutorial',exact:true}).click({timeout:1500});else if(step===1)await page.getByRole('button',{name:'Select Server 01',exact:true}).click({timeout:1500});else if(step===2)await page.getByRole('button',{name:'Inspect CPU',exact:true}).click({timeout:1500});else if([3,6,7].includes(step))await page.locator('[data-guide="inspector.upgrade"]').click({timeout:1500});else if(step===4)await page.locator('[data-guide="hud.monitor"]').click({timeout:1500});else if(step===5)await page.locator('[data-guide="monitor.inspect"]').click({timeout:1500});else if(step===8)await page.getByRole('button',{name:'Achievements',exact:true}).click({timeout:1500});else if(step===9)await page.getByRole('button',{name:'Claim rewards',exact:true}).click({timeout:1500})
 }else if(await page.getByTestId('major-announcement').isVisible()){log.push({active,event:await page.getByTestId('major-announcement').innerText()});await page.getByTestId('major-announcement').getByRole('button',{name:'Continue',exact:true}).click({timeout:1500})}
 else{
  // The engine's active clock excludes popups and hidden time.
  const failure=page.locator('.monitor-signals>button:has(.state-limiting)').first();if(await failure.count()&&!followingPrerequisite)await failure.click({timeout:1500})
  const buy=page.locator('[data-guide="inspector.upgrade"]');if(await failure.count()&&await buy.isVisible()&&await buy.isEnabled()){await buy.click({timeout:1500});followingPrerequisite=false}else{const prerequisite=page.locator('.prerequisites button,.prerequisite-link').first();if(await prerequisite.isVisible()){await prerequisite.click({timeout:1500});followingPrerequisite=true}}
  if(active-claimAt>25){claimAt=active;await page.getByRole('button',{name:'Achievements',exact:true}).click({timeout:1500});const claim=page.getByRole('button',{name:'Claim rewards',exact:true});if(await claim.isEnabled())await claim.click({timeout:1500});await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click({timeout:1500})}
  if(active-viewAt>60){viewAt=active;await page.getByRole('button',{name:['Workshop','Server Interior','Service Flow'][Math.floor(active/60)%3],exact:true}).click({timeout:1500});log.push({active,hud:await page.locator('.compact-hud').innerText(),objective:await page.locator('.objective-chip').innerText(),nodes:await page.locator('*').count()});await page.screenshot({path:`test-results/reviewer-${Math.floor(active/60)}.png`})}
 }
 }catch(error){if(await page.getByTestId('major-announcement').isVisible())continue;throw error}
 last=Date.now();await page.waitForTimeout(2500)
 if(Date.now()-start>3600000)throw Error('Review exceeded wall-time limit')
 if(Math.floor(active)%30<3){mkdirSync('test-results',{recursive:true});writeFileSync(report,JSON.stringify({activeSeconds:active,wallSeconds:(Date.now()-start)/1000,log,errors},null,2))}
}
}catch(e){errors.push(String(e))}finally{mkdirSync('test-results',{recursive:true});writeFileSync(report,JSON.stringify({activeSeconds:active,wallSeconds:(Date.now()-start)/1000,log,errors},null,2));await browser.close()}
if(errors.length||active<duration){console.log(JSON.stringify({active,errors}));process.exitCode=1}else console.log('Completed '+duration+' active seconds: '+JSON.stringify({events:log.length,errors}))
