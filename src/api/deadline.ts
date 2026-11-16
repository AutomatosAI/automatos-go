// A per-call AbortController: the caller's signal is forwarded to it, and a timer aborts it when the
// server has not answered in time, or the client ends the call itself (expire: a stream past one of
// its limits). The client tells a timeout from the caller's own abort by timedOut(), and callFailure
// turns what a call threw into the taxonomy the same way for every kind of call.

import { abortError, ApiError, isAbortError, isApiError } from './errors';

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

function noAnswer(timeoutMs: number): Error {
  return new Error(`no answer within ${timeoutMs} ms`);
}

/**
 * What a call threw, in the taxonomy: an ApiError stays itself, the caller's abort stays an abort,
 * and anything else (the deadline, a dead connection) is the network.
 */
export function callFailure(
  error: unknown,
  deadline: Deadline,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): unknown {
  if (isApiError(error)) return error;
  if (signal?.aborted) return isAbortError(error) ? error : abortError();
  const cause = deadline.timedOut() ? noAnswer(timeoutMs) : error;
  return new ApiError('network', { cause });
}

/** A body read under a deadline that ran out: the network, as the call itself would be. */
export function timedOutError(timeoutMs: number): ApiError {
  return new ApiError('network', { cause: noAnswer(timeoutMs) });
}
