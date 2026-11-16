// The state check's EAS lines (docs/release/README.md, "State check"): the environment names, the
// latest delivery run, the build quota and the CI/CD minutes. Each is one line, `<check>: ok: …`,
// `<check>: FAIL: …` or `<check>: not checked: <why>`. No line ever holds a variable's value.

import {
  EasTimeout,
  easRunner,
  firstErrorLine,
  makeLinkedFolder,
  namesFromEnvList,
  parseJsonOutput,
} from './eas.mjs';

const RUNNING = new Set(['NEW', 'IN_PROGRESS']);
const RAN = new Set(['SUCCESS', 'FAILURE', 'IN_PROGRESS']);
/** How many runs are read, so a cancelled latest run can be judged by the one before it. */
const RUNS_READ = 10;
const CANCELLED = 'cancelled (by a newer run or by hand)';
/** Expo's words when the plan's CI/CD minutes are spent ("… 60 minute limit reached …"). */
const MINUTES_SPENT = /minute limit|limit reached|minutes reset/i;
const MAX_REASON = 160;

export const line = (check, status, detail) => `${check}: ${status}: ${detail}`;
const plainText = (value) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_REASON);
const isCount = (value) => typeof value === 'number' && Number.isFinite(value);
const day = (value) => (typeof value === 'string' ? value.slice(0, 10) : 'the end of the cycle');

/** Every EAS check named, each with the same reason: eas could not be asked at all. */
export function easCheckNames(envList) {
  return [
    ...Object.keys(envList).map((env) => `eas-env:${env}`),
    'workflow-run',
    'build-quota',
    'cicd-minutes',
  ];
}

const allNotChecked = (envList, why) =>
  easCheckNames(envList).map((check) => line(check, 'not checked', why));

/** One environment's line: the names it lacks, read from both scopes a build reads. */
async function envLine(eas, environment, required) {
  const check = `eas-env:${environment}`;
  const scopes = ['project', 'account'];
  const results = await Promise.all(
    scopes.map((scope) =>
      eas(['env:list', '--environment', environment, '--format', 'short', '--scope', scope]),
    ),
  );
  const failed = results.find((result) => result.code !== 0);
  // eas's output here can hold values: only the exit code is said
  if (failed) return line(check, 'not checked', `eas env:list exited ${failed.code}`);
  const present = new Set(results.flatMap((result) => namesFromEnvList(result.stdout)));
  const missing = required.filter((name) => !present.has(name));
  if (missing.length > 0)
    return line(check, 'FAIL', `EAS environment ${environment} lacks ${missing.join(', ')}`);
  return line(
    check,
    'ok',
    `EAS environment ${environment} holds the ${required.length} names docs/release/eas-env.json lists`,
  );
}

const errorText = (error) => plainText(`${error?.title ?? ''} ${error?.message ?? ''}`);
const errorsOf = (holder) => (Array.isArray(holder?.errors) ? holder.errors : []).map(errorText);

/**
 * The errors Expo's minutes words are looked for in: the run's own, and those of jobs that never
 * left NEW. A job that ran and failed for a reason of its own (a rate limit, say) is not a run that
 * failed to start.
 */
const startErrors = (view, jobs) => [
  ...errorsOf(view),
  ...jobs.filter((job) => job?.status === 'NEW').flatMap(errorsOf),
];

/** The first job that failed, named, with its first error. */
function failedJob(jobs) {
  const job = jobs.find((each) => each?.status === 'FAILURE') ?? {};
  const [first] = errorsOf(job);
  return `${plainText(job.name ?? 'a job')} failed${first ? ` (${first})` : ''}`;
}

/**
 * Why a failed run failed: `started` is false for Expo's minutes words or no job that ran, true
 * for a job that ran and failed, and undefined when the view lists no jobs to tell by.
 */
