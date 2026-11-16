// Tunables of the one API client (D-NO-HARDCODE): every timeout and limit it applies is named here.

/** A JSON request, headers and body together, gives up after this long (a network error). */
export const REQUEST_TIMEOUT_MS = 30_000;

/**
 * A stream (a chat turn, the live events) must answer with its status within this long; the body
 * then runs for as long as the server keeps it open, under the stream limits below, until the
 * caller aborts. A stream's body read whole (bytes()) stays under this deadline until it is in.
 */
export const STREAM_CONNECT_TIMEOUT_MS = 30_000;

/**
 * A chat turn (POST /api/chat) answers its status only once the server has saved the message and
 * chosen who answers (an LLM call): a healthy turn may take a while to answer, so it gets this hard
 * cap instead (>= 120 s, Gerard, 28 Oct 2026). After the status the turn's body is read for as long
 * as the server keeps sending it, however long it runs, under the stream limits below.
 */
export const CHAT_TURN_CONNECT_TIMEOUT_MS = 120_000;

/**
 * The live events (GET /api/v1/tasks/stream) end when no byte has come for this long. The server
 * sends a heartbeat comment whenever no event has gone for BOARD_SSE_HEARTBEAT_SECONDS (20 s by
 * default): this is four and a half of them, so only a stream that has died ends here. The live
 * connection then reconnects (live-connection.ts).
 */
export const STREAM_IDLE_TIMEOUT_MS = 90_000;

/**
 * A chat turn ends when no byte has come for this long. Its stream has no heartbeat: between two
 * frames the server may be waiting on one model call or one tool. The platform's model client sets
 * no timeout of its own, so the provider SDK's 600 s per try holds; this is half as long again.
 * A turn ended here is read again from the server (thread.ts readBroke): it may still be running.
 */
export const CHAT_TURN_IDLE_TIMEOUT_MS = 15 * 60_000;

/**
 * One line of a chat turn, or one event of the live events, held or whole, is at most this many
 * characters; a longer one ends the stream. The largest legitimate are a chat frame carrying a
 * round's whole text (a model's answer, at most tens of thousands of tokens, JSON-escaped) and a
 * card's data, a few hundred KB at the very most; a live event is a Postgres NOTIFY payload,
 * under 8,000 bytes.
 */
export const STREAM_LINE_MAX_CHARS = 1024 * 1024;

/**
 * One stream carries at most this many characters in all; past it, it ends (the live events then
 * reconnect). A long chat turn sends a few MB; the live events send a heartbeat of a few bytes
 * every 20 s and small events, so a phone left in the foreground on a busy board reaches this
 * after many hours.
 */
export const STREAM_MAX_CHARS = 32 * 1024 * 1024;

/** A binary body (binary()) larger than this is refused unless the caller sets its own cap. */
export const BINARY_MAX_BYTES = 10 * 1024 * 1024;

/**
 * A JSON body (request()) larger than this is refused, read no further: an invalid_response. The
 * largest the app asks for is a long conversation's messages; this is far above any seen.
 */
export const JSON_MAX_BYTES = 10 * 1024 * 1024;

/**
 * An error body ({"detail": ...}, a validation error's list) is read no further than this. One
 * over it carries no detail: the status alone still says which kind of error it is.
 */
export const ERROR_BODY_MAX_BYTES = 64 * 1024;

/** A redirect's Location longer than this is dropped: no real address of a server is. */
export const REDIRECT_TARGET_MAX_CHARS = 2048;

/** A server message (a 409's detail.message) longer than this is cut before anyone sees it. */
export const SERVER_MESSAGE_MAX_CHARS = 500;

/**
 * A limit's wait (a 429's Retry-After) longer than this is not believed: the words say "later".
 * The server's own windows are a minute to an hour (its rate limiter, readiness, the digest).
 */
export const RETRY_AFTER_MAX_MS = 24 * 60 * 60 * 1000;
