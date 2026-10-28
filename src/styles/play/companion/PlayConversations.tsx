// Play's Conversations (Ember 03): 'Chats' in the screen slot with 'New chat' (44 high, the cream
// secondary), a bell chip to the notifications inbox with the server's unread number (Play has no
// header menu, so this is its way in: fix/notification-taps), and an avatar chip to Settings beside
// them (KS10); the sections Today, This week and
// Earlier in the label style; each row the title on one line (header slot), the time (Geist Mono
// 11 text2), the preview (Geist 14 text2, one line) and the report badge (the label style in the
// accent text), over 1 pt dividers of the ground's text at 0.07; the bottom bar under it all. No
// search field (PRD-001 open question 3 is Gerard's). Props only: phase 2 (US-017g) feeds it A2's
// history, its paging and the destinations, and what stands in the rows' place while there are none
// (`empty`: the wait, a failure, the first chat's nudge).

import { useRouter } from 'expo-router';
import { useMemo, type ReactElement } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import Bell from 'lucide-react-native/icons/bell';
import UserRound from 'lucide-react-native/icons/user-round';

import { routes } from '../../../navigation/routes';
import { inboxButtonLabel } from '../../../push/inbox/model';
import { useUnreadCount } from '../../../push/inbox/use-inbox';
import { pushScreens } from '../../../push/nav';
import { Button, CountBadge, Screen, Text } from '../../../ui';
import { ICON_STROKE } from '../../../ui/paint';
import { PLAY_CONVERSATIONS_COPY } from '../../strings';
import {
  COMPANION,
  conversationSections,
  type ConversationRowView,
  type PlayConversation,
} from './model';
import { PlayBottomBar } from './PlayBottomBar';
import { useCompanionPaint, type CompanionPaint } from './use-companion';

export type PlayConversationsProps = {
  readonly conversations: readonly PlayConversation[];
  readonly now: Date;
  /** The phone's timezone (expo-localization's); the phone's clock when null. */
  readonly timeZone: string | null;
  readonly onNewChat: () => void;
  readonly onOpen: (id: string) => void;
  /** The next page of the history (A2's paging). */
  readonly onEndReached?: () => void;
  /** Under the list: A2's loading-more or end row. */
  readonly footer?: ReactElement | null;
  /** In the rows' place while there are none: loading, a failure, the empty state. */
  readonly empty?: ReactElement | null;
  /** The signed-in person's initial on the avatar chip; an icon without it. */
  readonly initial?: string | null;
};

const { conversations: list, avatar } = COMPANION;
const AVATAR_ICON = 20;
const AVATAR_LETTER = 15;

type AvatarProps = { readonly initial?: string | null; readonly paint: CompanionPaint };

function AvatarChip({ initial, paint }: AvatarProps) {
  const router = useRouter();
  const { vars, style } = paint;
  const letter = initial?.trim().charAt(0).toUpperCase() || null;
  return (
    <Pressable
      onPress={() => router.push(routes.settings)}
      accessibilityRole="button"
      accessibilityLabel={PLAY_CONVERSATIONS_COPY.settings}
      style={[
        styles.avatar,
        {
          width: avatar,
          height: avatar,
          borderRadius: avatar / 2,
          backgroundColor: vars.groundChip,
        },
      ]}
    >
      {letter ? (
        <Text style={[style.type.body(AVATAR_LETTER, 600), { color: vars.groundText }]}>
          {letter}
        </Text>
      ) : (
        <UserRound size={AVATAR_ICON} color={vars.groundText2} strokeWidth={ICON_STROKE} />
      )}
    </Pressable>
  );
}

function InboxChip({ paint }: { readonly paint: CompanionPaint }) {
  const router = useRouter();
  const unread = useUnreadCount();
  const { vars, style } = paint;
  const { spacing } = style.tokens;
  return (
    <Pressable
      onPress={() => router.push(pushScreens.inbox)}
      accessibilityRole="button"
      accessibilityLabel={inboxButtonLabel(unread)}
      style={[
        styles.avatar,
        styles.inbox,
        {
          gap: spacing.space1,
          paddingHorizontal: spacing.space3,
          minWidth: avatar,
          height: avatar,
          borderRadius: avatar / 2,
          backgroundColor: vars.groundChip,
        },
      ]}
    >
      <Bell size={AVATAR_ICON} color={vars.groundText2} strokeWidth={ICON_STROKE} />
      <CountBadge count={unread} />
    </Pressable>
  );
}