export function whyRunFailed(view) {
  if (!Array.isArray(view?.jobs))
    return { started: undefined, reason: 'eas workflow:view gave no jobs' };
  const { jobs } = view;
  const spent = startErrors(view, jobs).find((text) => MINUTES_SPENT.test(text));
  if (spent) return { started: false, reason: spent };
  if (!jobs.some((job) => RAN.has(job?.status))) {
    const all = [...errorsOf(view), ...jobs.flatMap(errorsOf)];
    return { started: false, reason: all.find((text) => text !== '') ?? 'no job started' };
  }
  return { started: true, reason: failedJob(jobs) };
}

/** A failed run, told apart: it failed to start, a job failed, or it is not known which. */
async function failedRun(eas, run) {
  const viewed = await eas(['workflow:view', run.id, '--json', '--non-interactive']);
  const view = viewed.code === 0 ? parseJsonOutput(viewed.stdout) : undefined;
  const { started, reason } =
    view === undefined
      ? { started: undefined, reason: `eas workflow:view: ${firstErrorLine(viewed)}` }
      : whyRunFailed(view);
  if (started === undefined)
    return ['FAIL', `run ${run.id} failed; whether it started is not known (${reason})`];
  if (!started)
    return ['FAIL', `run ${run.id} failed to start (${reason}): that merge shipped nothing`];
  return ['FAIL', `run ${run.id} failed: ${reason}`];
}

/** One run that was not cancelled, judged: [verdict, words]. */
async function judgeRun(eas, run) {
  if (run.status === 'SUCCESS') return ['ok', `run ${run.id} succeeded (${day(run.startedAt)})`];
  if (RUNNING.has(run.status)) return ['ok', `run ${run.id} is running`];
  if (run.status === 'FAILURE') return failedRun(eas, run);
  if (run.status === 'ACTION_REQUIRED') return ['FAIL', `run ${run.id} waits for an approval`];
  return ['FAIL', `run ${run.id} is ${plainText(run.status)}`];
}

/**
 * The latest run of the delivery workflow: running or green is ok; anything else fails. A
 * cancelled run is said as such, never as a merge that shipped nothing: the run before it that
 * was not cancelled gives the verdict.
 */
async function workflowLine(eas, workflowFile) {
  const args = [
    'workflow:runs',
    '--workflow',
    workflowFile,
    '--limit',
    String(RUNS_READ),
    '--json',
  ];
  const listed = await eas(args);
  if (listed.code !== 0) {
    return line('workflow-run', 'not checked', `eas workflow:runs: ${firstErrorLine(listed)}`);
  }
  const runs = parseJsonOutput(listed.stdout);
  if (!Array.isArray(runs)) {
    return line('workflow-run', 'not checked', 'eas workflow:runs gave no JSON list');
  }
  if (runs.length === 0) {
    return line('workflow-run', 'FAIL', `no run of ${workflowFile} yet: no merge has shipped`);
  }
  const [latest] = runs;
  const judged = runs.find((run) => run?.status !== 'CANCELED');
  if (judged === undefined) {
    const why = `latest run ${latest.id} was ${CANCELLED}, as were the ${runs.length - 1} before it`;
    return line('workflow-run', 'FAIL', why);
  }
  const [verdict, words] = await judgeRun(eas, judged);
  if (judged === latest) return line('workflow-run', verdict, `latest ${words}`);
  return line(
    'workflow-run',
    verdict,
    `latest run ${latest.id} was ${CANCELLED}; before it, ${words}`,
  );
}

/** A plan's use, when its used and limit are counts and the limit is above zero. */
function planOf(plan) {
  if (!plan || !isCount(plan.used) || !isCount(plan.limit) || plan.limit <= 0) return undefined;
  return { used: plan.used, limit: plan.limit };
}

const cycleEnd = (usage) => day(usage?.account?.billingPeriod?.end);

