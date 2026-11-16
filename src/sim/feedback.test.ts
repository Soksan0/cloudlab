import {describe,it,expect} from 'vitest'
import {calculateMetrics,createInitialState,loadGame,previewEquipmentImpact,purchaseEquipment,purchaseUpgrade,serializeGame,skipTutorial,stepGame,triggerIncident} from './engine'
import {impactRows,impactSummary,STAGES} from './feedback'
import {UPGRADES} from './upgrades'
import {STANDARD_PRICE,AI_PRICE} from './hardware'
import type {GameState} from './types'
const lab=()=>{const s=skipTutorial(createInitialState());s.cash=100000;s.revenue.opening=100000;s.nextIncidentAt=0;return s}
const full=()=>{let s=lab();for(const u of UPGRADES)s=purchaseUpgrade(s,u.id);return stepGame(s,2.1)}

describe('measured feedback',()=>{
 it('reports workload capacities and explicit time units',()=>{const s=lab(),p=previewEquipmentImpact(s,'cpu');expect(impactRows(p).find(x=>x.label==='CPU')?.unit).toBe('requests/second');expect(impactSummary(p)).toContain('/second');expect(impactSummary(p)).toContain('/minute')})
 it('does not promise more revenue at fully served current demand',()=>{let s=purchaseEquipment(lab(),'cpu');s=purchaseEquipment(s,'cpu');expect(s.lastPurchase!.after.served).toBe(s.lastPurchase!.before.served);expect(impactSummary(s.lastPurchase!)).toContain('More headroom')})
 it.each([1,4] as const)('measures only incident duration while ordinary play continues at speed %s',speed=>{let s=triggerIncident(lab(),'marketing');s.speed=speed;s=stepGame(s,30/speed);const r=s.eventReports[0];expect(r.duration).toBeCloseTo(25,8);expect(s.elapsed).toBeCloseTo(30,8);expect(r.served+r.dropped).toBeCloseTo(r.standardRequests+r.aiRequests,6);expect(r.potentialGross-r.gross).toBeCloseTo(STAGES.reduce((n,k)=>n+r.missedByStage[k],0),7);expect(r.extraRequests).toBeCloseTo((r.standardRequests+r.aiRequests)/3,6);expect(r.gross).toBeLessThan(s.revenue.gross)})
 it('survives reload during an incident without inventing totals',()=>{let s=stepGame(triggerIncident(lab(),'marketing'),7.35);s=purchaseEquipment(s,'cpu');const restored=loadGame(serializeGame(s))!;expect(restored.incident?.stats).toEqual(s.incident?.stats);s=stepGame(restored,20);expect(s.eventReports[0].duration).toBeCloseTo(25);expect(s.eventReports[0].gross).not.toBeCloseTo(s.cash-100000)})
 it('values simultaneous standard and AI losses at the correct prices',()=>{let s=full();s.totalServed=1e8;s.nextIncidentAt=0;s=triggerIncident(s,'bot');s=stepGame(s,26);const r=s.eventReports[0];expect(r.aiRequests).toBeGreaterThan(0);expect(r.potentialGross).toBeCloseTo(r.standardRequests*STANDARD_PRICE+r.aiRequests*AI_PRICE,6);expect(STAGES.reduce((n,k)=>n+r.missedByStage[k],0)).toBeCloseTo(r.potentialGross-r.gross,6)})
 it('marks migrated active event measurements as partial',()=>{let s=stepGame(triggerIncident(lab(),'marketing'),15);s=loadGame(JSON.stringify({...s,version:4}))!;expect(s.incident?.stats?.partial).toBe(true);expect(s.incident?.stats?.gross).toBe(0);s=stepGame(s,15);expect(s.eventReports[0].duration).toBeCloseTo(10);expect(s.eventReports[0].partial).toBe(true)})
 it('rejects impossible incident and purchase reports',()=>{const s=createInitialState();expect(loadGame(JSON.stringify({...s,eventReports:[{duration:-1}]}))).toBeNull();expect(loadGame(JSON.stringify({...s,lastPurchase:{id:'cpu'}}))).toBeNull()})
 it('summed stage losses explain all missed customer revenue',()=>{const s=full();s.totalServed=1e9;const m=calculateMetrics(s);expect(Object.values(m.missedRevenue).reduce((a,b)=>a+b,0)).toBeCloseTo((m.standardDemand*STANDARD_PRICE+m.aiDemand*AI_PRICE)*60-m.gross,8)})
})
