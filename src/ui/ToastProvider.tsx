// The app's one toast: useToast().show('Answered — the agent is resuming.') from any screen or
// sheet. One at a time, each for 2.4 s; a new one replaces the one on screen (overlay.ts:
// toastReducer). VoiceOver hears it through an announcement (iOS has no live regions); TalkBack
// through the toast's live region. The app shell mounts this once, inside the theme.

import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';

import { Toast } from './Toast';
import {
  INITIAL_TOAST_STATE,
  TOAST_DURATION_MS,
  toastPlacement,
  toastReducer,
  type ToastPlacement,
} from './overlay';

export type ToastApi = {
  readonly show: (message: string) => void;
  readonly dismiss: () => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export type ToastProviderProps = {
  readonly children: ReactNode;
  /** Top on iOS, the bottom snackbar elsewhere, unless given. */
  readonly placement?: ToastPlacement;
};

export function ToastProvider({
  children,
  placement = toastPlacement(Platform.OS),
}: ToastProviderProps) {
  const [{ current }, dispatch] = useReducer(toastReducer, INITIAL_TOAST_STATE);

  useEffect(() => {
    if (!current) return undefined;
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(current.message);
    const timer = setTimeout(() => dispatch({ type: 'expire', id: current.id }), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [current]);

  const api = useMemo<ToastApi>(
    () => ({
      show: (message) => dispatch({ type: 'show', message }),
      dismiss: () => dispatch({ type: 'dismiss' }),
    }),
    [],
  );

  return (
    <ToastContext.Provider value={api}>
      <View style={styles.fill}>
        {children}
        {current ? (
          <Toast key={current.id} message={current.message} placement={placement} />
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

/** show() and dismiss(); only inside ToastProvider. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used within ToastProvider');
  return api;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
