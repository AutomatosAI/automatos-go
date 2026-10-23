// A social post awaiting approval (routes.cc.social: /cc/social/{post id}), drawn as a sheet over
// the Command Centre (app/(app)/cc/_layout.tsx gives it SHEET_ROUTE_OPTIONS). The needs strip on home
// links here, and a notification can (D18: approvals open the app). The screen only wires the
// route's id; the sheet is src/cc/social/SocialSheet.tsx.
import { useLocalSearchParams } from 'expo-router';

import { postIdParam } from '../../../../src/cc/social/api';
import { SocialSheet } from '../../../../src/cc/social/SocialSheet';

export default function SocialPostScreen() {
  return <SocialSheet postId={postIdParam(useLocalSearchParams())} />;
}
