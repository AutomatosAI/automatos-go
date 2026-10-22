// The words under a card's actions: the D17 note a role that cannot act reads in their place, and
// a refusal (refusalText's words), announced as an alert. Shared by every card of Auto's.

import { Text } from '../../ui';

const NOTE_LEVEL = 4;

export function ReadOnlyNote({ text }: { readonly text: string | null }) {
  if (!text) return null;
  return (
    <Text level={NOTE_LEVEL} tone="muted">
      {text}
    </Text>
  );
}

export function RefusalText({ text }: { readonly text: string | null }) {
  if (!text) return null;
  return (
    <Text
      level={NOTE_LEVEL}
      tone="accent"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      {text}
    </Text>
  );
}
