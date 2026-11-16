import {describe,it,expect} from 'vitest'
import {acknowledgeAnnouncement,calculateMetrics,createInitialState,getNextAnnouncement,loadGame,previewEquipmentImpact,purchaseEquipment,purchaseUpgrade,replayTutorial,serializeGame,setPolicy,skipTutorial,stepGame,triggerIncident,advanceTutorial} from './engine'
import {impactSummary,STAGES} from './feedback'
import {UPGRADES} from './upgrades'
import type {GameState} from './types'
const ack=(state:GameState)=>{let s=state;while(getNextAnnouncement(s))s=acknowledgeAnnouncement(s,getNextAnnouncement(s)!.id);return s}
const lab=()=>{const s=skipTutorial(createInitialState());s.cash=100000;s.nextIncidentAt=0;return s}
const full=()=>{let s=lab();for(const u of UPGRADES)s=ack(purchaseUpgrade(s,u.id));s.incidentQueue=[];return s}

describe('measured upgrade feedback',()=>{
  it('reports effective rates after virtualization, traffic and firewall modifiers',()=>{
    let s=full();s=setPolicy(s,'firewall','strict');s.cash=10000
    const expected=previewEquipmentImpact(s,'cpu')
    const next=purchaseEquipment(s,'cpu')
    expect(next.lastPurchase!.after.compute-next.lastPurchase!.before.compute).toBeCloseTo(3*1.25*1.1*.92)
    expect(expected.after.compute).toBe(next.metrics.compute)
    expect(next.lastPurchase!.before.net).toBe(calculateMetrics(s).net)
    expect(next.lastPurchase!.after.net).toBe(calculateMetrics(next).net)
  })
  it('does not promise extra revenue when demand is already served',()=>{
    let s=purchaseEquipment(lab(),'cpu')
    s=purchaseEquipment(s,'cpu')
    expect(s.lastPurchase!.after.served).toBe(s.lastPurchase!.before.served)
    expect(impactSummary(s.lastPurchase!)).toContain('More headroom')
    expect(s.revenue.gross).toBe(0)
  })
  it('handles cache/cloud changes and previews without spending or rewarding',()=>{
    const s=full(),before=serializeGame(s),q=previewEquipmentImpact(s,'cloud',3)
    expect(q.after.cloud-q.before.cloud).toBeCloseTo(18)
    expect(serializeGame(s)).toBe(before)
    const next=purchaseEquipment(s,'ai',1)
    expect(next.lastPurchase!.after.aiCapacity-next.lastPurchase!.before.aiCapacity).toBe(4)
  })
})

describe('event and revenue accounting',()=>{
  it.each([1,4] as const)('integrates exactly 25 game minutes at speed %s and stops at its report',speed=>{
    let s=triggerIncident(lab(),'marketing');s.speed=speed
    expect(getNextAnnouncement(s)!.title).toBe('Your campaign went viral!')
    expect(stepGame(s,100)).toBe(s)
    s=ack(s);const start=s.elapsed;s=stepGame(s,100)
    const r=s.eventReports[0]
    expect(r.duration).toBeCloseTo(25,8);expect(s.elapsed-start).toBeCloseTo(25,8)
    expect(r.gross).toBeCloseTo(s.revenue.gross)
    expect(r.expenses).toBeCloseTo(s.revenue.expenses)
    expect(r.potentialGross-r.gross).toBeCloseTo(STAGES.reduce((n,k)=>n+r.missedByStage[k],0))
    expect(r.extraRequests).toBeCloseTo((r.standardRequests+r.aiRequests)/3)
    expect(getNextAnnouncement(s)!.kind).toBe('report')
    expect(r.dominantStage).toBe('compute')
  })
  it('excludes purchases, grants, and achievements and survives a mid-event reload',()=>{
    let s=ack(triggerIncident(lab(),'marketing'))
    s=stepGame(s,7.35);s=purchaseEquipment(s,'cpu');s=stepGame(s,2.21)
    const loaded=loadGame(serializeGame(s))!
    expect(loaded.incident!.stats).toEqual(s.incident!.stats)
    s=stepGame(loaded,50)
    expect(s.eventReports[0].gross).toBeCloseTo(s.revenue.gross)
    expect(s.eventReports[0].duration).toBeCloseTo(25)
    expect(s.achievementIDs).toContain('first-equipment')
    expect(s.eventReports[0].gross).not.toBeCloseTo(s.cash-100000)
    expect(s.eventReports[0].missedByStage.memory).toBeGreaterThan(0)
  })
  it('prices standard/AI losses accurately under simultaneous constraints',()=>{
    let s=full();s.elapsed=20000;s.reputation=90;s.cloudProvisioned=24;s.aiProvisioned=8
    s=ack(triggerIncident(s,'bot'));s=stepGame(s,50)
    const r=s.eventReports[0]
    expect(r.aiRequests).toBeGreaterThan(0)
    expect(r.potentialGross).toBeCloseTo(r.standardRequests*4+r.aiRequests*12)
    expect(STAGES.reduce((n,k)=>n+r.missedByStage[k],0)).toBeCloseTo(r.potentialGross-r.gross)
    expect(r.missedByStage.network).toBeGreaterThan(0);expect(r.missedByStage.ai).toBeGreaterThan(0)
  })
  it('does not produce revenue while manually paused, gated, or replaying',()=>{
    let s=lab();s.paused=true;expect(stepGame(s,10).revenue.gross).toBe(0)
    s.paused=false;s=triggerIncident(s,'marketing');expect(stepGame(s,10).revenue.gross).toBe(0)
    s=advanceTutorial(replayTutorial(ack(s)));s=stepGame(s,4)
    expect(s.revenue.gross).toBe(0)
  })
  it('migrates active v3 incidents as partial reports without inventing earlier totals',()=>{
    let s=ack(triggerIncident(lab(),'marketing'));s=stepGame(s,15)
    const legacy={...s,version:3,incident:{...s.incident,stats:undefined},revenue:undefined,eventReports:undefined,lastPurchase:undefined}
    s=loadGame(JSON.stringify(legacy))!
    expect(s.incident!.stats!.partial).toBe(true);expect(s.revenue.gross).toBe(0)
    s=stepGame(s,30)
    expect(s.eventReports[0].duration).toBeCloseTo(10);expect(s.eventReports[0].partial).toBe(true)
    s.paused=true;const saved=loadGame(serializeGame(s))!
    expect(saved.eventReports).toEqual(s.eventReports)
    const restored=ack(saved);expect(restored.paused).toBe(true)
  })
  it('rejects invalid ledger and report data',()=>{
    const s=createInitialState()
    expect(loadGame(JSON.stringify({...s,revenue:{gross:-1,expenses:0,grants:0}}))).toBeNull()
    expect(loadGame(JSON.stringify({...s,eventReports:[{duration:-1}]}))).toBeNull()
    expect(loadGame(JSON.stringify({...s,lastPurchase:{id:'cpu'}}))).toBeNull()
  })
})
