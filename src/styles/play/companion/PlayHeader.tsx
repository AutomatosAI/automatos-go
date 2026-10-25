// Play's chat header (Ember 01-02): 56 high over a 1 pt line of the ground's text at 0.08, 'Chats'
// left and 'Shelf' right (Geist 500 15 in text2, 44 pt targets; 'Shelf +N' in the accent text when
// N Deliverables landed in this conversation) and the conversation's title centred on one line in
// the header slot. Under it, while the server's needs-you total is above zero, the slim line
// 'NEEDS YOU · N  Command Centre →' (the label style in the accent text, KS10, FR-4): the number
// is the app's one answer (useNeedsYou), and the line opens the Board, as CommandCentreButton does.

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useNeedsYou } from '../../../api/needs-you';
import { routes } from '../../../navigation/routes';
import { Text } from '../../../ui';
import { hitSlopFor } from '../../../ui/paint';
import { PLAY_CHAT_COPY } from '../../strings';
import { COMPANION, needsLine, shelfView, type NeedsLineView } from './model';
import { useCompanionPaint, type CompanionPaint } from './use-companion';

export type PlayHeaderProps = {
  /** The conversation's title. */
  readonly title: string;
  /** Deliverables that landed in this conversation: 'Shelf +N'. */
  readonly shelfCount?: number;
  readonly onChats: () => void;
  readonly onShelf: () => void;
};

const { header, target } = COMPANION;

type HeaderButtonProps = {
  readonly text: string;
  readonly label: string;
  readonly colour: string;
  readonly paint: CompanionPaint;
  readonly onPress: () => void;
};

function HeaderButton({ text, label, colour, paint, onPress }: HeaderButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.button,
        { paddingHorizontal: header.buttonPaddingX, opacity: pressed ? COMPANION.pressedOpacity : 1 },
      ]}
    >
      <Text style={[paint.style.type.body(header.buttonSize, 500), { color: colour }]}>{text}</Text>
    </Pressable>
  );
}

function NeedsLine({ view, paint }: { readonly view: NeedsLineView; readonly paint: CompanionPaint }) {
  const router = useRouter();
  const { type, tokens } = paint.style;
  const ink = { color: paint.vars.accentText };
  const height = type.label.lineHeight + tokens.spacing.space2 * 2;
  return (
    <Pressable
      onPress={() => router.push(routes.cc.board)}
      hitSlop={hitSlopFor(height)}
      accessibilityRole="link"
      accessibilityLabel={view.label}
      style={[
        styles.needs,
        { paddingHorizontal: tokens.spacing.space7, paddingVertical: tokens.spacing.space2 },
      ]}
    >
      <Text style={[type.label, ink]}>{view.text}</Text>
      <Text style={[type.label, ink]}>{view.link}</Text>
    </Pressable>
  );
}

export function PlayHeader({ title, shelfCount = 0, onChats, onShelf }: PlayHeaderProps) {
  const paint = useCompanionPaint();
  const { total } = useNeedsYou();
  if (!paint) return null;
  const { vars, lines, style } = paint;
  const shelf = shelfView(shelfCount);
  const needs = needsLine(total);
  return (
    <View>
      <View
        style={[
          styles.bar,
          { paddingHorizontal: header.paddingX, borderBottomColor: lines.headerLine },
        ]}
      >
        <HeaderButton
          text={PLAY_CHAT_COPY.chats}
          label={PLAY_CHAT_COPY.chats}
          colour={vars.groundText2}
          paint={paint}
          onPress={onChats}
        />
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={[style.type.display('header'), styles.title, { color: vars.groundText }]}
        >
          {title}
        </Text>
        <HeaderButton
          text={shelf.text}
          label={shelf.label}
          colour={shelf.fresh ? vars.accentText : vars.groundText2}
          paint={paint}
          onPress={onShelf}
        />
      </View>
      {needs ? <NeedsLine view={needs} paint={paint} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: header.height,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  button: { minHeight: target, minWidth: target, justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center' },
  needs: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
