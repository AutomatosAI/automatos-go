// "What Auto depends on" as drawn (PRD-268 §6.12.3 'Readiness list', US-G07): the server's items
// then this phone's rows, each id once, the phone's in place of an id it answers for; a server fix
// followed only to a screen the phone has; VoiceOver's 'Calendar: needs setup. Connect calendar.';
// the marks (✓ Ready · ○ Not checked · ◆ Needs setup) in HUD's glyph roles and the state colour
// roles elsewhere; the count; and the line (checking, the server's rate-limit words, a failed read).

import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/errors';
import { API_ERROR_COPY } from '../../api/strings';
import { routes } from '../../navigation/routes';
import { GLYPHS } from '../../styles/dress/status-glyphs';
import { clientRows, type RowInput } from '../client-rows';
import { ReadinessSchema, READINESS_STATES, type ReadinessItem } from '../schema';
import { CLIENT_ROW_COPY, READINESS_COPY, READINESS_WORDS } from '../strings';
import {
  appFixOf,
  mergeRows,
  readinessMark,
  readinessView,
  refusalLine,
  rowLabel,
} from '../view-model';
import { ALL_READY, CHECKED_AT, READINESS_BODY, SEARCH_ITEM } from './fixtures';

vi.mock('expo-secure-store', () => ({ AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7 }));

const ITEMS = ReadinessSchema.parse(READINESS_BODY).items;
const PHONE = clientRows(ALL_READY, { source: 'hosted', serverName: 'Automatos' });

function items(list: readonly unknown[]): readonly ReadinessItem[] {
  return ReadinessSchema.parse({ v: 1, checked_at: CHECKED_AT, items: list }).items;
}

const CALENDAR = {
  id: 'calendar',
  label: 'Calendar',
  detail: "Calendar isn't connected.",
  state: 'needs_setup',
  fix: { label: 'Connect calendar', href: '/command-center?tab=calendar' },
  needed_by: ['brief'],
};

describe('mergeRows', () => {
  it("the server's items in its order, then this phone's; the phone's push in the server's place", () => {
    const rows = mergeRows(ITEMS, PHONE);
    expect(rows.map((row) => row.id)).toEqual([
      'core',
      'model_route',
      'web_search',
      'push',
      'microphone',
      'speech',
      'server_voice',
    ]);
    const push = rows.find((row) => row.id === 'push');
    expect(push?.label).toBe(CLIENT_ROW_COPY.pushLabel);
    expect(Object.isFrozen(rows)).toBe(true);
  });

  it('a repeated server id shows once, the first', () => {
    const rows = mergeRows(items([SEARCH_ITEM, { ...SEARCH_ITEM, detail: 'Second.' }]), []);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.detail).toBe(SEARCH_ITEM.detail);
  });

  it("before the server answers, this phone's rows alone", () => {
    expect(mergeRows(null, PHONE).map((row) => row.id)).toEqual([
      'push',
      'microphone',
      'speech',
      'server_voice',
    ]);
  });

  it('each row carries its word', () => {
    const rows = mergeRows(ITEMS, []);
    expect(rows.map((row) => row.word)).toEqual([
      READINESS_WORDS.ready,
      READINESS_WORDS.needs_setup,
      READINESS_WORDS.not_checked,
      READINESS_WORDS.ready,
    ]);
  });
});

describe('appFixOf: in-app paths only', () => {
  it("a path to a screen the phone has opens that screen, with the server's label", () => {
    expect(appFixOf({ label: 'Connect calendar', href: '/command-center?tab=calendar' })).toEqual({
      label: 'Connect calendar',
      route: routes.cc.calendar,
    });
  });

  it("a Studio-only page (core's settings tabs) shows no fix: never the browser", () => {
    expect(
      appFixOf({ label: "Choose Auto's model", href: '/settings?tab=orchestrator' }),
    ).toBeNull();
    expect(appFixOf({ label: 'Add a key', href: '/settings?tab=api-keys' })).toBeNull();
  });

  it('no fix is none', () => {
    expect(appFixOf(null)).toBeNull();
    expect(appFixOf(undefined)).toBeNull();
  });
});

