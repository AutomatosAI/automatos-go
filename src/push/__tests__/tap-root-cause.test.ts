// The ways a valid tap fell to a neutral path (fix/notification-taps), each pinned with the input
// that fell before the fix: an iOS response whose content.data came over empty while the trigger
// still held Expo's data; a workspace id in another case; a verified push that names no screen
// (an approval, a Mission plan, no link) received while the person is on home lost its banner; and
// a failed check now says why (the word the tap diagnostics keep), never the key or the payload.

import { describe, expect, it } from 'vitest';

import { DEFAULT_ACTION_ID } from '../config';
import { handleResponse, verificationOf, type VerifyDeps } from '../inbound/handler';
import { sameWorkspace } from '../inbound/intent';
import { fromResponse } from '../inbound/parse';
import { handleIncoming, type IncomingDeps } from '../inbound/receive';
import type { PushRecord } from '../registration/record';
import { parsePushData } from '../schemas/payload';
import { checkPushSignature, verifyPushSignature } from '../signature/verify';
import { routes } from '../../navigation/routes';
import { NOTIFICATION_ID, WS } from './data-fixtures';
import {
  NOW_S,
  ORIGIN,
  OTHER_KEY,
  PHONE_KEY,
  READ_PATH,
  REVIEW_FIELDS,
  nodeSha256,
  OPEN_CATEGORY,
  phoneRecord,
  received,
  signed,
  world,
} from './handler-fixtures';
import { IOS_ID } from './inbound-fixtures';

const REVIEW = signed(REVIEW_FIELDS);

/** An iOS tap whose content.data is empty: Expo's data only in the trigger's userInfo. */
function iosTapWithDataOnTrigger(body: unknown, data: unknown = null) {
  return {
    notification: {
      date: 1792540800.5,
      request: {
        identifier: IOS_ID,
        content: {
          title: 'Auto',
          body: 'A ticket is ready for review',
          data,
          categoryIdentifier: OPEN_CATEGORY,
        },
        trigger: { type: 'push', payload: { aps: { category: OPEN_CATEGORY }, body } },
      },
    },
    actionIdentifier: DEFAULT_ACTION_ID,
  };
}

describe('iOS: Expo data read from the trigger when content.data is empty', () => {
  it.each([
    ['null', null],
    ['an empty object', {}],
  ])('content.data %s → the trigger’s body is the data', (_name, data) => {
    const event = fromResponse(iosTapWithDataOnTrigger(REVIEW, data));
    expect(event).toMatchObject({ kind: 'readable', id: IOS_ID, data: REVIEW });
  });

  it('a body sent as a JSON string reads the same', () => {
    const event = fromResponse(iosTapWithDataOnTrigger(JSON.stringify(REVIEW)));
    expect(event).toMatchObject({ kind: 'readable', data: REVIEW });
  });

  it('content.data, when there, still wins over the trigger', () => {
    const other = { ...REVIEW, link_id: '1' };
    const event = fromResponse(iosTapWithDataOnTrigger(other, REVIEW));
    expect(event).toMatchObject({ kind: 'readable', data: REVIEW });
  });

  it('no data anywhere stays unreadable', () => {
    expect(fromResponse(iosTapWithDataOnTrigger(undefined))).toEqual({ kind: 'unreadable' });
    expect(fromResponse(iosTapWithDataOnTrigger('not json'))).toEqual({ kind: 'unreadable' });
  });

  it('such a tap opens the ticket and marks it read', async () => {
    const run = world();
    const outcome = await handleResponse(iosTapWithDataOnTrigger(REVIEW), run.deps);
    expect(outcome).toEqual({ route: routes.cc.ticket('8812') });
    expect(run.requests()).toEqual([expect.objectContaining({ method: 'POST', path: READ_PATH })]);
  });
});

