// The composer's state (US-009a): the button sends, stops or waits; a blank message with nothing
// attached has nothing to send; Stop while a reply is in flight, the pill still open; a viewer reads
// only, with D17's words; a hidden AI label switches every control off with the vendored paused
// words, and before its first measurement holds them without a notice. The pill's metrics, and
// what the composer's source may hold: the label and its fence, Return as a newline, no chips,
// Plan toggle or voice button.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { WorkspaceRole } from '../../api/workspace';
import { ROLE_COPY } from '../../auth/strings';
import { AI_LABEL_PAUSED_TEXT } from '../../core/web/lib/ai-label/copy';
import {
  PILL_INPUT,
  composerButton,
  composerState,
  outgoingText,
  pillMetrics,
  type ComposerInput,
} from '../composer/composer-state';
import { COMPOSER_COPY } from '../strings';

const input = (over: Partial<ComposerInput> = {}): ComposerInput => ({
  text: '',
  streaming: false,
  role: 'editor',
  aiLabelVisible: true,
  uploading: false,
  ...over,
});

const open = { inputEditable: true, placeholder: COMPOSER_COPY.placeholder, notice: null };

describe('composerState — send', () => {
  it('has nothing to send while the message is blank and nothing is attached', () => {
    expect(composerState(input())).toEqual({ buttonMode: 'disabled', ...open });
    expect(composerState(input({ text: '  \n\t ' })).buttonMode).toBe('disabled');
    expect(composerState(input({ attachments: 0 })).buttonMode).toBe('disabled');
  });

  it('sends words, or files with no words', () => {
    expect(composerState(input({ text: 'Why is Ledger blocked?' }))).toEqual({
      buttonMode: 'send',
      ...open,
    });
    expect(composerState(input({ attachments: 1 })).buttonMode).toBe('send');
  });

  it.each<WorkspaceRole>(['owner', 'admin', 'editor'])('lets the %s write to Auto', (role) => {
    expect(composerState(input({ role, text: 'hi' }))).toEqual({ buttonMode: 'send', ...open });
  });

  it('holds the send while a file uploads, the pill still taking words', () => {
    expect(composerState(input({ text: 'hi', uploading: true }))).toEqual({
      buttonMode: 'disabled',
      ...open,
    });
    expect(composerState(input({ attachments: 1, uploading: true })).buttonMode).toBe('disabled');
  });

  it('holds the send while the thread is still being opened', () => {
    expect(composerState(input({ text: 'hi', loading: true }))).toEqual({
      buttonMode: 'disabled',
      ...open,
    });
  });
});

describe('composerState — stop', () => {
  it('stops while a reply is in flight, blank or not, and the pill takes the next message', () => {
    expect(composerState(input({ streaming: true }))).toEqual({ buttonMode: 'stop', ...open });
    expect(composerState(input({ streaming: true, text: 'next' })).buttonMode).toBe('stop');
  });

  it('stops even while a file uploads or the thread reloads', () => {
    expect(composerState(input({ streaming: true, uploading: true })).buttonMode).toBe('stop');
    expect(composerState(input({ streaming: true, loading: true })).buttonMode).toBe('stop');
  });
});

describe('composerState — switched off', () => {
  const viewer = {
    buttonMode: 'disabled',
    inputEditable: false,
    placeholder: COMPOSER_COPY.readOnlyPlaceholder,
    notice: { kind: 'viewer', text: ROLE_COPY.viewerReadOnly },
  };
  const paused = {
    buttonMode: 'disabled',
    inputEditable: false,
    placeholder: COMPOSER_COPY.placeholder,
    notice: { kind: 'paused', text: AI_LABEL_PAUSED_TEXT },
  };

  it('gives a viewer the thread read-only, with D17’s words', () => {
    expect(ROLE_COPY.viewerReadOnly).toBe(
      'Ask your workspace owner for editor access to talk to Auto',
    );
    expect(composerState(input({ role: 'viewer', text: 'hi' }))).toEqual(viewer);
    expect(composerState(input({ role: 'viewer', streaming: true }))).toEqual(viewer);
  });

  it('tells a viewer why, not the paused label', () => {
    expect(composerState(input({ role: 'viewer', aiLabelVisible: false }))).toEqual(viewer);
  });

  it('switches every control off, Stop included, while the AI label can’t be seen', () => {
    expect(composerState(input({ aiLabelVisible: false, text: 'hi' }))).toEqual(paused);
    expect(composerState(input({ aiLabelVisible: false, streaming: true }))).toEqual(paused);
    expect(
      composerState(input({ aiLabelVisible: false, aiLabelChecked: true, attachments: 2 })),
    ).toEqual(paused);
  });

  it('holds the composer without a notice until the label is first measured', () => {
    expect(
      composerState(input({ aiLabelVisible: false, aiLabelChecked: false, text: 'hi' })),
    ).toEqual({ ...paused, notice: null });
    expect(composerState(input({ aiLabelChecked: false, text: 'hi' })).buttonMode).toBe('send');
  });

  it('offers nothing while the role is not yet read', () => {
    const off = { ...paused, notice: null };
    expect(composerState(input({ role: null, text: 'hi' }))).toEqual(off);
    expect(composerState(input({ role: undefined, streaming: true }))).toEqual(off);
    expect(composerState(input({ role: null, aiLabelVisible: false }))).toEqual(paused);
  });
});

