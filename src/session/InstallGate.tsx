// The root layout's first gate (KC9): nothing under it renders until this launch's reinstall check is
// done (install-gate.ts), so ClerkProvider's token cache, the encrypted store (the theme, the query
// cache) and the paired record are read only after a new install's leftovers are deleted. The
// check is a few keychain calls; until then the root renders nothing.

import { useEffect, useState, type ReactNode } from 'react';

import { installGate } from './install-gate';

export function InstallGate({ children }: { readonly children: ReactNode }) {
  const [ready, setReady] = useState(installGate.isReady);
  useEffect(() => {
    if (ready) return undefined;
    let mounted = true;
    void installGate.ready().then(() => {
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, [ready]);
  return ready ? <>{children}</> : null;
}
