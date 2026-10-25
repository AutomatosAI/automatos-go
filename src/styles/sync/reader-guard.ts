// StyleSync's single-instance guard (US-016j): the signed-in shell mounts StyleSync once for the
// app, and A5's own screens (the Style and look screen, the look pages) still mount theirs from
// phase 1. Only one instance reads at a time, per process: the first one mounted holds the reader
// and the others render nothing; when the holder goes, the next one still mounted takes over, so
// there is never a second reader and never a mounted StyleSync with none. Pure: StyleSync.tsx
// subscribes to it with useSyncExternalStore.

export type ReaderGuard = {
  /** An instance comes in (on mount); returns its leave (on unmount). Joining twice is one join. */
  readonly join: (id: symbol) => () => void;
  /** Whether this instance is the one that reads. */
  readonly holds: (id: symbol) => boolean;
  /** Called whenever the holder changes; returns the unsubscribe. */
  readonly subscribe: (listener: () => void) => () => void;
};

export function createReaderGuard(): ReaderGuard {
  let queue: readonly symbol[] = [];
  const listeners = new Set<() => void>();

  const update = (next: readonly symbol[]) => {
    const before = queue[0];
    queue = next;
    if (queue[0] !== before) listeners.forEach((listener) => listener());
  };

  return Object.freeze({
    join: (id: symbol) => {
      if (!queue.includes(id)) update([...queue, id]);
      return () => update(queue.filter((queued) => queued !== id));
    },
    holds: (id: symbol) => queue[0] === id,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  });
}

/** The one guard for every StyleSync in the app. */
export const STYLE_SYNC_READER: ReaderGuard = createReaderGuard();
