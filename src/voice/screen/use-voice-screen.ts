// The voice screen's wiring (US-019j): it only wires; the words are voiceView's (KV8) and the core's
// props core-props.ts's.
//   The conversation is A2's useThread for the screen's chat; quick-ask runs over it (useQuickAsk:
//   the engine, a new AI-notice session at mount, the interruption policy and keep-awake, US-019h),
//   so there is never a second chat request. TYPE opens A2's Composer in the foundation's Sheet: a
//   typed turn goes through the same thread and is never spoken (KV6). STOP is quick-ask's (the mic
//   aborted, the speech stopped, its turn cancelled through A2's Stop). LOOK opens the style's look
//   page; the menu square closes the screen (back, or home when it was opened on its own).
//   HOLD TO TALK presses in and out; under a screen reader (AccessibilityInfo, KV5) it toggles
//   (use-voice-parts.ts, shared with HUD's home).
//   Permissions are read at mount for MIC OFF, never asked (KV5: only a press asks); a press's own
//   verdict, always the newer, wins.
//   Report this on the voice's reply: its saved message (voiceReportId), read per thread change.
//   The EN/PT switch beside HOLD TO TALK (useLanguageSwitch) for someone who may talk.

import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { useNeedsYou } from '../../api/needs-you';
import { useAppSession } from '../../app-state/session';
import { roleCan } from '../../auth/role';
import type { WorkspaceRole } from '../../api/workspace';
import { useThread, type ThreadView } from '../../chat/controller/use-thread';
import type { ChatFile } from '../../chat/request';
import type { MascotName } from '../../core/frozen/lib/mascot/types';
import { logger } from '../../lib/logger';
import { routes } from '../../navigation/routes';
import type { HudTurn } from '../../styles/hud/core/model';
import { useStyle } from '../../styles/theme';
import { voiceLookPath } from '../nav';
import type { PermissionVerdict } from '../permissions/permission-flow';
import { permissions } from '../permissions/permissions';
import { useLanguageSwitch, type LanguageSwitch } from '../language/use-language-switch';
import { useListening } from '../language/use-speak-language';
import { useQuickAsk, type QuickAskView } from '../quick-ask/use-quick-ask';
import {
  phaseMascot,
  voiceCoreProps,
  voiceLine,
  voiceReportId,
  voiceTurn,
  type VoiceCoreProps,
  type VoiceLine,
} from './core-props';
import { voiceDress } from './dress';
import { useHold, useLevels, useScreenReader } from './use-voice-parts';
import { voiceView, type MessageAction, type VoiceView } from './voice-view-model';

export type VoiceScreenActions = {
  readonly type: () => void;
  readonly closeType: () => void;
  readonly sendTyped: (text: string, files: readonly ChatFile[]) => void;
  readonly stop: () => void;
  readonly look: () => void;
  readonly close: () => void;
  readonly lineAction: (action: MessageAction) => void;
};

export type VoiceScreenModel = {
  readonly thread: ThreadView;
  readonly role: WorkspaceRole | null | undefined;
  readonly view: VoiceView;
  readonly turn: HudTurn;
  readonly mascot: MascotName;
  /** HudCore's voice but the line: with the EN/PT switch for someone who may talk. */
  readonly core: VoiceCoreProps & { readonly language?: LanguageSwitch };
  readonly line: VoiceLine | null;
  readonly levels: readonly number[] | null;
  readonly needsYou: number;
  /** TYPE's sheet is open. */
  readonly typing: boolean;
  readonly on: VoiceScreenActions;
};

/** The permissions as they stand at mount, read only (never a prompt); null until read. */
function useMountPermission(): PermissionVerdict | null {
  const [verdict, setVerdict] = useState<PermissionVerdict | null>(null);
  useEffect(() => {
    let current = true;
    permissions.check('quick-ask').then(
      (read) => {
        if (current) setVerdict(read);
      },
      (error: unknown) => logger.warn('[voice] the permissions were not read', error),
    );
    return () => {
      current = false;
    };
  }, []);
  return verdict;
}

function useActions(quick: QuickAskView, thread: ThreadView, setTyping: (on: boolean) => void) {
  const router = useRouter();
  const { layout } = useStyle();
  const chatId = thread.state.chatId;
  const { send } = thread;
  const { stop, download } = quick;
  return useMemo<VoiceScreenActions>(
    () => ({
      type: () => setTyping(true),
      closeType: () => setTyping(false),
      sendTyped: (text, files) => {
        send({ text, files });
        setTyping(false);
      },
      stop,
      look: () => router.push(voiceLookPath(layout)),
      close: () => (router.canGoBack() ? router.back() : router.replace(routes.home)),
      lineAction: (action) => {
        if (action === 'openSettings') permissions.openSettings();
        else if (action === 'download') download();
        else if (chatId !== null) router.push(routes.chat(chatId));
      },
    }),
    [stop, download, router, layout, chatId, send, setTyping],
  );
}

/** The voice screen over `chatId`'s conversation (null: a draft its first message creates). */
export function useVoiceScreen(chatId: string | null): VoiceScreenModel {
  const thread = useThread(chatId);
  const quick = useQuickAsk(thread);
  const { workspace } = useAppSession();
  const style = useStyle();
  const screenReader = useScreenReader();
  const mounted = useMountPermission();
  const { listening } = useListening();
  const roleCanChat = roleCan(workspace.role, 'chat');
  const language = useLanguageSwitch(roleCanChat);
  const levels = useLevels(quick.level);
  const hold = useHold(quick);
  const [typing, setTyping] = useState(false);
  const on = useActions(quick, thread, setTyping);
  const { total } = useNeedsYou();
  const { voice } = quick;
  const view = voiceView({
    state: voice,
    policy: quick.policy,
    permission: quick.permission ?? mounted,
    roleCanChat,
    screenReader,
    mascotState: phaseMascot(voice),
    locale: listening,
    reply: quick.reply,
    failure: thread.state.failure,
  });
  const dress = useMemo(() => voiceDress(style), [style]);
  const replyId = useMemo(
    () => voiceReportId(thread.state, quick.reply),
    [thread.state, quick.reply],
  );
  return {
    thread,
    role: workspace.role,
    view,
    turn: voiceTurn(view, quick.reply, replyId),
    mascot: view.mascot,
    core: { ...voiceCoreProps({ view, phase: voice.phase, dress, hold }), language },
    line: voiceLine(view.message),
    levels,
    needsYou: total,
    typing,
    on,
  };
}
