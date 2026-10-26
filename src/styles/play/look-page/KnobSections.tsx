// The look page's knobs ('Automatos Play Looks.dc.html', the editor column laid out for the phone):
// the accent as 40 pt circles with a 2 pt ground border and a ring in the ground's text when
// selected; Background as a two-column grid of 48 pt buttons with the ground's square; Type as
// 46 pt rows, each name in its own face; Auto's shell and his light as 44 pt buttons with their dot;
// and the Glow slider (US-016g), which stops at the look's safe glow. Every option is a button
// with its selected state and its words ('Molten accent, selected'); a tap changes the look at once.
// Every box grows with Dynamic Type (least heights, rows that wrap).

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { TypeStyleKey } from '../../../core/frozen/lib/looks/catalogue';
import type { Look } from '../../../core/frozen/lib/looks/types';
import { Slider, Text } from '../../../ui';
import { SWATCH_EDGE, lightGlow } from '../../tokens/look-page-colours';
import { useCompanionPaint, type CompanionPaint } from '../companion/use-companion';
import { glowWords, type LookValues } from '../look-page';
import {
  LOOK_PAGE,
  lookKnobs,
  optionFace,
  optionFrame,
  type KnobOption,
  type KnobSection,
  type LookKnobs,
} from './knobs';

type Change = (values: Partial<LookValues>) => void;

type SectionProps<K extends string> = {
  readonly section: KnobSection<K>;
  readonly onChange: Change;
  readonly paint: CompanionPaint;
};

const { swatch, ground, font, finish } = LOOK_PAGE;
const SWATCH_OUTER = swatch.size + 2 * swatch.ring;

type TitledProps = {
  readonly title: string;
  readonly paint: CompanionPaint;
  readonly children: ReactNode;
};

