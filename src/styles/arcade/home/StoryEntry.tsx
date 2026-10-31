// One entry of Arcade's story window (README 'Pages' /chat; the design kit's chat/entries.tsx and
// cards.tsx and the 'Phone 390' log): a line is a speaker or glyph in the label face (YOU in the
// accent, AUTO in the secondary text, ★ in mana blue, ✕ in HP red) beside its words in Pixelify
// Sans, 17 pt as the handheld sets them. Auto's answer is A2's own markdown renderer, and Report
// this long-presses it and is each block's accessible action where A2 offers it. A2's notices
// (with Try again), ticket cards and cards are drawn unchanged; each approval card sits under its
// heading ('! A choice awaits' in the quest colour while it is open). A Deliverable the turn made
// is an ITEM RECEIVED window whose OPEN opens its page. A reply carrying the day's brief that the
// dialogue is not saying (PRD-268 US-G06, D-ARC-7) is a window, '★ Today's brief' and its greeting,
// whose OPEN BRIEF opens the whole brief in the home's sheet (onBrief); Report this stays on it.
// Entries are memoised by value: a streamed delta redraws only the entry that changed.

import { useRouter } from 'expo-router';
import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Brief } from '../../../brief/schema';
import type { SettleCard } from '../../../chat/cards/model';
import { TicketCards } from '../../../chat/cards/TaskCard';
import { ThreadCards } from '../../../chat/cards/ThreadCards';
import type { FollowLink } from '../../../chat/components/follow-link';
import { sameValue } from '../../../chat/components/row-same';
import { TurnNotice } from '../../../chat/components/TurnNotice';
import { Markdown } from '../../../chat/markdown/Markdown';
import {
  reportTarget,
  type ReportAccessibility,
  type ThreadReport,
} from '../../../chat/report/report';
import { routes } from '../../../navigation/routes';
import { Text } from '../../../ui';
import { MIN_TOUCH } from '../../../ui/paint';
import type {
  EventLine,
  StoryBrief,
  StoryCards,
  StoryEntry,
  StoryItem,
} from '../../homes/arcade-story';
import { ARCADE_HOME_COPY } from '../../strings';
import { ArcadeButton } from '../parts/ArcadeButton';
import { ArcadeWindow } from '../parts/ArcadeWindow';
import { useArcadePaint } from '../parts/use-arcade-paint';
import { useReportActions } from '../parts/use-report-actions';

/**
 * The handheld's log (chat.module.css [data-layout=phone]): 17 pt running text, the speaker column
 * 44 pt (it grows with its word), 10 between them, 8 within an entry; an item's words keep 160 pt
 * beside OPEN or wrap above it, 4 between their lines.
 */
const STORY_LINE = Object.freeze({
  size: 17,
  markWidth: 44,
  gap: 10,
  inner: 8,
  itemWords: 160,
  itemGap: 4,
});

type Tone = 'you' | 'auto' | 'event' | 'failed';
const MARK_INK = Object.freeze({ you: 'ac', auto: 'tx2', event: 'mp', failed: 'hp' } as const);

type LineProps = {
  readonly mark: string;
  readonly tone: Tone;
  /** The mark is a speaker VoiceOver hears; a glyph is decoration. */
  readonly spoken?: boolean;
  readonly children: ReactNode;
};

function StoryLine({ mark, tone, spoken = false, children }: LineProps) {
  const { vars, type } = useArcadePaint();
  return (
    <View style={styles.line}>
      <Text
        accessibilityElementsHidden={!spoken}
        importantForAccessibility={spoken ? 'auto' : 'no-hide-descendants'}
        style={[type.label, styles.mark, { color: vars[MARK_INK[tone]] }]}
      >
        {mark}
      </Text>
      <View style={styles.words}>{children}</View>
    </View>
  );
}

function Event({ line, onLink }: { readonly line: EventLine; readonly onLink: FollowLink }) {
  const { vars, type } = useArcadePaint();
  const { link } = line;
  const ink = { color: link ? vars.tx : vars.tx2 };
  const words = <Text style={[type.body(STORY_LINE.size), ink]}>{line.text}</Text>;
  return (
    <StoryLine mark={line.mark} tone={line.tone}>
      {link ? (
        <Pressable
          onPress={() => onLink(link)}
          accessibilityRole="link"
          accessibilityLabel={line.label}
          style={styles.link}
        >
          {words}
        </Pressable>
      ) : (
        <Text accessibilityLabel={line.label} style={[type.body(STORY_LINE.size), ink]}>
          {line.text}
        </Text>
      )}
    </StoryLine>
  );
}

function ItemReceived({ item }: { readonly item: StoryItem }) {
  const router = useRouter();
  const { vars, type } = useArcadePaint();
  return (
    <ArcadeWindow contentStyle={styles.item}>
      <View accessible accessibilityLabel={item.label} style={styles.itemText}>
        <Text style={[type.label, { color: vars.xp }]}>{ARCADE_HOME_COPY.itemReceived}</Text>
        <Text style={[type.body(STORY_LINE.size), { color: vars.tx }]}>{item.title}</Text>
        <Text style={[type.body(STORY_LINE.size), { color: vars.tx2 }]}>{item.meta}</Text>
      </View>
      {item.openable ? (
        <ArcadeButton
          kind="primary"
          label={ARCADE_HOME_COPY.open}
          hint={ARCADE_HOME_COPY.openHint}
          onPress={() => router.push(routes.cc.deliverable(item.id))}
        />
      ) : null}
    </ArcadeWindow>
  );
}

