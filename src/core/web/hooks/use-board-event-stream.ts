// Vendored from AutomatosAI/automatos-ai frontend/hooks/use-board-event-stream.ts @ 630fc1c85af06c5c76e70c74e9653ee1804fdf41 · extract: parseSSEFrames — do not edit — scripts/sync-core.ts
/** One parsed SSE frame (event name + JSON-decoded data, if any). */
interface SSEEvent {
  event: string
  data: unknown
}

/**
 * Parse a chunk of accumulated SSE text into complete frames, returning the
 * frames plus any trailing partial frame still in the buffer. Pure — no I/O.
 */
export function parseSSEFrames(buffer: string): { events: SSEEvent[]; rest: string } {
  const events: SSEEvent[] = []
  // Frames are separated by a blank line. Keep the trailing (possibly partial)
  // segment in the buffer for the next chunk.
  const segments = buffer.split('\n\n')
  const rest = segments.pop() ?? ''

  for (const segment of segments) {
    const trimmed = segment.trim()
    if (!trimmed || trimmed.startsWith(':')) {
      // Blank or a heartbeat comment (`: hb`) — liveness only, no refresh.
      continue
    }
    let eventName = 'message'
    const dataLines: string[] = []
    for (const line of trimmed.split('\n')) {
      if (line.startsWith('event:')) {
        eventName = line.slice('event:'.length).trim()
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trim())
      }
    }
    let data: unknown = null
    if (dataLines.length > 0) {
      try {
        data = JSON.parse(dataLines.join('\n'))
      } catch {
        data = dataLines.join('\n')
      }
    }
    events.push({ event: eventName, data })
  }
  return { events, rest }
}
