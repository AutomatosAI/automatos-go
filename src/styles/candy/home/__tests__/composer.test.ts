// Candy's message box (US-023h), pure: what the pill and its button say over A2's composerState,
// in Candy's words, and the P2 mock's measures.

import { describe, expect, it } from 'vitest';

import { composerState } from '../../../../chat/composer/composer-state';
import { CANDY_CHAT_COPY } from '../../strings';
import { COMPOSER, candyComposerView } from '../composer';

const said = CANDY_CHAT_COPY.composer;
const base = {
  text: '',
  streaming: false,
  role: 'owner',
  uploading: false,
  attachments: 0,
  loading: false,
} as const;

describe('candyComposerView', () => {
  it("says 'Message Auto' and does nothing while there is nothing to send", () => {
    const view = candyComposerView(composerState(base));
    expect(view).toEqual({
      editable: true,
      placeholder: said.placeholder,
      label: said.send,
      hint: undefined,
      stop: false,
      disabled: true,
    });
    expect(said.placeholder).toBe('Message Auto');
  });

  it('sends once something is typed', () => {
    expect(candyComposerView(composerState({ ...base, text: 'Hi' }))).toMatchObject({
      label: said.send,
      stop: false,
      disabled: false,
    });
  });

  it('is Stop, with its hint, while Auto answers; the pill still takes the next message', () => {
    expect(candyComposerView(composerState({ ...base, streaming: true }))).toMatchObject({
      editable: true,
      label: said.stop,
      hint: said.stopHint,
      stop: true,
      disabled: false,
    });
  });

  it("takes a viewer's placeholder and no typing (D17)", () => {
    const viewer = composerState({ ...base, role: 'viewer', text: 'Hi' });
    const view = candyComposerView(viewer);
    expect(view.editable).toBe(false);
    expect(view.disabled).toBe(true);
    expect(view.placeholder).toBe(viewer.placeholder);
    expect(view.placeholder).not.toBe(said.placeholder);
  });
});

describe('the P2 mock’s measures', () => {
  it('sits 14 in and 28 over the inset, a 56 pill with a 44 button and hold to talk at 56', () => {
    expect(COMPOSER).toMatchObject({ side: 14, bottom: 28, pill: 56, send: 44, talk: 56 });
    expect(COMPOSER.padRight + COMPOSER.send).toBeLessThanOrEqual(COMPOSER.pill);
  });
});
