// The social post as it will publish, pure (D-SOCIAL, the web's socials-review.ts channelCopies): the
// status as a chip with its word, the format, each channel with its post kinds and the copy it
// publishes (the channel's own text, else the base), the media, and when it publishes: its scheduled
// time, else the slot it is planned for, in the post's own timezone with its city (the phone's when
// the post names none). Approving a post whose planned slot is still ahead schedules it there
// (PRD-251B US-B105), so only a future slot is said to be. The server decides all of it again at
// approve time; this only shows it.

import { socialPostHref } from '../../core/web/components/command-center/calendar-actions';
import { studioUrl } from '../../navigation/web-links';
import type { Tone } from '../../ui/variants';
import { wallClock, zoneCity } from '../shell/dateline';
import { SHELL_COPY, SOCIAL_COPY } from '../strings';
import { postMedia, type PostMedia } from './media';
import type { SocialPost } from './schemas';

/** The one status a post waits on a person in (modules/socials/service.py NEEDS_APPROVAL). */
export const NEEDS_APPROVAL = 'needs_approval';

/** Every status keeps a word beside its colour (D-SHAPE); an unknown one is muted. */
const STATUS_TONES: Readonly<Record<string, Tone>> = Object.freeze({
  needs_approval: 'warning',
  changes_requested: 'accent',
  approved: 'success',
  scheduled: 'success',
  published: 'success',
  rendering: 'info',
  publishing: 'info',
  partially_published: 'accent',
  failed: 'accent',
  missed: 'accent',
});

export type ChannelView = {
  readonly toolkit: string;
  /** 'LinkedIn · post'. */
  readonly label: string;
  readonly text: string;
};

export type SocialPostView = {
  readonly title: string;
  readonly status: { readonly word: string; readonly tone: Tone };
  readonly format: string | null;
  /** One per channel; empty when no channel is chosen (then `text` is the base copy). */
  readonly channels: readonly ChannelView[];
  readonly text: string | null;
  readonly media: PostMedia;
  /** 'Publishes Tue 21 Oct · 09:00 London', 'Planned for …', or 'Not scheduled yet'. */
  readonly when: string;
  /** The slot approving schedules it for, when it has one still ahead. */
  readonly slot: string | null;
};

export type PostClock = { readonly now: Date; readonly timeZone: string | null };

/** 'fact_card' → 'Fact card'. */
export function slugWords(slug: string): string {
  const words = slug.replace(/[_-]+/g, ' ').trim();
  return words ? `${words[0].toUpperCase()}${words.slice(1)}` : slug;
}

export function statusWord(status: string): string {
  return SOCIAL_COPY.status[status] ?? slugWords(status);
}

export function statusTone(status: string): Tone {
  return STATUS_TONES[status] ?? 'muted';
}

/** 'linkedin' → 'LinkedIn', 'blue_sky' → 'Blue Sky' (the web's channelLabel). */
export function channelLabel(toolkit: string): string {
  return (
    SOCIAL_COPY.channels[toolkit] ??
    toolkit.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

/** One entry per channel, its post kinds and the copy it publishes, in the targets' order. */
export function channelViews(post: Pick<SocialPost, 'copy' | 'targets'>): ChannelView[] {
  const base = post.copy.base ?? '';
  const kinds = post.targets.reduce<ReadonlyMap<string, readonly string[]>>((found, target) => {
    const kind = target.post_kind?.trim();
    const known = found.get(target.toolkit) ?? [];
    return new Map(found).set(target.toolkit, kind ? [...known, slugWords(kind)] : known);
  }, new Map());
  return [...kinds.entries()].map(([toolkit, postKinds]) => ({
    toolkit,
    label: [channelLabel(toolkit), ...postKinds].join(' · '),
    text: (post.copy.channels[toolkit] ?? base).trim(),
  }));
}

const twoDigits = (value: number) => String(value).padStart(2, '0');

/** 'Tue 21 Oct · 09:00 London' in that zone (the city left off when it has none); null if unreadable. */
export function momentText(iso: string | null, timeZone: string | null): string | null {
  const at = iso ? Date.parse(iso) : Number.NaN;
  if (Number.isNaN(at)) return null;
  const clock = wallClock(new Date(at), timeZone);
  const city = zoneCity(timeZone);
  const date = `${SHELL_COPY.weekdays[clock.weekday]} ${clock.day} ${SHELL_COPY.months[clock.month]}`;
  const time = `${twoDigits(clock.hours)}:${twoDigits(clock.minutes)}`;
  return `${date} · ${city ? `${time} ${city}` : time}`;
}

type WhenFields = Pick<SocialPost, 'scheduled_for' | 'planned_for' | 'timezone'>;

function isAhead(iso: string | null, now: Date): boolean {
  const at = iso ? Date.parse(iso) : Number.NaN;
  return !Number.isNaN(at) && at > now.getTime();
}

function whenOf(post: WhenFields, clock: PostClock) {
  const zone = post.timezone?.trim() || clock.timeZone;
  const scheduled = momentText(post.scheduled_for, zone);
  const planned = momentText(post.planned_for, zone);
  if (scheduled) return { when: SOCIAL_COPY.publishes(scheduled), slot: null };
  if (planned) {
    return {
      when: SOCIAL_COPY.planned(planned),
      slot: isAhead(post.planned_for, clock.now) ? planned : null,
    };
  }
  return { when: SOCIAL_COPY.notScheduled, slot: null };
}

export function socialPostView(post: SocialPost, clock: PostClock): SocialPostView {
  const channels = channelViews(post);
  const format = post.format?.trim();
  return {
    title: post.title?.trim() || SOCIAL_COPY.untitled,
    status: { word: statusWord(post.status), tone: statusTone(post.status) },
    format: format ? (SOCIAL_COPY.format[format] ?? slugWords(format)) : null,
    channels,
    text: channels.length === 0 ? post.copy.base?.trim() || null : null,
    media: postMedia(post.media),
    ...whenOf(post, clock),
  };
}

/** The post in Studio (the web's own link), on the server's web address; null when it has none. */
export function postStudioUrl(postId: string, webUrl: string): string | null {
  return studioUrl(socialPostHref(postId), webUrl);
}
