// The drawer's three pickers ('Automatos Command HUD.dc.html'), each under its heading in Geist
// Mono 500 11 at .16em in text2: 'ACCENT · <NAME>' over 36 pt circles in each accent (a 2 pt edge
// in the ground, a 2 pt ring in the text colour round the one picked); 'BACKGROUND' in two columns
// of 40 pt buttons, an 18 pt square of the ground beside its name (Geist Mono 500 12); 'TYPE' as
// three 44 pt buttons each in its own display face at 15, .1em. The one picked is framed in 1.5 pt
// of the accent (drawerFrame). Every option reaches 44 pt with hitSlop and says what it is.

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../../../ui';
import { hitSlopFor } from '../../../ui/paint';
import { HUD_SWATCH_EDGE } from '../../tokens/drawer-colours';
import {
  HUD_DRAWER,
  drawerFace,
  drawerFrame,
  type DrawerOption,
  type DrawerPick,
  type HudDrawer,
} from '../drawer-model';
import type { HudAccentKey, HudFontKey, HudGroundKey } from '../../tokens/hud-catalogue';
import { useDrawerPaint, type DrawerPaint } from './use-drawer';

const { accent, ground, font, heading } = HUD_DRAWER;
/** The accent circle with room for its ring, so the ring takes no layout of its own. */
const RING_BOX = accent.size + 2 * accent.ring;
const GROUND_COLUMNS = 2;

type Choose = (pick: DrawerPick) => void;

type HeadingProps = { readonly paint: DrawerPaint; readonly children: ReactNode };

export function DrawerHeading({ paint, children }: HeadingProps) {
  const face = paint.style.type.mono(heading.size, 500, { trackingEm: heading.tracking });
  return (
    <Text accessibilityRole="header" style={[face, { color: paint.vars.text2 }]}>
      {children}
    </Text>
  );
}

type PickerProps<K extends string> = {
  readonly options: readonly DrawerOption<K>[];
  readonly paint: DrawerPaint;
  readonly onChoose: (key: K) => void;
};

function AccentCircles({ options, paint, onChoose }: PickerProps<HudAccentKey>) {
  const { vars } = paint;
  return (
    <View style={styles.accents}>
      {options.map((option) => (
        <Pressable
          key={option.key}
          onPress={() => onChoose(option.key)}
          hitSlop={hitSlopFor(RING_BOX, RING_BOX)}
          accessibilityRole="button"
          accessibilityLabel={option.label}
          accessibilityState={{ selected: option.selected }}
          style={[styles.ringBox, { borderColor: option.selected ? vars.text : 'transparent' }]}
        >
          <View
            style={[
              styles.circle,
              { backgroundColor: option.colour ?? vars.accent, borderColor: vars.bg },
            ]}
          />
        </Pressable>
      ))}
    </View>
  );
}

/** The options two to a row, as the drawing's two-column grid lays them. */
function rowsOf<T>(items: readonly T[], size: number): readonly (readonly T[])[] {
  const count = Math.ceil(items.length / size);
  return Array.from({ length: count }, (_, index) => items.slice(index * size, (index + 1) * size));
}

function Backgrounds({ options, paint, onChoose }: PickerProps<HudGroundKey>) {
  const { vars, style } = paint;
  const face = style.type.mono(ground.size, 500);
  return (
    <View style={styles.grounds}>
      {rowsOf(options, GROUND_COLUMNS).map((row) => (
        <View key={row.map((option) => option.key).join()} style={styles.groundRow}>
          {row.map((option) => (
            <Pressable
              key={option.key}
              onPress={() => onChoose(option.key)}
              hitSlop={hitSlopFor(ground.height)}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: option.selected }}
              style={[styles.ground, drawerFrame(option.selected, vars)]}
            >
              <View
                style={[styles.groundSwatch, { backgroundColor: option.colour ?? vars.bg }]}
              />
              <Text style={[face, styles.shrink, { color: vars.text }]}>{option.text}</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

function TypeButtons({ options, paint, onChoose }: PickerProps<HudFontKey>) {
  const { vars } = paint;
  return (
    <View style={styles.fonts}>
      {options.map((option) => (
        <Pressable
          key={option.key}
          onPress={() => onChoose(option.key)}
          accessibilityRole="button"
          accessibilityLabel={option.label}
          accessibilityState={{ selected: option.selected }}
          style={[styles.font, drawerFrame(option.selected, vars)]}
        >
          <Text style={[drawerFace(option.key, font.size, font.tracking), { color: vars.text }]}>
            {option.text}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export type DrawerOptionsProps = {
  readonly drawer: HudDrawer;
  readonly onChoose: Choose;
};

export function DrawerOptions({ drawer, onChoose }: DrawerOptionsProps) {
  const paint = useDrawerPaint();
  if (!paint) return null;
  return (
    <>
      <View style={styles.section}>
        <DrawerHeading paint={paint}>{drawer.accent.title}</DrawerHeading>
        <AccentCircles
          options={drawer.accent.options}
          paint={paint}
          onChoose={(value) => onChoose({ knob: 'accent', value })}
        />
      </View>
      <View style={styles.section}>
        <DrawerHeading paint={paint}>{drawer.ground.title}</DrawerHeading>
        <Backgrounds
          options={drawer.ground.options}
          paint={paint}
          onChoose={(value) => onChoose({ knob: 'ground', value })}
        />
      </View>
      <View style={styles.section}>
        <DrawerHeading paint={paint}>{drawer.font.title}</DrawerHeading>
        <TypeButtons
          options={drawer.font.options}
          paint={paint}
          onChoose={(value) => onChoose({ knob: 'font', value })}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: heading.gap },
  accents: { flexDirection: 'row', flexWrap: 'wrap', gap: accent.gap - 2 * accent.ring },
  ringBox: {
    width: RING_BOX,
    height: RING_BOX,
    borderRadius: RING_BOX / 2,
    borderWidth: accent.ring,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: accent.size,
    height: accent.size,
    borderRadius: accent.size / 2,
    borderWidth: accent.border,
  },
  grounds: { gap: ground.gap },
  groundRow: { flexDirection: 'row', gap: ground.gap },
  ground: {
    flex: 1,
    minHeight: ground.height,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ground.inner,
    paddingHorizontal: ground.padX,
  },
  groundSwatch: {
    width: ground.swatch,
    height: ground.swatch,
    borderWidth: ground.swatchLine,
    borderColor: HUD_SWATCH_EDGE,
  },
  shrink: { flexShrink: 1 },
  fonts: { flexDirection: 'row', gap: font.gap },
  font: { flex: 1, minHeight: font.height, alignItems: 'center', justifyContent: 'center' },
});
