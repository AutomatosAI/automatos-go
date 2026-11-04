// The phone's own check by name, for the step-up copy (D-FACE-ID: honest copy). This is the
// iPhone's (and what node's tests read); Metro takes check-copy.android.ts on Android, where the
// check is the fingerprint, the face or the screen lock (docs/release/play-app-access.md, "Approve
// and answer"). Both keep this one shape; the sentences are built in strings.ts and the features'
// strings.

export type CheckCopy = Readonly<{
  /** The check as the switch names it and a sentence opens with it. */
  name: string;
  /** What it asks for, the passcode fallback included (disableDeviceFallback: false). */
  asksFor: string;
  /** What a hint says comes first. */
  first: string;
  /** A phone that cannot be asked. */
  none: string;
  /** Too many tries: what is locked, and how to undo it. */
  lockedOut: string;
}>;

export const CHECK_COPY: CheckCopy = Object.freeze({
  name: 'Face ID',
  asksFor: 'Face ID, or your passcode',
  first: 'Face ID',
  none: 'no passcode or Face ID',
  lockedOut:
    'Face ID is locked after too many tries. Unlock your phone with its passcode, then try again.',
});
