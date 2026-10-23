// The composer's [+] (D-COMPOSER): a 42 pt round button before the pill that opens the foundation's
// Sheet with Camera, Photo library and Files. Camera asks for its permission when tapped; refused,
// the sheet says how to allow it in Settings and offers to open them. The wiring is
// useAttachMenu's; the files picked go to the composer's attachments.

import Camera from 'lucide-react-native/icons/camera';
import FileText from 'lucide-react-native/icons/file-text';
import Images from 'lucide-react-native/icons/images';
import Plus from 'lucide-react-native/icons/plus';
import { View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Button, IconButton, ListRow, Sheet, Text } from '../../ui';
import { ATTACH_COPY } from '../strings';
import type { PickedFile } from './picked';
import { useAttachMenu, type AttachMenu as Menu } from './use-attach-menu';

const TITLE_LEVEL = 4;

export type AttachMenuProps = {
  /** The composer is off (a viewer, the AI label hidden) or the message is full. */
  readonly disabled: boolean;
  /** How many more files this message can take. */
  readonly room: number;
  readonly onPicked: (files: readonly PickedFile[]) => void;
};

function Choices({ menu }: { readonly menu: Menu }) {
  return (
    <>
      <Text variant="title" level={TITLE_LEVEL} accessibilityRole="header">
        {ATTACH_COPY.sheetTitle}
      </Text>
      <ListRow
        icon={Camera}
        title={ATTACH_COPY.camera}
        summary={ATTACH_COPY.cameraSummary}
        onPress={menu.camera}
      />
      <ListRow
        icon={Images}
        title={ATTACH_COPY.library}
        summary={ATTACH_COPY.librarySummary}
        onPress={menu.library}
      />
      <ListRow
        icon={FileText}
        title={ATTACH_COPY.files}
        summary={ATTACH_COPY.filesSummary}
        onPress={menu.files}
      />
    </>
  );
}

function CameraDenied({ menu }: { readonly menu: Menu }) {
  const { spacing } = useTokens();
  return (
    <>
      <Text variant="title" level={TITLE_LEVEL} accessibilityRole="header">
        {ATTACH_COPY.cameraDeniedTitle}
      </Text>
      <Text tone="muted">{ATTACH_COPY.cameraDenied}</Text>
      <View style={{ gap: spacing.space3 }}>
        <Button label={ATTACH_COPY.openSettings} onPress={menu.openSettings} fullWidth />
        <Button label={ATTACH_COPY.notNow} onPress={menu.close} variant="ghost" fullWidth />
      </View>
    </>
  );
}

export function AttachMenu({ disabled, room, onPicked }: AttachMenuProps) {
  const menu = useAttachMenu(room, onPicked);
  return (
    <>
      <IconButton
        icon={Plus}
        accessibilityLabel={ATTACH_COPY.button}
        accessibilityHint={ATTACH_COPY.buttonHint}
        onPress={menu.open}
        variant="outline"
        size="lg"
        round
        disabled={disabled || room === 0}
      />
      <Sheet visible={menu.visible} onClose={menu.close}>
        {menu.content === 'cameraDenied' ? <CameraDenied menu={menu} /> : <Choices menu={menu} />}
      </Sheet>
    </>
  );
}
