// Back from one conversation and from Older chats (rule 4.2): each takes the one hook with home as
// its fallback, as each wrote it by hand before: the screen behind when there is one (the list a
// chat was opened from), home in its place when there is none (a chat opened from a notification
// or a link). Where the hook goes is proved over a router in src/navigation's go-back.test.ts;
// here, read from the source (nothing renders in node), each screen hands it to its own Back.

import { describe, expect, it } from 'vitest';

import { codeOf } from '../../release/__tests__/support/code';

const CHAT_ROUTE = 'src/chat/screens/ChatRouteScreen.tsx';
const CHATS = 'src/chat/history/ChatsScreen.tsx';

describe.each([
  { file: CHAT_ROUTE, control: /<StyleChat[\s\S]*?onBack=\{back\}[\s\S]*?\/>/ },
  { file: CHATS, control: /<ChatsHeader onBack=\{back\} onNewChat=\{newChat\}\s*\/>/ },
])('Back from $file', ({ file, control }) => {
  const code = codeOf(file);

  it('is the one hook, falling back to home', () => {
    expect(code.match(/useGoBack\(/g)).toHaveLength(1);
    expect(code).toContain('const back = useGoBack(routes.home);');
  });

  it('is handed to the screen’s own Back', () => {
    expect(code).toMatch(control);
  });

  it('no longer asks the router itself', () => {
    expect(code).not.toMatch(/\.(back|canGoBack)\(/);
  });
});
