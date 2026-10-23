// Tunables of the one API client (D-NO-HARDCODE): every timeout and limit it applies is named here.

/** A JSON request, headers and body together, gives up after this long (a network error). */
export const REQUEST_TIMEOUT_MS = 30_000;

/**
 * A stream (a chat turn, the live events) must answer with its status within this long; the body
 * then runs for as long as the server keeps it open, until the caller aborts.
 */
export const STREAM_CONNECT_TIMEOUT_MS = 30_000;

/** A server message (a 409's detail.message) longer than this is cut before anyone sees it. */
export const SERVER_MESSAGE_MAX_CHARS = 500;
