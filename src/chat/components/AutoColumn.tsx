// Auto's side of the thread (D72): its sail avatar, then a column holding what Auto said (its box,
// the thinking pill, a notice) and the cards under it. A row that continues Auto's run has no disc
// but keeps its width, so the run lines up under one avatar. At the accessibility text sizes
// (fontScale from 1.6: iOS AX1 is 1.786, the largest default size 1.353) the avatar moves above
// and the column takes the full width (thread-look.ts columnLayout).

import type { ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import type { ReportAccessibility } from '../report/report';
import { AutoAvatar } from './AutoAvatar';
import { THREAD, avatarPlacement, columnLayout, type AvatarRole } from './thread-look';

export type AutoColumnProps = {
  readonly avatar: AvatarRole;
  /** Report this on the avatar, where the message offers it. */
  readonly report?: ReportAccessibility;
  readonly children: ReactNode;
};

function Lead({ avatar, report, indent }: Omit<AutoColumnProps, 'children'> & { indent: boolean }) {
  if (avatar !== 'none') return <AutoAvatar role={avatar} report={report} />;
  return indent ? <View style={{ width: THREAD.avatar }} /> : null;
}

export function AutoColumn({ avatar, report, children }: AutoColumnProps) {
  const { spacing } = useTokens();
  const { fontScale } = useWindowDimensions();
  const layout = columnLayout(avatarPlacement(fontScale));
  return (
    <View style={[layout.row, { gap: spacing[layout.gap] }]}>
      <Lead avatar={avatar} report={report} indent={layout.indent} />
      <View style={[layout.content, { gap: spacing.space3 }]}>{children}</View>
    </View>
  );
}
