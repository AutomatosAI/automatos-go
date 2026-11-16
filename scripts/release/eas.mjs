// eas-cli, as the state check runs it (docs/release/README.md, "State check"). eas reads the app's
// config before every project command and evaluates app.json's plugins while it does, so in an app
// folder without node_modules every eas command fails. The project commands here need only the
// link (owner, slug, project id), so they run in a folder made for the run that holds just that:
// an app.json with the link and no plugins, and a package.json with no `expo` dependency, so
// eas-cli reads app.json itself instead of running `expo config` (project/expoConfig in eas-cli
// 27.10.0; it needs `name` and `slug`). The folder is deleted afterwards.
//
// The readers below take what they need from eas's output and drop the rest. `env:list` prints
// each variable as NAME=value, a plain value in the clear, so only the name before '=' is kept and
// nothing of its output is ever printed or put in a message. Shapes read from eas-cli 27.10.0:
// commands/env/list (no --json, and no --non-interactive: stdin is closed instead),
// commands/workflow/runs and view (--json), commands/account/usage (--json).

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

/** The eas-cli the shapes below were read from, run through npx. */
export const EAS_CLI = 'eas-cli@27.10.0';
export const EAS_TIMEOUT_MS = 120_000;
/** After SIGTERM, how long the process group gets before SIGKILL. */
export const KILL_GRACE_MS = 5_000;
/** After the child exits, how long its output may still drain before the call settles. */
export const DRAIN_MS = 2_000;
const MAX_OUTPUT_CHARS = 4 * 1024 * 1024;
// The escape character is built, not written, so this file holds no control character.
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
const NAME_LINE = /^([A-Z][A-Z0-9_]*)=/;

/**
 * @typedef {{ code: number, stdout: string, stderr: string }} ExecResult
 * @typedef {(command: string, args: string[], options: { cwd: string, env: Record<string, string | undefined>, timeoutMs: number }) => Promise<ExecResult>} Exec
 */

/** eas did not finish in time; its whole process group was killed. */
export class EasTimeout extends Error {}

/** Signals a whole process group, quietly when it is already gone. */
function signalGroup(kill, pid, signal) {
  try {
    kill(-pid, signal);
  } catch {
    // the group has already exited
  }
}

/**
 * Kills the child's process group on timeout: SIGTERM, then SIGKILL after the grace period. npx
 * starts eas as a grandchild, which a signal to the child alone would leave running.
 */
function armTimeout(child, { timeoutMs, graceMs, kill, onTimeout }) {
  const timers = [];
  timers.push(
    setTimeout(() => {
      onTimeout();
      signalGroup(kill, child.pid, 'SIGTERM');
      timers.push(setTimeout(() => signalGroup(kill, child.pid, 'SIGKILL'), graceMs));
    }, timeoutMs),
  );
  return () => timers.forEach(clearTimeout);
}

/**
 * Runs a command in its own process group with stdin closed, its output kept in memory (capped),
 * never inherited. It settles when the child exits, after its output has drained or DRAIN_MS has
 * passed, so a grandchild that keeps a pipe open cannot hold it. On timeout it rejects with
 * EasTimeout. `spawnFn`, `kill` and the times are for tests.
 */
