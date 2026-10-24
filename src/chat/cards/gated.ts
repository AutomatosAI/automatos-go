// Face ID before approve (D19, KP13; A4's US-015e): the two card writes that ask first. Approve & run
// on a Mission plan goes through guard('approve_plan', …) and on a tool approval through
// guard('grant_tool', …), from src/step-up, so the request leaves only after a pass and exactly as
// before (approveMission's empty body, grantCall's bodiless /grant). A cancelled, missed or
// locked-out check sends nothing and settles nothing: the card stays open as it was, and the gate's
// toast says nothing was sent. Reject, Deny and Withdraw never ask (KP13). Pure: the cards hand in
// useStepUp().guard and useCardRequest runs the call.

import type { ApiClient } from '../../api/client';
import type { Guard } from '../../step-up/guard';
import type { GatedAction } from '../../step-up/policy';
import { approveMission } from './api';
import { grantCall } from './grants';
import type { CardCall, CardOutcome } from './model';

/** A card write behind the gate: its outcome once the server agreed, or null when nothing was sent. */
export type GatedCardCall = (client: ApiClient) => Promise<CardOutcome | null>;

const APPROVED: CardOutcome = Object.freeze({ state: 'approved' });

function gated(guard: Guard, action: GatedAction, call: CardCall): GatedCardCall {
  return async (client) => {
    const sent = await guard(action, () => call(client));
    return sent.ran ? sent.value : null;
  };
}

/** Approve & run on a plan: Face ID, then POST /api/missions/{id}/approve with the empty body. */
export function approvePlanGated(guard: Guard, missionId: string): GatedCardCall {
  return gated(guard, 'approve_plan', async (client) => {
    await approveMission(client, missionId);
    return APPROVED;
  });
}

/** Approve & run on a tool approval: Face ID, then the grant and what its resumed call did. */
export function grantToolGated(guard: Guard, grantId: number): GatedCardCall {
  return gated(guard, 'grant_tool', grantCall(grantId));
}
