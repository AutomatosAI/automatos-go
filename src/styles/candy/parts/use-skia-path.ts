// An outline from shapes.ts as a Skia path, made once per outline: null (logged) for one that does
// not parse, so the part draws its plain fill instead of failing.

import { Skia, type SkPath } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { logger } from '../../../lib/logger';

export function useSkiaPath(svg: string | null): SkPath | null {
  return useMemo(() => {
    if (svg === null) return null;
    const path = Skia.Path.MakeFromSVGString(svg);
    if (!path) logger.warn("[styles] Candy's parts: an outline did not parse; it is left out");
    return path;
  }, [svg]);
}
