// The edge screens (PRD-001 §4.7 Edges, Ember 06-09, US-017f) in every style: First open, Not
// running, Something went wrong and Lost, and EdgeScreen, an error as its edge. Props only:
// app/+not-found.tsx renders Lost; US-016j puts EdgeScreen on the gate's errors and US-016k
// mounts First open on the homes.

export { EdgeScreen, type EdgeScreenProps } from './EdgeScreen';
export { FirstOpen, FirstOpenHello, type FirstOpenHelloProps, type FirstOpenProps } from './FirstOpen';
export { Lost, type LostProps } from './Lost';
export { NotRunning, type NotRunningProps } from './NotRunning';
export { SomethingWrong, type SomethingWrongProps } from './SomethingWrong';
export * from './edges';
export {
  NOT_RUNNING_RECHECK_MS,
  startRecheck,
  type Recheck,
  type RecheckRun,
  type StillRunning,
} from './recheck';
