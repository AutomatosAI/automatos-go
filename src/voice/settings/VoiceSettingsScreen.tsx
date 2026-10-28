// Settings → Voice (VOICE_SCREENS.settings: /settings/voice, src/voice/nav.ts): "I speak" (the
// language hold to talk listens in and Auto answers in), then the voice Auto answers in on this phone: Auto's server voices first when the server offers them, with "Use this
// phone's voice instead"; the phone's voices (Automatic first) without them or once chosen; then
// Speed (and Pitch for the phone's voice) and Reset to default (VoiceSections.tsx). Every value is
// the phone's own (use-voice-setting.ts) and quick-ask speaks its next reply with it. Back returns
// to Settings, or opens it when this screen was opened first.

import { StyleSheet, View } from 'react-native';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';

import { routes } from '../../navigation/routes';
import { useGoBack } from '../../navigation/use-go-back';
import { useTokens } from '../../styles/theme';
import { IconButton, Screen, Text } from '../../ui';
import { VOICE_SETTINGS_COPY } from '../strings';
import { useVoiceSettings } from './use-voice-settings';
import { LanguageList, ServerVoiceList, SoundSection, VoiceList } from './VoiceSections';

const COPY = VOICE_SETTINGS_COPY;
const TITLE_LEVEL = 2;
const LEDE_LEVEL = 3;

function Head({ lede }: { readonly lede: string }) {
  const { spacing } = useTokens();
  return (
    <View style={{ gap: spacing.space3 }}>
      <Text variant="eyebrow">{COPY.eyebrow}</Text>
      <Text variant="title" level={TITLE_LEVEL} accessibilityRole="header">
        {COPY.title}
      </Text>
      <Text level={LEDE_LEVEL} tone="muted">
        {lede}
      </Text>
    </View>
  );
}

export function VoiceSettingsScreen() {
  const goBack = useGoBack(routes.settings);
  const { spacing } = useTokens();
  const view = useVoiceSettings();
  return (
    <Screen scroll padding="space9">
      <View style={[styles.column, { gap: spacing.space6 }]}>
        <IconButton icon={ChevronLeft} accessibilityLabel={COPY.back} onPress={goBack} />
        <Head lede={view.lede} />
        <LanguageList
          rows={view.languages}
          note={view.languageNote}
          onChoose={view.chooseLanguage}
        />
        {view.server === null ? null : (
          <ServerVoiceList rows={view.server} onChoose={view.chooseServer} />
        )}
        {view.phone === null ? null : (
          <VoiceList
            title={view.phone.title}
            rows={view.phone.rows}
            help={view.phone.help}
            onChoose={view.choose}
          />
        )}
        <SoundSection
          sound={view.sound}
          resetHint={view.resetHint}
          onSlide={view.slide}
          onRelease={view.release}
          onReset={view.reset}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: 'stretch' },
});
