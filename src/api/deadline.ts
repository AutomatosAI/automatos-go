// A per-call AbortController: the caller's signal is forwarded to it, and a timer aborts it when the
// server has not answered in time, or the client ends the call itself (expire: a stream past one of
// its limits). The client tells a timeout from the caller's own abort by timedOut().

export type Deadline = {
  /** The signal the transport gets. */
  readonly signal: AbortSignal;
  timedOut(): boolean;
  /** The server answered in time: stop the timer, keep forwarding the caller's abort. */
  settle(): void;
  /** The call is over: stop the timer and stop listening to the caller. */
  dispose(): void;
  /** Ends the call now, as a timeout: the transport's request, and any read of its body, abort. */
  expire(): void;
};

export function startDeadline(timeoutMs: number, outer?: AbortSignal): Deadline {
  const controller = new AbortController();
  let expired = false;
  const expire = () => {
    expired = true;
    controller.abort();
  };
  const timer = setTimeout(expire, timeoutMs);
  const forward = () => controller.abort();
  if (outer?.aborted) controller.abort();
  else outer?.addEventListener('abort', forward);
  return {
    signal: controller.signal,
    timedOut: () => expired,
    settle: () => clearTimeout(timer),
    dispose: () => {
      clearTimeout(timer);
      outer?.removeEventListener('abort', forward);
    },
    expire,
  };
}
