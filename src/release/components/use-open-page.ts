// Opens one of the public pages (legal-links.ts) in the system browser, never in the app
// (D-NO-WEBVIEW). The foundation's web-links.ts only resolves {external} targets; the app's opener
// that reports a failure is the Command Centre's openInBrowser (React Native's Linking → Safari), so
// this wave uses it and says in a toast when the browser did not open.

import { useCallback } from 'react';

import { openInBrowser } from '../../cc/open-studio';
import { useToast } from '../../ui';
import { PRIVACY_COPY } from '../strings';

export type OpenPage = (url: string) => void;

export function useOpenPage(): OpenPage {
  const toast = useToast();
  return useCallback(
    (url: string) => {
      void openInBrowser(url).then((opened) => {
        if (!opened) toast.show(PRIVACY_COPY.linkFailed);
      });
    },
    [toast],
  );
}
