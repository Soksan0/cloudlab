import {act,renderHook} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import {useSceneTransition} from './useSceneTransition'
import type {SceneView} from './components'
afterEach(()=>vi.useRealTimers())
it('cancels interrupted cross-view travel and restores a visible idle scene',()=>{vi.useFakeTimers();const {result,rerender}=renderHook(({view}:{view:SceneView})=>useSceneTransition(view,false),{initialProps:{view:'Workshop' as SceneView}});rerender({view:'Server Interior'});expect(result.current.phase).toBe('leaving');act(()=>vi.advanceTimersByTime(50));rerender({view:'Workshop'});act(()=>vi.advanceTimersByTime(500));expect(result.current).toEqual({view:'Workshop',phase:'idle'});rerender({view:'Service Flow'});act(()=>vi.advanceTimersByTime(110));expect(result.current.view).toBe('Service Flow');act(()=>vi.advanceTimersByTime(350));expect(result.current.phase).toBe('idle')})
it('reduced motion switches diagrams immediately without transition timers',()=>{vi.useFakeTimers();const {result,rerender}=renderHook(({view}:{view:SceneView})=>useSceneTransition(view,true),{initialProps:{view:'Workshop' as SceneView}});rerender({view:'Server Interior'});expect(result.current).toEqual({view:'Server Interior',phase:'idle'});expect(vi.getTimerCount()).toBe(0)})
