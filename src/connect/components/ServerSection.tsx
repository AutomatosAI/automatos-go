// Settings → Account's server section (US-006h, PRD-001 §4.5 server switch): the server's name, its
// address (with the unencrypted home network line while it is http) and the edition in words. Its
// way out: on a paired own server 'Remove this phone and forget this server', asked first
// (ForgetServer, US-006i); on the hosted server the shell's Sign out. Either way the gate then opens Welcome. Nothing here deletes an
// account or a workspace (D63). The words are edges.ts serverSectionView's.

import { View } from 'react-native';

import type { Server } from '../../api/server';
import { SHELL_COPY } from '../../app-state/strings';
import { useSignOut } from '../../app-state/use-sign-out';
import { usePushSignOut } from '../../push/bind/use-push-sign-out';
import { useTokens } from '../../styles/theme';
import { Button, Card, Divider, Text } from '../../ui';
import { ownServer } from '../current-server';
import { serverSectionView } from '../edges';
import { SERVER_SECTION_COPY } from '../strings';
import { useCurrentServer } from '../use-current-server';
import { ForgetServer } from './ForgetServer';
import { InsecureNetworkBanner } from './InsecureNetworkBanner';

const NAME_LEVEL = 3;
const VALUE_LEVEL = 2;

function Row({ label, value }: { readonly label: string; readonly value: string }) {
  const { spacing } = useTokens();
  return (
    <View
      style={{ gap: spacing.space1, paddingVertical: spacing.space3 }}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text variant="eyebrow">{label}</Text>
      <Text level={VALUE_LEVEL} selectable>
        {value}
      </Text>
    </View>
  );
}

function SignOutButton() {
  const pushSignOut = usePushSignOut(useSignOut());
  const { signOut, busy } = pushSignOut;
  return <Button label={SHELL_COPY.signOut} variant="outline" onPress={signOut} busy={busy} />;
}

export type ServerSectionProps = {
  readonly server: Server;
  /** The discovery document's edition, as the server sends it. */
  readonly edition: string;
};

export function ServerSection({ server, edition }: ServerSectionProps) {
  const { spacing } = useTokens();
  const own = ownServer(useCurrentServer());
  const view = serverSectionView({ server, own, edition });
  return (
    <View style={{ gap: spacing.space3 }}>
      <Text variant="eyebrow" accessibilityRole="header">
        {SERVER_SECTION_COPY.eyebrow}
      </Text>
      <Card>
        <Text variant="title" level={NAME_LEVEL} style={{ paddingTop: spacing.space3 }}>
          {view.name}
        </Text>
        <Row label={SERVER_SECTION_COPY.address} value={view.address} />
        <InsecureNetworkBanner origin={server.apiUrl} />
        <Divider />
        <Row label={SERVER_SECTION_COPY.edition} value={view.edition} />
      </Card>
      {view.forgetQuestion ? <ForgetServer question={view.forgetQuestion} /> : <SignOutButton />}
    </View>
  );
}
