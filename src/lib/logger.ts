// Thin __DEV__-gated logger (FR-2) — the ONLY file allowed to touch console
// (eslint no-console holds everywhere else; eslint.config.js turns it off for
// this file only). Release builds compile the gate to false and the calls become
// no-ops.

const enabled = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

export const logger = {
  debug(...args: unknown[]): void {
    if (enabled) console.log(...args);
  },
  info(...args: unknown[]): void {
    if (enabled) console.info(...args);
  },
  warn(...args: unknown[]): void {
    if (enabled) console.warn(...args);
  },
  error(...args: unknown[]): void {
    if (enabled) console.error(...args);
  },
};
