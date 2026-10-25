// Play's look page 'Make it yours' (US-017e, D55, 'Automatos Play Looks.dc.html' laid out for the
// phone): the page is Play in the look being edited (StyleScope), whatever style the phone is on —
// the heading 'Make it yours.' in the look's display face (the hero slot), the lead and the status
// line ('Ember · edited'); what the look sync says when the looks stay on the phone; the live
// preview; the looks row; the knobs; Save as new look and Reset; and the sheet a long press on a
// saved look opens. Every change goes to the style store at once, so Play repaints everywhere,
// and the look sync sends it (US-017d; the route mounts StyleSync).

import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useGoBack } from '../../../navigation/use-go-back';
import { IconButton, Screen, Text } from '../../../ui';
import { STYLE_SCREENS } from '../../nav';
import { StyleScope } from '../../provider/StyleScope';
import { LOOK_SYNC_COPY, PLAY_LOOK_COPY } from '../../strings';
import { useLookSyncNotice, useLookSyncStatus } from '../../sync/LookSync';
import { useCompanionPaint } from '../companion/use-companion';
import { looksRow, statusLine, syncLine } from '../look-page';
import { KnobSections } from './KnobSections';
import { LOOK_PAGE } from './knobs';
import { LookActions } from './LookActions';
import { LookPreview, PLAY_CHOICE } from './LookPreview';
import { LookSheet } from './LookSheet';
import { LooksRow } from './LooksRow';
import { PREVIEW_STATE } from './preview';
import { useHeldLook, useLookPage } from './use-look-page';

const LEAD_SIZE = 15;
const STATUS_SIZE = 12;
const NOTICE_SIZE = 13;

function Heading({ status }: { readonly status: string }) {
  const goBack = useGoBack(STYLE_SCREENS.settingsStyle);
  const paint = useCompanionPaint();
  if (!paint) return null;
  const { vars, style } = paint;
  const { spacing } = style.tokens;
  return (
    <View style={{ gap: spacing.space5 }}>
      <View style={[styles.row, styles.between]}>
        <IconButton icon={ChevronLeft} accessibilityLabel={PLAY_LOOK_COPY.back} onPress={goBack} />
        <Text
          accessibilityLiveRegion="polite"
          style={[style.type.mono(STATUS_SIZE), styles.shrink, { color: vars.groundText2 }]}
        >
          {status}
        </Text>
      </View>
      <View style={{ gap: spacing.space3 }}>
        <Text
          accessibilityRole="header"
          style={[style.type.display('hero'), { color: vars.groundText }]}
        >
          {PLAY_LOOK_COPY.heading}
        </Text>
        <Text style={[style.type.body(LEAD_SIZE), { color: vars.groundText2 }]}>
          {PLAY_LOOK_COPY.lead}
        </Text>
      </View>
    </View>
  );
}

/** 'Kept on this phone only' and why, while Play is not installed; a failed sync's own words. */
function SyncNotice() {
  const line = syncLine(
    useLookSyncStatus('play'),
    useLookSyncNotice('play'),
    LOOK_SYNC_COPY.localOnly,
  );
  const paint = useCompanionPaint();
  if (!paint || line === null) return null;
  const { vars, style } = paint;
  return (
    <View accessible style={{ gap: style.tokens.spacing.space1 }}>
      {line.title === null ? null : (
        <Text style={[style.type.body(NOTICE_SIZE, 600), { color: vars.groundText }]}>
          {line.title}
        </Text>
      )}
      <Text style={[style.type.body(NOTICE_SIZE), { color: vars.groundText2 }]}>
        {line.reason}
      </Text>
    </View>
  );
}

export function PlayLookPage() {
  const page = useLookPage();
  const { looks } = page;
  const [holding, setHolding] = useState<string | null>(null);
  const held = useHeldLook(looks, holding);
  const sheet = { ...page, activeId: looks.active.id };
  return (
    <StyleScope choice={PLAY_CHOICE} look={looks.active}>
      <Screen scroll padding="space9" autoState={PREVIEW_STATE}>
        <View style={styles.page}>
          <Heading status={statusLine(looks)} />
          <SyncNotice />
          <LookPreview look={looks.active} />
          <LooksRow items={looksRow(looks)} onPick={page.pick} onHold={setHolding} />
          <KnobSections look={looks.active} onChange={page.change} />
          <LookActions
            onSaveAs={page.saveAsNew}
            onReset={page.reset}
            canReset={page.canReset}
            problem={page.problem}
          />
        </View>
      </Screen>
      <LookSheet look={held} onClose={() => setHolding(null)} actions={sheet} />
    </StyleScope>
  );
}

const styles = StyleSheet.create({
  page: { gap: LOOK_PAGE.pageGap },
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { justifyContent: 'space-between' },
  shrink: { flexShrink: 1, textAlign: 'right' },
});
