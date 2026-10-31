import { describe, expect, it } from 'vitest';

import { CHAT_ID } from '../../../chat/__tests__/thread-fixtures';
import { opened } from '../../../chat/__tests__/view-model-fixtures';
import { createThread, threadReducer } from '../../../chat/controller/thread';
import { ApiError } from '../../../api/errors';
import { builtinChoice, layoutOf, themeChoice } from '../../registry/style-id';
import { homeFor, isBlankDraft, showsFirstOpen } from '../layout';
import { SEND } from './fixtures';

describe('the layout decision', () => {
  it('each built-in style has its own home', () => {
    expect(homeFor(layoutOf(builtinChoice('studio')))).toBe('studio');
    expect(homeFor(layoutOf(builtinChoice('play')))).toBe('play');
    expect(homeFor(layoutOf(builtinChoice('hud')))).toBe('hud');
    expect(homeFor(layoutOf(builtinChoice('arcade')))).toBe('arcade');
    expect(homeFor(layoutOf(builtinChoice('candy')))).toBe('candy');
  });

  it('an installed theme paints Studio’s layout, so it has Studio’s home', () => {
    expect(homeFor(layoutOf(themeChoice('install-1')))).toBe('studio');
  });
});

describe('First open: a home whose conversation is a blank draft', () => {
  const draft = createThread(null);

  it('shows for a draft with nothing in it', () => {
    expect(isBlankDraft(draft)).toBe(true);
    expect(showsFirstOpen(draft)).toBe(true);
  });

  it('never once the user has written, or for a chat, or about a ticket', () => {
    const sent = threadReducer(draft, SEND);
    expect(showsFirstOpen(sent)).toBe(false);
    const broke = threadReducer(sent, { type: 'failed', error: new ApiError('network', {}) });
    expect(showsFirstOpen(broke)).toBe(false);
    expect(showsFirstOpen(createThread(CHAT_ID))).toBe(false);
    expect(showsFirstOpen(opened())).toBe(false);
    expect(showsFirstOpen(draft, '2680')).toBe(false);
  });
});
