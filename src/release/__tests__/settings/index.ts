// The app's audit settings (docs/app-standard.md rule 14.2): everything the release audits read
// that differs from one app to the next, in one folder, one file per topic. The audits hold the
// rules (what a store requires, the patterns they search for, the store's own words); this folder
// holds who the app is, the folders they walk, the palettes and pairs the contrast test measures,
// and each audit's allowed list under that audit's name, every entry with its reason. A copy of
// the template edits these files and no audit. audit-settings.test.ts holds them.
//
// Each audit imports the topic file it needs, not this index, so an audit loads only its own.

import * as a11yAudit from './a11y-audit';
import * as contrast from './contrast';
import * as dependencyAudit from './dependency-audit';
import * as namedStates from './named-states';
import * as permissions from './permissions';
import * as releaseDocs from './release-docs';
import * as releaseLicences from './release-licences';
import * as secureStoreAudit from './secure-store-audit';
import * as storeCopy from './store-copy';
import * as surfaces from './surfaces';
import * as textTones from './text-tones';
import { frozen, type Reasoned } from './types';
import * as uploadAudit from './upload-audit';

export { APP_IDENTITY } from './identity';
export { APP_RECORD, type AppRole } from './record';
export { AUDIT_TREE, type AuditTree } from './tree';

/** One allowed list: the audit that reads it, its name, and its entries or its one reason. */
export type AllowedList = Readonly<{
  audit: string;
  name: string;
  entries: readonly unknown[];
  /** A list of plain entries (names, paths) gives one reason for all of them. */
  reason?: string;
}>;

const each = (audit: string, name: string, entries: readonly unknown[]): AllowedList =>
  frozen({ audit, name, entries });

const plain = (audit: string, name: string, list: Reasoned<unknown>): AllowedList =>
  frozen({ audit, name, entries: list.entries, reason: list.reason });

/**
 * Every allowed list an audit reads: the exceptions to its rule, KNOWN's pairs under AA among
 * them. Data that is not an exception (this app's named states and review labels, the store rules
 * app.json is pinned to, the contrast pairs) is in its settings file too, and needs no reason.
 */
export const ALLOWED_LISTS: readonly AllowedList[] = frozen([
  each('a11y-audit', 'ALLOWED', a11yAudit.ALLOWED),
  each('text-tones', 'ALLOWED', textTones.ALLOWED),
  each('store-copy', 'ALLOWED', storeCopy.ALLOWED),
  each('release-docs', 'ALLOWED_AGES', releaseDocs.ALLOWED_AGES),
  each('surfaces', 'SEND_SURFACES', surfaces.SEND_SURFACES),
  each('surfaces', 'REPORT_MOUNTS', surfaces.REPORT_MOUNTS),
  each(
    'surfaces',
    'AUTO_MESSAGES',
    Object.values(surfaces.AUTO_MESSAGES).filter((messages) => messages.kind !== 'report'),
  ),
  each('upload-audit', 'UPLOAD_PATHS', uploadAudit.UPLOAD_PATHS),
  plain('secure-store-audit', 'ADAPTER_FILES', secureStoreAudit.ADAPTER_FILES),
  plain('secure-store-audit', 'WRITE_OPTION_NAMES', secureStoreAudit.WRITE_OPTION_NAMES),
  each('secure-store-audit', 'FORWARDERS', secureStoreAudit.FORWARDERS),
  each('secure-store-audit', 'PORT_WRITES', secureStoreAudit.PORT_WRITES),
  each('named-states', 'OWED', namedStates.OWED),
  each('contrast', 'KNOWN', contrast.KNOWN),
  plain('dependency-audit', 'ALLOWED_WEB_VIEW_MENTIONS', dependencyAudit.ALLOWED_WEB_VIEW_MENTIONS),
  plain('release-licences', 'LICENCE_IDS', releaseLicences.LICENCE_IDS),
  each('release-licences', 'NO_LICENCE_ALLOWED', releaseLicences.NO_LICENCE_ALLOWED),
  plain('permissions', 'PICKER_CALLERS', permissions.PICKER_CALLERS),
]);
