// This phone's notifications in one sentence and at most one button (US-014c's statuses through
// view-model.ts's phoneStatusView): 'Turn on notifications' asks the OS and registers, 'Open
// Settings' leaves for the phone's Settings, 'Turn on again' and 'Try again' register once more.

import { View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Button, Card, Text } from '../../ui';
import { phoneActionLabel, type PhoneAction, type PhoneStatusView } from './view-model';

const SENTENCE_LEVEL = 2;

export type PhoneStatusProps = {
  readonly view: PhoneStatusView;
  /** A tap's registration is out: the button shows it and takes no second tap. */
  readonly busy: boolean;
  readonly onAction: (action: PhoneAction) => void;
};

export function PhoneStatus({ view, busy, onAction }: PhoneStatusProps) {
  const { spacing } = useTokens();
  const { action } = view;
  return (
    <Card>
      <View style={{ gap: spacing.space4 }}>
        <Text level={SENTENCE_LEVEL} accessibilityLiveRegion="polite">
          {view.sentence}
        </Text>
        {action ? (
          <Button
            label={phoneActionLabel(action)}
            variant="outline"
            onPress={() => onAction(action)}
            busy={busy}
          />
        ) : null}
      </View>
    </Card>
  );
}
