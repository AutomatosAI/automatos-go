// User-facing copy for the app shell: the gate's states, the placeholders the kits replace, the
// lost-link screen and the Account stub (one strings module per feature). Nothing about plans,
// credits or prices (D8), and nothing that deletes anything (D63).

import type { WorkspaceRole } from '../api/workspace';

export const SHELL_COPY = Object.freeze({
  /** A build made without EXPO_PUBLIC_API_URL. */
  notConfiguredTitle: 'No server is set up in this build',
  notConfiguredMessage:
    "This build of Automatos Go was made without its server address, so it can't connect.",
  connecting: 'Opening your workspace…',
  /** The server offers no sign-in this version has (its words are AUTH_COPY.unsupportedServer). */
  unsupportedMessage: 'Update Automatos Go to the latest version, then open it again.',
  pausedTitle: 'Workspace paused',
  discoveryErrorTitle: "Couldn't reach Automatos",
  workspaceErrorTitle: "Couldn't open your workspace",
  signOut: 'Sign out',
});

/** Placeholder screens the owning kits replace (K5): home → A2, the Command Centre → A3. */
export const PLACEHOLDER_COPY = Object.freeze({
  homeTitle: 'Auto',
  homeMessage: 'Your conversation with Auto will be here.',
  ccTitle: 'Command Centre',
  ccMessage: 'The Board, Calendar, Questions and Deliverables will be here.',
  openCommandCentre: 'Command Centre',
  openSettings: 'Settings',
  back: 'Back',
});

/** An app link with no screen (app/+not-found.tsx). */
export const NOT_FOUND_COPY = Object.freeze({
  title: "This page isn't in Automatos Go",
  message: 'The link may be for Studio on the web, or for a newer version of the app.',
  home: 'Go home',
});

export const ACCOUNT_COPY = Object.freeze({
  eyebrow: 'Settings',
  title: 'Account',
  server: 'Server',
  edition: 'Edition',
  workspace: 'Workspace',
  role: 'Role',
  version: 'App version',
  /** No version in the build's config (a development build without app.json's version). */
  unknownVersion: 'Unknown',
  back: 'Back',
});

/** The discovery document's edition, in words; any other edition is shown as the server sent it. */
export const EDITION_LABELS: Readonly<Record<string, string>> = Object.freeze({
  saas: 'Automatos cloud',
  local: 'Self-hosted',
});

export const ROLE_LABELS: Readonly<Record<WorkspaceRole, string>> = Object.freeze({
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
});
