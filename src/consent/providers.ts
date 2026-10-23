// The AI providers this workspace's data goes to (D23, KC11): the bootstrap's ai_providers
// [{id, name}] (GET /api/workspaces/current, automatos-ai services/ai_providers.py, PRD-266 US-017),
// read for the consent sheet. Every entry the server lists is kept, Retell for Auto Live voice
// included: nothing is filtered by kind, capability or plan, and every name is the server's own.
// A server before W3 sends no field (and one whose list could not be read sends null, which the
// foundation's schema reads as absent): 'unlisted', whose copy names no provider. An empty list
// means nothing goes to an AI provider: 'none', no sheet. Pure.

import type { Workspace } from '../api/workspace';

export type AiProvider = { readonly id: string; readonly name: string };

export type ConsentProviders =
  /** The server's list, each id once, sorted by name. */
  | { readonly kind: 'listed'; readonly providers: readonly AiProvider[] }
  /** The server does not list its providers (absent field): the unlisted copy. */
  | { readonly kind: 'unlisted' }
  /** The server lists none: nothing to agree to. */
  | { readonly kind: 'none' };

const UNLISTED: ConsentProviders = Object.freeze({ kind: 'unlisted' });
const NONE: ConsentProviders = Object.freeze({ kind: 'none' });

/** The name as sent, trimmed; a blank one shows the server's id for it (never a made-up name). */
function displayed(provider: AiProvider): AiProvider {
  return Object.freeze({ id: provider.id, name: provider.name.trim() || provider.id });
}

/** The first entry of each id, in the server's order. */
function dedupedById(providers: readonly AiProvider[]): readonly AiProvider[] {
  const seen = new Set<string>();
  return providers.filter((provider) => {
    if (seen.has(provider.id)) return false;
    seen.add(provider.id);
    return true;
  });
}

/** By name, case-insensitively, then by id: the same order on every phone. */
function byName(a: AiProvider, b: AiProvider): number {
  const left = a.name.toLowerCase();
  const right = b.name.toLowerCase();
  if (left !== right) return left < right ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

export function providersFrom(workspace: Pick<Workspace, 'ai_providers'>): ConsentProviders {
  const listed = workspace.ai_providers;
  if (listed === undefined) return UNLISTED;
  if (listed.length === 0) return NONE;
  const providers = [...dedupedById(listed)].map(displayed).sort(byName);
  return Object.freeze({ kind: 'listed', providers: Object.freeze(providers) });
}

/** The names the sheet shows, in its order; none for an unlisted server. */
export function providerNames(providers: ConsentProviders): readonly string[] {
  return providers.kind === 'listed' ? providers.providers.map((provider) => provider.name) : [];
}
