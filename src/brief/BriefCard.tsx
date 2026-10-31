// The brief card (PRD-268 §6.12.3 'Brief card', §6.12.5, US-G06): the date, the greeting, Auto's Read
// and the sections (§6.11.2) with title + why rows, the row's action as text ('Start →'), and 'Show
// N more' past the fold. Studio draws it as Auto's box in the thread (D72: StudioBriefCard, in Auto's
// column under the sail avatar); Play as a card on the ground's surface at the head of the day in
// PlayThread (PlayBriefCard), dressed by the primitives. Both draw the same body from model.ts: the
// needs-you count is the strip's, a row with nowhere to go draws no action, a row pressed says its
// done words in place, and each action names its row to VoiceOver ('Start: Lisbon flights'). The
// prose is the text part's own words, so the text is never drawn a second time. A suggestion row
// offers Start (src/suggestions' Start, Face ID first) and says '✓ {done_label}' in place once it
// went through. The foot is Listen and the thumbs (BriefFooter.tsx). The card enters once
// (motion.ts); Auto's words are the server's, in the person's language.

import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { StateMark } from '../cc/status/StatusLine';
import { bubbleStyle } from '../chat/components/thread-look';
import { Markdown } from '../chat/markdown/Markdown';
import type { WebLinkTarget } from '../navigation/web-links';
import { useTokens } from '../styles/theme';
import { SUGGESTION_COPY } from '../suggestions/strings';
import { Button, Card, Text } from '../ui';
import { BriefFooter } from './BriefFooter';
import { sectionHeading, type BriefRowView, type BriefSectionView } from './model';
import { BRIEF_ENTRANCE, briefEntrance, briefKey, createSightings } from './motion';
import type { Brief } from './schema';
import { BRIEF_COPY } from './strings';
import { useBriefCard, type BriefCardState } from './use-brief-view';

const sightings = createSightings();

const ENTRANCES = Object.freeze({
  rise: FadeInDown.duration(BRIEF_ENTRANCE.durationMs).withInitialValues({
    transform: [{ translateY: BRIEF_ENTRANCE.risePt }],
  }),
  fade: FadeIn.duration(BRIEF_ENTRANCE.durationMs),
});

type RowProps = {
  readonly view: BriefRowView;
  readonly card: BriefCardState;
};

/** A suggestion row's Start: Face ID first, then '✓ {done_label}' in place; a refusal is one line. */
function StartAction({ view, card }: RowProps) {
  const label = view.row.action?.label;
  if (!view.start || !label || !card.canStart) return null;
  const refusal = card.refusal(view);
  return (
    <View style={{ alignSelf: 'flex-start' }}>
      <Button
        label={BRIEF_COPY.action(label)}
        variant="ghost"
        size="sm"
        busy={card.starting(view)}
        onPress={() => card.press(view)}
        accessibilityLabel={view.start.startLabel}
        accessibilityHint={SUGGESTION_COPY.startHint}
      />
      {refusal ? (
        <Text level={5} tone="warning" accessibilityLiveRegion="polite">
          {refusal}
        </Text>
      ) : null}
    </View>
  );
}

/** A row's link: where briefTarget says it goes. */
function LinkAction({ view, card }: RowProps) {
  if (!view.actionLabel || !view.target) return null;
  return (
    <View style={{ alignSelf: 'flex-start' }}>
      <Button
        label={BRIEF_COPY.action(view.actionLabel)}
        variant="ghost"
        size="sm"
        onPress={() => card.press(view)}
        accessibilityLabel={view.actionAccessibilityLabel ?? undefined}
        accessibilityHint={'external' in view.target ? BRIEF_COPY.opensStudio : undefined}
      />
    </View>
  );
}

function RowAction({ view, card }: RowProps) {
  const done = card.doneWords(view);
  if (done) {
    return (
      <Text level={5} tone="success">
        {BRIEF_COPY.done(done)}
      </Text>
    );
  }
  if (view.start) return <StartAction view={view} card={card} />;
  return <LinkAction view={view} card={card} />;
}

function BriefRowLine({ view, card }: RowProps) {
  const { spacing } = useTokens();
  const { row } = view;
  const lead = [row.at, row.number].filter(Boolean).join(' · ');
  return (
    <View style={{ gap: spacing.space1, paddingVertical: spacing.space2 }}>
      {lead ? (
        <Text variant="mono" tone="muted">
          {lead}
        </Text>
      ) : null}
      <Text variant="title" level={6} selectable>
        {row.title}
      </Text>
      {row.why ? (
        <Text level={5} tone="muted" selectable>
          {row.why}
        </Text>
      ) : null}
      {row.display_state ? <StateMark state={row.display_state} /> : null}
      <RowAction view={view} card={card} />
    </View>
  );
}

type SectionProps = { readonly section: BriefSectionView; readonly card: BriefCardState };

function BriefSection({ section, card }: SectionProps) {
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
        <BriefRowLine key={view.key} view={view} card={card} />
      ))}
      {more > 0 ? (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            label={BRIEF_COPY.showMore(more)}
            variant="ghost"
            size="sm"
            onPress={() => card.unfold(section.name)}
            accessibilityLabel={BRIEF_COPY.showMoreLabel(more, section.label)}
          />
        </View>
      ) : null}
    </View>
  );
}

export type BriefCardProps = {
  readonly brief: Brief;
  readonly onLink: (target: WebLinkTarget) => void;
};

/** The card's body without its frame or entrance: Arcade's OPEN BRIEF sheet frames it in a window. */
export function BriefBody({ brief, onLink }: BriefCardProps) {
  const { spacing } = useTokens();
  const card = useBriefCard(brief, onLink);
  const { view } = card;
  return (
    <View style={{ gap: spacing.space5 }}>
      <View style={{ gap: spacing.space1 }}>
        <Text variant="eyebrow">{BRIEF_COPY.eyebrow(view.dateLabel)}</Text>
        {view.greeting ? (
          <Text variant="title" level={3} accessibilityRole="header" selectable>
            {view.greeting}
          </Text>
        ) : null}
      </View>
      {view.prose ? <Markdown text={view.prose} onLink={onLink} /> : null}
      {view.sections.map((section) => (
        <BriefSection key={section.name} section={section} card={card} />
      ))}
      {view.empty ? <Text tone="muted">{view.empty}</Text> : null}
      {/* a new brief starts its own thumbs and its own reading */}
      <BriefFooter key={brief.state_hash} brief={brief} />
    </View>
  );
}

/** The card's one entrance, the first time this brief is drawn in this launch. */
function Entrance({ brief, children }: { readonly brief: Brief; readonly children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const [firstTime] = useState(() => sightings.first(briefKey(brief)));
  const entrance = briefEntrance(firstTime, reduceMotion);
  if (entrance === null) return <View>{children}</View>;
  return <Animated.View entering={ENTRANCES[entrance]}>{children}</Animated.View>;
}

/** Studio (and Classic, and every skin): Auto's box in the thread (D72). */
export function StudioBriefCard(props: BriefCardProps) {
  const tokens = useTokens();
  return (
    <Entrance brief={props.brief}>
      <View style={bubbleStyle(tokens, 'auto')}>
        <BriefBody {...props} />
      </View>
    </Entrance>
  );
}

/** Play: a card on the ground's surface, dressed by the primitives (14 pt corners). */
export function PlayBriefCard(props: BriefCardProps) {
  return (
    <Entrance brief={props.brief}>
      <Card padding="space6" radius="panel">
        <BriefBody {...props} />
      </Card>
    </Entrance>
  );
}
