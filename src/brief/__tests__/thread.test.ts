// The brief in the thread (US-G06): Studio's and Play's rows carry it where discovery lists `brief`,
// HUD's transcript slot shows it while it is the newest message, and it enters once.

import { describe, expect, it } from 'vitest';

import { saved } from '../../chat/__tests__/thread-fixtures';
import { autoRows, opened } from '../../chat/__tests__/view-model-fixtures';
import { threadReducer } from '../../chat/controller/thread';
import { threadRows } from '../../chat/view-model';
import { hudBrief, hudTurn } from '../../styles/homes/hud-turn';
import { briefEntrance, briefKey, createSightings } from '../motion';
import { PROSE, briefMessage } from './fixtures';

const ASKED = saved('m-1', 'user', 'Brief me');
const REPLY = saved('m-2', 'assistant', 'Here it is.');

describe('threadRows with the brief', () => {
  it('keeps the brief on its row where briefs are drawn, and the text as the answer', () => {
    const [row] = autoRows(threadRows(opened([briefMessage()]), { briefs: true }));
    expect(row.brief?.greeting).toBe('Morning, Sam.');
    expect(row.answer).toBe(PROSE);
  });

  it('draws the text part exactly as today on a server without `brief`', () => {
    const [row] = autoRows(threadRows(opened([briefMessage()])));
    expect(row.brief).toBeNull();
    expect(row.answer).toBe(PROSE);
  });

  it('carries no brief on any other row', () => {
    const rows = autoRows(threadRows(opened([ASKED, REPLY]), { briefs: true }));
    expect(rows.map((row) => row.brief)).toEqual([null]);
  });
});

describe('HUD: the brief fills the transcript slot while it is the newest message', () => {
  it('is the newest message’s brief, today’s only, with its message for Report this', () => {
    const shown = hudBrief(opened([ASKED, REPLY, briefMessage()]), '2026-10-28');
    expect(shown?.brief.date).toBe('2026-10-28');
    expect(shown?.messageId).toBe('m-brief');
    expect(hudBrief(opened([ASKED, REPLY, briefMessage()]), '2026-10-29')).toBeNull();
  });

  it('is none once a newer message lands, while a turn is live, or while loading', () => {
    expect(hudBrief(opened([briefMessage(), ASKED, REPLY]), '2026-10-28')).toBeNull();
    const live = threadReducer(opened([briefMessage()]), {
      type: 'send',
      draft: { text: 'And now?', files: [], sentAt: '2026-10-28T08:00:00.000Z' },
    });
    expect(hudBrief(live, '2026-10-28')).toBeNull();
    expect(hudTurn(opened([briefMessage()])).auto).toBe(PROSE);
  });
});

describe('the card’s one entrance', () => {
  it('rises the first time a brief is drawn, fades under Reduce Motion, and never replays', () => {
    const sightings = createSightings();
    const key = briefKey({ date: '2026-10-28', state_hash: 'h-1' });
    expect(briefEntrance(sightings.first(key), false)).toBe('rise');
    expect(briefEntrance(sightings.first(key), false)).toBeNull();
    expect(
      briefEntrance(sightings.first(briefKey({ date: '2026-10-29', state_hash: 'h' })), true),
    ).toBe('fade');
  });
});
