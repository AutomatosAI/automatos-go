import { describe, expect, it } from 'vitest';

import { SERVER } from '../../api/__tests__/fake-transport';
import {
  aspectRatio,
  DEFAULT_RATIO,
  isMediaFileName,
  mediaFrame,
  mediaKind,
  mediaUrl,
  postMedia,
} from '../social/media';
import { SocialPostSchema } from '../social/schemas';
import {
  channelLabel,
  channelViews,
  momentText,
  postStudioUrl,
  socialPostView,
  statusTone,
  statusWord,
} from '../social/view';
import { SOCIAL_COPY } from '../strings';

const POST_ID = '5b0c3f7e-8a51-4c1f-9d2e-0f6a7b8c9d10';
const HASH = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
const NOW = new Date('2026-10-23T08:00:00Z');
const CLOCK = { now: NOW, timeZone: 'Europe/London' };

const RECORD = {
  deliverable_id: '1a2b3c4d-0000-4000-8000-000000000007',
  name: 'teaser-9x16.mp4',
  sha256: HASH,
  bytes: 4_200_000,
  content_type: 'video/mp4',
};

/** SocialPost.to_dict's fields the view reads, plus some it ignores. */
const WIRE = {
  id: POST_ID,
  title: '  Q4 launch teaser ',
  status: 'needs_approval',
  content_hash: HASH,
  format: 'fact_card',
  copy: { base: 'We ship on Monday.', channels: { twitter: 'Monday.', youtube: 7 } },
  media: { '9:16': [RECORD], '1:1': ['1a2b3c4d-0000-4000-8000-000000000008'] },
  targets: [
    { toolkit: 'linkedin', post_kind: 'video' },
    { toolkit: 'twitter', post_kind: 'post' },
    { toolkit: 'twitter', post_kind: 'thread' },
    { toolkit: 'blue_sky', post_kind: null },
    { post_kind: 'video' },
  ],
  scheduled_for: null,
  planned_for: '2026-10-27T09:00:00+00:00',
  timezone: null,
  review_log: [{ action: 'submit' }],
  future_field: { anything: true },
};

const parse = (overrides: Record<string, unknown> = {}) =>
  SocialPostSchema.parse({ ...WIRE, ...overrides });

describe('the post’s wire shape', () => {
  it('keeps what the view reads, drops channel copy that is not text and unreadable targets', () => {
    const post = parse();
    expect(post.copy).toEqual({ base: 'We ship on Monday.', channels: { twitter: 'Monday.' } });
    expect(post.targets.map((target) => target.toolkit)).toEqual([
      'linkedin',
      'twitter',
      'twitter',
      'blue_sky',
    ]);
    expect(post).not.toHaveProperty('future_field');
  });

  it('keeps an unknown status as sent, and survives a missing copy or media', () => {
    const post = parse({ status: 'queued_for_review', copy: undefined, media: 'broken' });
    expect(post.status).toBe('queued_for_review');
    expect(post.copy).toEqual({ base: null, channels: {} });
    expect(post.media).toEqual({});
  });
});

describe('the post as it will publish', () => {
  it('lists each channel with its post kinds and the copy it publishes', () => {
    expect(channelViews(parse())).toEqual([
      { toolkit: 'linkedin', label: 'LinkedIn · Video', text: 'We ship on Monday.' },
      { toolkit: 'twitter', label: 'X · Post · Thread', text: 'Monday.' },
      { toolkit: 'blue_sky', label: 'Blue Sky', text: 'We ship on Monday.' },
    ]);
  });

  it('names the seeded channels, and any other from its slug', () => {
    expect(channelLabel('instagram')).toBe('Instagram');
    expect(channelLabel('mastodon_social')).toBe('Mastodon Social');
  });

  it('shows the base copy when no channel is chosen', () => {
    const view = socialPostView(parse({ targets: [] }), CLOCK);
    expect(view.channels).toEqual([]);
    expect(view.text).toBe('We ship on Monday.');
  });

  it('gives every status a word and a tone; an unknown one its own word, muted', () => {
    expect([statusWord('needs_approval'), statusTone('needs_approval')]).toEqual([
      'Needs approval',
      'warning',
    ]);
    expect([statusWord('published'), statusTone('published')]).toEqual(['Published', 'success']);
    expect([statusWord('queued_for_review'), statusTone('queued_for_review')]).toEqual([
      'Queued for review',
      'muted',
    ]);
  });

  it('heads with the trimmed title, the status and the format word', () => {
    const view = socialPostView(parse(), CLOCK);
    expect(view.title).toBe('Q4 launch teaser');
    expect(view.status).toEqual({ word: 'Needs approval', tone: 'warning' });
    expect(view.format).toBe('Fact card');
    expect(socialPostView(parse({ title: ' ', format: null }), CLOCK)).toMatchObject({
      title: SOCIAL_COPY.untitled,
      format: null,
    });
  });
});