describe('the workspace is compared as an id, not as text', () => {
  it('the same UUID in another case is the same workspace', () => {
    expect(sameWorkspace(WS, WS.toUpperCase())).toBe(true);
    expect(sameWorkspace(` ${WS} `, WS)).toBe(true);
    expect(sameWorkspace(WS, '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d')).toBe(false);
    expect(sameWorkspace(WS, null)).toBe(false);
    expect(sameWorkspace('', '')).toBe(false);
  });

  it('a push whose signed workspace id is upper case opens its target', async () => {
    const upper = signed({ ...REVIEW_FIELDS, workspace_id: WS.toUpperCase() });
    const run = world();
    const tap = {
      notification: {
        date: 1,
        request: {
          identifier: IOS_ID,
          content: { data: upper, categoryIdentifier: OPEN_CATEGORY },
        },
      },
      actionIdentifier: DEFAULT_ACTION_ID,
    };
    expect(await handleResponse(tap, run.deps)).toEqual({ route: routes.cc.ticket('8812') });
  });
});

describe('checkPushSignature says why a push did not verify', () => {
  const payload = parsePushData(REVIEW);

  it.each([
    ['verified', REVIEW, PHONE_KEY, NOW_S],
    ['not_v2', { ...REVIEW, v: 1 }, PHONE_KEY, NOW_S],
    ['not_v2', { nothing: true }, PHONE_KEY, NOW_S],
    ['no_key', REVIEW, null, NOW_S],
    ['stale', REVIEW, PHONE_KEY, NOW_S + 604801],
    ['mismatch', REVIEW, OTHER_KEY, NOW_S],
  ] as const)('%s', async (word, push, key, now) => {
    await expect(checkPushSignature(push, key, nodeSha256, now)).resolves.toBe(word);
    await expect(verifyPushSignature(push, key, nodeSha256, now)).resolves.toBe(
      word === 'verified',
    );
  });

  it('a digest that fails is digest_failed, never a throw', async () => {
    const broken = async () => {
      throw new Error('no native module');
    };
    await expect(checkPushSignature(payload, PHONE_KEY, broken, NOW_S)).resolves.toBe(
      'digest_failed',
    );
  });
});

describe('verificationOf names a missing key', () => {
  function deps(load: () => Promise<PushRecord | null>): VerifyDeps {
    return {
      session: { serverOrigin: ORIGIN },
      store: { load },
      sha256: nodeSha256,
      nowSeconds: () => NOW_S,
    };
  }
  const payload = parsePushData(REVIEW);

  type Load = () => Promise<PushRecord | null>;
  const locked: Load = async () => {
    throw new Error('locked');
  };

  it.each<[string, Load]>([
    ['verified', async () => phoneRecord()],
    ['no_record', async () => null],
    ['other_server', async () => phoneRecord({ serverOrigin: 'https://own.example' })],
    ['keychain', locked],
  ])('%s', async (word, load) => {
    await expect(verificationOf(payload, deps(load))).resolves.toBe(word);
  });

  it('no payload is not_v2', async () => {
    await expect(
      verificationOf(
        null,
        deps(async () => phoneRecord()),
      ),
    ).resolves.toBe('not_v2');
  });
});

describe('foreground: a push with no screen of its own keeps its banner on home', () => {
  function incoming(route: string): IncomingDeps {
    return {
      session: { serverOrigin: ORIGIN },
      store: { load: async () => phoneRecord() },
      sha256: nodeSha256,
      nowSeconds: () => NOW_S,
      currentRoute: () => route,
      refresh: () => undefined,
    };
  }

  it.each([
    ['an approval', { link_type: 'approval_grant', link_id: '42' }],
    ['a Mission plan', { link_type: 'mission', link_id: '0d9f2c51-7a43-4b8e-9c61-2e5f7a1b3c4d' }],
    ['no link', {}],
  ])('%s on home → banner and list', async (_name, link) => {
    const push = signed({
      v: 2,
      type: 'needs_answer',
      workspace_id: WS,
      notification_id: NOTIFICATION_ID,
      ...link,
      iat: NOW_S,
    });
    const shown = await handleIncoming(received(push, OPEN_CATEGORY), incoming(routes.home));
    expect(shown).toMatchObject({ shouldShowBanner: true, shouldShowList: true });
  });

  it('a ticket push while on that ticket still drops only the banner', async () => {
    const shown = await handleIncoming(
      received(REVIEW, OPEN_CATEGORY),
      incoming(routes.cc.ticket('8812')),
    );
    expect(shown).toMatchObject({ shouldShowBanner: false, shouldShowList: true });
  });
});
