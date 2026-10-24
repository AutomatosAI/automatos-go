// The interruption hooks (US-019h): useInterruptions forwards AppState's changes and removes its
// listener on unmount; useVoiceKeepAwake holds the screen only while voice works and always lets go
// on unmount. There is no React renderer here: useEffect is replaced by one that runs the effect at
// once and keeps its cleanup, which is all either hook asks of React.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => {
  const effects: { cleanup: (() => void) | void }[] = [];
  const subscription = { remove: vi.fn() };
  return {
    effects,
    subscription,
    appState: {
      currentState: 'active',
      addEventListener: vi.fn((_type: string, _listener: (status: string) => void) => subscription),
    },
    keepAwake: {
      activateKeepAwakeAsync: vi.fn(async (_tag?: string) => undefined),
      deactivateKeepAwake: vi.fn(async (_tag?: string) => undefined),
    },
    react: {
      useEffect: (effect: () => (() => void) | void) => {
        effects.push({ cleanup: effect() });
      },
    },
  };
});
vi.mock('react', () => native.react);
vi.mock('react-native', () => ({ AppState: native.appState }));
vi.mock('expo-keep-awake', () => native.keepAwake);

const { useInterruptions } = await import('../interruptions/use-interruptions');
const { useVoiceKeepAwake, VOICE_KEEP_AWAKE_TAG } = await import('../interruptions/keep-awake');

/** Runs every effect's cleanup, as an unmount would. */
function unmount(): void {
  native.effects.splice(0).forEach(({ cleanup }) => cleanup?.());
}

beforeEach(() => {
  vi.clearAllMocks();
  native.effects.splice(0);
});

describe('useInterruptions', () => {
  it("forwards each AppState change to interrupt as the app's status", () => {
    const interrupt = vi.fn();
    useInterruptions(interrupt);
    expect(native.appState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    const listener = native.appState.addEventListener.mock.calls[0]?.[1];
    listener?.('background');
    listener?.('active');
    expect(interrupt.mock.calls).toEqual([
      [{ type: 'app', status: 'background' }],
      [{ type: 'app', status: 'active' }],
    ]);
  });

  it('reads nothing at mount and removes its listener on unmount', () => {
    const interrupt = vi.fn();
    useInterruptions(interrupt);
    expect(interrupt).not.toHaveBeenCalled();
    unmount();
    expect(native.subscription.remove).toHaveBeenCalledTimes(1);
  });
});

describe('useVoiceKeepAwake', () => {
  it('holds the screen while the mic is open, and lets go on unmount', () => {
    useVoiceKeepAwake({ phase: 'listening', micOpen: true });
    expect(native.keepAwake.activateKeepAwakeAsync).toHaveBeenCalledWith(VOICE_KEEP_AWAKE_TAG);
    unmount();
    expect(native.keepAwake.deactivateKeepAwake).toHaveBeenCalledWith(VOICE_KEEP_AWAKE_TAG);
  });

  it('takes no hold while idle, so there is nothing to release', () => {
    useVoiceKeepAwake({ phase: 'idle', micOpen: false });
    unmount();
    expect(native.keepAwake.activateKeepAwakeAsync).not.toHaveBeenCalled();
    expect(native.keepAwake.deactivateKeepAwake).not.toHaveBeenCalled();
  });
});