function quotaLine(usage) {
  const builds = usage?.builds ?? {};
  const plan = planOf(builds.ios?.plan ?? builds.plan);
  if (!plan) return line('build-quota', 'not checked', 'eas account:usage gave no iOS build quota');
  const left = plan.limit - plan.used;
  const detail = `iOS builds ${plan.used} of ${plan.limit} used this cycle`;
  if (left <= 0) {
    const why = `${detail}, none left until ${cycleEnd(usage)}: a native merge cannot build`;
    return line('build-quota', 'FAIL', why);
  }
  return line('build-quota', 'ok', `${detail}, ${left} left (the cycle ends ${cycleEnd(usage)})`);
}

const NO_MINUTES =
  'eas account:usage gives no CI/CD minutes for this account: a run that failed to start (workflow-run) is the only sign';

/** The CI/CD minutes, which eas-cli reports in its simulator block when the account has one. */
function minutesLine(usage) {
  const simulator = usage?.simulator ?? {};
  const minutes = planOf(simulator.minutes?.plan);
  if (!minutes) return line('cicd-minutes', 'not checked', NO_MINUTES);
  const workflows = simulator.byJobType?.workflows;
  const share = isCount(workflows) ? ` (workflows ${Math.round(workflows)})` : '';
  const detail = `CI/CD minutes ${Math.round(minutes.used)} of ${minutes.limit} used${share}`;
  if (minutes.used >= minutes.limit) {
    const why = `${detail}: workflow jobs cannot start until ${cycleEnd(usage)}, so a merge ships nothing`;
    return line('cicd-minutes', 'FAIL', why);
  }
  return line('cicd-minutes', 'ok', `${detail} (the cycle ends ${cycleEnd(usage)})`);
}

async function usageLines(eas, owner) {
  const result = await eas(['account:usage', owner, '--json', '--non-interactive']);
  const usage = result.code === 0 ? parseJsonOutput(result.stdout) : undefined;
  if (usage === undefined) {
    const why = `eas account:usage: ${firstErrorLine(result)}`;
    return [line('build-quota', 'not checked', why), line('cicd-minutes', 'not checked', why)];
  }
  return [quotaLine(usage), minutesLine(usage)];
}

async function signedIn(eas) {
  try {
    return (await eas(['whoami'])).code === 0
      ? undefined
      : 'not signed in to Expo (eas whoami failed): npx eas-cli login, or set EXPO_TOKEN';
  } catch (error) {
    if (error instanceof EasTimeout) throw error;
    return 'eas-cli did not start (npx --yes eas-cli)';
  }
}

const whyNot = (error) =>
  error instanceof EasTimeout
    ? `eas timed out (${plainText(error.message)})`
    : `eas could not be run: ${plainText(error instanceof Error ? error.message : error)}`;

/**
 * The EAS lines. `exec` runs a command (a test passes a fake); `tmp` is where the linked folder goes.
 * @param {{ project: ReturnType<typeof import('./project.mjs').readProject>, envList: Readonly<Record<string, readonly string[]>>, workflowFile: string, exec?: import('./eas.mjs').Exec, env?: Record<string, string | undefined>, tmp?: string }} options
 */
export async function easLines({ project, envList, workflowFile, exec, env, tmp }) {
  if (!project.owner || !project.slug || !project.projectId) {
    return allNotChecked(envList, 'app.json has no EAS link (owner, slug, extra.eas.projectId)');
  }
  const folder = makeLinkedFolder(project, { tmp });
  try {
    const eas = easRunner({ dir: folder.dir, exec, env });
    const why = await signedIn(eas);
    if (why) return allNotChecked(envList, why);
    const envChecks = [];
    for (const [environment, required] of Object.entries(envList)) {
      envChecks.push(await envLine(eas, environment, required));
    }
    return [
      ...envChecks,
      await workflowLine(eas, workflowFile),
      ...(await usageLines(eas, project.owner)),
    ];
  } catch (error) {
    return allNotChecked(envList, whyNot(error));
  } finally {
    folder.remove();
  }
}
