// The scanner's decisions (US-006g): the camera permission in four states, asked once when the
// scanner opens; the first valid code wins and later frames change nothing; an invalid QR shows its
// copy and scanning goes on. Moved out of scan-state.test.ts unchanged, which keeps the link's and
// Connect's decisions.

import { describe, expect, it } from 'vitest';

import {
  INITIAL_SCAN,
  cameraPermissionOf,
  scanReducer,
  scannerView,
  shouldAskForCamera,
  type CameraPermission,
  type ScanState,
} from '../scanner/scan-state';
import { SCAN_COPY } from '../strings';
import { CODE, NEW_API, VALID, serverLink } from './pair-links';

const OTHER_VALID = serverLink('http://192.168.1.30:8000', 'WXYZ-2345');
const NOT_A_PAIRING_CODE = 'https://example.test/menu';

const scan = (state: ScanState, data: string) => scanReducer(state, { type: 'scanned', data });

describe('cameraPermissionOf: the four permission states', () => {
  it('is undetermined before the hook has read it, and while never asked', () => {
    expect(cameraPermissionOf(null)).toBe('undetermined');
    expect(cameraPermissionOf({ status: 'undetermined', canAskAgain: true })).toBe('undetermined');
  });

  it('is granted once allowed', () => {
    expect(cameraPermissionOf({ status: 'granted', canAskAgain: true })).toBe('granted');
  });

  it('is denied when refused but the system can still ask, blocked when only Settings can', () => {
    expect(cameraPermissionOf({ status: 'denied', canAskAgain: true })).toBe('denied');
    expect(cameraPermissionOf({ status: 'denied', canAskAgain: false })).toBe('blocked');
  });

  it('reads an unknown status as not yet decided, never as granted', () => {
    expect(cameraPermissionOf({ status: 'limited', canAskAgain: true })).toBe('undetermined');
  });
});

describe('shouldAskForCamera: asked when the scanner opens, once', () => {
  it('asks an undetermined permission the first time only', () => {
    expect(shouldAskForCamera('undetermined', false)).toBe(true);
    expect(shouldAskForCamera('undetermined', true)).toBe(false);
  });

  it('never asks by itself once decided', () => {
    for (const permission of ['granted', 'denied', 'blocked'] as const) {
      expect(shouldAskForCamera(permission, false)).toBe(false);
    }
  });

  it('records the ask once', () => {
    const asked = scanReducer(INITIAL_SCAN, { type: 'asked' });
    expect(asked.asked).toBe(true);
    expect(scanReducer(asked, { type: 'asked' })).toBe(asked);
  });
});

describe('scanReducer: the first valid code wins', () => {
  it('keeps the first valid pairing code, as the server hashed it', () => {
    const found = scan(INITIAL_SCAN, serverLink(NEW_API, 'abcd efgh')).found;
    expect(found).toEqual({ apiOrigin: NEW_API, insecure: false, code: CODE });
  });

  it('ignores every later frame: the same code, another valid code, an invalid one', () => {
    const first = scan(INITIAL_SCAN, VALID);
    expect(scan(first, VALID)).toBe(first);
    expect(scan(first, OTHER_VALID)).toBe(first);
    expect(scan(first, NOT_A_PAIRING_CODE)).toBe(first);
    expect(first.found?.code).toBe(CODE);
  });

  it('marks an invalid QR and keeps scanning; the same invalid code again changes nothing', () => {
    const invalid = scan(INITIAL_SCAN, NOT_A_PAIRING_CODE);
    expect(invalid).toMatchObject({ invalid: true, found: null });
    expect(scan(invalid, NOT_A_PAIRING_CODE)).toBe(invalid);
    expect(scan(invalid, '')).toBe(invalid);
  });

  it('takes a valid code after an invalid one, and drops the invalid mark', () => {
    const found = scan(scan(INITIAL_SCAN, NOT_A_PAIRING_CODE), VALID);
    expect(found).toMatchObject({ invalid: false, found: { code: CODE } });
  });

  it('refuses what parsePairLink refuses: an http api on a public host, another scheme', () => {
    for (const data of [
      serverLink('http://203.0.113.9:8000'),
      `javascript:alert(1)//go/pair?api=${encodeURIComponent(NEW_API)}&code=${CODE}`,
      `${VALID}&api=${encodeURIComponent('https://evil.example')}`,
    ]) {
      expect(scan(INITIAL_SCAN, data)).toMatchObject({ invalid: true, found: null });
    }
  });

  it('records a camera that failed to start, once', () => {
    const failed = scanReducer(INITIAL_SCAN, { type: 'cameraFailed' });
    expect(failed.cameraFailed).toBe(true);
    expect(scanReducer(failed, { type: 'cameraFailed' })).toBe(failed);
  });

  it('never changes the state it is given', () => {
    const before = scan(INITIAL_SCAN, NOT_A_PAIRING_CODE);
    expect(Object.isFrozen(before)).toBe(true);
    scan(before, VALID);
    expect(before).toMatchObject({ invalid: true, found: null });
    expect(INITIAL_SCAN).toEqual({
      asked: false,
      found: null,
      invalid: false,
      cameraFailed: false,
    });
  });
});

describe('scannerView: what the scanner shows', () => {
  it('scans once granted, with the hint', () => {
    expect(scannerView('granted', INITIAL_SCAN)).toEqual({
      kind: 'scanning',
      note: SCAN_COPY.hint,
      noteTone: 'info',
      reading: true,
    });
  });

  it("shows an invalid QR's copy and keeps reading", () => {
    const view = scannerView('granted', scan(INITIAL_SCAN, NOT_A_PAIRING_CODE));
    expect(view).toMatchObject({ kind: 'scanning', note: SCAN_COPY.invalid, noteTone: 'error' });
    expect(view).toMatchObject({ reading: true });
  });

  it('stops reading once a code is found', () => {
    expect(scannerView('granted', scan(INITIAL_SCAN, VALID))).toMatchObject({ reading: false });
  });

  it('waits on the system while the permission is being asked', () => {
    expect(scannerView('undetermined', INITIAL_SCAN)).toEqual({
      kind: 'asking',
      message: SCAN_COPY.asking,
    });
  });

  it('refused: the camera copy, Open Settings, and Allow the camera while the system can ask', () => {
    expect(scannerView('denied', INITIAL_SCAN)).toEqual({
      kind: 'no_camera',
      message: SCAN_COPY.denied,
      openSettings: true,
      askAgain: true,
    });
    expect(scannerView('blocked', INITIAL_SCAN)).toEqual({
      kind: 'no_camera',
      message: SCAN_COPY.denied,
      openSettings: true,
      askAgain: false,
    });
  });

  it('says the camera did not start, whatever the permission, without Settings', () => {
    const failed = scanReducer(INITIAL_SCAN, { type: 'cameraFailed' });
    for (const permission of ['granted', 'undetermined', 'denied'] as CameraPermission[]) {
      expect(scannerView(permission, failed)).toEqual({
        kind: 'no_camera',
        message: SCAN_COPY.cameraFailed,
        openSettings: false,
        askAgain: false,
      });
    }
  });

  it('uses the words US-006g gives for a refused camera', () => {
    expect(SCAN_COPY.denied).toBe(
      'Automatos Go needs the camera to scan the code. You can allow it in Settings, or type the code instead.',
    );
    expect(SCAN_COPY.openSettings).toBe('Open Settings');
    expect(SCAN_COPY.typeCode).toBe('Type the code');
  });
});
