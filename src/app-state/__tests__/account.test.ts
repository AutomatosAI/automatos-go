import { describe, expect, it } from 'vitest';

import { WorkspaceSchema } from '../../api/workspace';
import { accountRows, editionLabel, serverLabel } from '../account';
import { ACCOUNT_COPY, ROLE_LABELS } from '../strings';

/** GET /api/workspaces/current as the server sends it, plan and all (workspace.test.ts's CURRENT). */
const WORKSPACE = WorkspaceSchema.parse({
  id: '7f1c2a54-0000-4000-8000-000000000001',
  name: "Gerard's workspace",
  plan: 'business',
  role: 'admin',
  exposure: { plan: 'business', display_price_usd: 99, families: { voice: true } },
});

function rows(appVersion: string | null | undefined) {
  return accountRows({ workspace: WORKSPACE, appVersion });
}

describe('accountRows', () => {
  it('shows the workspace, role and app version, in that order (the server and edition are the server section, US-006h)', () => {
    expect(rows('1.0.0')).toEqual([
      { label: ACCOUNT_COPY.workspace, value: "Gerard's workspace" },
      { label: ACCOUNT_COPY.role, value: 'Admin' },
      { label: ACCOUNT_COPY.version, value: '1.0.0' },
    ]);
  });

  it('says nothing about the plan (D8)', () => {
    const words = rows('1.0.0')
      .flatMap((row) => [row.label, row.value])
      .join(' ')
      .toLowerCase();
    for (const word of ['business', 'plan', 'credit', 'price', '$']) {
      expect(words).not.toContain(word);
    }
  });

  it('says the version is unknown when the build config has none', () => {
    for (const missing of [undefined, null, '', '  ']) {
      expect(rows(missing).at(-1)).toEqual({
        label: ACCOUNT_COPY.version,
        value: ACCOUNT_COPY.unknownVersion,
      });
    }
  });

  it('names every role', () => {
    expect(ROLE_LABELS).toEqual({
      owner: 'Owner',
      admin: 'Admin',
      editor: 'Editor',
      viewer: 'Viewer',
    });
  });
});

describe('serverLabel', () => {
  it('is the host, without the scheme or a path', () => {
    expect(serverLabel({ apiUrl: 'https://api.automatos.app' })).toBe('api.automatos.app');
    expect(serverLabel({ apiUrl: 'http://192.168.1.20:8000/api' })).toBe('192.168.1.20:8000');
    expect(serverLabel({ apiUrl: 'https://automatos.local?x=1' })).toBe('automatos.local');
  });
});

describe('editionLabel', () => {
  it('names the two editions and shows any other as the server sent it', () => {
    expect(editionLabel('saas')).toBe('Automatos cloud');
    expect(editionLabel('local')).toBe('Self-hosted');
    expect(editionLabel('enterprise')).toBe('enterprise');
    expect(editionLabel('constructor')).toBe('constructor');
  });
});