export function spawnExec(command, args, options) {
  const { cwd, env, timeoutMs } = options;
  const { graceMs = KILL_GRACE_MS, drainMs = DRAIN_MS } = options;
  const { spawnFn = spawn, kill = process.kill } = options;
  return new Promise((resolve, reject) => {
    const child = spawnFn(command, args, {
      cwd,
      env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const out = { stdout: '', stderr: '' };
    const keep = (stream) => (chunk) => {
      if (out[stream].length < MAX_OUTPUT_CHARS) out[stream] += chunk.toString('utf8');
    };
    child.stdout.on('data', keep('stdout'));
    child.stderr.on('data', keep('stderr'));
    let timedOut = false;
    const disarm = armTimeout(child, {
      timeoutMs,
      graceMs,
      kill,
      onTimeout: () => (timedOut = true),
    });
    child.on('error', (error) => {
      disarm();
      reject(error);
    });
    child.on('exit', (code) => {
      disarm();
      if (timedOut) {
        reject(new EasTimeout(`${args[2] ?? command} took over ${timeoutMs / 1000} s`));
        return;
      }
      const settle = () => resolve({ code: code ?? 1, ...out });
      const drain = setTimeout(settle, drainMs);
      child.on('close', () => {
        clearTimeout(drain);
        settle();
      });
    });
  });
}

/** A folder holding only the EAS link: eas can find the project there without the app's plugins. */
export function makeLinkedFolder(project, { tmp = os.tmpdir() } = {}) {
  const dir = mkdtempSync(path.join(tmp, 'release-state-'));
  const expo = {
    name: project.name ?? project.slug,
    slug: project.slug,
    owner: project.owner,
    extra: { eas: { projectId: project.projectId } },
  };
  writeFileSync(path.join(dir, 'app.json'), `${JSON.stringify({ expo }, null, 2)}\n`);
  const pkg = { name: `${project.slug}-release-state`, version: '0.0.0', private: true };
  writeFileSync(path.join(dir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
  return { dir, remove: () => rmSync(dir, { recursive: true, force: true }) };
}

/** The variables eas may see, by name: what npx, node and eas need to run and sign in, no more. */
const PASSED_NAMES = new Set([
  'PATH',
  'HOME',
  'TMPDIR',
  'TMP',
  'TEMP',
  'USER',
  'LOGNAME',
  'SHELL',
  'LANG',
  'EXPO_TOKEN',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'http_proxy',
  'https_proxy',
  'no_proxy',
  'NODE_EXTRA_CA_CERTS',
  'SSL_CERT_FILE',
  'CI',
]);
const PASSED_PREFIXES = [/^LC_/, /^EAS_/, /^EXPO_/, /^npm_config_/i];
/** Apple's keys and passwords: the read-only commands need none, so eas never sees them. */
const WITHHELD_PREFIXES = [/^EXPO_ASC_/, /^EXPO_APPLE_/];

/** The environment eas runs with: the allowed names only, colour and telemetry off. */
export function easEnv(env) {
  const passed = Object.entries(env).filter(
    ([name, value]) =>
      value !== undefined &&
      (PASSED_NAMES.has(name) || PASSED_PREFIXES.some((prefix) => prefix.test(name))) &&
      !WITHHELD_PREFIXES.some((prefix) => prefix.test(name)),
  );
  return { ...Object.fromEntries(passed), FORCE_COLOR: '0', NO_COLOR: '1', EXPO_NO_TELEMETRY: '1' };
}

/**
 * An eas runner in that folder. Colour is off, stdin is closed, and nothing it prints is passed on.
 * @param {{ dir: string, exec?: Exec, env?: Record<string, string | undefined> }} options
 */
export function easRunner({ dir, exec = spawnExec, env = process.env }) {
  const runEnv = easEnv(env);
  return (args) =>
    exec('npx', ['--yes', EAS_CLI, ...args], { cwd: dir, env: runEnv, timeoutMs: EAS_TIMEOUT_MS });
}

const plain = (text) => String(text ?? '').replace(ANSI, '');

/** The variable names `eas env:list --format short` printed; every value is dropped here. */
export function namesFromEnvList(stdout) {
  return Object.freeze(
    plain(stdout)
      .split('\n')
      .map((line) => NAME_LINE.exec(line.trim())?.[1])
      .filter((name) => name !== undefined),
  );
}

/** JSON from an eas --json answer, or undefined. */
export function parseJsonOutput(stdout) {
  try {
    return JSON.parse(plain(stdout).trim());
  } catch {
    return undefined;
  }
}

/** The first line of eas's own error output, cut short, for a command whose output holds no value. */
export function firstErrorLine(result) {
  const line = plain(result.stderr)
    .split('\n')
    .map((each) => each.trim())
    .find((each) => each !== '');
  return line ? line.slice(0, 160) : `exit ${result.code}`;
}
