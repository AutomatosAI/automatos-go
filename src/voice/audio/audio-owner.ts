// One audio owner at a time (KV13, US-019g): none | recognizer | speaker | live. Pure: no React,
// React Native or Expo, and no module calls: claim() says who owns the audio next and what the
// caller must stop first.
//   The recognizer takes the audio from the speaker (barge-in: pressing while Auto speaks stops the
//   speech before the mic opens). The speaker never talks over the open mic: its claim while the
//   recognizer holds the audio is refused (the user is talking). Live takes the audio from both,
//   whatever was holding it (phase 2: it aborts recognition and stops speech), and while Live is up
//   quick-ask's claims are refused. Claiming 'none' (STOP) stops whoever holds the audio.

export type AudioOwner = 'none' | 'recognizer' | 'speaker' | 'live';

/** Something that holds the audio and can be stopped. */
export type AudioUser = Exclude<AudioOwner, 'none'>;

export type AudioClaim = {
  /** Who owns the audio after the claim. */
  readonly owner: AudioOwner;
  /** What the caller stops before going on, in order. */
  readonly stop: readonly AudioUser[];
  /** false: the claim was refused and the owner is unchanged. */
  readonly granted: boolean;
};

const NOTHING: readonly AudioUser[] = Object.freeze([]);
/** Live stops recognition and speech alike: nothing of quick-ask may sound in a call. */
const QUICK_ASK: readonly AudioUser[] = Object.freeze(['recognizer', 'speaker']);

function granted(owner: AudioOwner, stop: readonly AudioUser[]): AudioClaim {
  return Object.freeze({ owner, stop, granted: true });
}

function refused(owner: AudioOwner): AudioClaim {
  return Object.freeze({ owner, stop: NOTHING, granted: false });
}

/** The holder, as the one thing to stop; nothing when no one holds the audio. */
function holder(owner: AudioOwner): readonly AudioUser[] {
  return owner === 'none' ? NOTHING : Object.freeze([owner]);
}

export function claim(owner: AudioOwner, next: AudioOwner): AudioClaim {
  if (next === owner) return granted(owner, NOTHING);
  if (next === 'none') return granted('none', holder(owner));
  if (next === 'live') return granted('live', QUICK_ASK);
  // Quick-ask is off while Live is up; the speaker never talks over the open mic.
  if (owner === 'live' || (next === 'speaker' && owner === 'recognizer')) return refused(owner);
  return granted(next, holder(owner));
}

/** `who` is done with the audio (the recognizer ended, the speech ran out): no one holds it now. */
export function release(owner: AudioOwner, who: AudioUser): AudioOwner {
  return owner === who ? 'none' : owner;
}
