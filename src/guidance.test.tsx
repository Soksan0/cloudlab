import {act,cleanup,renderHook} from '@testing-library/react'
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {useGuidance} from './useGuidance'
import {useLiveFeed} from './useLiveFeed'
import {createInitialState,skipTutorial} from './sim/engine'
beforeEach(()=>vi.useFakeTimers())
afterEach(()=>{cleanup();vi.useRealTimers()})
const advance=(ms:number)=>act(()=>vi.advanceTimersByTime(ms))
describe('contextual help active-time rules',()=>{
 it('waits for sustained failure, suppresses dismissed advice, and observes the global cooldown',()=>{
  const {result,rerender}=renderHook(({key,running})=>useGuidance(running,key,0,false),{initialProps:{key:'cpu',running:true}})
  advance(14000);expect(result.current.visible).toBe(false);advance(1000);expect(result.current.visible).toBe(true)
  act(()=>result.current.dismiss());advance(60000);expect(result.current.visible).toBe(false)
  rerender({key:'memory',running:true});advance(15000);expect(result.current.visible).toBe(true)
  rerender({key:'storage',running:true});advance(15000);expect(result.current.visible).toBe(false)
  rerender({key:'storage',running:false});advance(60000);expect(result.current.visible).toBe(false)
  rerender({key:'storage',running:true});advance(30000);expect(result.current.visible).toBe(true)
 })
 it('only-when-asked suppresses automatic advice',()=>{const {result}=renderHook(()=>useGuidance(true,'cpu',0,true));advance(120000);expect(result.current.visible).toBe(false)})
})
describe('shared presentation history',()=>{
 it('counts partial active seconds across a pause without sampling paused time',()=>{const s=skipTutorial(createInitialState()),{result,rerender}=renderHook(({running})=>useLiveFeed(s,running,0),{initialProps:{running:true}});advance(500);expect(result.current.samples).toHaveLength(0);rerender({running:false});advance(5000);expect(result.current.samples).toHaveLength(0);rerender({running:true});advance(500);expect(result.current.samples).toHaveLength(1)})
 it('bounds one-second samples, stops on pause, resets on company replacement, and excludes rewards from receipts',()=>{
  const s=skipTutorial(createInitialState()),{result,rerender}=renderHook(({state,running,epoch})=>useLiveFeed(state,running,epoch),{initialProps:{state:s,running:true,epoch:0}})
  advance(65000);expect(result.current.samples).toHaveLength(60);expect(result.current.samples[0].at).toBe(6)
  rerender({state:s,running:false,epoch:0});advance(10000);expect(result.current.samples.at(-1)?.at).toBe(65)
  const rewarded={...s,cash:s.cash+100,revenue:{...s.revenue,rewards:100}}
  rerender({state:rewarded,running:true,epoch:0});advance(1000);expect(result.current.receipts).toHaveLength(0)
  const earned={...rewarded,revenue:{...rewarded.revenue,gross:5,expenses:1}}
  rerender({state:earned,running:true,epoch:0});advance(1000);expect(result.current.receipts[0].amount).toBe(4)
  rerender({state:s,running:true,epoch:1});expect(result.current.samples).toHaveLength(0);expect(result.current.receipts).toHaveLength(0)
 })
})
