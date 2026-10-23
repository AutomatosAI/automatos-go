// A pairing link opened on this phone (US-006g; KC8, KC13): https://<host>/go/pair?api=…&code=… or
// automatos://go/pair?…, from app/go/pair.tsx. Its params are untrusted text: parsePairLink reads
// them, and the link's own host is never contacted. Connected nowhere, it opens Connect prefilled;
// on a phone that already uses a server (its own, or the hosted one it is signed in to) it first
// asks 'You're connected to {current}. Connect to {new} instead?' and changes nothing without the
// yes, which opens Connect here, told the question was answered (Connect would otherwise ask it
// again). Either way Connect stops at the confirm card, so nothing pairs from a link (KC8). A link to
// the server already in use goes home; an unparsable one says so and goes home or to Welcome.
// Nothing here logs or shows the code. Thin wiring: scan-state.ts decides.

import { Redirect, useRouter } from 'expo-router';
import Link2Off from 'lucide-react-native/icons/link-2-off';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuthSession } from '../../auth/AuthRoot';
import type { RouteParams } from '../../navigation/routes';
import { EmptyState, LoadingState, Screen } from '../../ui';
import { SwitchQuestion } from '../components/SwitchQuestion';
import { hostedServer, ownServer } from '../current-server';
import { pairLinkFromParams, parsePairLink } from '../pair-link';
import { ConnectScreen } from '../screens/ConnectScreen';
import { prefillKey } from '../screens/connect-view';
import { PAIR_LINK_COPY } from '../strings';
import { useCurrentServer } from '../use-current-server';
import { pairLinkIntake, serverInUse, type LinkIntake } from './scan-state';

type AskProps = {
  readonly intake: Extract<LinkIntake, { readonly kind: 'ask' }>;
  readonly onStay: () => void;
};

/**
 * The switch question, then Connect in place for this one link once the person says yes. The yes
 * is this screen's state, keyed to the link it answered: a new link asks again, and no URL can
 * carry it.
 */
function AskThenConnect({ intake, onStay }: AskProps) {
  const [agreed, setAgreed] = useState<string | null>(null);
  const answering = prefillKey(intake.prefill);
  if (agreed === answering) return <ConnectScreen prefill={intake.prefill} switchAnswered />;
  return (
    <SwitchQuestion
      question={intake.question}
      onConnect={() => setAgreed(answering)}
      onStay={onStay}
    />
  );
}

function InvalidLink({
  exit,
  go,
}: {
  readonly exit: string;
  readonly go: (route: string) => void;
}) {
  return (
    <Screen scroll>
      <View style={styles.centre}>
        <EmptyState
          icon={Link2Off}
          title={PAIR_LINK_COPY.invalidTitle}
          message={PAIR_LINK_COPY.invalidMessage}
          action={{ label: PAIR_LINK_COPY.invalidAction, onPress: () => go(exit) }}
        />
      </View>
    </Screen>
  );
}

export function PairLinkScreen({ params }: { readonly params: RouteParams }) {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuthSession();
  const own = ownServer(useCurrentServer());
  const intake = pairLinkIntake({
    link: parsePairLink(pairLinkFromParams(params)),
    isLoaded,
    isSignedIn,
    inUse: serverInUse({ own, hosted: hostedServer(), isSignedIn }),
  });
  // replace, never push: nothing comes back to the link
  const go = (route: string) => router.replace(route);
  switch (intake.kind) {
    case 'loading':
      return (
        <Screen>
          <View style={styles.centre}>
            <LoadingState />
          </View>
        </Screen>
      );
    case 'connect':
      return <Redirect href={intake.connect} />;
    case 'in_use':
      return <Redirect href={intake.exit} />;
    case 'invalid':
      return <InvalidLink exit={intake.exit} go={go} />;
    case 'ask':
      return <AskThenConnect intake={intake} onStay={() => go(intake.stay)} />;
  }
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