describe('rowLabel (VoiceOver)', () => {
  it("'Calendar: needs setup. Connect calendar.' for a row with a fix", () => {
    const [row] = mergeRows(items([CALENDAR]), []);
    expect(row?.accessibilityLabel).toBe('Calendar: needs setup. Connect calendar.');
  });

  it('the label, the word and the detail for a row without one', () => {
    const [row] = mergeRows(ITEMS, []);
    expect(row?.accessibilityLabel).toBe(
      'Automatos server: ready. The server and its database answer.',
    );
  });

  it('a row with no detail says its label and word', () => {
    const bare: RowInput = { id: 'x', label: 'Thing', detail: '', state: 'not_checked', fix: null };
    expect(rowLabel(bare)).toBe('Thing: not checked.');
  });
});

describe('readinessMark', () => {
  it('✓ Ready · ○ Not checked · ◆ Needs setup, the same word in every layout', () => {
    for (const glyphs of [true, false]) {
      expect(readinessMark('ready', glyphs, 'light')).toMatchObject({
        glyph: GLYPHS.done,
        word: 'Ready',
      });
      expect(readinessMark('not_checked', glyphs, 'dark')).toMatchObject({
        glyph: GLYPHS.waiting,
        word: 'Not checked',
      });
      expect(readinessMark('needs_setup', glyphs, 'dark')).toMatchObject({
        glyph: GLYPHS.attention,
        word: 'Needs setup',
      });
    }
  });

  it('HUD paints the glyph in its role: ready and needs setup in the accent, not checked in text2', () => {
    expect(readinessMark('ready', true, 'dark').glyphToken).toBe('primary');
    expect(readinessMark('needs_setup', true, 'dark').glyphToken).toBe('primary');
    expect(readinessMark('not_checked', true, 'dark').glyphToken).toBe('mutedForeground');
  });

  it('Studio, a theme and Play paint by the colour role (§6.12.2), the word muted', () => {
    expect(readinessMark('ready', false, 'light')).toMatchObject({
      glyphToken: 'success',
      wordToken: 'mutedForeground',
    });
    expect(readinessMark('needs_setup', false, 'dark').glyphToken).toBe('info');
    expect(readinessMark('not_checked', false, 'light').glyphToken).toBe('mutedForeground');
  });

  it('has a mark for every state', () => {
    for (const state of READINESS_STATES) {
      expect(readinessMark(state, false, 'light').word).toBe(READINESS_WORDS[state]);
    }
  });
});

describe('refusalLine', () => {
  it("a 429 shows the server's words, in the person's language", () => {
    const error = new ApiError('server', {
      status: 429,
      code: 'checked_recently',
      serverMessage: 'Verificado há pouco. Tente de novo em um minuto.',
    });
    expect(refusalLine(error)).toBe('Verificado há pouco. Tente de novo em um minuto.');
  });

  it('a 429 with no words says checked a moment ago', () => {
    expect(refusalLine(new ApiError('server', { status: 429 }))).toBe(
      READINESS_COPY.checkedRecently,
    );
  });

  it("any other failure is the client's message for its kind", () => {
    expect(refusalLine(new ApiError('network'))).toBe(API_ERROR_COPY.network);
  });
});

describe('readinessView', () => {
  const base = { items: ITEMS, client: PHONE, checking: false, readError: null, refusal: null };

  it('counts the ready rows over every row', () => {
    const view = readinessView(base);
    // core, the phone's push, microphone, speech and server voice; not the model or web search
    expect(view.count).toBe(READINESS_COPY.readyCount(5, 7));
    expect(view.line).toBeNull();
  });

  it('says Checking… while a read is out, before a refusal or a failure', () => {
    const view = readinessView({ ...base, checking: true, refusal: 'Checked a moment ago.' });
    expect(view.line).toBe(READINESS_COPY.checking);
    expect(view.checking).toBe(true);
  });

  it("shows a refused Check again's line", () => {
    expect(readinessView({ ...base, refusal: 'Checked a moment ago.' }).line).toBe(
      'Checked a moment ago.',
    );
  });

  it('a failed read says why and still draws the phone’s rows', () => {
    const view = readinessView({ ...base, items: null, readError: new ApiError('network') });
    expect(view.line).toBe(API_ERROR_COPY.network);
    expect(view.rows).toHaveLength(4);
  });
});
