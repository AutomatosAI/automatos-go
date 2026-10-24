// One part of Settings → Notifications: its name as an eyebrow header, then its card and lines.

import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTokens } from '../../../styles/theme';
import { Text } from '../../../ui';

const NOTE_LEVEL = 6;

export type SectionProps = {
  readonly title: string;
  readonly children: ReactNode;
};

export function Section({ title, children }: SectionProps) {
  const { spacing } = useTokens();
  return (
    <View style={{ gap: spacing.space3 }}>
      <Text variant="eyebrow" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

/** A muted line under a section's card (whose switches these are, which time zone). */
export function SectionNote({ children }: { readonly children: string }) {
  return (
    <Text level={NOTE_LEVEL} tone="muted">
      {children}
    </Text>
  );
}
