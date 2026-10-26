// The ways in (US-019k), read from source (vitest runs in node with no React renderer, and these
// files load React Native): VoiceButton is a 42 pt round IconButton with lucide's mic that only
// navigates; A2's Composer has ONE voice-agnostic slot beside the send button, drawn only when given
// (lead decision 24 Oct, option a); ChatScreen fills it with VoiceButton on the chat's id; Play's
// PlayComposer shows it beside Send only when given `voice`. The voice screen's own TYPE composer
// carries none. HUD's home holds to talk in place: HudHome wires quick-ask (useHudHomeVoice, scope
// 'focused') into HudCore's optional quickAsk, its STOP is the voice's, a typed send hands the
// transcript back to the thread, and its TYPE composer keeps A2's Stop. A2's and A5's own tests are
// untouched.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ICON_BUTTON_SIZES } from '../../ui/variants';
import { COVERED } from '../interruptions/interruption-policy';

const SRC = path.resolve(__dirname, '..', '..');
const read = (file: string) => readFileSync(path.resolve(SRC, file), 'utf8');
/** The code alone (A2's idiom): comments stripped. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/** Every module a file imports. */
const importsOf = (source: string) =>
  [...source.matchAll(/from '([^']+)'/g)].map((match) => match[1]).sort();

const button = read('voice/entry/VoiceButton.tsx');
const composer = read('chat/composer/Composer.tsx');
const chatScreen = read('chat/screens/ChatScreen.tsx');
const playComposer = read('styles/play/companion/PlayComposer.tsx');
const voiceScreen = read('voice/screen/VoiceScreen.tsx');
const hudHome = read('styles/homes/HudHome.tsx');
const hudCore = read('styles/hud/core/HudCore.tsx');
const quickAskHook = read('voice/quick-ask/use-quick-ask.ts');
const homeVoice = read('voice/home/use-hud-home-voice.ts');

describe('VoiceButton', () => {
  it('is a 42 pt round IconButton with lucide’s mic', () => {
    expect(ICON_BUTTON_SIZES.lg.box).toBe(42);
    expect(button).toMatch(/<IconButton[\s\S]*size="lg"\s+round/);
    expect(button).toMatch(/from 'lucide-react-native\/icons\/mic'/);
    expect(button).toMatch(/accessibilityLabel=\{entry\.label\}/);
  });

  it('imports only expo-router, the icon, the foundation’s ui and the entry model', () => {
    expect(importsOf(button)).toEqual([
      '../../ui',
      './voice-entry',
      'expo-router',
      'lucide-react-native/icons/mic',
    ]);
    expect(button).not.toMatch(/from '[^']*(chat|styles)\//);
  });

  it('only navigates: a tap never opens the microphone (KV5)', () => {
    expect(code(button)).toMatch(/onPress=\{\(\) => router\.push\(entry\.route\)\}/);
    expect(code(button)).not.toMatch(/recogni|permission|speech|quick-ask|useQuickAsk/i);
  });

  it('is never held by the AI label (D73)', () => {
    const model = read('voice/entry/voice-entry.ts');
    for (const source of [button, model]) expect(code(source)).not.toMatch(/AiLabel|aiLabel|fence/);
  });
});

describe("A2's Composer slot (SEAM EDIT, option a)", () => {
  it('takes one optional accessory and never names voice', () => {
    expect(code(composer)).toMatch(/readonly accessory\?: ReactNode;/);
    expect(composer).not.toMatch(/voice/i);
  });

  it('draws the accessory only when given, beside the send button', () => {
    const body = code(composer);
    expect(body.match(/\baccessory\b/g)).toHaveLength(3);
    expect(body).toMatch(/<PillInput[\s\S]*?\/>\s*\{accessory \?\? null\}\s*<IconButton/);
  });
});

describe('ChatScreen (SEAM EDIT)', () => {
  it('fills the slot with VoiceButton on the conversation’s id and the role’s chat right', () => {
    expect(code(chatScreen)).toMatch(
      /accessory=\{\s*<VoiceButton roleCanChat=\{roleCan\(workspace\.role, 'chat'\)\} chatId=\{state\.chatId\} \/>\s*\}/,
    );
    expect(chatScreen).toMatch(/from '\.\.\/\.\.\/voice\/entry\/VoiceButton'/);
  });
});

