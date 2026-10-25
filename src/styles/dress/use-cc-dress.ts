// The Command Centre shell's dress (cc-dress.ts) for the style a subtree paints, built once per
// resolved style object, so the shell's memoised styles hold until the style changes.

import { useStyle } from '../theme';
import { oncePerObject } from '../tokens/style-tokens';
import type { ResolvedStyle } from '../provider/resolve';
import { shellDress, shellTitle, type ShellDress, type ShellTitle } from './cc-dress';
import { dressOf } from './dress';

const shellOfStyle = oncePerObject((style: ResolvedStyle) => shellDress(style, dressOf(style)));

export function useShellDress(): ShellDress {
  return shellOfStyle(useStyle());
}

/** The head's title in this style; `title` is the screen's own name (VoiceOver's label). */
export function useShellTitle(title: string): ShellTitle {
  return shellTitle(useStyle(), title);
}
