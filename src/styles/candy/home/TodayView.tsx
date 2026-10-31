// P1 Today (PRD-001 §4.6.2 D-CAN-6, US-023g; CANDY-LAYOUT §4 P1 and the 390 mock), over today.ts:
// the band 440 tall behind the top of the view, then a column 20 in from each side, 18 apart: the
// header at the top inset + 8 — the greeting (Outfit 600 28), needs-you's total in words under it
// (Nunito 700 14, the band's quiet text; hidden until needs-you answers), Auto at 56 in the turn's
// state (or the voice's) and the home menu circle — with 'Ideas · N' (PRD-268 US-G01, where
// discovery lists `suggestions` and one is open), the pause control and the EN/PT switch under it;
// the orb (200, needs-you's number, 'need you'); the stat cards; the Needs you window. Auto
// floats and the orb's arc turns, so the pause control is drawn here (D-CAN-5, WCAG 2.2.2). The
// column scrolls when Dynamic Type leaves it no room, and its foot clears the floating tab bar.

import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '../../../ui';
import type { CandyToday } from '../../homes/use-candy-home';
import type { HudLanguage } from '../../hud/core/model';
import { CandyAuto } from '../auto/CandyAuto';
import { stageLabel, type Stage } from '../auto/stage';
import { CandyPauseButton } from '../CandyPauseButton';
import { Band } from '../parts/Band';
import { Orb } from '../parts/Orb';
import { PAGE_GUTTER } from '../parts/orb-model';
import { useCandyPaint } from '../parts/use-candy-paint';
import { CANDY_TODAY_COPY } from '../strings';
import { HeaderPill } from './HeaderPill';
import { LanguagePill } from './LanguagePill';
import { MenuCircle, type MenuCircleProps } from './MenuCircle';
import { NeedsWindow } from './NeedsWindow';
import { StatCards } from './StatCards';
import type { HeaderPillView } from './today';

/** The design's measures: the band, the header under the top inset, Auto, and the gaps. */
const TODAY = Object.freeze({ band: 440, top: 8, auto: 56, gap: 18, headerGap: 12, controlGap: 8 });

export type TodayViewProps = {
  readonly today: CandyToday;
  /** Auto's stage: the turn's state, or the voice's while it works (stageOf). */
  readonly stage: Stage;
  readonly menu: MenuCircleProps;
  /** The EN/PT switch for someone who may talk. */
  readonly language?: HudLanguage;
  /** 'Ideas · N', opening the sheet of Auto's suggestions (today.ts ideasPill); none, nothing. */
  readonly ideas?: HeaderPillView | null;
  /** The room the floating tab bar takes at the view's foot. */
  readonly footRoom: number;
};

type HeaderProps = Pick<TodayViewProps, 'today' | 'stage' | 'menu' | 'language' | 'ideas'>;

function TodayHeader({ today, stage, menu, language, ideas }: HeaderProps) {
  const { vars, type } = useCandyPaint();
  return (
    <View style={styles.headerBlock}>
      <View style={styles.header}>
        <View style={styles.words}>
          <Text accessibilityRole="header" style={[type.display('hero'), { color: vars.text }]}>
            {today.greeting}
          </Text>
          {today.needsLine === null ? null : (
            <Text style={[type.label, { color: vars.bandQuiet }]}>{today.needsLine}</Text>
          )}
        </View>
        <CandyAuto state={stage.state} size={TODAY.auto} label={stageLabel(stage)} />
        <MenuCircle {...menu} />
      </View>
      <View style={styles.controls}>
        {ideas ? <HeaderPill {...ideas} /> : null}
        <CandyPauseButton />
        {language ? <LanguagePill language={language} /> : null}
      </View>
    </View>
  );
}

export function TodayView({ today, stage, menu, language, ideas, footRoom }: TodayViewProps) {
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: insets.top + TODAY.top, paddingBottom: footRoom };
  return (
    <ScrollView
      style={styles.view}
      contentContainerStyle={[styles.column, pad]}
      keyboardShouldPersistTaps="handled"
    >
      <Band height={TODAY.band} />
      <TodayHeader today={today} stage={stage} menu={menu} language={language} ideas={ideas} />
      <View style={styles.orb}>
        <Orb figure={today.figure} caption={CANDY_TODAY_COPY.orbCaption} />
      </View>
      <StatCards cards={today.cards} />
      <NeedsWindow rows={today.rows} onOpen={today.openRow} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  view: { flex: 1 },
  column: { flexGrow: 1, paddingHorizontal: PAGE_GUTTER, gap: TODAY.gap },
  headerBlock: { gap: TODAY.controlGap },
  header: { flexDirection: 'row', alignItems: 'center', gap: TODAY.headerGap },
  words: { flex: 1 },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: TODAY.controlGap,
  },
  orb: { alignItems: 'center' },
});
