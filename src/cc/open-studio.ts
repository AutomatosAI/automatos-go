// A Studio page in the system browser (D-NO-WEBVIEW): the foundation's web-links.ts resolves the
// page (studioUrl, appRouteForWebLink's {external}) but has no opener, so this wave hands the URL to
// React Native's Linking, which leaves the app for Safari (never an in-app view). The caller shows
// a failure in its own words; nothing is retried.

import { Linking } from 'react-native';

import { logger } from '../lib/logger';

/** Open the page; false when the phone could not. */
export async function openInBrowser(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch (error) {
    logger.warn('[cc] the system browser could not open a Studio page', error);
    return false;
  }
}
