// Face ID before approving a social post (D19, KP13; A4's US-015e): Approve goes to
// POST /api/socials/posts/{id}/approve only after guard('approve_social', …) from src/step-up
// passes, and exactly as before (approveShown: the content_hash of the version on screen, a 409
// reloading it). A refused check sends nothing: the sheet stays as it was and the gate's toast says
// why. Request changes never asks (KP13). Pure: use-social.ts hands in useStepUp().guard.

import type { ApiClient } from '../../api/client';
import type { Guard, GuardResult } from '../../step-up/guard';
import { approveShown, type ApproveOutcome } from './api';
import type { SocialPost } from './schemas';

export function approvePostGated(
  guard: Guard,
  client: ApiClient,
  shown: SocialPost,
  reload: () => Promise<SocialPost | null | undefined>,
): Promise<GuardResult<ApproveOutcome>> {
  return guard('approve_social', () => approveShown(client, shown, reload));
}