describe("Play's PlayComposer (SEAM EDIT)", () => {
  it('shows VoiceButton beside Send only when given voice', () => {
    expect(code(playComposer)).toMatch(/readonly voice\?: VoiceButtonProps;/);
    expect(code(playComposer)).toMatch(
      /\{voice \? <VoiceButton \{\.\.\.voice\} \/> : null\}\s*<ComposerButton/,
    );
  });
});

describe('the voice screen', () => {
  it('gives its TYPE composer no voice button: it is the voice screen', () => {
    expect(code(voiceScreen)).not.toMatch(/accessory=|VoiceButton/);
  });
});

describe("HUD's home (SEAM EDIT): HOLD TO TALK in place", () => {
  it('wires quick-ask over its own thread into the core', () => {
    const body = code(hudHome);
    expect(hudHome).toMatch(/from '\.\.\/\.\.\/voice\/home\/use-hud-home-voice'/);
    expect(body).toMatch(/const voice = useHudHomeVoice\(home, turn\);/);
    expect(body).toMatch(/turn=\{voice\.turn\}/);
    expect(body).toMatch(/micOpen=\{voice\.micOpen\}/);
    expect(body).toMatch(/levels=\{voice\.levels\}/);
    expect(body).toMatch(
      /quickAsk=\{\{\s*\.\.\.voice\.core,\s*line: <VoiceLine line=\{voice\.line\} onAction=\{voice\.lineAction\} \/>,?\s*\}\}/,
    );
    expect(body).not.toMatch(/micOpen=\{false\}/);
  });

  it("STOP is the voice's; TYPE's composer keeps A2's Stop; a typed send hands back the turn", () => {
    const body = code(hudHome);
    expect(body).toMatch(/<HudCore[\s\S]*?onStop=\{voice\.stop\}[\s\S]*?\/>/);
    expect(body).toMatch(/<Composer[\s\S]*?onStop=\{stop\}[\s\S]*?\/>/);
    expect(body).toMatch(/sendMessage\(text, ready\);\s*typed\(\);/);
  });

  it('listens only while it is the screen on top, and asks nothing at mount (KV5)', () => {
    expect(code(homeVoice)).toMatch(/useQuickAsk\(thread, 'focused'\)/);
    expect(code(homeVoice)).not.toMatch(/permissions\.(check|press)/);
    expect(code(read('voice/screen/use-voice-screen.ts'))).toMatch(/useQuickAsk\(thread\);/);
  });
});

describe("HudCore's quickAsk (SEAM EDIT)", () => {
  it('is optional, and the voice screen’s group wins over it', () => {
    const body = code(hudCore);
    expect(body).toMatch(/readonly quickAsk\?: HudCoreQuickAsk;/);
    expect(body).toMatch(/if \(!voice && quick\) return quickAskParts\(quick\);/);
    expect(body).toMatch(/const parts = columnParts\(voice, turn, props\.quickAsk\);/);
  });

  it("gives HOLD TO TALK its hold and STOP the voice's switch, nothing else of the home", () => {
    const parts = code(hudCore).match(/function quickAskParts[\s\S]*?\n}/)?.[0] ?? '';
    expect(parts).toMatch(/buttons: \{ streaming: quick\.stopEnabled, talk: quick\.talk \}/);
    expect(parts).not.toMatch(/menuLabel|lookHint|typeEnabled/);
  });
});

describe("useQuickAsk's scope", () => {
  it("is 'mounted' by default (the voice screen) and 'focused' only on request", () => {
    const body = code(quickAskHook);
    expect(body).toMatch(/scope: QuickAskScope = 'mounted'/);
    expect(body).toMatch(
      /useEffect\(\(\) => \(scope === 'mounted' \? attach\(\) : undefined\), \[attach, scope\]\);/,
    );
    expect(body).toMatch(/if \(scope !== 'focused'\) return undefined;/);
  });

  it('leaves as for the background when covered, then lets go of the listeners', () => {
    expect(code(quickAskHook)).toMatch(/engine\.interrupt\(COVERED\);\s*detach\(\);/);
    expect(importsOf(quickAskHook)).toContain('../interruptions/interruption-policy');
    expect(COVERED).toEqual({ type: 'covered' });
  });

  it("attaches through the engine's attach (the wiring listener-handover.test.ts drives)", () => {
    expect(code(quickAskHook)).toMatch(
      /useCallback\(\(\) => engine\.attach\(\{ recognizer, speaker \}\), \[engine\]\)/,
    );
    expect(code(quickAskHook)).not.toMatch(/\.listen\(/);
  });
});
