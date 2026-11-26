export const INSPECT_OPTIONS='Inspect options'
type Cue={selector:string;instruction:string}
const partFallbacks=(name:string):Cue[]=>[{selector:'[data-guide-tab="equipment"][aria-pressed="false"]',instruction:'Click Equipment in the tuning card.'},{selector:'[data-testid="tuning-console"] [role="combobox"]',instruction:`Choose ${name} in the component list on the right.`},{selector:'[aria-label="Tune components"]',instruction:'Click Tune components to reopen the card.'}]
export const tutorialTargets:Record<number,Cue&{fallbacks?:Cue[]}>= {
 1:{selector:'[aria-label="Select Server 01"]',instruction:'Click Server 01 in the workshop.',fallbacks:[{selector:'[data-guide-view="Workshop"]',instruction:'Return to Workshop, then click Server 01.'}]},
 2:{selector:'.scene-viewport [data-component-id="cpu"][role="button"]',instruction:'Click the CPU inside the open server.',fallbacks:[{selector:'[data-guide-view="Server Interior"]',instruction:'Open Server Interior, then click the CPU.'}]},
 3:{selector:'[data-guide="inspector.upgrade"][data-guide-component="cpu"]',instruction:'Click Upgrade in the tuning card on the right.',fallbacks:partFallbacks('CPU')},
 4:{selector:'[data-guide="hud.monitor"]',instruction:'Click Monitor at the top right.'},
 5:{selector:'[data-guide="monitor.inspect"]',instruction:`Click ${INSPECT_OPTIONS} in the monitor.`,fallbacks:[{selector:'[data-guide="hud.monitor"]',instruction:'Open Monitor, then click Inspect options.'}]},
 6:{selector:'[data-guide="inspector.upgrade"][data-guide-component="memory"]',instruction:'Click Upgrade to add working memory.',fallbacks:partFallbacks('Memory')},
 7:{selector:'[data-guide="inspector.upgrade"][data-guide-component="ssd"]',instruction:'Click Upgrade to install Storage (SSD).',fallbacks:partFallbacks('Storage (SSD)')},
 8:{selector:'[aria-label="Achievements"]',instruction:'Click the trophy in the top bar.'},
 9:{selector:'[aria-label="Claim rewards"]',instruction:'Click Claim rewards in the open trophy panel.',fallbacks:[{selector:'[aria-label="Achievements"]',instruction:'Click the trophy to reopen your rewards.'}]},
}
