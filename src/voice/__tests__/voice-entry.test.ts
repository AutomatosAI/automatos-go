// The way into the voice screen (US-019k): voiceEntry per role (D-ROLES: viewers get no voice, nor
// does a role not yet read) and per AI label state (D73: the label holds nothing, so every state
// gives the same entry), the route on the open conversation (voiceRoute), and the button's words.

import { describe, expect, it } from 'vitest';

import { roleCan } from '../../auth/role';
import { WORKSPACE_ROLES, type WorkspaceRole } from '../../api/workspace';
import { voiceRoute } from '../nav';
import { VOICE_ENTRY_COPY } from '../strings';
import { voiceEntry, type VoiceEntryInput } from '../entry/voice-entry';

const ROLES: readonly (WorkspaceRole | null | undefined)[] = [...WORKSPACE_ROLES, null, undefined];
const TALKERS: readonly WorkspaceRole[] = ['owner', 'admin', 'editor'];
/** Where the thread's AI label may be when the composer draws: none of them may matter (D73). */
const LABEL_STATES = ['loading', 'shown', 'unnamed agent', 'scrolled away'] as const;

function entryFor(role: WorkspaceRole | null | undefined, chatId: string | null = 'c-1') {
  return voiceEntry({ roleCanChat: roleCan(role, 'chat'), chatId });
}

describe('voiceEntry per role (D-ROLES)', () => {
  it('shows a pressable button to owners, admins and editors', () => {
    for (const role of TALKERS) {
      const entry = entryFor(role);
      expect(entry.visible, role).toBe(true);
      expect(entry.enabled, role).toBe(true);
    }
  });

  it('shows nothing to a viewer, nor while the role is unknown', () => {
    for (const role of ['viewer', null, undefined] as const) {
      const entry = entryFor(role);
      expect(entry.visible, String(role)).toBe(false);
      expect(entry.enabled, String(role)).toBe(false);
    }
  });

  it('is visible exactly when the role can chat', () => {
    for (const role of ROLES) expect(entryFor(role).visible).toBe(roleCan(role, 'chat'));
  });
});

describe('voiceEntry per AI label state (D73)', () => {
  it('gives the same entry in every label state, for every role', () => {
    for (const role of ROLES) {
      const plain = entryFor(role);
      for (const aiLabel of LABEL_STATES) {
        const input: VoiceEntryInput & { readonly aiLabel: string } = {
          roleCanChat: roleCan(role, 'chat'),
          chatId: 'c-1',
          aiLabel,
        };
        expect(voiceEntry(input), `${String(role)} · ${aiLabel}`).toEqual(plain);
      }
    }
  });

  it('takes nothing but the role and the chat', () => {
    const input: Required<VoiceEntryInput> = { roleCanChat: true, chatId: null };
    expect(Object.keys(input).sort()).toEqual(['chatId', 'roleCanChat']);
  });
});

describe('voiceEntry route', () => {
  it('opens the voice screen on the open conversation', () => {
    expect(entryFor('editor', 'c-123').route).toBe('/voice?chat=c-123');
    expect(entryFor('editor', 'a b/c').route).toBe(voiceRoute('a b/c'));
  });

  it("opens A2's home thread while the chat has no id yet (KC4)", () => {
    expect(entryFor('owner', null).route).toBe('/voice');
    expect(entryFor('owner', '  ').route).toBe('/voice');
  });

  it('says the same route whether or not the button shows', () => {
    expect(entryFor('viewer', 'c-9').route).toBe(entryFor('admin', 'c-9').route);
  });
});

describe('voiceEntry words', () => {
  it("is 'Talk to Auto' to VoiceOver and TalkBack, with a hint that the mic waits for the hold", () => {
    const entry = entryFor('editor');
    expect(entry.label).toBe('Talk to Auto');
    expect(entry.label).toBe(VOICE_ENTRY_COPY.label);
    expect(entry.hint).toBe(VOICE_ENTRY_COPY.hint);
    expect(entry.hint).toMatch(/Hold to talk/);
  });

  it('returns a frozen entry', () => {
    expect(Object.isFrozen(entryFor('owner'))).toBe(true);
  });
});
