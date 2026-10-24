// The ways in (US-019k), read from source (vitest runs in node with no React renderer, and these
// files load React Native): VoiceButton is a 42 pt round IconButton with lucide's mic that only
// navigates; A2's Composer has ONE voice-agnostic slot beside the send button, drawn only when given
// (lead decision 24 Oct, option a); ChatScreen fills it with VoiceButton on the chat's id; Play's
// PlayComposer shows it beside Send only when given `voice`. The voice screen's own TYPE composer
// carries none. A2's and A5's own tests are untouched.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ICON_BUTTON_SIZES } from '../../ui/variants';

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
    for (const source of [button, model])
      expect(code(source)).not.toMatch(/AiLabel|aiLabel|useAiLabelVisible|fence/);
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
