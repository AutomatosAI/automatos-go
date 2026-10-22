// Opens a link the foundation's appRouteForWebLink mapped (D-NO-WEBVIEW): an app route through
// expo-router, a Studio page in the system browser. The mapping is the foundation's; only the
// opening is here, because nothing in src/navigation opens a WebLinkTarget.

import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Linking } from 'react-native';

import { logger } from '../../lib/logger';
import type { WebLinkTarget } from '../../navigation/web-links';

export type FollowLink = (target: WebLinkTarget) => void;

export function useFollowLink(): FollowLink {
  const router = useRouter();
  return useCallback(
    (target: WebLinkTarget) => {
      if ('app' in target) {
        router.push(target.app);
        return;
      }
      Linking.openURL(target.external).catch((error: unknown) => {
        logger.warn('[chat] the system browser did not open a Studio link', error);
      });
    },
    [router],
  );
}
