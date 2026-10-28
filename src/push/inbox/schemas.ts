// What the server answers the phone's notifications inbox (D-ONE-CLIENT): zod at the boundary,
// unknown fields dropped. Shapes read on automatos-ai origin/main: api/notifications.py
// NotificationRow / NotificationListResponse / UnreadCountResponse / ReadAllResponse (the web's
// bell uses the same routes), api/approval_grants.py list_grants (grant.to_dict: id and details,
// where a tool approval keeps the chat it was raised in, details.conversation_id, and a board
// ticket's, details.board_task_id: modules/tools/execution/tool_grants.py _grant_details) and
// api/missions.py get_mission (_run_to_response: config.origin_chat_id, the chat a Mission was
// launched from). A row this version cannot read is left out, never a failed list.

import { z } from 'zod';

import { logger } from '../../lib/logger';
import { UUID_PATTERN } from '../config';

const Text = z.string().nullable().catch(null);
const OptionalText = z.string().nullish().catch(null);

/** One bell row as the inbox reads it (NotificationRow keeps more: agent, status, dismissed_at). */
export const inboxNotificationSchema = z.object({
  id: z.string().regex(UUID_PATTERN),
  event_type: z.string(),
  title: z.string(),
  message: Text,
  link_type: Text,
  link_id: Text,
  agent_name: OptionalText,
  read_at: Text,
  created_at: z.string(),
});

export type InboxNotification = Readonly<z.output<typeof inboxNotificationSchema>>;

/** Each row parsed on its own: one this version cannot read is dropped (and said so in debug). */
const InboxRows = z.array(z.unknown()).transform((rows) =>
  rows.flatMap((row) => {
    const parsed = inboxNotificationSchema.safeParse(row);
    if (parsed.success) return [Object.freeze(parsed.data)];
    logger.debug('[inbox] left out a notification this version cannot read');
    return [];
  }),
);

export const inboxListSchema = z.object({
  notifications: InboxRows,
  total: z.number().int().nonnegative().catch(0),
});

export type InboxList = Readonly<z.output<typeof inboxListSchema>>;

export const unreadCountSchema = z.object({ count: z.number().int().nonnegative() });

/** A grant's details as the open path reads them: where its card is, never what it runs. */
const GrantDetails = z
  .object({
    conversation_id: z.string().nullish().catch(null),
    board_task_id: z.union([z.number().int(), z.string()]).nullish().catch(null),
  })
  .nullish()
  .catch(null);

const GrantPlaceShape = z.object({ id: z.number().int(), details: GrantDetails });

/** GET /api/v1/approval-grants?status=pending: each open grant and where its card is. */
export const grantPlacesSchema = z.object({
  grants: z.array(z.unknown()).transform((rows) =>
    rows.flatMap((row) => {
      const parsed = GrantPlaceShape.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    }),
  ),
});

export type GrantPlace = Readonly<z.output<typeof GrantPlaceShape>>;

/** GET /api/missions/{id}: the chat it was launched from, when it was. */
export const missionPlaceSchema = z.object({
  id: z.string(),
  config: z
    .object({ origin_chat_id: z.string().nullish().catch(null) })
    .nullish()
    .catch(null),
});

export type MissionPlace = Readonly<z.output<typeof missionPlaceSchema>>;
