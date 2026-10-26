// Shared by the homes' tests: A2's thread driven with A2's own reducer and frames (the controller's
// fixtures), and Auto driven beside it in the order a home lives it (use-home-thread.ts): a frame
// reaches Auto first (useThread's onFrame), then the reducer folds it, then Auto hears how the
// thread moved (mascot-feed.ts, the layout effect). Nothing touches the network or React.

import { AT } from '../../../chat/__tests__/thread-fixtures';
import {
  threadReducer,
  type ThreadAction,
  type ThreadState,
} from '../../../chat/controller/thread';
import type { Frame } from '../../../core/ai-sdk-stream';
import { approvalsInPart } from '../../../core/web/lib/chat/approvals';
import { deliverablesInPart } from '../../../core/web/lib/chat/deliverables';
import type { MascotName } from '../../../core/frozen/lib/mascot/types';
import { startRun, stepRun, type MascotRun } from '../../mascot/run';
import { threadMascotEvents } from '../mascot-feed';

export type Home = { readonly state: ThreadState; readonly run: MascotRun };

export function homeOn(state: ThreadState): Home {
  return { state, run: startRun() };
}

function act(home: Home, action: ThreadAction): Home {
  const tapped =
    action.type === 'frame' ? stepRun(home.run, { type: 'frame', frame: action.frame }) : home.run;
  const state = threadReducer(home.state, action);
  const run = threadMascotEvents(home.state, state).reduce<MascotRun>(
    (current, event) => stepRun(current, { type: 'event', event }),
    tapped,
  );
  return { state, run };
}

/** The home after these actions, each lived in turn. */
export function live(home: Home, ...actions: ThreadAction[]): Home {
  return actions.reduce(act, home);
}

/** What Auto should show now (the reducer's target). */
export const autoShows = (home: Home): MascotName => home.run.driver.mascot.mascot;

export const SEND: ThreadAction = Object.freeze({
  type: 'send',
  draft: Object.freeze({ text: 'Find me a laptop', files: [], sentAt: AT }),
});

export const frame = (value: Frame): ThreadAction => ({ type: 'frame', frame: value, at: AT });

export const FINISHED: ThreadAction = Object.freeze({ type: 'finished' });

export const SEARCH_START: Frame = Object.freeze({
  kind: 'tool-start',
  toolCallId: 'call-search',
  toolName: 'platform_web_search',
  input: Object.freeze({ query: 'best budget laptops' }),
});

export const SEARCH_END: Frame = Object.freeze({
  kind: 'tool-end',
  toolCallId: 'call-search',
  toolName: 'platform_web_search',
  success: true,
  skipped: false,
  waiting: false,
});

export const FINISH: Frame = Object.freeze({
  kind: 'finish',
  finishReason: 'stop',
  aiGenerated: true,
});

/** The document tool's data part: a Deliverable made in this turn. */
export function madeDocument(id: string, title: string, format = 'pdf'): Frame {
  const data = { generated_document: { deliverable_id: id, title, format } };
  return {
    kind: 'tool-data',
    approvals: [],
    deliverables: deliverablesInPart({ type: 'tool-data', data }),
  };
}

/** A tool approval card (the tool_approval data part), waiting on the user. */
export const TOOL_APPROVAL: Frame = Object.freeze({
  kind: 'tool-data',
  approvals: approvalsInPart({
    type: 'tool-data',
    data: {
      tool_approval: {
        grant_id: 41,
        action: 'platform_delete_task',
        message: 'Delete ticket #0425?',
        params: { task_id: 2680 },
      },
    },
  }),
  deliverables: [],
});