function Titled({ title, paint, children }: TitledProps) {
  const { style, vars } = paint;
  return (
    <View style={{ gap: LOOK_PAGE.sectionGap }}>
      <Text accessibilityRole="header" style={[style.type.label, { color: vars.groundText2 }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

type OptionProps<K extends string> = {
  readonly option: KnobOption<K>;
  readonly onChange: Change;
  readonly paint: CompanionPaint;
  readonly style?: StyleProp<ViewStyle>;
  /** Framed in the accent when selected, on the ground's surface (all but the accent circles). */
  readonly framed?: boolean;
  readonly children: ReactNode;
};

function Option<K extends string>(props: OptionProps<K>) {
  const { option, onChange, paint, style, framed = true, children } = props;
  const frame = framed
    ? {
        ...optionFrame(option.selected, paint.vars),
        borderRadius: paint.style.radii.control,
        backgroundColor: paint.vars.groundSurface,
      }
    : null;
  return (
    <Pressable
      onPress={() => onChange(option.values)}
      accessibilityRole="button"
      accessibilityLabel={option.label}
      accessibilityState={{ selected: option.selected }}
      style={({ pressed }) => [frame, style, pressed ? styles.pressed : null]}
    >
      {children}
    </Pressable>
  );
}

function Accents({ section, onChange, paint }: SectionProps<string>) {
  const { vars } = paint;
  return (
    <View style={[styles.wrap, { gap: swatch.gap }]}>
      {section.options.map((option) => (
        <Option key={option.key} option={option} onChange={onChange} paint={paint} framed={false}>
          <View
            style={[
              styles.ring,
              { borderColor: option.selected ? vars.groundText : 'transparent' },
            ]}
          >
            <View
              style={[
                styles.swatch,
                { borderColor: vars.groundBg, backgroundColor: option.colour ?? vars.accent },
              ]}
            />
          </View>
        </Option>
      ))}
    </View>
  );
}

function Grounds({ section, onChange, paint }: SectionProps<string>) {
  const { vars, style } = paint;
  const face = style.type.body(ground.size, 500);
  return (
    <View style={[styles.wrap, { gap: ground.gap }]}>
      {section.options.map((option) => (
        <Option
          key={option.key}
          option={option}
          onChange={onChange}
          paint={paint}
          style={[styles.row, styles.half, styles.ground]}
        >
          <View
            style={[styles.groundSwatch, { backgroundColor: option.colour ?? vars.groundBg }]}
          />
          <Text style={[face, styles.shrink, { color: vars.groundText }]}>{option.name}</Text>
        </Option>
      ))}
    </View>
  );
}

function Fonts({ section, onChange, paint }: SectionProps<TypeStyleKey>) {
  const { vars, style } = paint;
  return (
    <View style={{ gap: font.gap }}>
      {section.options.map((option) => (
        <Option
          key={option.key}
          option={option}
          onChange={onChange}
          paint={paint}
          style={[styles.row, styles.font]}
        >
          <Text style={[optionFace(option.key), styles.shrink, { color: vars.groundText }]}>
            {option.name}
          </Text>
          <Text style={[style.type.body(font.faceSize), { color: vars.groundText2 }]}>
            {option.detail}
          </Text>
        </Option>
      ))}
    </View>
  );
}

type FinishesProps = SectionProps<string> & {
  /** Auto's light: each dot glows in its own colour, as the design draws it. */
  readonly glow: boolean;
};

function Finishes({ section, onChange, paint, glow }: FinishesProps) {
  const { vars, style } = paint;
  const face = style.type.body(finish.size, 500);
  return (
    <View style={[styles.wrap, { gap: finish.gap }]}>
      {section.options.map((option) => {
        const colour = option.colour ?? vars.autoLight;
        const shadow = glow ? lightGlow(colour, finish.dotGlow) : undefined;
        return (
          <Option
            key={option.key}
            option={option}
            onChange={onChange}
            paint={paint}
            style={[styles.row, styles.quarter, styles.finish]}
          >
            <View style={[styles.dot, { backgroundColor: colour, boxShadow: shadow }]} />
            <Text style={[face, styles.shrink, { color: vars.groundText }]}>{option.name}</Text>
          </Option>
        );
      })}
    </View>
  );
}

type GlowProps = {
  readonly glow: LookKnobs['glow'];
  readonly onChange: Change;
  readonly paint: CompanionPaint;
};

function Glow({ glow, onChange, paint }: GlowProps) {
  const label = [paint.style.type.label, { color: paint.vars.groundText2 }];
  return (
    <View style={{ gap: LOOK_PAGE.sectionGap }}>
      <View style={[styles.row, styles.between]}>
        <Text style={label}>{glow.title}</Text>
        {/* VoiceOver hears the value from the slider, in words */}
        <Text style={label} accessible={false} importantForAccessibility="no">
          {glow.label}
        </Text>
      </View>
      <Slider
        value={glow.value}
        min={glow.min}
        max={glow.max}
        maxAllowed={glow.cap}
        onChange={(value) => onChange({ glow: value })}
        accessibilityLabel={glow.title}
        valueText={(value) => glowWords(value, glow.cap)}
      />
    </View>
  );
}

export type KnobSectionsProps = { readonly look: Look; readonly onChange: Change };

export function KnobSections({ look, onChange }: KnobSectionsProps) {
  const paint = useCompanionPaint();
  if (!paint) return null;
  const knobs = lookKnobs(look);
  const shared = { onChange, paint };
  return (
    <View style={{ gap: paint.style.tokens.spacing.space9 }}>
      <Titled title={knobs.accent.title} paint={paint}>
        <Accents section={knobs.accent} {...shared} />
      </Titled>
      <Titled title={knobs.ground.title} paint={paint}>
        <Grounds section={knobs.ground} {...shared} />
      </Titled>
      <Titled title={knobs.font.title} paint={paint}>
        <Fonts section={knobs.font} {...shared} />
      </Titled>
      <Titled title={knobs.shell.title} paint={paint}>
        <Finishes section={knobs.shell} glow={false} {...shared} />
      </Titled>
      <Titled title={knobs.light.title} paint={paint}>
        <Finishes section={knobs.light} glow {...shared} />
      </Titled>
      <Glow glow={knobs.glow} {...shared} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { justifyContent: 'space-between' },
  shrink: { flexShrink: 1 },
  pressed: { opacity: LOOK_PAGE.pressedOpacity },
  ring: {
    width: SWATCH_OUTER,
    height: SWATCH_OUTER,
    borderRadius: SWATCH_OUTER / 2,
    borderWidth: swatch.ring,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: swatch.size,
    height: swatch.size,
    borderRadius: swatch.size / 2,
    borderWidth: swatch.border,
  },
  half: { flexGrow: 1, flexBasis: '40%' },
  ground: { minHeight: ground.height, paddingHorizontal: ground.padX, gap: ground.inner },
  groundSwatch: {
    width: ground.swatch,
    height: ground.swatch,
    borderRadius: ground.swatchRadius,
    borderWidth: 1,
    borderColor: SWATCH_EDGE,
  },
  font: { minHeight: font.height, paddingHorizontal: font.padX, justifyContent: 'space-between' },
  quarter: { flexGrow: 1, flexBasis: '20%' },
  finish: { minHeight: finish.height, gap: finish.inner, justifyContent: 'center' },
  dot: { width: finish.dot, height: finish.dot, borderRadius: finish.dot / 2 },
});
