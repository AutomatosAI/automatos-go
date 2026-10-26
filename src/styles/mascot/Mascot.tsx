// Auto on screen (D-MASCOT, D37): <Mascot size state>. state is a state to hold (an edge screen, a
// preview: useMascotPose) or the controller of a caller that feeds him events (useMascot()). He reads
// the resolved style — whether he shows at all, Play's shell, the ring's palette, the platform,
// Reduce Motion and HUD's motion, an installed theme's files — through stage.ts, and draws the ring
// (MascotRing), then the figure: an untinted clip through expo-video (MascotClip), anything else
// through Skia (MascotSkia); a clip that will not play on either path turns him to stills
// (clipFailed). VoiceOver reads one image, 'Auto, <what he is doing>' (the vendored caption, the
// animation's text twin); where the style shows no mascot he renders nothing.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, View } from 'react-native';

import type { MascotName } from '../../core/web/lib/mascot/types';
import { useStyle } from '../theme';
import { BUNDLED_MASCOT } from './assets';
import { mascotGeometry, type Box } from './geometry';
import { MascotClip } from './MascotClip';
import { MascotRing } from './MascotRing';
import { MascotSkia } from './MascotSkia';
import { MASCOT_TINTED_CLIPS, type MascotPlatform } from './media';
import { mascotLabel, mascotStage, skiaMedia, type ShownMedia } from './stage';
import { useMascotPose, type MascotController } from './use-mascot';
import { useThemeMascot } from './use-theme-mascot';

const PLATFORM: MascotPlatform = Platform.OS === 'ios' ? 'ios' : 'android';

export type MascotProps = {
  /** Auto's size s in points (geometry.ts MASCOT_SIZES): his stage is 0.9s x s. */
  readonly size: number;
  /** A state to hold, or useMascot()'s controller, fed by its caller. */
  readonly state: MascotName | MascotController;
};

type FigureProps = {
  readonly media: ShownMedia;
  readonly box: Box;
  readonly run: number;
  readonly onBoundary: (run: number) => void;
  readonly onClipError: () => void;
};

function Figure({ media, box, run, onBoundary, onClipError }: FigureProps) {
  const place = { position: 'absolute', left: box.x, top: box.y, width: box.width } as const;
  return (
    <View pointerEvents="none" style={{ ...place, height: box.height }}>
      {media.kind === 'clip' ? (
        <MascotClip clip={media.clip} run={run} onBoundary={onBoundary} onError={onClipError} />
      ) : (
        <MascotSkia
          media={skiaMedia(media)}
          side={box.width}
          run={run}
          onBoundary={onBoundary}
          onError={onClipError}
        />
      )}
    </View>
  );
}

export function Mascot({ size, state }: MascotProps) {
  const style = useStyle();
  const pose = useMascotPose(typeof state === 'string' ? state : 'idle');
  const { driver, run, boundary, setStills } = typeof state === 'string' ? pose : state;
  const showing = driver.player.showing;
  const theme = useThemeMascot(style, showing);
  const [clipFailed, setClipFailed] = useState(false);
  const onClipError = useCallback(() => setClipFailed(true), []);
  const geometry = useMemo(() => mascotGeometry(size), [size]);
  // once per change: the shell's matrix and the ring's colour run the vendored engine
  const stage = useMemo(
    () =>
      mascotStage(
        {
          style,
          platform: PLATFORM,
          clipFailed,
          theme,
          bundled: BUNDLED_MASCOT,
          tintedClips: MASCOT_TINTED_CLIPS,
        },
        showing,
      ),
    [style, clipFailed, theme, showing],
  );
  const stills = stage?.stills ?? true;
  useEffect(() => setStills(stills), [setStills, stills]);

  if (!stage) return null;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={mascotLabel(driver.mascot.mascot)}
      style={{ width: geometry.stage.width, height: geometry.stage.height }}
    >
      <MascotRing ring={geometry.ring} colour={stage.ring} pulse={stage.pulse} />
      <Figure
        media={stage.media}
        box={geometry.media}
        run={run}
        onBoundary={boundary}
        onClipError={onClipError}
      />
    </View>
  );
}