type BriefWindowProps = {
  readonly brief: StoryBrief;
  readonly onBrief: (brief: Brief) => void;
  readonly report: ReportAccessibility;
};

/** A brief the dialogue is not saying: its title (★ hidden from VoiceOver), greeting, OPEN BRIEF. */
function BriefWindow({ brief, onBrief, report }: BriefWindowProps) {
  const { vars, type } = useArcadePaint();
  const said = ARCADE_HOME_COPY.brief;
  return (
    <ArcadeWindow contentStyle={styles.item}>
      <View accessible accessibilityLabel={brief.label} {...report} style={styles.itemText}>
        <Text style={[type.label, { color: vars.mp }]}>{brief.heading}</Text>
        {brief.greeting ? (
          <Text style={[type.body(STORY_LINE.size), { color: vars.tx }]}>{brief.greeting}</Text>
        ) : null}
      </View>
      <ArcadeButton
        kind="primary"
        label={said.open}
        hint={said.openHint}
        onPress={() => onBrief(brief.brief)}
      />
    </ArcadeWindow>
  );
}

type CardsProps = {
  readonly cards: StoryCards;
  readonly onCard: SettleCard;
  readonly onLink: FollowLink;
};

/** A2's cards: each choice under its heading, then the rest, all drawn by A2's ThreadCards. */
function Cards({ cards, onCard, onLink }: CardsProps) {
  const { vars, type } = useArcadePaint();
  return (
    <>
      {cards.choices.map((choice) => (
        <View key={choice.key} style={styles.choice}>
          <Text
            accessibilityRole="header"
            style={[type.label, { color: choice.waiting ? vars.qs : vars.tx2 }]}
          >
            {choice.heading}
          </Text>
          <ThreadCards cards={choice.cards} onSettled={onCard} onLink={onLink} />
        </View>
      ))}
      <ThreadCards cards={cards.others} onSettled={onCard} onLink={onLink} />
    </>
  );
}

export type StoryEntryProps = {
  readonly entry: StoryEntry;
  readonly onRetry: () => void;
  readonly onCard: SettleCard;
  readonly onLink: FollowLink;
  readonly report: ThreadReport;
  /** OPEN BRIEF on a brief's window: the home's sheet opens on it. */
  readonly onBrief: (brief: Brief) => void;
};

type AutoProps = Omit<StoryEntryProps, 'entry'> & {
  readonly entry: Extract<StoryEntry, { kind: 'auto' }>;
};

function AutoEntry({ entry, onRetry, onCard, onLink, report, onBrief }: AutoProps) {
  const { row, words, brief } = entry;
  const target = words || brief ? reportTarget(row, report.allowed) : null;
  const onReport = target ? () => report.open(target) : undefined;
  const actions = useReportActions(onReport);
  const body = (
    <View style={styles.entry}>
      {entry.events.map((line) => (
        <Event key={line.key} line={line} onLink={onLink} />
      ))}
      {words ? (
        <StoryLine mark={ARCADE_HOME_COPY.auto} tone="auto" spoken>
          <Markdown text={words} onLink={onLink} report={actions} />
        </StoryLine>
      ) : null}
      {brief ? <BriefWindow brief={brief} onBrief={onBrief} report={actions} /> : null}
      {row.notices.map((notice) => (
        <TurnNotice key={notice.key} notice={notice} onRetry={onRetry} />
      ))}
      {entry.items.map((item) => (
        <ItemReceived key={item.key} item={item} />
      ))}
      <TicketCards tickets={row.tickets} onLink={onLink} />
      <Cards cards={entry.cards} onCard={onCard} onLink={onLink} />
    </View>
  );
  if (!onReport) return body;
  return (
    <Pressable accessible={false} onLongPress={onReport}>
      {body}
    </Pressable>
  );
}

function StoryEntryView(props: StoryEntryProps) {
  const { entry } = props;
  const { vars, type } = useArcadePaint();
  switch (entry.kind) {
    case 'you':
      return (
        <StoryLine mark={ARCADE_HOME_COPY.you} tone="you">
          <Text
            accessibilityLabel={entry.label}
            style={[type.body(STORY_LINE.size), { color: vars.tx }]}
          >
            {entry.text}
          </Text>
        </StoryLine>
      );
    case 'auto':
      return <AutoEntry {...props} entry={entry} />;
    case 'notice':
      return <TurnNotice notice={entry.notice} onRetry={props.onRetry} />;
    case 'loose':
      return (
        <View style={styles.entry}>
          {entry.items.map((item) => (
            <ItemReceived key={item.key} item={item} />
          ))}
          <Cards cards={entry.cards} onCard={props.onCard} onLink={props.onLink} />
        </View>
      );
  }
}

/** An entry draws again only when it changed: equal in value, the same handlers. */
export const StoryEntryRow = memo(StoryEntryView, sameValue);

const styles = StyleSheet.create({
  entry: { gap: STORY_LINE.inner },
  line: { flexDirection: 'row', alignItems: 'baseline', gap: STORY_LINE.gap },
  mark: { minWidth: STORY_LINE.markWidth },
  words: { flex: 1, gap: STORY_LINE.inner },
  item: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: STORY_LINE.gap,
    padding: STORY_LINE.gap,
  },
  itemText: { flexGrow: 1, flexBasis: STORY_LINE.itemWords, gap: STORY_LINE.itemGap },
  choice: { gap: STORY_LINE.inner },
  link: { minHeight: MIN_TOUCH, justifyContent: 'center' },
});
