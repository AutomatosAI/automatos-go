// The Quests map on the handheld (PRD-001 §4.6.1 D-ARC-6, US-022m; the design kit's
// quests/map-view.tsx MapView and quests.module.css at 034fa629c): the terrain (MapTerrain, Skia)
// as wide as the screen gives it inside the kit's 2 pt ring, each region's name with its state (a
// glyph and a word, never the colour alone), and a marker per quest on its tile. A marker is a
// 44 pt target held inside the map (map-paint.ts markerBox, the kit's clamp) round the kit's 30 pt
// phone chip, its glyph in its state's colour; the selected one is lit in the highlight and drawn
// over its neighbours. VoiceOver hears each marker's quest and state ('Compare three laptops, in
// progress') and that it is selected. Props only: the Quests view feeds the quests and their tiles.
// The region names sit where the kit puts them, the eastern two held from the right edge so they
// stay on a phone's map (the kit's 60 % from the left runs past it at 390 pt).

import { useCallback, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type DimensionValue,
  type LayoutChangeEvent,
} from 'react-native';

import { Text } from '../../../ui';
import { MIN_TOUCH } from '../../../ui/paint';
import { ARCADE_QUESTS_COPY } from '../../strings';
import { ARCADE_BODY_MIN } from '../../typeface/arcade-type';
import { QUEST_REGIONS, QUEST_TONES, regionOf, type Quest } from '../home/quests';
import { useArcadePaint } from '../parts/use-arcade-paint';
import { MapTerrain } from './MapTerrain';
import { markerBox } from './map-paint';
import { MAP_COLUMNS, MAP_ROWS, type MapSpot, type Region } from './world-map';

/** The kit's phone sizes: a 2 pt ring round the map, a 30 pt chip, 3 / 5 pt label padding. */
const MAP = Object.freeze({ ring: 2, chip: 30, labelPadV: 3, labelPadH: 5 });

type Place = {
  readonly left?: DimensionValue;
  readonly right?: DimensionValue;
  readonly top: DimensionValue;
};

/** quests.module.css .region[data-region]: Greenwood top left, the eastern two from the right. */
const REGION_PLACES: Readonly<Record<Region, Place>> = Object.freeze({
  active: { left: '3%', top: '4%' },
  needs: { right: '3%', top: '4%' },
  done: { right: '3%', top: '60%' },
});

function RegionLabel({ region }: { readonly region: Region }) {
  const { vars, type } = useArcadePaint();
  const shown = regionOf(region);
  return (
    <View
      accessible
      accessibilityLabel={shown.label}
      pointerEvents="none"
      style={[
        styles.region,
        REGION_PLACES[region],
        { backgroundColor: vars.win, borderColor: vars.bd },
      ]}
    >
      <Text style={[type.label, { color: vars[QUEST_TONES[shown.tone]] }]}>
        {`${shown.glyph} ${shown.word}`}
      </Text>
      <Text style={[type.body(ARCADE_BODY_MIN), { color: vars.tx }]}>{shown.name}</Text>
    </View>
  );
}

type MarkerProps = {
  readonly quest: Quest;
  readonly spot: MapSpot;
  readonly width: number;
  readonly selected: boolean;
  readonly onSelect: (id: number) => void;
};

function Marker({ quest, spot, width, selected, onSelect }: MarkerProps) {
  const { vars, type } = useArcadePaint();
  const box = markerBox(spot, width, MIN_TOUCH);
  const ink = selected ? vars.hlt : vars[QUEST_TONES[quest.status.tone]];
  return (
    <Pressable
      onPress={() => onSelect(quest.id)}
      accessibilityRole="button"
      accessibilityLabel={quest.label}
      accessibilityHint={ARCADE_QUESTS_COPY.markerHint}
      accessibilityState={{ selected }}
      style={[
        styles.marker,
        { left: box.left, top: box.top, width: box.size, height: box.size },
        selected ? styles.lifted : null,
      ]}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.chip,
            { backgroundColor: selected ? vars.hl : vars.win, borderColor: vars.bd },
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={[type.label, { color: ink }]}>{quest.status.glyph}</Text>
        </View>
      )}
    </Pressable>
  );
}

export type QuestMapProps = {
  /** The quests on the map, in the order VoiceOver reads their markers. */
  readonly quests: readonly Quest[];
  /** Each quest's tile by its id (quests.ts questSpots); a quest with none has no marker. */
  readonly spots: ReadonlyMap<string, MapSpot>;
  readonly selected: number | null;
  readonly onSelect: (id: number) => void;
};

export function QuestMap({ quests, spots, selected, onSelect }: QuestMapProps) {
  const { vars } = useArcadePaint();
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);
  const drawn = width > 0;
  return (
    <View style={[styles.frame, { borderColor: vars.bd, backgroundColor: vars.page }]}>
      <View style={styles.map} onLayout={onLayout}>
        {drawn ? <MapTerrain width={width} /> : null}
        {QUEST_REGIONS.map((region) => (
          <RegionLabel key={region} region={region} />
        ))}
        {drawn
          ? quests.map((quest) => {
              const spot = spots.get(String(quest.id));
              return spot ? (
                <Marker
                  key={quest.id}
                  quest={quest}
                  spot={spot}
                  width={width}
                  selected={quest.id === selected}
                  onSelect={onSelect}
                />
              ) : null;
            })
          : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderWidth: MAP.ring },
  map: { width: '100%', aspectRatio: MAP_COLUMNS / MAP_ROWS },
  region: {
    position: 'absolute',
    paddingVertical: MAP.labelPadV,
    paddingHorizontal: MAP.labelPadH,
    borderWidth: MAP.ring,
  },
  marker: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  lifted: { zIndex: 1 },
  chip: {
    minWidth: MAP.chip,
    minHeight: MAP.chip,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: MAP.ring,
  },
  pressed: { transform: [{ translateX: MAP.ring }, { translateY: MAP.ring }] },
});
