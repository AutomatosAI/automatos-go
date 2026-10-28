// The notifications inbox (pushScreens.inbox: /notifications, src/push/nav.ts): every bell
// notification, so none is lost once its push is gone. The screen only wires; it is
// src/push/inbox/InboxScreen.tsx.
import { InboxScreen } from '../../src/push/inbox/InboxScreen';

export default function Notifications() {
  return <InboxScreen />;
}
