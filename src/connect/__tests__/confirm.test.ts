// The confirm card and the paired record (KC5, KC9): the reached origin, Studio's address, the
// server's name, the record built from the card and POST /pair's answer, and the record the flow
// keeps without its token.

import { describe, expect, it, vi } from 'vitest';

import { DiscoverySchema } from '../../api/discovery';
import type { PairedDevice } from '../api';
import {
  confirmDetailsFrom,
  pairedRecordFrom,
  serverNameFrom,
  webUrlFrom,
  withoutToken,
} from '../confirm';
import { TOKEN } from './paired-record';

// The native module, stubbed: only the device store's record schema is read here.
vi.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 7,
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
  deleteItemAsync: async () => undefined,
}));

const { pairedRecordSchema } = await import('../device-store');

const LAN = 'http://192.168.1.20:8000';
const PAIRED_AT = '2026-10-23T09:30:00.000Z';

const DOCUMENT = DiscoverySchema.parse({
  schema: 'automatos-discovery/v1',
  name: '  Home NAS  ',
  edition: 'local',
  api_url: 'http://172.18.0.4:8000',
  web_url: 'http://192.168.1.20:3000/',
  auth: { modes: ['device'], clerk: null },
  pairing: { enabled: true },
  push: { expo: true },
});

const DEVICE: PairedDevice = Object.freeze({
  deviceId: '4a0f6c5e-8f43-4d5e-9b7a-1f2e3d4c5b6a',
  workspaceId: '9b1d2c3e-4f50-4617-8a9b-0c1d2e3f4a5b',
  token: TOKEN,
  rotateAfter: '2027-01-19T10:00:00.123456+00:00',
});

const DETAILS = confirmDetailsFrom({ origin: LAN, insecure: true, code: 'ABCD-EFGH' }, DOCUMENT);

describe('confirmDetailsFrom (KC5)', () => {
  it('keeps the reached origin and shows the document api_url only as a difference', () => {
    expect(DETAILS).toEqual({
      origin: LAN,
      insecure: true,
      serverName: 'Home NAS',
      edition: 'local',
      webUrl: 'http://192.168.1.20:3000',
      apiUrlDiffers: true,
      documentApiUrl: 'http://172.18.0.4:8000',
      pushExpo: true,
      code: 'ABCD-EFGH',
    });
    expect(Object.isFrozen(DETAILS)).toBe(true);
  });

  it('says nothing differs when api_url is the origin, written any way', () => {
    const same = DiscoverySchema.parse({ ...DOCUMENT, api_url: 'HTTP://192.168.1.20:8000/' });
    const details = confirmDetailsFrom({ origin: LAN, insecure: true, code: 'X' }, same);
    expect(details.apiUrlDiffers).toBe(false);
  });
});

describe('serverNameFrom', () => {
  it('trims the name and cuts it to 120 characters', () => {
    expect(serverNameFrom(' Office ', LAN)).toBe('Office');
    expect(serverNameFrom('n'.repeat(500), LAN)).toHaveLength(120);
  });

  it("falls back to the server's address when the name is missing or blank", () => {
    expect(serverNameFrom(undefined, LAN)).toBe('192.168.1.20:8000');
    expect(serverNameFrom('   ', 'https://automatos.example.com')).toBe('automatos.example.com');
  });
});

describe('webUrlFrom', () => {
  it('keeps an http(s) address with a host, without a trailing slash', () => {
    expect(webUrlFrom(' https://studio.example.com/app/ ', LAN)).toBe(
      'https://studio.example.com/app',
    );
    expect(webUrlFrom('http://nas.local:3000', LAN)).toBe('http://nas.local:3000');
  });

  it('falls back to the origin for anything else', () => {
    for (const web of [
      'ftp://studio.example.com',
      'https://',
      'https://bad_host',
      'https://user:pass@studio.example.com',
      'https://studio.example.com:99999',
      'javascript:alert(1)',
      'https://studio .example.com',
    ]) {
      expect(webUrlFrom(web, LAN), web).toBe(LAN);
    }
  });
});

describe('pairedRecordFrom and withoutToken (KC9)', () => {
  const record = pairedRecordFrom(DETAILS, DEVICE, PAIRED_AT);

  it('joins the card with the answer into a record the device store accepts', () => {
    expect(record).toEqual({
      origin: LAN,
      webUrl: 'http://192.168.1.20:3000',
      serverName: 'Home NAS',
      edition: 'local',
      insecure: true,
      pushExpo: true,
      deviceId: DEVICE.deviceId,
      workspaceId: DEVICE.workspaceId,
      token: TOKEN,
      rotateAfter: DEVICE.rotateAfter,
      pairedAt: PAIRED_AT,
    });
    expect(pairedRecordSchema.safeParse(record).success).toBe(true);
  });

  it('never keeps the document api_url or the pairing code', () => {
    expect(JSON.stringify(record)).not.toContain('172.18.0.4');
    expect(JSON.stringify(record)).not.toContain('ABCD-EFGH');
  });

  it('leaves the token behind for the flow', () => {
    const kept = withoutToken(record);
    expect(kept).not.toHaveProperty('token');
    expect(JSON.stringify(kept)).not.toContain(TOKEN);
    expect({ ...kept, token: TOKEN }).toEqual(record);
  });
});
