// Tunables of the one API client (D-NO-HARDCODE): every timeout and limit it applies is named here.

/** A JSON request, headers and body together, gives up after this long (a network error). */
export const REQUEST_TIMEOUT_MS = 30_000;

/**
 * A stream (a chat turn, the live events) must answer with its status within this long; the body
 * then runs for as long as the server keeps it open, until the caller aborts.
 */
export const STREAM_CONNECT_TIMEOUT_MS = 30_000;

/**
 * A chat turn (POST /api/chat) answers its status only once the server has saved the message and
 * chosen who answers (an LLM call): a healthy turn may take a while to answer, so it gets this hard
 * cap instead (>= 120 s, Gerard, 28 Oct 2026). After the status there is no cap at all: the turn's
 * body is read for as long as the server keeps it open, however long it runs.
 */
export const CHAT_TURN_CONNECT_TIMEOUT_MS = 120_000;

/** A binary body (binary()) larger than this is refused unless the caller sets its own cap. */
export const BINARY_MAX_BYTES = 10 * 1024 * 1024;

/** A server message (a 409's detail.message) longer than this is cut before anyone sees it. */
export const SERVER_MESSAGE_MAX_CHARS = 500;
