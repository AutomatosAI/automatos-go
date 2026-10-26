// R15 as a test that keeps running in CI. (a) Every way to talk to Auto — the thread in Studio,
// Play and HUD, the voice screen, and whatever a later change adds — carries the AI label, the one
// muted caption (D73): the whole product tree, comments removed, is scanned for code that sends a
// person's text or speech to Auto; each file found is in support/surfaces.ts's list with exactly
// its markers, and its render reaches the foundation's AiLabel file by file, or it is used only
// inside a surface that does. Nothing here asks for a label beside a composer or a composer lock.
// (b) Report this: the files that mount the foundation's ReportSheet, what each reports, what Auto's
// messages offer on each surface, and the one call that posts a report. (c) The consent sheet's
// view-model names every provider the server lists, Retell AI included (D70).

import { describe, expect, it } from 'vitest';

import { WorkspaceSchema } from '../../api/workspace';
import { providersFrom } from '../../consent/providers';
import { consentSheetView } from '../../consent/sheet';
import { CONSENT_SHEET_COPY } from '../../consent/strings';
import { codeOf } from './support/code';
import { definingFile, importersOf, rendersFirst, rendersFrom } from './support/jsx';
import {
  AI_LABEL_FILE,
  AUTO_MESSAGES,
  CHAT_SCREEN,
  FIRST_OPEN_THREAD,
  PLAY_HOME,
  REPORT_MOUNTS,
  SEND_HINT,
  SEND_MARKERS,
  SEND_SURFACES,
  sendMarkersIn,
  type LabelPath,
} from './support/surfaces';
import { productFiles, readRepoFile } from './support/tree';

const products = productFiles();
const found = products
  .filter((file) => SEND_HINT.test(readRepoFile(file)))
  .map((file) => ({ file, markers: sendMarkersIn(codeOf(file)) }))
  .filter((hit) => hit.markers.length > 0);
const listed = new Map(SEND_SURFACES.map((entry) => [entry.file, entry.sends]));
const screens = SEND_SURFACES.filter((entry) => entry.labels !== undefined);
const hooks = SEND_SURFACES.filter((entry) => entry.inside !== undefined);

/** The steps of a label path that do not hold: each file renders the next, the last AiLabel. */
function brokenSteps(surface: string, path: LabelPath): string[] {
  const files = [surface, ...path];
  const links = files
    .slice(1)
    .map((next, index) =>
      rendersFrom(files[index], next) ? null : `${files[index]} renders nothing from ${next}`,
    );
  const last = files[files.length - 1];
  const label = rendersFrom(last, AI_LABEL_FILE) ? null : `${last} renders no AiLabel`;
  return [...links, label].filter((step): step is string => step !== null);
}

// ── (a) the AI label ─────────────────────────────────────────────────────────────────────────

describe('(a) every way to talk to Auto is in the explicit list', () => {
  it('scans the whole product tree', () => {
    expect(products.length).toBeGreaterThan(300);
    expect(found.map((hit) => hit.file)).toContain(CHAT_SCREEN);
  });

  it('finds no product file the list does not name, or with a marker it is not given', () => {
    const unlisted = found
      .filter(({ file, markers }) => listed.get(file)?.join() !== markers.join())
      .map(
        ({ file, markers }) =>
          `${file}: ${markers.join(', ')} (listed: ${listed.get(file)?.join(', ') ?? 'no'})`,
      );
    expect(unlisted).toEqual([]);
  });

  it('lists no file that is gone or no longer shows its markers (no stale entry)', () => {
    const shown = new Map(found.map((hit) => [hit.file, hit.markers.join()]));
    const stale = SEND_SURFACES.filter((entry) => shown.get(entry.file) !== entry.sends.join());
    expect(stale.map((entry) => entry.file)).toEqual([]);
  });

  it('gives each entry a reason and only known markers, in marker order', () => {
    const ids = SEND_MARKERS.map((marker) => marker.id);
    SEND_SURFACES.forEach((entry) => {
      expect(entry.reason.length, entry.file).toBeGreaterThan(30);
      expect(entry.sends, entry.file).toEqual(ids.filter((id) => entry.sends.includes(id)));
    });
  });
});

describe('the send markers', () => {
  it.each([
    ['composer', '<Composer role={role} onSend={onSend} />'],
    ['play-composer', '<PlayComposer value={text} onSend={send} />'],
    ['hud-core', '<HudCore turn={turn} onType={type} />'],
    ['speech', "const quick = useQuickAsk(thread, 'focused');"],
  ])('%s matches `%s`', (id, sample) => {
    expect(sendMarkersIn(sample)).toContain(id);
    expect(SEND_HINT.test(sample)).toBe(true);
  });

  it('skips the quick-ask hook’s own declaration and a component merely named alike', () => {
    expect(sendMarkersIn('export function useQuickAsk(thread) {}')).toEqual([]);
    expect(sendMarkersIn('<ComposerHint text={hint} />')).toEqual([]);
  });
});

