// The drawer's sliders and switches ('Automatos Command HUD.dc.html'): GRID 0-30 and GLOW, each
// with its value at the right (Geist Mono 500 11 at .16em in text2) over the shared Slider (KS7),
// the glow's thumb stopping at the look's safeGlow (KS9); then SCAN, AUTO and MOTION in three
// columns, 44 high in Geist Mono 600 11 at .1em — on: the accent fill, 1.5 pt of the accent and
// the accent ink; off: 1 pt of the line and text2. While the phone's Reduce Motion holds HUD
// still, MOTION reads off, dims and takes no press, and 'MOTION OFF · REDUCE MOTION' says why.

import { Pressable, StyleSheet, View } from 'react-native';

import { Slider, Text } from '../../../ui';
import { DISABLED_OPACITY } from '../../../ui/paint';
import {
  HUD_DRAWER,
  drawerFrame,
  type DrawerSlider,
  type DrawerSwitch,
  type HudDrawer,
  type HudSwitchKnob,
} from '../drawer-model';
import { DrawerHeading } from './DrawerOptions';
import { useDrawerPaint, type DrawerPaint } from './use-drawer';

const { sliders, switches, status, heading } = HUD_DRAWER;

type SlideTo = (knob: DrawerSlider['knob'], value: number) => void;

type SliderRowProps = {
  readonly slider: DrawerSlider;
  readonly paint: DrawerPaint;
  readonly onSlide: SlideTo;
};

/** The value at the right is the slider's own, which VoiceOver hears from the slider. */
function SliderRow({ slider, paint, onSlide }: SliderRowProps) {
  const face = paint.style.type.mono(heading.size, 500, { trackingEm: heading.tracking });
  return (
    <View style={styles.slider}>
      <View style={styles.between}>
        <DrawerHeading paint={paint}>{slider.title}</DrawerHeading>
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={[face, { color: paint.vars.text2 }]}
        >
          {String(slider.value)}
        </Text>
      </View>
      <Slider
        value={slider.value}
        min={slider.min}
        max={slider.max}
        maxAllowed={slider.cap}
        onChange={(value) => onSlide(slider.knob, value)}
        accessibilityLabel={slider.label}
        valueText={slider.words}
      />
    </View>
  );
}

type SwitchProps = {
  readonly item: DrawerSwitch;
  readonly paint: DrawerPaint;
  readonly onFlip: (knob: HudSwitchKnob) => void;
};

function SwitchButton({ item, paint, onFlip }: SwitchProps) {
  const { vars, style } = paint;
  const face = style.type.mono(switches.size, 600, { trackingEm: switches.tracking });
  return (
    <Pressable
      onPress={() => onFlip(item.knob)}
      disabled={item.disabled}
      accessibilityRole="switch"
      accessibilityLabel={item.label}
      accessibilityState={{ checked: item.on, disabled: item.disabled }}
      style={({ pressed }) => [
        styles.switch,
        drawerFrame(item.on, vars),
        { backgroundColor: item.on ? vars.accentFill : 'transparent' },
        item.disabled ? styles.disabled : pressed ? styles.pressed : null,
      ]}
    >
      <Text style={[face, styles.centred, { color: item.on ? vars.accent : vars.text2 }]}>
        {item.text}
      </Text>
    </Pressable>
  );
}

export type DrawerControlsProps = {
  readonly drawer: HudDrawer;
  readonly onSlide: SlideTo;
  readonly onFlip: (knob: HudSwitchKnob) => void;
};

export function DrawerControls({ drawer, onSlide, onFlip }: DrawerControlsProps) {
  const paint = useDrawerPaint();
  if (!paint) return null;
  const noteFace = paint.style.type.mono(status.size, 500, { trackingEm: status.tracking });
  return (
    <>
      <View style={styles.sliders}>
        <SliderRow slider={drawer.grid} paint={paint} onSlide={onSlide} />
        <SliderRow slider={drawer.glow} paint={paint} onSlide={onSlide} />
      </View>
      <View style={styles.switchArea}>
        <View style={styles.switches}>
          {drawer.switches.map((item) => (
            <SwitchButton key={item.knob} item={item} paint={paint} onFlip={onFlip} />
          ))}
        </View>
        {drawer.motionNote === null ? null : (
          <Text style={[noteFace, { color: paint.vars.text2 }]}>{drawer.motionNote}</Text>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  sliders: { gap: sliders.between },
  slider: { gap: sliders.gap },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchArea: { gap: sliders.gap },
  switches: { flexDirection: 'row', gap: switches.gap },
  switch: {
    flex: 1,
    minHeight: switches.height,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centred: { textAlign: 'center' },
  pressed: { opacity: HUD_DRAWER.pressedOpacity },
  disabled: { opacity: DISABLED_OPACITY },
});
