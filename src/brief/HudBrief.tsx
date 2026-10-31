// HUD's brief (PRD-268 §6.12.5, US-G06): HUD draws no thread, so while the day's brief is the newest
// message it fills the transcript slot (HudBriefSlot: the greeting and Auto's Read as plain words, in
// the transcript's faces) with OPEN BRIEF, which opens the foundation's Sheet in HUD's dress
// (HudBriefSheet): one panel headed 'Briefing · <date>', the greeting, then each section with its
// count and its rows, the rows that ask for something numbered 01, 02, … so "start two" is a
// sentence a person can say (§6.12.6). A row's action is '▸ <label>' where it goes somewhere (it
// closes the sheet and opens it, model.ts briefTarget); its words are the server's. A suggestion
// row's '▸ START' starts it in place (Face ID first; the sheet stays for the done words), and the
// panel ends with Listen and the thumbs (BriefFooter.tsx), as every layout's card does. Copy,
// numbers and targets are model.ts's; capitals come from HUD's label face.

import { Pressable, View } from 'react-native';

import { StateMark } from '../cc/status/StatusLine';
import { reportAccessibility } from '../chat/report/report';
import type { WebLinkTarget } from '../navigation/web-links';
import { HUD_CORE } from '../styles/hud/core/model';
import { useVoiceCore } from '../styles/hud/core/use-voice-core';
import { useTokens } from '../styles/theme';
import { Button, Card, Sheet, Text } from '../ui';
import { BriefFooter } from './BriefFooter';
import { sectionHeading, type BriefRowView, type BriefSectionView } from './model';
import type { Brief } from './schema';
import { BRIEF_COPY } from './strings';
import { useBriefCard, type BriefCardState } from './use-brief-view';

const { transcript } = HUD_CORE;

export type HudBriefSlotProps = {
  readonly greeting: string;
  /** Auto's Read as plain words (hud-turn.ts plainText). */
  readonly words: string;
  readonly onOpen: () => void;
  /** Report this on the brief's message (a long-press and the accessible action); absent, none. */
  readonly onReport?: () => void;
};

/** The transcript slot while the brief is the newest message. */
export function HudBriefSlot({ greeting, words, onOpen, onReport }: HudBriefSlotProps) {
  const core = useVoiceCore();
  const { spacing } = useTokens();
  const you = core.style.type.body(transcript.you.size, 400, { leading: transcript.you.leading });
  const auto = core.style.type.body(transcript.auto.size, 400, {
    leading: transcript.auto.leading,
  });
  return (
    <View style={{ gap: spacing.space3 }}>
      {greeting ? (
        <Text accessibilityRole="header" style={[you, { color: core.paint.text2 }]}>
          {greeting}
        </Text>
      ) : null}
      {words ? (
        <Pressable accessible={false} onLongPress={onReport} disabled={!onReport}>
          <Text
            selectable
            style={[auto, { color: core.paint.text }]}
            {...reportAccessibility(onReport)}
          >
            {words}
          </Text>
        </Pressable>
      ) : null}
      <View style={{ alignSelf: 'flex-start' }}>
        <Button
          label={BRIEF_COPY.hud.open}
          accessibilityLabel={BRIEF_COPY.hud.openLabel}
          variant="outline"
          size="sm"
          onPress={onOpen}
        />
      </View>
    </View>
  );
}

type HudRowProps = {
  readonly view: BriefRowView;
  readonly card: BriefCardState;
};

/** A row's '▸ <label>' where it goes somewhere: it closes the sheet, then opens the place. */
function HudLink({ view, card }: HudRowProps) {
  if (!view.actionLabel || !view.target) return null;
  return (
    <View style={{ alignSelf: 'flex-start' }}>
      <Button
        label={BRIEF_COPY.hud.action(view.actionLabel)}
        accessibilityLabel={view.actionAccessibilityLabel ?? undefined}
        variant="ghost"
        size="sm"
        onPress={() => card.press(view)}
      />
    </View>
  );
}

