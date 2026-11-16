// The dependency audit's allowed list (dependency-audit.test.ts, rule 13.8): the installed packages
// that name a web view, each as the audit reads it, with the reason they may.

import { reasoned } from './types';

export const ALLOWED_WEB_VIEW_MENTIONS = reasoned(
  "expo names both as optional peers, for its DOM components, which the lint refuses ('use dom', expo/dom, @expo/dom-webview): npm never installs an optional peer, and nothing here imports one.",
  [
    'node_modules/expo optional peer react-native-webview',
    'node_modules/expo optional peer @expo/dom-webview',
  ],
);