describe('when it publishes', () => {
  it('reads a planned slot ahead in the phone’s zone, and approving schedules it there', () => {
    const view = socialPostView(parse(), CLOCK);
    expect(view.when).toBe('Planned for Tue 27 Oct · 09:00 London');
    expect(view.slot).toBe('Tue 27 Oct · 09:00 London');
  });

  it('prefers the post’s own timezone, and its scheduled time over the plan', () => {
    const post = parse({
      timezone: 'America/New_York',
      scheduled_for: '2026-10-27T13:30:00+00:00',
    });
    const view = socialPostView(post, CLOCK);
    expect(view.when).toBe('Publishes Tue 27 Oct · 09:30 New York');
    expect(view.slot).toBeNull();
  });

  it('a slot that has passed is not one approving schedules', () => {
    const view = socialPostView(parse({ planned_for: '2026-10-20T09:00:00Z' }), CLOCK);
    expect(view.when).toBe('Planned for Tue 20 Oct · 10:00 London');
    expect(view.slot).toBeNull();
  });

  it('says it is not scheduled when it has no time, or one that cannot be read', () => {
    expect(socialPostView(parse({ planned_for: null }), CLOCK).when).toBe(SOCIAL_COPY.notScheduled);
    expect(socialPostView(parse({ planned_for: 'soon' }), CLOCK).when).toBe(
      SOCIAL_COPY.notScheduled,
    );
    expect(momentText(null, 'UTC')).toBeNull();
    expect(momentText('2026-10-27T09:00:00Z', 'UTC')).toBe('Tue 27 Oct · 09:00 UTC');
  });
});

describe('the media', () => {
  it('shows the files the post serves by name, and counts the rest for Studio', () => {
    expect(postMedia(parse().media)).toEqual({
      files: [{ aspect: '9:16', name: 'teaser-9x16.mp4', kind: 'video', ratio: 9 / 16 }],
      elsewhere: 1,
    });
  });

  it('never loads a name the media route would refuse', () => {
    expect(isMediaFileName('teaser-9x16.mp4')).toBe(true);
    expect(isMediaFileName('../secrets.mp4')).toBe(false);
    expect(isMediaFileName('a..b.png')).toBe(false);
    expect(isMediaFileName('Upper.png')).toBe(false);
    const media = { '1:1': [{ ...RECORD, name: '../x.png' }, { content_type: 'image/png' }] };
    expect(postMedia(media)).toEqual({ files: [], elsewhere: 2 });
  });

  it('tells images from videos by content type, else by extension', () => {
    expect(mediaKind('image/jpeg', 'cover.bin')).toBe('image');
    expect(mediaKind('VIDEO/MP4', 'clip')).toBe('video');
    expect(mediaKind(null, 'cover.webp')).toBe('image');
    expect(mediaKind(null, 'clip.mov')).toBe('video');
    expect(mediaKind('application/pdf', 'brief.pdf')).toBe('file');
  });

  it('draws each file in its own shape, no taller than the cap', () => {
    expect(aspectRatio('16:9')).toBeCloseTo(16 / 9);
    expect(aspectRatio('1080x1920')).toBeCloseTo(9 / 16);
    expect([aspectRatio('square'), aspectRatio('0:5')]).toEqual([DEFAULT_RATIO, DEFAULT_RATIO]);
    expect(mediaFrame(350, 9 / 16, 420)).toEqual({ width: 236, height: 420 });
    expect(mediaFrame(350, 16 / 9, 420)).toEqual({ width: 350, height: 197 });
    expect(mediaFrame(0, 1, 420)).toEqual({ width: 0, height: 0 });
  });

  it('loads a file from the post’s media route', () => {
    expect(mediaUrl(SERVER.apiUrl, POST_ID, 'teaser-9x16.mp4')).toBe(
      `${SERVER.apiUrl}/api/socials/posts/${POST_ID}/media/teaser-9x16.mp4`,
    );
  });
});

describe('Open in Studio', () => {
  it('opens the web’s own link to the post, or says there is none', () => {
    expect(postStudioUrl(POST_ID, SERVER.webUrl)).toBe(
      `${SERVER.webUrl}/deliverables?tab=socials&post=${POST_ID}`,
    );
    expect(postStudioUrl(POST_ID, '')).toBeNull();
  });
});
