// The header's menu (D73): the foundation's bottom Sheet (the [+] menu's, so the grabber, the
// backdrop tap, VoiceOver's escape and Reduce Motion are the same), mounted by the header with no
// route. On top, the workspace's full name and the role in words; then one ListRow per item in
// menu.ts MENU_ITEMS, the Command Centre's with the needs-you number in place of its chevron. A row
// slides the sheet away, then opens its screen (useHomeMenu). No workspace switcher: the pinned API
// lists no user's workspaces, and PRD §7 keeps a switcher out of v1.

import type { LucideIcon } from 'lucide-react-native';
import LayoutDashboard from 'lucide-react-native/icons/layout-dashboard';
import MessagesSquare from 'lucide-react-native/icons/messages-square';
import SettingsIcon from 'lucide-react-native/icons/settings';
import SquarePen from 'lucide-react-native/icons/square-pen';
import { View } from 'react-native';

import { useAppSession } from '../../app-state/session';
import { useTokens } from '../../styles/theme';
import { CountBadge, Divider, ListRow, Sheet, Text } from '../../ui';
import { MENU_ITEMS, menuHeading, menuRows, type MenuIcon } from './menu';
import type { HomeMenuState } from './use-home-menu';

const TITLE_LEVEL = 3;
const SUMMARY_LEVEL = 3;

const MENU_ICONS: Readonly<Record<MenuIcon, LucideIcon>> = Object.freeze({
  'square-pen': SquarePen,
  'messages-square': MessagesSquare,
  'layout-dashboard': LayoutDashboard,
  settings: SettingsIcon,
});

export type HomeMenuProps = {
  readonly menu: HomeMenuState;
  /** The server's needs-you number, as the menu button shows it. */
  readonly needsYou: number;
};

function Heading() {
  const { spacing } = useTokens();
  const heading = menuHeading(useAppSession().workspace);
  return (
    <View style={{ gap: spacing.space1 }}>
      <Text variant="title" level={TITLE_LEVEL} accessibilityRole="header">
        {heading.title}
      </Text>
      <Text level={SUMMARY_LEVEL} tone="muted">
        {heading.summary}
      </Text>
    </View>
  );
}

export function HomeMenu({ menu, needsYou }: HomeMenuProps) {
  return (
    <Sheet visible={menu.visible} onClose={menu.close}>
      <Heading />
      <Divider />
      {menuRows(MENU_ITEMS, { needsYou }).map((row) => (
        <ListRow
          key={row.id}
          icon={MENU_ICONS[row.icon]}
          title={row.label}
          accessibilityLabel={row.accessibilityLabel}
          onPress={() => menu.go(row.route)}
          trailing={row.badge === null ? undefined : <CountBadge count={row.badge} />}
        />
      ))}
    </Sheet>
  );
}
