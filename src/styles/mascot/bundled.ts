// The mascot files the app ships (KS6, D-MASCOT): the 12 vendored states' clips and stills,
// copied byte for byte into assets/mascot/ (SOURCES.md). Metro picks the table by platform:
// assets.ios.ts requires the clips and the stills, assets.android.ts the stills only, so the
// Android bundle carries no clip; assets.d.ts gives TypeScript this one shape for both.

import type { MascotName } from '../../core/web/lib/mascot/types';

/** A bundled file: the module id Metro gives a require()d asset. */
export type BundledFile = number;

export type BundledMascot = {
  /** Each state's HEVC-alpha clip (iOS); null on Android, whose bundle has none. */
  readonly clips: Readonly<Record<MascotName, BundledFile>> | null;
  /** Each state's 512 x 512 RGBA still: the clip's poster, and all there is without motion. */
  readonly stills: Readonly<Record<MascotName, BundledFile>>;
};
