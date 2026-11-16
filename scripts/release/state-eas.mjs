// The state check's EAS lines (docs/release/README.md, "State check"): the environment names, the
// latest delivery run, the build quota and the CI/CD minutes. Each is one line, `<check>: ok: …`,
// `<check>: FAIL: …` or `<check>: not checked: <why>`. No line ever holds a variable's value.

import {
  easRunner,
  firstErrorLine,
  makeLinkedFolder,
  namesFromEnvList,
  parseJsonOutput,
} from './eas.mjs';

const RUNNING = new Set(['NEW', 'IN_PROGRESS']);
const RAN = new Set(['SUCCESS', 'FAILURE', 'IN_PROGRESS']);
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

/** Every error the run and its jobs carry, as one line each. */
function errorTexts(view, jobs) {
  const runErrors = Array.isArray(view?.errors) ? view.errors : [];
  return [...runErrors, ...jobs.flatMap((job) => job?.errors ?? [])].map(errorText);
}

/** The first job that failed, named, with its first error. */
function failedJob(jobs) {
  const job = jobs.find((each) => each?.status === 'FAILURE') ?? {};
  const [first] = (job.errors ?? []).map(errorText);
  return `${plainText(job.name ?? 'a job')} failed${first ? ` (${first})` : ''}`;
}

/** Why a failed run failed: Expo's minutes words, no job that ran, or the first job that failed. */
export function whyRunFailed(view) {
  const jobs = Array.isArray(view?.jobs) ? view.jobs : [];
  const texts = errorTexts(view, jobs);
  const spent = texts.find((text) => MINUTES_SPENT.test(text));
  if (spent) return { started: false, reason: spent };
  if (!jobs.some((job) => RAN.has(job?.status))) {
    return { started: false, reason: texts.find((text) => text !== '') ?? 'no job started' };
  }
  return { started: true, reason: failedJob(jobs) };
}

async function failedRunLine(eas, run) {
  const viewed = await eas(['workflow:view', run.id, '--json', '--non-interactive']);
  const view = viewed.code === 0 ? parseJsonOutput(viewed.stdout) : undefined;
  if (view === undefined) {
    return line(
      'workflow-run',
      'FAIL',
      `latest run ${run.id} is ${run.status}; whether it started is not known (eas workflow:view: ${firstErrorLine(viewed)})`,
    );
  }
  const { started, reason } = whyRunFailed(view);
  if (!started)
    return line(
      'workflow-run',
      'FAIL',
      `latest run ${run.id} failed to start (${reason}): that merge shipped nothing`,
    );
  return line('workflow-run', 'FAIL', `latest run ${run.id} failed: ${reason}`);
}

/** The latest run of the delivery workflow: running or green is ok; anything else fails. */
async function workflowLine(eas, workflowFile) {
  const listed = await eas(['workflow:runs', '--workflow', workflowFile, '--limit', '1', '--json']);
  if (listed.code !== 0)
    return line('workflow-run', 'not checked', `eas workflow:runs: ${firstErrorLine(listed)}`);
  const runs = parseJsonOutput(listed.stdout);
  if (!Array.isArray(runs))
    return line('workflow-run', 'not checked', 'eas workflow:runs gave no JSON list');
  const [run] = runs;
  if (run === undefined)
    return line('workflow-run', 'FAIL', `no run of ${workflowFile} yet: no merge has shipped`);
  if (run.status === 'SUCCESS')
    return line('workflow-run', 'ok', `latest run ${run.id} succeeded (${day(run.startedAt)})`);
  if (RUNNING.has(run.status)) return line('workflow-run', 'ok', `latest run ${run.id} is running`);
  if (run.status === 'FAILURE') return failedRunLine(eas, run);
  if (run.status === 'ACTION_REQUIRED')
    return line('workflow-run', 'FAIL', `latest run ${run.id} waits for an approval`);
  return line(
    'workflow-run',
    'FAIL',
    `latest run ${run.id} is ${plainText(run.status)}: that merge shipped nothing`,
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
  } catch {
    return 'eas-cli did not start (npx --yes eas-cli)';
  }
}

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
    return allNotChecked(
      envList,
      `eas could not be run: ${plainText(error instanceof Error ? error.message : error)}`,
    );
  } finally {
    folder.remove();
  }
}