describe('(a) every surface reaches the AI label', () => {
  it.each(screens.map((entry) => [entry.file, entry.labels ?? []] as const))(
    '%s renders it on every path that can send',
    (file, paths) => {
      expect(paths.length).toBeGreaterThan(0);
      paths.forEach((path) => expect(brokenSteps(file, path), path.join(' → ')).toEqual([]));
    },
  );

  it('opens its row wherever it is drawn: the caption is its container’s first child', () => {
    const drawers = [
      ...new Set(screens.flatMap((entry) => (entry.labels ?? []).map((p) => p.at(-1)))),
    ];
    expect(drawers.length).toBeGreaterThanOrEqual(3);
    drawers.forEach((file) => expect(rendersFirst(file ?? '', 'AiLabel'), file).toBe(true));
  });

  it("is the first row of Studio's and Play's thread lists", () => {
    expect(codeOf('src/chat/components/MessageList.tsx')).toContain(
      'ListHeaderComponent={ThreadCaption}',
    );
    expect(codeOf('src/styles/homes/PlayThread.tsx')).toContain(
      'ListHeaderComponent={PlayThreadCaption}',
    );
  });

  it("opens Studio's First open, which takes the thread's place on home", () => {
    const home = codeOf('src/styles/homes/StyleHome.tsx');
    expect(home).toMatch(/<HomeScreen firstOpen=\{<FirstOpenThread\b/);
    expect(rendersFrom('src/styles/homes/StyleHome.tsx', FIRST_OPEN_THREAD)).toBe(true);
    expect(codeOf('src/chat/screens/HomeScreen.tsx')).toContain('empty={firstOpen}');
    expect(codeOf(CHAT_SCREEN)).toMatch(
      /if \(empty && isBlankDraft\(state\)\)\s*return <>\{empty\}<\/>/,
    );
    expect(brokenSteps(FIRST_OPEN_THREAD, ['src/styles/play/companion/Messages.tsx'])).toEqual([]);
  });

  it.each(hooks.map((entry) => [entry.file, entry.inside ?? []] as const))(
    '%s is used only inside a surface that carries it',
    (file, inside) => {
      const users = importersOf(file, products);
      expect(users.length).toBeGreaterThan(0);
      expect(users.filter((user) => !inside.includes(user))).toEqual([]);
      inside.forEach((parent) => expect(screens.map((entry) => entry.file)).toContain(parent));
    },
  );

  it('keeps every composer free of the label: nothing waits for it (D73)', () => {
    const composers = products.filter(
      (file) =>
        file.startsWith('src/chat/composer/') ||
        file === 'src/styles/play/companion/PlayComposer.tsx',
    );
    expect(composers).toContain('src/chat/composer/Composer.tsx');
    composers.forEach((file) => expect(codeOf(file), file).not.toMatch(/ai-label/));
  });
});

// ── (b) Report this ──────────────────────────────────────────────────────────────────────────

const REPORT_SHEET = 'src/ui/ReportSheet.tsx';
const mountedFiles = REPORT_MOUNTS.map((mount) => mount.file);

describe('(b) Report this', () => {
  it("is mounted exactly where the list says: the foundation's one ReportSheet", () => {
    const mounts = products.filter(
      (file) =>
        file.endsWith('.tsx') &&
        readRepoFile(file).includes('ReportSheet') &&
        rendersFrom(file, REPORT_SHEET),
    );
    expect(mounts).toEqual([...mountedFiles].sort());
  });

  it.each(REPORT_MOUNTS.map((mount) => [mount.file, mount] as const))(
    '%s opens it through its target’s hook',
    (file, mount) => {
      expect(definingFile(file, mount.opener.name)).toBe(mount.opener.file);
      expect(codeOf(file)).toContain(`${mount.opener.name}(`);
      expect(mount.reason.length).toBeGreaterThan(30);
    },
  );

  it("is offered on Auto's messages in each thread that mounts it for a message", () => {
    REPORT_MOUNTS.filter((mount) => mount.target === 'message').forEach((mount) => {
      expect(codeOf(mount.file), mount.file).toContain('report={report}');
    });
    ['src/chat/components/MessageList.tsx', 'src/styles/homes/PlayThread.tsx'].forEach((file) =>
      expect(definingFile(file, 'reportTarget'), file).toBe('src/chat/report/report.ts'),
    );
    const rows = codeOf('src/chat/report/report.ts');
    expect(rows).toContain("row.type !== 'auto'");
    expect(rows).toContain("target_type: 'message'");
  });

  it('is offered on a Deliverable, in every style', () => {
    const page = 'src/cc/deliverables/use-deliverable.ts';
    expect(definingFile(page, 'reportTarget')).toBe('src/cc/deliverables/detail.ts');
    expect(codeOf('src/cc/deliverables/detail.ts')).toContain("target_type: 'deliverable'");
    const route = 'app/(app)/cc/deliverables/[id].tsx';
    expect(rendersFrom(route, 'src/cc/deliverables/DeliverableDetail.tsx')).toBe(true);
    expect(rendersFrom(route, 'src/styles/homes/PlayDeliverable.tsx')).toBe(true);
  });

  it("says, for every surface that can show Auto's messages, what Report this is there", () => {
    expect(Object.keys(AUTO_MESSAGES).sort()).toEqual(screens.map((entry) => entry.file).sort());
    Object.entries(AUTO_MESSAGES).forEach(([file, messages]) => {
      const mounted = REPORT_MOUNTS.some(
        (mount) => mount.file === file && mount.target === 'message',
      );
      if (messages.kind === 'report') expect(mounted, file).toBe(true);
      else expect(mounted, `${file}: mounted now, so say so`).toBe(false);
      if (messages.kind === 'pending') expect(messages.story).toMatch(/^P001R-AF-\d+$/);
      if (messages.kind !== 'report') expect(messages.reason.length).toBeGreaterThan(30);
    });
    expect(AUTO_MESSAGES[PLAY_HOME]).toEqual({ kind: 'report' });
  });

  it('posts only through src/api/reports.ts', () => {
    const codeWith = (hint: string, pattern: RegExp) =>
      products.filter((file) => readRepoFile(file).includes(hint) && pattern.test(codeOf(file)));
    expect(codeWith('v1/reports', /\/api\/v1\/reports\b/)).toEqual(['src/api/routes.ts']);
    expect(codeOf('src/api/routes.ts')).toMatch(
      /reports: \{ method: 'POST', path: '\/api\/v1\/reports'/,
    );
    expect(codeWith('.reports', /\b\w*routes\.reports\b/i)).toEqual(['src/api/reports.ts']);
    expect(codeWith('reportContent', /(?<!function )\breportContent\(/)).toEqual([REPORT_SHEET]);
  });
});

// ── (c) the consent sheet's providers ────────────────────────────────────────────────────────

const ANTHROPIC = { id: 'anthropic', name: 'Anthropic' };
const DEEPSEEK = { id: 'deepseek', name: 'DeepSeek' };
const RETELL = { id: 'retell', name: 'Retell AI' };

/** GET /api/workspaces/current through the foundation's schema, with these providers. */
function providersOf(aiProviders: readonly object[]) {
  const workspace = WorkspaceSchema.parse({
    id: '7f1c2a54-0000-4000-8000-000000000021',
    name: 'Workspace',
    role: 'owner',
    ai_providers: aiProviders,
  });
  const providers = providersFrom(workspace);
  if (providers.kind === 'none') throw new Error('the fixture lists providers');
  return providers;
}

describe('(c) the consent sheet names every AI provider the server lists', () => {
  it.each([
    ['hosted', 'sign_out'],
    ['own', 'forget_server'],
  ] as const)(
    'on a %s server: Anthropic, DeepSeek and Retell AI, Retell included',
    (source, leave) => {
      [
        [ANTHROPIC, DEEPSEEK, RETELL],
        [RETELL, DEEPSEEK, ANTHROPIC],
      ].forEach((listedProviders) => {
        const view = consentSheetView({
          providers: providersOf(listedProviders),
          source,
          serverName: 'the VPS',
        });
        expect(view.providers).toEqual(['Anthropic', 'DeepSeek', 'Retell AI']);
        expect(view.body).toContain('Anthropic, DeepSeek and Retell AI');
        expect(view.note).toBeNull();
        expect(view.agree).toBe('Agree and continue');
        expect(view.leave.action).toBe(leave);
      });
    },
  );

  it('draws every name the view lists, opens with the AI label, and has no Not now', () => {
    const sheet = 'src/consent/ConsentSheet.tsx';
    const code = codeOf(sheet);
    expect(code).toContain('names={view.providers}');
    expect(code).toContain('names.map(');
    expect(rendersFrom(sheet, AI_LABEL_FILE)).toBe(true);
    expect(code).not.toMatch(/Not now|notNow/);
    expect(Object.keys(CONSENT_SHEET_COPY)).not.toContain('notNow');
  });

  it("is the signed-in gate's consent step, before every (app) screen", () => {
    const layout = 'app/(app)/_layout.tsx';
    expect(definingFile(layout, 'ConsentSheet')).toBe('src/consent/ConsentSheet.tsx');
    expect(codeOf(layout)).toContain('consent={<ConsentSheet />}');
  });
});
