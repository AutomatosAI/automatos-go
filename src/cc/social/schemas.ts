// A social post's wire shape (D-ONE-CLIENT: zod at the boundary, unknown fields ignored): GET
// /api/socials/posts/{post_id}, SocialPost.to_dict (core/models/socials.py) at the pinned SHA. Only
// what the approval view reads is kept: the copy per channel, the targets, the media, the slot and
// the content_hash of this version (D6), which Approve sends back exactly as it came. A post with no
// hash cannot be approved from here, so it fails the parse rather than offer an Approve that the
// server would refuse. The post is never persisted (query-keys.ts 'socialPost'). A status outside
// the known set is kept as sent (view.ts gives it its own word).

import { z } from 'zod';

const Text = z.string().nullable().catch(null);

/** Only entries of the right shape are kept; a missing or broken list is empty. */
function rowsOf<T extends z.ZodTypeAny>(row: T) {
  return z
    .array(z.unknown())
    .catch([])
    .transform((items): z.output<T>[] =>
      items.flatMap((item) => {
        const parsed = row.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      }),
    );
}

/** {toolkit: text}: a channel's own copy; an entry that is not text is dropped. */
const ChannelCopies = z
  .record(z.string(), z.unknown())
  .catch({})
  .transform((entries): Readonly<Record<string, string>> =>
    Object.fromEntries(
      Object.entries(entries).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    ),
  );

/** {"base": text, "channels": {toolkit: text}}: the base copy and each channel's override. */
const CopySchema = z
  .object({ base: Text, channels: ChannelCopies })
  .catch({ base: null, channels: {} });

/** One channel and post kind it publishes to (SocialPostTarget.to_dict). */
const TargetSchema = z.object({ toolkit: z.string().min(1), post_kind: Text });

/** {aspect: [Deliverable id | file record]}: read entry by entry in media.ts. */
const MediaSchema = z
  .record(z.string(), z.unknown())
  .catch({})
  .transform((aspects): Readonly<Record<string, readonly unknown[]>> =>
    Object.fromEntries(
      Object.entries(aspects).map(([aspect, entries]) => [
        aspect,
        Array.isArray(entries) ? entries : [],
      ]),
    ),
  );

export const SocialPostSchema = z.object({
  id: z.string().min(1),
  title: Text,
  /** Kept as sent: a status this version does not know still shows, under its own word. */
  status: z.string(),
  /** The hash of this version (D6): Approve carries it back unchanged. */
  content_hash: z.string().min(1),
  format: Text,
  copy: CopySchema,
  media: MediaSchema,
  targets: rowsOf(TargetSchema),
  /** UTC; set once approved and scheduled. */
  scheduled_for: Text,
  /** UTC; the slot it is planned for before approval (approving a future slot schedules it). */
  planned_for: Text,
  /** IANA name the author chose, for display. */
  timezone: Text,
});

export type SocialPost = Readonly<z.output<typeof SocialPostSchema>>;
export type SocialTarget = SocialPost['targets'][number];

/** What approve and request-changes answer: the post as saved; only its status is read. */
export const DecidedPostSchema = z.object({ status: Text });

export type DecidedPost = Readonly<z.output<typeof DecidedPostSchema>>;
