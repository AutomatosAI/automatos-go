// Not running's quiet re-check in React (recheck.ts): the chain starts when the screen mounts and
// stops when it goes. The latest check is read at each tick, so a caller's new function (a
// re-render) never restarts the 5 s wait; each check gets the chain's 'still running' test.

import { useEffect, useRef } from 'react';

import { startRecheck, type RecheckRun } from './recheck';

export function useRecheck(check: RecheckRun): void {
  const latest = useRef(check);
  useEffect(() => {
    latest.current = check;
  }, [check]);
  useEffect(() => startRecheck((running) => latest.current(running)).stop, []);
}
