// The Board tab's screen (/cc/board): routes.cc.board ('/cc') redirects here, and the shell's
// Board tab comes straight here. The screen only wires; the tab is src/cc/board/BoardTab.tsx.
import { BoardTab } from '../../../src/cc/board/BoardTab';

export default function BoardScreen() {
  return <BoardTab />;
}