type RowProps = {
  readonly row: ConversationRowView;
  readonly last: boolean;
  readonly paint: CompanionPaint;
  readonly onOpen: (id: string) => void;
};

function ConversationRow({ row, last, paint, onOpen }: RowProps) {
  const { vars, lines, style } = paint;
  const { spacing } = style.tokens;
  return (
    <Pressable
      onPress={() => onOpen(row.id)}
      accessibilityRole="button"
      accessibilityLabel={row.label}
      style={({ pressed }) => [
        {
          gap: spacing.space1,
          paddingHorizontal: list.rowPaddingX,
          paddingVertical: list.rowPaddingY,
          borderBottomWidth: last ? 0 : 1,
          borderBottomColor: lines.divider,
          opacity: pressed ? COMPANION.pressedOpacity : 1,
        },
      ]}
    >
      <View style={[styles.titleRow, { gap: spacing.space3 }]}>
        <Text
          numberOfLines={1}
          style={[style.type.display('header'), styles.title, { color: vars.groundText }]}
        >
          {row.title}
        </Text>
        <Text style={[style.type.mono(list.timeSize), { color: vars.groundText2 }]}>
          {row.time}
        </Text>
      </View>
      {row.preview ? (
        <Text
          numberOfLines={1}
          style={[style.type.body(list.previewSize), { color: vars.groundText2 }]}
        >
          {row.preview}
        </Text>
      ) : null}
      {row.badge ? (
        <Text style={[style.type.label, { color: vars.accentText }]}>{row.badge}</Text>
      ) : null}
    </Pressable>
  );
}

export function PlayConversations(props: PlayConversationsProps) {
  const { conversations, now, timeZone, onNewChat, onOpen, onEndReached, footer, empty, initial } =
    props;
  const paint = useCompanionPaint();
  const sections = useMemo(
    () => conversationSections(conversations, { now, timeZone }),
    [conversations, now, timeZone],
  );
  if (!paint) return null;
  const { vars, style, text3 } = paint;
  const { spacing } = style.tokens;
  const lastSection = sections[sections.length - 1];
  return (
    <Screen ground="conversations">
      <View
        style={[
          styles.header,
          { gap: spacing.space3, paddingHorizontal: spacing.space8, paddingTop: spacing.space3 },
        ]}
      >
        <Text
          accessibilityRole="header"
          style={[style.type.display('screen'), styles.title, { color: vars.groundText }]}
        >
          {PLAY_CONVERSATIONS_COPY.title}
        </Text>
        <Button label={PLAY_CONVERSATIONS_COPY.newChat} variant="secondary" onPress={onNewChat} />
        <InboxChip paint={paint} />
        <AvatarChip initial={initial} paint={paint} />
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(row) => row.id}
        renderSectionHeader={({ section }) => (
          <Text
            accessibilityRole="header"
            style={[
              style.type.label,
              { color: text3, paddingHorizontal: list.rowPaddingX, paddingTop: spacing.space7 },
            ]}
          >
            {section.title}
          </Text>
        )}
        renderItem={({ item, index, section }) => (
          <ConversationRow
            row={item}
            last={section === lastSection && index === section.data.length - 1}
            paint={paint}
            onOpen={onOpen}
          />
        )}
        onEndReached={onEndReached}
        ListFooterComponent={footer ?? null}
        ListEmptyComponent={empty ?? null}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[styles.content, { paddingHorizontal: spacing.space3 }]}
        style={styles.list}
      />
      <PlayBottomBar active="chats" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  /** The bell and its number side by side; the chip grows with the number. */
  inbox: { flexDirection: 'row' },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { flex: 1 },
  list: { flex: 1 },
  /** The empty slot fills the list, so a state centres in it. */
  content: { flexGrow: 1 },
});
