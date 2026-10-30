// The design kit's sprite frames as fingerprints (D-ARC-5, KA3-VENDOR-PIN): per state, the sha256
// (first 16 hex) of each frame's runs as the kit's own code at 034fa629c draws them
// (themes/arcade/src/art/{grid,auto-sprite,states}.ts, run through esbuild in Node on 30 Oct
// 2026). states.test.ts pins every frame to them, clock.test.ts the sequence frameAt steps through.

import { createHash } from 'node:crypto';

import type { MascotName } from '../../../../core/frozen/lib/mascot/types';
import type { SpriteFrame } from '../states';

export const KIT_FRAMES: Readonly<Record<MascotName, readonly string[]>> = {
  hello: ['f90de58114c653eb', '36367a5b92325b65'],
  idle: ['7b7d37bb56641a3d', '4bc39d54db42ac95', '7b7d37bb56641a3d', '3aa72c58afd0e72f'],
  listening: ['2ba535fd54230150', '0dd7876a9d00c5c6'],
  thinking: ['e420b836ad3b23cd', '148a19b0812b9766', '8ea3ff221c57e755'],
  working: ['6e3a02698d34be7c', '533679df10605e7a', '6e3a02698d34be7c', '9d0fd24219894fcc'],
  searching: ['51b183d839c55cd5', '7b7d37bb56641a3d', '85ac21a327c254ee', '7b7d37bb56641a3d'],
  reading: ['abb9440f29baa431', 'ac453cee857b5658', '099271b41d490300'],
  celebrate: ['8cd0045ac43f3fd0', '79ad335eb4f0fd3e', '881ff4ca803d70dc', '79ad335eb4f0fd3e'],
  oops: ['23904b1ee8b66ace', 'de8d34529c3f6553', '09e0befae6970c44'],
  sleeping: ['1ce0f6ae2738d7b8', 'f3de53630d6d032e', '5d2a4467af49ab91'],
  lost: ['f0d02c3c5f14c5f1', '5bcc49dff7bbcfb8'],
  loading: ['6b3bd49c0668cc22', '9c31bd27cc331488', 'dfddbaf38fed38bf', '8283aa4afb4f7a67'],
};

/** The digest the kit's frames were pinned with: each run as x,y,width,key, joined by ';'. */
export function digest(frame: SpriteFrame): string {
  const text = frame.map((run) => `${run.x},${run.y},${run.width},${run.key}`).join(';');
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}
