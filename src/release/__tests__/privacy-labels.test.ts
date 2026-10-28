// R05 as a test that keeps running in CI: docs/release/privacy-labels.json is the one source of the
// App Store privacy labels and the Play Data safety answers. It parses; it answers every type each
// form asks about, with KR15's manifest keys; it never tracks and collects for App Functionality
// only; it cites files that exist; Apple and Play agree; its answers say what the code does (no
// tracing, no tap or screen breadcrumbs, no user on crash events, the crash switch, photos only, no
// location, cleartext on private networks, where quick-ask audio is recognised); and the two form
// documents carry the same words.

import { existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { cameraOptions, libraryOptions } from '../../chat/attachments/picked';
import { expo, infoPlist, pluginOptions, type PluginEntry } from '../../config/__tests__/app-json';
import { parseCrashSetting } from '../../observability/crash-setting';
import { buildSentryOptions } from '../../observability/options';
import { scrubBreadcrumb, scrubEvent } from '../../observability/scrub';
import { recognitionPolicy } from '../../voice/quick-ask/recognition-policy';
import { PRIVACY_POLICY_URL, SUPPORT_URL } from '../legal-links';
import { privacySectionRows } from '../privacy-section';
import { markdownTables, sectionStartingWith, tableWithColumns } from './support/markdown';
import {
  APP_FUNCTIONALITY,
  APP_STORE_DOC,
  APPLE_DATA_TYPES,
  appleCells,
  cellMismatches,
  KR15_MANIFEST_KEYS,
  PLAY_DATA_TYPES,
  PLAY_DOC,
  PLAY_PURPOSES_USED,
  playCells,
  privacyLabelsSchema,
  readPrivacyLabels,
  type AppleRow,
  type PlayRow,
} from './support/privacy-labels';
import { readRepoFile, repoRoot } from './support/tree';

const labels = readPrivacyLabels();
const appleDoc = readRepoFile(APP_STORE_DOC);
const playDoc = readRepoFile(PLAY_DOC);

const apple = (key: string): AppleRow => {
  const row = labels.apple.find((candidate) => candidate.manifestKey === key);
  if (!row) throw new Error(`no apple row for ${key}`);
  return row;
};
const play = (type: string): PlayRow => {
  const row = labels.play.find((candidate) => candidate.type === type);
  if (!row) throw new Error(`no play row for ${type}`);
  return row;
};
const key = (suffix: string) => `NSPrivacyCollectedDataType${suffix}`;

const APPLE_COLUMNS = ['Data type', 'Collected', 'Linked to you'] as const;
const PLAY_COLUMNS = ['Data type', 'Collected', 'Required or optional'] as const;
const EU_DSN = 'https://0123456789abcdef0123456789abcdef@o123.ingest.de.sentry.io/4508123456789';

describe('privacy-labels.json (R05)', () => {
  it('parses with the schema, and the schema refuses an unknown field', () => {
    expect(() => readPrivacyLabels()).not.toThrow();
    const extra = { ...labels, apple: [{ ...labels.apple[0], trackingDomain: 'x' }] };
    expect(privacyLabelsSchema.safeParse(extra).success).toBe(false);
  });

  it("answers every App Store type once, in the form's order, with KR15's manifest keys", () => {
    expect(KR15_MANIFEST_KEYS.size).toBe(35);
    expect(
      labels.apple.map(({ category, appleType, manifestKey }) => ({
        category,
        appleType,
        manifestKey,
      })),
    ).toEqual(APPLE_DATA_TYPES);
    for (const row of labels.apple) expect(KR15_MANIFEST_KEYS.has(row.manifestKey)).toBe(true);
  });

  it("answers every Play type once, in the form's order", () => {
    expect(labels.play.map(({ category, type }) => ({ category, type }))).toEqual(PLAY_DATA_TYPES);
  });

  it('tracks nothing: tracking is false on every Apple row', () => {
    expect(labels.apple.filter((row) => row.tracking !== false)).toEqual([]);
  });

  it('collects every Apple type for App Functionality only, and says whether it is linked', () => {
    for (const row of labels.apple) {
      expect(row.purposes, row.appleType).toEqual(row.collected ? [APP_FUNCTIONALITY] : []);
      expect(row.linked === null, row.appleType).toBe(!row.collected);
    }
  });

  it('uses no Play purpose for analytics, advertising or personalisation, and shares nothing', () => {
    for (const row of labels.play) {
      expect(row.shared, row.type).toBe(false);
      for (const purpose of row.purposes)
        expect(PLAY_PURPOSES_USED.has(purpose), purpose).toBe(true);
      expect(row.purposes.length > 0, row.type).toBe(row.collected);
    }
  });

  it('answers ephemeral and required-or-optional for every collected Play type and no other', () => {
    for (const row of labels.play) {
      expect(row.ephemeral === null, row.type).toBe(!row.collected);
      expect(row.requiredOrOptional === null, row.type).toBe(!row.collected);
    }
  });

  it('cites only files that exist, and every collected row cites one', () => {
    const { encryptedInTransit, accountCreation } = labels.playSecurity;
    const cited = [...labels.apple, ...labels.play, encryptedInTransit, accountCreation].flatMap(
      (row) => row.evidence,
    );
    const root = repoRoot();
    expect(cited.filter((file) => !existsSync(path.join(root, file)))).toEqual([]);
    const bare = [...labels.apple, ...labels.play].filter(
      (row) => row.collected && row.evidence.length === 0,
    );
    expect(bare).toEqual([]);
  });
});

describe('App Store and Play agree', () => {
  it('names only KR15 keys on Play rows', () => {
    const named = labels.play.flatMap((row) => row.apple);
    expect(named.filter((name) => !KR15_MANIFEST_KEYS.has(name))).toEqual([]);
  });

  it('a collected Play type maps only to collected Apple types', () => {
    const wrong = labels.play
      .filter((row) => row.collected)
      .flatMap((row) =>
        row.apple.filter((name) => !apple(name).collected).map((name) => `${row.type} → ${name}`),
      );
    expect(wrong).toEqual([]);
  });

  it('every collected Apple type has a collected Play type', () => {
    const covered = new Set(labels.play.filter((row) => row.collected).flatMap((row) => row.apple));
    const missing = labels.apple.filter((row) => row.collected && !covered.has(row.manifestKey));
    expect(missing.map((row) => row.appleType)).toEqual([]);
  });
});

describe('the answers say what the code does (KR7 and this wave)', () => {
  const sentry = buildSentryOptions({
    dsn: EU_DSN,
    enabled: true,
    channel: 'testflight',
    appVersion: '1.0.0',
    buildNumber: '7',
  });

  it('Performance Data: not collected, because Sentry traces nothing', () => {
    expect(apple(key('PerformanceData')).collected).toBe(false);
    expect(play('Other app performance data').collected).toBe(false);
    expect(sentry).toMatchObject({
      tracesSampleRate: 0,
      enableAutoPerformanceTracing: false,
      enableAppStartTracking: false,
      enableNativeFramesTracking: false,
      enableStallTracking: false,
    });
    expect(sentry).not.toHaveProperty('profilesSampleRate');
  });

  it('Product Interaction: not collected, because no tap, screen or session is recorded', () => {
    expect(apple(key('ProductInteraction')).collected).toBe(false);
    for (const category of ['touch', 'ui.click', 'ui.input', 'navigation']) {
      expect(scrubBreadcrumb({ category, message: 'Tapped Send' }), category).toBeNull();
    }
    expect(sentry).toMatchObject({
      enableUserInteractionTracing: false,
      enableAutoSessionTracking: false,
    });
  });

  it('Crash Data: collected and not linked, because events carry no user and no PII', () => {
    expect(apple(key('CrashData'))).toMatchObject({ collected: true, linked: false });
    expect(sentry?.sendDefaultPii).toBe(false);
    const scrubbed = scrubEvent({
      message: 'boom',
      user: { id: 'u_1', email: 'a@b.test', ip_address: '10.0.0.2' },
    });
    expect(scrubbed).not.toHaveProperty('user');
  });

  it('Play crash logs: optional, because Settings has the switch (on by default)', () => {
    expect(play('Crash logs')).toMatchObject({ collected: true, requiredOrOptional: 'Optional' });
    const rows = privacySectionRows({
      crashOn: true,
      appVersion: '1.0.0',
      buildNumber: '7',
      updateId: null,
    });
    expect(rows.some((row) => row.kind === 'switch' && row.id === 'crash-reports')).toBe(true);
    expect(parseCrashSetting(null)).toBe(true);
    expect(parseCrashSetting('off')).toBe(false);
  });

  it('Photos yes, videos no, because both pickers ask for still images only', () => {
    expect(apple(key('PhotosorVideos')).collected).toBe(true);
    expect(play('Photos').collected).toBe(true);
    expect(play('Videos').collected).toBe(false);
    expect(cameraOptions().mediaTypes).toEqual(['images']);
    expect(libraryOptions(5).mediaTypes).toEqual(['images']);
  });

  it("Audio Data names Apple's speech recognition, because iOS starts another chosen language", () => {
    // Gerard, 27 Oct 2026: on iPhone a language other than the iPhone's own is recognised on the
    // iPhone when its dictation model is installed, else by Apple. The Apple row says so, and no
    // longer claims quick-ask audio is never sent; Android stays on the phone or does not start.
    const other = recognitionPolicy({
      platform: 'ios',
      supportsOnDevice: false,
      recognitionAvailable: true,
      locale: 'pt-BR',
      phoneLocale: 'en-GB',
    });
    expect(other.kind).toBe('ready');
    const audio = apple(key('AudioData'));
    expect(audio.source).toContain("Apple's speech recognition processes it");
    expect(audio.source).toContain('the app receives only the text');
    expect(audio.source).not.toMatch(/recognised on the phone and never sent|no audio leaves/);
    const android = recognitionPolicy({
      platform: 'android',
      androidApiLevel: 34,
      supportsOnDevice: false,
      recognitionAvailable: true,
      locale: 'pt-BR',
      phoneLocale: 'en-GB',
    });
    expect(android.kind).toBe('unavailable');
    expect(play('Voice or sound recordings').source).toContain(
      'Quick-ask audio stays on the phone.',
    );
  });

  it('Location: not collected, because the build has no location permission or usage key', () => {
    for (const suffix of ['PreciseLocation', 'CoarseLocation'])
      expect(apple(key(suffix)).collected).toBe(false);
    expect(play('Approximate location').collected).toBe(false);
    expect(play('Precise location').collected).toBe(false);
    expect(Object.keys(infoPlist).filter((name) => name.startsWith('NSLocation'))).toEqual([]);
    expect(expo.android.permissions.filter((name) => name.includes('LOCATION'))).toEqual([]);
    expect(expo.android.blockedPermissions).toEqual(
      expect.arrayContaining([
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
      ]),
    );
  });

  it("encrypted in transit: never 'Yes' while the build allows cleartext to private networks", () => {
    const { encryptedInTransit } = labels.playSecurity;
    const build = pluginOptions(expo.plugins as PluginEntry[], 'expo-build-properties') as
      { android?: { usesCleartextTraffic?: boolean } } | undefined;
    const cleartext = build?.android?.usesCleartextTraffic === true;
    expect(cleartext && encryptedInTransit.answer === 'Yes').toBe(false);
    expect(encryptedInTransit.options.map((option) => option.answer).sort()).toEqual(['No', 'Yes']);
  });

  it('deletion requests go to the policy or the contact page (KR8)', () => {
    const { deletionRequest } = labels.playSecurity;
    expect([PRIVACY_POLICY_URL, SUPPORT_URL]).toContain(deletionRequest.url);
    expect(deletionRequest.how).toContain(SUPPORT_URL);
  });
});

describe('the two form documents carry the JSON words', () => {
  it('app-store-privacy.md: one row per Apple type, in order, with the same answers', () => {
    const table = tableWithColumns(appleDoc, APPLE_COLUMNS);
    expect(cellMismatches(labels.apple.map(appleCells), table.rows)).toEqual([]);
  });

  it('play-data-safety.md: one row per Play type, in order, with the same answers', () => {
    const table = tableWithColumns(playDoc, PLAY_COLUMNS);
    expect(cellMismatches(labels.play.map(playCells), table.rows)).toEqual([]);
  });

  it('each lists every row that differs from the draft, under its changes section', () => {
    const appleChanges = sectionStartingWith(appleDoc, 'Changes from the privacy draft');
    const playChanges = sectionStartingWith(playDoc, 'Changes from the privacy draft');
    const changedApple = labels.apple.filter((row) => row.changedFromDraft !== null);
    const changedPlay = labels.play.filter((row) => row.changedFromDraft !== null);
    expect(changedApple.filter((row) => !appleChanges.includes(`**${row.appleType}**`))).toEqual(
      [],
    );
    expect(changedPlay.filter((row) => !playChanges.includes(`**${row.type}**`))).toEqual([]);
  });

  it('app-store-privacy.md names the privacy policy URL and answers Tracking: No', () => {
    expect(appleDoc).toContain(PRIVACY_POLICY_URL);
    expect(sectionStartingWith(appleDoc, 'Tracking: No')).not.toBe('');
  });

  it('play-data-safety.md gives both encrypted-in-transit answers, the deletion URL and account creation', () => {
    const security = sectionStartingWith(playDoc, 'Data collection and security');
    const { encryptedInTransit, deletionRequest, accountCreation } = labels.playSecurity;
    expect(security).toContain('plain HTTP');
    for (const option of encryptedInTransit.options)
      expect(security).toContain(`**${option.answer}**`);
    expect(security).toContain(deletionRequest.url);
    expect(security).toContain(accountCreation.answer);
  });
});

describe('the comparison fires', () => {
  const doc = [
    '| Category | Data type | Collected | Purposes | Linked to you | Used for tracking | Why |',
    '|---|---|---|---|---|---|---|',
    '| Contact Info | Name | No | — | — | — | wrong on purpose |',
  ].join('\n');

  it('names the row and column whose word differs, and a missing row', () => {
    const table = tableWithColumns(doc, APPLE_COLUMNS);
    const found = cellMismatches(labels.apple.slice(0, 2).map(appleCells), table.rows);
    expect(found).toContain('the document has 1 rows, the JSON 2');
    expect(found).toContain("Name: Collected is 'No', want 'Yes'");
    expect(found).toContain("Email Address: Data type is 'missing', want 'Email Address'");
  });

  it('refuses a table row with the wrong number of cells, and a document with no table', () => {
    expect(() => markdownTables(`${doc}\n| Contact Info | Name |`)).toThrow(
      /2 cells, its header 7/,
    );
    expect(() => tableWithColumns('no table here', APPLE_COLUMNS)).toThrow(/found 0/);
  });
});
