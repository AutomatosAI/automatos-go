// What the server answers the connect wave (D-ONE-CLIENT): zod at the boundary, unknown fields
// dropped at parse time. A refusal's detail ({"detail": {"code": …}}) is read by the one client's
// error parser (src/api/errors.ts detailOf → ApiError.code), never by a second one here.

import { z } from 'zod';

import { DEVICE_TOKEN_MAX_LENGTH, DEVICE_TOKEN_MIN_LENGTH, DEVICE_TOKEN_PREFIX } from './config';

/** The prefix, then token_urlsafe's base64url: nothing that could split or forge a header. */
const DEVICE_TOKEN_PATTERN = new RegExp(`^${DEVICE_TOKEN_PREFIX}[A-Za-z0-9_-]+$`);

/** A device token; zod's issue for a bad one names the rule, never the value. */
export const deviceTokenSchema = z
  .string()
  .min(DEVICE_TOKEN_MIN_LENGTH)
  .max(DEVICE_TOKEN_MAX_LENGTH)
  .regex(DEVICE_TOKEN_PATTERN);

/** Python's isoformat() of an aware datetime: '2026-11-20T10:00:00.123456+00:00'. */
const isoDateTime = z.string().datetime({ offset: true });

/** POST /api/v1/mobile/pair (automatos-ai api/mobile_devices.py `pair`), Cache-Control no-store. */
export const pairResponseSchema = z.object({
  device_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  token: deviceTokenSchema,
  rotate_after: isoDateTime,
});

export type PairResponse = z.output<typeof pairResponseSchema>;