describe('composerButton and outgoingText', () => {
  it('draws Stop as a square that says what it stops, anything else as the send arrow', () => {
    expect(composerButton('stop')).toEqual({
      icon: 'stop',
      label: COMPOSER_COPY.stop,
      hint: COMPOSER_COPY.stopHint,
    });
    expect(composerButton('send')).toEqual({ icon: 'send', label: 'Send', hint: undefined });
    expect(composerButton('disabled')).toEqual(composerButton('send'));
  });

  it('sends the words without the spaces and blank lines around them, inner lines kept', () => {
    expect(outgoingText('\n  Summarise today\n\nthen file it  \n')).toBe(
      'Summarise today\n\nthen file it',
    );
    expect(outgoingText(' \n ')).toBe('');
  });
});

describe('pillMetrics', () => {
  it('centres one line in the 42 pt pill with the handoff’s radius and side padding', () => {
    const metrics = pillMetrics(21.7);
    expect(metrics.minHeight).toBe(PILL_INPUT.minHeight);
    expect(metrics.radius).toBe(21);
    expect(metrics.paddingHorizontal).toBe(16);
    expect(metrics.paddingVertical * 2 + 21.7 + 2 * PILL_INPUT.border).toBeCloseTo(42);
  });

  it('grows to six lines, then scrolls', () => {
    const metrics = pillMetrics(20);
    expect(metrics.paddingVertical).toBe(10);
    expect(metrics.maxHeight).toBe(6 * 20 + 2 * (10 + 1));
  });

  it('never pads below zero for a line taller than the pill', () => {
    expect(pillMetrics(60).paddingVertical).toBe(0);
  });
});

describe('the composer’s source', () => {
  const read = (file: string) =>
    readFileSync(path.resolve(__dirname, '..', 'composer', file), 'utf8');
  const composer = read('Composer.tsx');
  const pill = read('PillInput.tsx');
  /** The code alone: the header comments name what the composer leaves out. */
  const code = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('renders the foundation’s AiLabel, tracked by the fence that feeds composerState', () => {
    expect(composer).toMatch(/from '\.\.\/\.\.\/styles\/ai-label'/);
    expect(composer).toMatch(/<AiLabel track=\{fence\.track\} \/>/);
    expect(composer).toMatch(/aiLabelVisible: fence\.visible/);
    expect(read('use-label-fence.ts')).toMatch(/useAiLabelVisible\(\)/);
  });

  it('keeps Return a newline: a multiline pill that never submits', () => {
    expect(pill).toMatch(/\bmultiline\b/);
    expect(pill).toMatch(/submitBehavior="newline"/);
    expect(code(`${composer}${pill}`)).not.toMatch(/onSubmitEditing|onKeyPress|blurOnSubmit/);
  });

  it('draws the round 42 pt button with lucide’s arrow-up and square', () => {
    expect(composer).toMatch(/lucide-react-native\/icons\/arrow-up/);
    expect(composer).toMatch(/lucide-react-native\/icons\/square/);
    expect(composer).toMatch(/size="lg"\s+round/);
  });

  it('has no suggestion chips, no Plan toggle and no voice button', () => {
    const source = code(`${composer}${pill}`);
    expect(source).not.toMatch(/\bChip\b|SegmentedControl|suggestion/i);
    expect(source).not.toMatch(/planMode|missionMode|\bPlan\b/);
    expect(source).not.toMatch(/\bMic\b|icons\/mic|voice/i);
  });
});
