// A Deliverable's file on its page when it is not text (detail.ts DetailBody): an image inline,
// loaded with the bearer in the image source's headers (an image on another site with none of the
// session), drawn in its own shape once it has loaded; a PDF, DOCX or XLSX behind its Open button
// (the system viewer, use-deliverable.ts); anything else in Studio, with why. Every failure has its
// words. Running text is DeliverableDetail's list, so a long file is drawn as it scrolls.

import ExternalLink from 'lucide-react-native/icons/external-link';
import FileText from 'lucide-react-native/icons/file-text';
import { useState } from 'react';
import { ActivityIndicator, Image, View, type LayoutChangeEvent } from 'react-native';

import type { AuthHeaders } from '../../api/auth-headers';
import { useTokens } from '../../styles/theme';
import { Button, Text } from '../../ui';
import { openInBrowser } from '../open-studio';
import { DEFAULT_RATIO, mediaFrame } from '../social/media';
import { useMediaHeaders } from '../social/use-social';
import { DELIVERABLE_COPY } from '../strings';
import { DELIVERABLE_PAGE } from './chrome';
import type { DetailBody } from './detail';
import type { FileLink } from './file-source';
import { useSystemViewer, type ViewerBody } from './use-deliverable';

export function Note({ text, alert = false }: { readonly text: string; readonly alert?: boolean }) {
  return (
    <Text
      level={DELIVERABLE_PAGE.noteLevel}
      tone={DELIVERABLE_PAGE.noteTone}
      accessibilityRole={alert ? 'alert' : undefined}
    >
      {text}
    </Text>
  );
}

type Source = { readonly uri: string; readonly headers?: AuthHeaders };

function LoadedImage({ source, title }: { readonly source: Source; readonly title: string }) {
  const { colours, radii } = useTokens();
  const [width, setWidth] = useState(0);
  const [ratio, setRatio] = useState(DEFAULT_RATIO);
  const [failed, setFailed] = useState(false);
  if (failed) return <Note text={DELIVERABLE_COPY.imageFailed} alert />;
  const frame = mediaFrame(width, ratio, DELIVERABLE_PAGE.imageMaxHeight);
  return (
    <View onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
      <Image
        source={source}
        resizeMode="contain"
        accessibilityLabel={DELIVERABLE_COPY.image(title)}
        onLoad={({ nativeEvent }) => {
          const { width: w, height: h } = nativeEvent.source;
          if (w > 0 && h > 0) setRatio(w / h);
        }}
        onError={() => setFailed(true)}
        style={{
          width: frame.width,
          height: frame.height,
          alignSelf: 'center',
          borderRadius: radii[DELIVERABLE_PAGE.imageRadius],
          borderWidth: DELIVERABLE_PAGE.imageBorderWidth,
          borderColor: colours[DELIVERABLE_PAGE.imageBorder],
          backgroundColor: colours[DELIVERABLE_PAGE.imageGround],
        }}
      />
    </View>
  );
}

/** An image on the API waits for the headers; one on another site is loaded without them. */
function ImageBody({ link, title }: { readonly link: FileLink; readonly title: string }) {
  const { colours } = useTokens();
  const { headers, failed } = useMediaHeaders();
  if (link.kind === 'external') return <LoadedImage source={{ uri: link.url }} title={title} />;
  if (failed) return <Note text={DELIVERABLE_COPY.imageFailed} alert />;
  if (!headers) {
    return (
      <ActivityIndicator
        color={colours[DELIVERABLE_PAGE.spinner]}
        accessibilityLabel={DELIVERABLE_COPY.loading}
      />
    );
  }
  return <LoadedImage source={{ uri: link.url, headers }} title={title} />;
}

function ViewerButton({ body, title }: { readonly body: ViewerBody; readonly title: string }) {
  const viewer = useSystemViewer(body, title);
  return (
    <>
      <Button
        label={body.label}
        icon={FileText}
        accessibilityHint={DELIVERABLE_COPY.openHint}
        busy={viewer.busy}
        onPress={viewer.open}
        fullWidth
      />
      {viewer.failure ? <Note text={viewer.failure} alert /> : null}
    </>
  );
}

/** Studio in the system browser (D-NO-WEBVIEW); a build with no Studio address says so. */
export function StudioLink({ url }: { readonly url: string | null }) {
  const [failed, setFailed] = useState(false);
  if (url === null) return <Note text={DELIVERABLE_COPY.studioMissing} />;
  return (
    <>
      {failed ? <Note text={DELIVERABLE_COPY.studioFailed} alert /> : null}
      <Button
        label={DELIVERABLE_COPY.studio}
        variant="outline"
        icon={ExternalLink}
        accessibilityHint={DELIVERABLE_COPY.studioHint}
        onPress={() => {
          void openInBrowser(url).then((opened) => setFailed(!opened));
        }}
        fullWidth
      />
    </>
  );
}

export type DeliverableBodyProps = {
  readonly body: DetailBody;
  readonly title: string;
  readonly studioUrl: string | null;
};

/** The file when it is not running text; text is drawn by the page's list. */
export function DeliverableBody({ body, title, studioUrl }: DeliverableBodyProps) {
  switch (body.kind) {
    case 'image':
      return <ImageBody link={body.link} title={title} />;
    case 'viewer':
      return <ViewerButton body={body} title={title} />;
    case 'studio':
      return (
        <>
          <Note text={body.note} />
          <StudioLink url={studioUrl} />
        </>
      );
    default:
      return null;
  }
}
