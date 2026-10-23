// Every refusal the session hears, told once (US-007a, P001N-SEAM-1). The session's one client
// (src/app-state/launch-client.ts) reports each 403 it sees, whichever kit made the call: chat's
// turn and its card buttons and uploads are plain promises the TanStack caches never see, a Command
// Centre write is a mutation. watchRefusals (session-refresh.ts) reports what the query and mutation
// caches hear, for anything that does not go through the client. A refusal that reaches both (a
// mutation's: the client sees its ApiError, then the mutation cache sees the same one) is told once,
// so it is never read again twice. useSessionRefresh listens and hands each to the refresher as
// 'forbidden'. Pure; no React.

export type RefusalListener = () => void;

export type Refusals = {
  /** Tells every listener of this refusal: false when this same error was already told. */
  readonly report: (error: unknown) => boolean;
  /** Listens for refusals; returns the unsubscribe. */
  readonly listen: (listener: RefusalListener) => () => void;
};

/** Already told: the same error object, held weakly so a told refusal is still collected. */
function firstTelling(told: WeakSet<object>, error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return true;
  if (told.has(error)) return false;
  told.add(error);
  return true;
}

export function createRefusals(): Refusals {
  const told = new WeakSet<object>();
  let listeners: readonly RefusalListener[] = [];
  return Object.freeze({
    report: (error: unknown) => {
      if (!firstTelling(told, error)) return false;
      listeners.forEach((listener) => listener());
      return true;
    },
    listen: (listener: RefusalListener) => {
      listeners = [...listeners, listener];
      return () => {
        listeners = listeners.filter((held) => held !== listener);
      };
    },
  });
}

/** The app's one channel: the launch client reports into it, useSessionRefresh listens. */
export const sessionRefusals: Refusals = createRefusals();
