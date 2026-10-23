// The post's media as it will publish (D-SOCIAL): each file in its own shape, loaded from the post's
// media route with the bearer (GET /api/socials/posts/{post_id}/media/{file_name}): an image through
// React Native's Image, a video through expo-video with its native controls. A video never plays by
// itself (Reduce Motion, and sound in a sheet), and nothing loads before the headers are read. A file
// that fails says so in words; one that is neither an image nor a video is named; the entries the
// post does not serve by name are counted and left to Studio.

import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { ActivityIndicator, Image, View, type LayoutChangeEvent } from 'react-native';

import type { AuthHeaders } from '../../api/auth-headers';
import { useApiClient } from '../../app-state/session';
import { useTokens } from '../../styles/theme';
import { Text } from '../../ui';
import { countPhrase } from '../../ui/variants';
import { SOCIAL_COPY } from '../strings';
import { SOCIAL_MEDIA } from './chrome';
import { mediaFrame, mediaUrl, type MediaFile, type MediaFrame, type PostMedia } from './media';
import { useMediaHeaders } from './use-social';

type Source = { readonly uri: string; readonly headers: AuthHeaders };

function Note({ text }: { readonly text: string }) {
  return (
    <Text level={SOCIAL_MEDIA.noteLevel} tone={SOCIAL_MEDIA.noteTone}>
      {text}
    </Text>
  );
}

function useFrameStyle(frame: MediaFrame) {
  const { colours, radii } = useTokens();
  return {
    width: frame.width,
    height: frame.height,
    alignSelf: 'center' as const,
    overflow: 'hidden' as const,
    borderRadius: radii[SOCIAL_MEDIA.radius],
    borderWidth: SOCIAL_MEDIA.borderWidth,
    borderColor: colours[SOCIAL_MEDIA.border],
    backgroundColor: colours[SOCIAL_MEDIA.ground],
  };
}

function PostImage({ file, source, frame }: MediaProps) {
  const style = useFrameStyle(frame);
  const [failed, setFailed] = useState(false);
  if (failed) return <Note text={SOCIAL_COPY.mediaFailed} />;
  return (
    <Image
      source={source}
      style={style}
      resizeMode="contain"
      accessibilityLabel={SOCIAL_COPY.image(file.name)}
      onError={() => setFailed(true)}
    />
  );
}

function PostVideo({ file, source, frame }: MediaProps) {
  const style = useFrameStyle(frame);
  const player = useVideoPlayer(source, (created) => {
    created.loop = false;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  if (status === 'error') return <Note text={SOCIAL_COPY.mediaFailed} />;
  return (
    <View style={style} accessibilityLabel={SOCIAL_COPY.video(file.name)}>
      <VideoView
        player={player}
        style={{ width: frame.width, height: frame.height }}
        contentFit="contain"
        nativeControls
        allowsPictureInPicture={false}
      />
    </View>
  );
}

type MediaProps = {
  readonly file: MediaFile;
  readonly source: Source;
  readonly frame: MediaFrame;
};

function MediaItem(props: MediaProps) {
  if (props.file.kind === 'image') return <PostImage {...props} />;
  if (props.file.kind === 'video') return <PostVideo {...props} />;
  return <Note text={props.file.name} />;
}

function Files({ postId, media, width }: PostMediaListProps & { readonly width: number }) {
  const { colours } = useTokens();
  const { server } = useApiClient();
  const { headers, failed } = useMediaHeaders();
  if (failed) return <Note text={SOCIAL_COPY.mediaFailed} />;
  if (!headers || width === 0) {
    return (
      <ActivityIndicator
        color={colours[SOCIAL_MEDIA.spinner]}
        accessibilityLabel={SOCIAL_COPY.mediaLoading}
      />
    );
  }
  return media.files.map((file) => (
    <MediaItem
      key={`${file.aspect}/${file.name}`}
      file={file}
      source={{ uri: mediaUrl(server.apiUrl, postId, file.name), headers }}
      frame={mediaFrame(width, file.ratio, SOCIAL_MEDIA.maxHeight)}
    />
  ));
}

export type PostMediaListProps = {
  readonly postId: string;
  readonly media: PostMedia;
};

export function PostMediaList({ postId, media }: PostMediaListProps) {
  const { spacing } = useTokens();
  const [width, setWidth] = useState(0);
  if (media.files.length === 0 && media.elsewhere === 0) return null;
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  return (
    <View style={{ gap: spacing[SOCIAL_MEDIA.gap] }} onLayout={onLayout}>
      <Text variant="mono" tone={SOCIAL_MEDIA.noteTone}>
        {SOCIAL_COPY.media}
      </Text>
      {media.files.length > 0 ? <Files postId={postId} media={media} width={width} /> : null}
      {media.elsewhere > 0 ? (
        <Note text={countPhrase(media.elsewhere, SOCIAL_COPY.elsewhere)} />
      ) : null}
    </View>
  );
}