function HudRow({ view, card }: HudRowProps) {
  const { spacing } = useTokens();
  const { row } = view;
  const head = [view.number, row.at, row.title].filter(Boolean).join('  ');
  const done = card.doneWords(view);
  return (
    <View style={{ gap: spacing.space1, paddingVertical: spacing.space2 }}>
      <Text variant="title" level={6} selectable>
        {head}
      </Text>
      {row.why ? (
        <Text level={5} tone="muted" selectable>
          {row.why}
        </Text>
      ) : null}
      {row.display_state ? <StateMark state={row.display_state} /> : null}
      {done ? <Text level={5}>{BRIEF_COPY.done(done)}</Text> : null}
      {done ? null : <HudLink view={view} card={card} />}
      {done ? null : <HudStart view={view} card={card} />}
    </View>
  );
}

/** A suggestion row's '▸ START': Face ID first; the sheet stays open for the done words. */
function HudStart({ view, card }: HudRowProps) {
  const label = view.row.action?.label;
  if (!view.start || !label || !card.canStart) return null;
  const refusal = card.refusal(view);
  return (
    <View style={{ alignSelf: 'flex-start' }}>
      <Button
        label={BRIEF_COPY.hud.action(label)}
        accessibilityLabel={view.start.startLabel}
        variant="ghost"
        size="sm"
        busy={card.starting(view)}
        onPress={() => card.press(view)}
      />
      {refusal ? (
        <Text level={5} tone="warning" accessibilityLiveRegion="polite">
          {refusal}
        </Text>
      ) : null}
    </View>
  );
}

function HudSection({
  section,
  card,
}: {
  readonly section: BriefSectionView;
  readonly card: BriefCardState;
}) {
  const { spacing } = useTokens();
  const open = card.unfolded.has(section.name);
  const rows = open ? [...section.shown, ...section.folded] : section.shown;
  const more = open ? 0 : section.folded.length;
  return (
    <View style={{ gap: spacing.space1 }}>
      <Text
        variant="mono"
        tone={section.name === 'needs_you' ? 'accent' : 'muted'}
        accessibilityRole="header"
      >
        {sectionHeading(section)}
      </Text>
      {rows.map((view) => (
        <HudRow key={view.key} view={view} card={card} />
      ))}
      {more > 0 ? (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            label={BRIEF_COPY.showMore(more)}
            accessibilityLabel={BRIEF_COPY.showMoreLabel(more, section.label)}
            variant="ghost"
            size="sm"
            onPress={() => card.unfold(section.name)}
          />
        </View>
      ) : null}
    </View>
  );
}

export type HudBriefSheetProps = {
  readonly brief: Brief | null;
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onLink: (target: WebLinkTarget) => void;
};

function HudBriefPanel({
  brief,
  onLink,
}: {
  readonly brief: Brief;
  readonly onLink: (target: WebLinkTarget) => void;
}) {
  const { spacing } = useTokens();
  const card = useBriefCard(brief, onLink);
  const { view } = card;
  return (
    <Card padding="space6" selected header={{ label: BRIEF_COPY.hud.head(view.dateLabel) }}>
      <View style={{ gap: spacing.space5 }}>
        {view.greeting ? (
          <Text variant="title" level={4}>
            {view.greeting}
          </Text>
        ) : null}
        {view.sections.map((section) => (
          <HudSection key={section.name} section={section} card={card} />
        ))}
        {view.empty ? <Text tone="muted">{view.empty}</Text> : null}
        {/* a new brief starts its own thumbs and its own reading */}
        <BriefFooter key={brief.state_hash} brief={brief} />
      </View>
    </Card>
  );
}

/** OPEN BRIEF's sheet: a row's action closes it, then opens where the row goes. */
export function HudBriefSheet({ brief, visible, onClose, onLink }: HudBriefSheetProps) {
  const follow = (target: WebLinkTarget) => {
    onClose();
    onLink(target);
  };
  return (
    <Sheet visible={visible && brief !== null} onClose={onClose}>
      {brief ? <HudBriefPanel brief={brief} onLink={follow} /> : null}
    </Sheet>
  );
}
