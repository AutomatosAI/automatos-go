// The AI-provider consent sheet (US-007c; D23, KC11): the gate's consent step, shown in place of
// every (app) screen until this person agrees (app/(app)/_layout.tsx hands it to the gate). The
// foundation's AI label (one muted caption line), 'Before you talk to Auto', the sentence of what
// goes to the providers, every provider the server lists by name (or the unlisted note), 'Agree
// and continue' and ONE way out: Sign out (hosted) or Forget this server, asked first (own). No
// 'Not now'. Thin wiring: sheet.ts decides the words, use-consent.ts the step.

import { StyleSheet, View } from 'react-native';

import { serverLabel } from '../app-state/account';
import { GateLoading } from '../app-state/GateStates';
import { useAppSession } from '../app-state/session';
import { useSignOut } from '../app-state/use-sign-out';
import { ForgetServer } from '../connect/components/ForgetServer';
import { ownServer } from '../connect/current-server';
import { ownServerInWords } from '../connect/edges';
import { useCurrentServer } from '../connect/use-current-server';
import { AiLabel } from '../styles/ai-label';
import { useTokens } from '../styles/theme';
import { Button, Card, Divider, Screen, Text } from '../ui';
import { consentSheetView, type ConsentLeave } from './sheet';
import { CONSENT_SHEET_COPY } from './strings';
import { useConsent } from './use-consent';

const HEADING_LEVEL = 1;
const BODY_LEVEL = 1;
const NAME_LEVEL = 2;
const NOTE_LEVEL = 3;

function ProviderList({ names }: { readonly names: readonly string[] }) {
  const { spacing } = useTokens();
  return (
    <View style={{ gap: spacing.space3 }}>
      <Text variant="eyebrow" accessibilityRole="header">
        {CONSENT_SHEET_COPY.providersLabel}
      </Text>
      <Card padding="space6">
        <View accessibilityRole="list">
          {names.map((name, index) => (
            <View key={`${index}:${name}`}>
              {index > 0 ? <Divider /> : null}
              <Text level={NAME_LEVEL} style={{ paddingVertical: spacing.space3 }}>
                {name}
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

function SignOutButton({ label }: { readonly label: string }) {
  const { signOut, busy } = useSignOut();
  return <Button label={label} onPress={signOut} busy={busy} variant="ghost" fullWidth />;
}

function Leave({ leave }: { readonly leave: ConsentLeave }) {
  if (leave.action === 'forget_server') {
    return <ForgetServer question={leave.question} variant="ghost" fullWidth />;
  }
  return <SignOutButton label={leave.label} />;
}

export function ConsentSheet() {
  const { spacing } = useTokens();
  const { server } = useAppSession();
  const own = ownServer(useCurrentServer());
  const { needed, providers, agree } = useConsent();
  // the gate leaves this step on the same change; until it does, nothing to agree to
  if (!needed) return <GateLoading />;
  const view = consentSheetView({
    providers,
    source: server.source,
    serverName: own ? ownServerInWords(own) : serverLabel(server),
  });
  return (
    <Screen scroll padding="space9">
      <View style={[styles.content, { gap: spacing.space9 }]}>
        <View style={{ gap: spacing.space5 }}>
          <AiLabel />
          <Text variant="title" level={HEADING_LEVEL} accessibilityRole="header">
            {view.heading}
          </Text>
          <Text level={BODY_LEVEL}>{view.body}</Text>
        </View>
        {view.providers.length > 0 ? <ProviderList names={view.providers} /> : null}
        {view.note ? (
          <Text level={NOTE_LEVEL} tone="muted">
            {view.note}
          </Text>
        ) : null}
        <View style={{ gap: spacing.space3 }}>
          <Button
            label={view.agree}
            onPress={agree}
            accessibilityHint={CONSENT_SHEET_COPY.agreeHint}
            fullWidth
          />
          <Leave leave={view.leave} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center' },
});
