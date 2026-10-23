// The social post as it will publish (D-SOCIAL): the status chip with its word and the format, the
// serif title, when it publishes, each channel with the copy it posts (the base copy when no channel
// is chosen), then the media. The words are view.ts's; sizes and token keys chrome.ts's and the
// ticket sheet's (the head and running text look the same on both sheets).

import { StyleSheet, View } from 'react-native';

import { useTokens } from '../../styles/theme';
import { Chip, Text } from '../../ui';
import { TICKET_HEAD, TICKET_TEXT } from '../ticket/chrome';
import { SOCIAL_CHANNEL, SOCIAL_HEAD } from './chrome';
import { PostMediaList } from './PostMedia';
import type { ChannelView, SocialPostView } from './view';

function PostHead({ view }: { readonly view: SocialPostView }) {
  const { spacing } = useTokens();
  return (
    <View style={{ gap: spacing[TICKET_HEAD.gap] }}>
      <View style={[styles.row, { gap: spacing[SOCIAL_HEAD.rowGap] }]}>
        <Chip label={view.status.word} tone={view.status.tone} />
        {view.format ? (
          <Text level={SOCIAL_HEAD.formatLevel} tone={SOCIAL_HEAD.formatTone}>
            {view.format}
          </Text>
        ) : null}
      </View>
      <Text variant="title" level={TICKET_HEAD.titleLevel} accessibilityRole="header">
        {view.title}
      </Text>
      <Text
        level={SOCIAL_HEAD.whenLevel}
        weight={SOCIAL_HEAD.whenWeight}
        tone={SOCIAL_HEAD.whenTone}
      >
        {view.when}
      </Text>
    </View>
  );
}

function Channel({ channel }: { readonly channel: ChannelView }) {
  const { spacing } = useTokens();
  return (
    <View style={{ gap: spacing[SOCIAL_CHANNEL.gap] }}>
      <Text variant="mono" tone={SOCIAL_CHANNEL.labelTone}>
        {channel.label}
      </Text>
      {channel.text ? (
        <Text level={SOCIAL_CHANNEL.textLevel} selectable>
          {channel.text}
        </Text>
      ) : null}
    </View>
  );
}

export type SocialPostPreviewProps = {
  readonly postId: string;
  readonly view: SocialPostView;
};

export function SocialPostPreview({ postId, view }: SocialPostPreviewProps) {
  const { spacing } = useTokens();
  return (
    <>
      <PostHead view={view} />
      {view.channels.length > 0 ? (
        <View style={{ gap: spacing[SOCIAL_CHANNEL.listGap] }}>
          {view.channels.map((channel) => (
            <Channel key={channel.toolkit} channel={channel} />
          ))}
        </View>
      ) : null}
      {view.text ? (
        <Text level={TICKET_TEXT.level} selectable>
          {view.text}
        </Text>
      ) : null}
      <PostMediaList postId={postId} media={view.media} />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});
