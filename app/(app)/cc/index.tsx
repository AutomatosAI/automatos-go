// routes.cc.board ('/cc'): every link into the Command Centre lands here and goes on to the Board's
// own screen (app/(app)/cc/board.tsx), where the shell's Board tab also goes.
import { Redirect } from 'expo-router';

import { BOARD_SCREEN } from '../../../src/cc/shell/tabs';

export default function CommandCentreIndex() {
  return <Redirect href={BOARD_SCREEN} />;
}
