// A social post awaiting approval (D-SOCIAL, D45): the foundation's bottom sheet over the Command
// Centre, opened from the needs strip on home through routes.cc.social(postId) (and, later, from a
// notification: approvals open the app, D18). The post as it will publish, then who decides it or
// why nothing waits on anyone, then Request changes and Approve for a role that may approve, then
// Open in Studio for everything the phone does not do (add a channel, reject, history). A route id
// that is not a post id reads as not found; a load that fails says why, with Try again.

import ExternalLink from 'lucide-react-native/icons/external-link';
import { useState } from 'react';

import { ApiError } from '../../api/errors';
import { routes } from '../../navigation/routes';
import { Button, ErrorState, LoadingState, Sheet, Text } from '../../ui';
import { openInBrowser } from '../open-studio';
import { SOCIAL_COPY } from '../strings';
import { useSheetRoute, type SheetRoute } from '../use-sheet-route';
import { noChannelNote, readOnlyNote, settledNote } from './approval';
import { SOCIAL_NOTE } from './chrome';
import { SocialPostPreview } from './SocialPostPreview';
import { SocialVerdict } from './SocialVerdict';
import { useSocialPost } from './use-social';
import { postStudioUrl } from './view';

/** What a route id that is not a post id is: no post the server could find. */
const NOT_A_POST = new ApiError('not_found');

function Note({ text }: { readonly text: string | null }) {
  if (!text) return null;
  return (
    <Text level={SOCIAL_NOTE.level} tone={SOCIAL_NOTE.tone}>
      {text}
    </Text>
  );
}

function StudioLink({ url }: { readonly url: string | null }) {
  const [failed, setFailed] = useState(false);
  if (url === null) return <Note text={SOCIAL_COPY.studioMissing} />;
  return (
    <>
      {failed ? <Note text={SOCIAL_COPY.studioFailed} /> : null}
      <Button
        label={SOCIAL_COPY.studio}
        variant="outline"
        icon={ExternalLink}
        accessibilityHint={SOCIAL_COPY.studioHint}
        onPress={() => {
          void openInBrowser(url).then((opened) => setFailed(!opened));
        }}
        fullWidth
      />
    </>
  );
}

function PostContent({ postId, route }: { readonly postId: string; readonly route: SheetRoute }) {
  const { post, view, actions, role, webUrl } = useSocialPost(postId);
  const data = post.data;
  if (!view || !data || !actions) {
    return post.error ? (
      <ErrorState error={post.error} onRetry={() => void post.refetch()} />
    ) : (
      <LoadingState label={SOCIAL_COPY.loading} inline />
    );
  }
  const reload = () => post.refetch().then((reloaded) => reloaded.data);
  return (
    <>
      <SocialPostPreview postId={data.id} view={view} />
      <Note text={settledNote(data) ?? readOnlyNote(data, role) ?? noChannelNote(data, role)} />
      <SocialVerdict
        post={data}
        actions={actions}
        slot={view.slot}
        reload={reload}
        onDecided={route.close}
      />
      <StudioLink url={postStudioUrl(data.id, webUrl)} />
    </>
  );
}

export type SocialSheetProps = {
  /** The post id from the route, or null when the route's id is not one. */
  readonly postId: string | null;
};

export function SocialSheet({ postId }: SocialSheetProps) {
  const route = useSheetRoute(routes.home);
  return (
    <Sheet visible={route.visible} onClose={route.close}>
      {postId === null ? (
        <ErrorState error={NOT_A_POST} />
      ) : (
        <PostContent postId={postId} route={route} />
      )}
    </Sheet>
  );
}
