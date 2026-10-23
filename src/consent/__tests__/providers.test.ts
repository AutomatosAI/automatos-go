// US-007b: the AI providers the consent sheet names (D23, KC11), read from the bootstrap's
// ai_providers as automatos-ai services/ai_providers.py answers it on origin/main 00bef182a:
// [{id, name}] sorted by id, Retell as {id 'retell', name 'Retell AI'} when the workspace can use
// Auto Live voice, [] when nothing goes out, null when the list could not be read.

import { describe, expect, it } from 'vitest';

import { WorkspaceSchema } from '../../api/workspace';
import { providerNames, providersFrom } from '../providers';
import { CONSENT_COPY, namesList } from '../strings';

const RETELL = { id: 'retell', name: 'Retell AI' };
const DEEPSEEK = { id: 'deepseek', name: 'DeepSeek' };
const OPENROUTER = { id: 'openrouter', name: 'OpenRouter' };
const VOYAGE = { id: 'voyage', name: 'Voyage AI' };

/** GET /api/workspaces/current through the foundation's schema, with this ai_providers value. */
function bootstrapWith(aiProviders?: unknown) {
  return WorkspaceSchema.parse({
    id: '7f1c2a54-0000-4000-8000-000000000001',
    name: 'Workspace',
    ...(aiProviders === undefined ? {} : { ai_providers: aiProviders }),
  });
}

describe('providersFrom: what the server lists', () => {
  it('reads a server before PRD-266 W3 (no field) as unlisted', () => {
    expect(providersFrom(bootstrapWith())).toEqual({ kind: 'unlisted' });
  });

  it('reads a list the server could not read (null) as unlisted, and never fails the bootstrap', () => {
    expect(providersFrom(bootstrapWith(null))).toEqual({ kind: 'unlisted' });
    expect(providersFrom(bootstrapWith([{ id: 'x' }]))).toEqual({ kind: 'unlisted' });
  });

  it('reads an empty list as none: nothing goes to an AI provider', () => {
    expect(providersFrom(bootstrapWith([]))).toEqual({ kind: 'none' });
  });

  it('keeps each id once, the first the server sent', () => {
    const read = providersFrom(
      bootstrapWith([DEEPSEEK, { id: 'deepseek', name: 'DeepSeek again' }, OPENROUTER]),
    );
    expect(read).toEqual({ kind: 'listed', providers: [DEEPSEEK, OPENROUTER] });
  });

  it('sorts by name, whatever the case, then by id (the server sorts by id)', () => {
    const lower = { id: 'aaa', name: 'openai' };
    const read = providersFrom(bootstrapWith([VOYAGE, OPENROUTER, lower, DEEPSEEK]));
    expect(providerNames(read)).toEqual(['DeepSeek', 'openai', 'OpenRouter', 'Voyage AI']);
    const twins = providersFrom(
      bootstrapWith([
        { id: 'b', name: 'Same' },
        { id: 'a', name: 'Same' },
      ]),
    );
    expect(twins.kind === 'listed' && twins.providers.map(({ id }) => id)).toEqual(['a', 'b']);
  });

  it('keeps the voice entry, Retell for Auto Live, and names it as sent', () => {
    const read = providersFrom(bootstrapWith([RETELL, DEEPSEEK, VOYAGE]));
    expect(read).toEqual({ kind: 'listed', providers: [DEEPSEEK, RETELL, VOYAGE] });
    expect(CONSENT_COPY.listed(providerNames(read))).toContain('DeepSeek, Retell AI and Voyage AI');
  });

  it('keeps an entry whatever else it carries (a kind, a capability): never filtered', () => {
    const tagged = [
      { ...RETELL, kind: 'voice', capability: 'live' },
      { ...VOYAGE, kind: 'embeddings', plan: 'business' },
    ];
    expect(providerNames(providersFrom(bootstrapWith(tagged)))).toEqual(['Retell AI', 'Voyage AI']);
  });

  it('shows names as sent, trimmed; a blank name shows the id the server sent with it', () => {
    const read = providersFrom(
      bootstrapWith([
        { id: 'cohere', name: '  Cohere ' },
        { id: 'xyz', name: ' ' },
      ]),
    );
    expect(providerNames(read)).toEqual(['Cohere', 'xyz']);
  });

  it('names nobody for an unlisted server', () => {
    expect(providerNames({ kind: 'unlisted' })).toEqual([]);
    expect(providerNames({ kind: 'none' })).toEqual([]);
  });
});

describe('the consent copy (strings.ts)', () => {
  it('lists every name: one, two, three or more', () => {
    expect(namesList(['A'])).toBe('A');
    expect(namesList(['A', 'B'])).toBe('A and B');
    expect(namesList(['A', 'B', 'C', 'D'])).toBe('A, B, C and D');
  });

  it('says what goes to the listed providers, and why', () => {
    expect(CONSENT_COPY.listed(['DeepSeek', 'Retell AI'])).toBe(
      'Auto answers using AI models from DeepSeek and Retell AI. What you send to Auto and your agents — messages, answers, notes and attachments — goes to them so they can reply.',
    );
  });

  it('for an unlisted server names no provider, and says the server does not list them', () => {
    expect(CONSENT_COPY.unlisted).toBe(
      'Auto answers using AI models from the AI providers this workspace uses, for chat and, where it is available, Auto Live voice. What you send to Auto and your agents — messages, answers, notes and attachments — goes to them so they can reply.',
    );
    expect(CONSENT_COPY.unlistedNote).toBe("This server doesn't list them yet.");
  });

  it('names no plan, price or credit, and claims nothing broader than what goes where (D8, KC16)', () => {
    const copy = [CONSENT_COPY.listed(['A']), CONSENT_COPY.unlisted, CONSENT_COPY.unlistedNote];
    for (const line of copy) {
      expect(line).not.toMatch(/credits?|pricing|price|upgrade|subscription|plan\b/i);
      expect(line).not.toMatch(/never leaves|nothing leaves|stays? (on|in) your/i);
    }
  });
});
