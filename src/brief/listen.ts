// Listen on the brief (PRD-268 §6.4 'Spoken', §6.12.5 'Listen', §6.12.6; US-G03), pure over the one
// voice out (src/voice/speech/reply-voice.ts; use-brief-listen.ts hands in voice-out.ts's). It reads
// the brief's own `spoken` words (the greeting and the numbered row titles, already speechified by
// core: Auto says titles only, the screen shows the why), else Auto's Read made speakable, sentence
// by sentence: Auto's server voice when the speech carries one (the server lists `tts` and the
// person keeps Auto's voice), the phone's voice for the rest of the reading once the server refuses
// (tts_off, tts_busy, …), as quick-ask falls back. Nothing plays until read() (never auto-plays,
// §12-Q12); a second press is stop().
//   The reader takes the voice's one listener only while it reads (a stack: the screen's quick-ask,
// if any, is covered meanwhile and hears again after), so a card left on screen never holds it. A
// reading ends when the voice says its last sentence ended or it was stopped; when another engine
// takes the listener (the voice screen opening, Settings → Voice), the reading stops there. stop()
// silences the voice only while this reader is reading: a card going away never stops anyone
// else's speech. One generation per read, so a late voice pick or event of an older one does nothing.

import { logger } from '../lib/logger';
import type { ServerSpeech } from '../voice/server/server-speaker-ports';
import { speakOptionsFor, type VoiceSetting } from '../voice/settings/voice-setting';
import type { ReplyVoice } from '../voice/speech/reply-voice';
import { sentenceChunker } from '../voice/speech/sentences';
import { toSpeakable } from '../voice/speech/speakable';
import type { Brief } from './schema';

/** What Listen reads: the brief's spoken words, else Auto's Read as a voice can say it; '' for none. */
export function briefSpokenText(brief: Pick<Brief, 'spoken' | 'prose'>): string {
  const spoken = brief.spoken?.trim();
  return spoken ? spoken : toSpeakable(brief.prose).trim();
}

/**
 * What one queued piece holds at most: short sentences ('1.' before a title) travel together, so
 * each piece is one request and one natural run of speech; a sentence is never cut here (the
 * voices cut one over their own limit at a space).
 */
export const BRIEF_PIECE_CHARS = 200;

/** The text as the pieces the voice queues one by one: whole sentences, packed up to the limit. */
export function briefSentences(text: string): readonly string[] {
  const chunker = sentenceChunker();
  const sentences = [...chunker.push(text), ...chunker.flush()];
  return sentences.reduce<readonly string[]>((pieces, sentence) => {
    const last = pieces[pieces.length - 1];
    if (last === undefined || last.length + 1 + sentence.length > BRIEF_PIECE_CHARS)
      return [...pieces, sentence];
    return [...pieces.slice(0, -1), `${last} ${sentence}`];
  }, []);
}

/** How the brief is spoken: "I speak"'s language, its voice choice, and the server voice if any. */
export type BriefSpeech = {
  readonly language: string;
  readonly setting: VoiceSetting;
  readonly server?: ServerSpeech;
};

export type ReaderVoice = Pick<ReplyVoice, 'speak' | 'stop' | 'listen' | 'newTurn' | 'voiceFor'>;

export type BriefReader = {
  /** Reads `text` aloud; nothing when it has nothing to say. */
  readonly read: (text: string, speech: BriefSpeech) => Promise<void>;
  /** Stops this reader's reading; nothing when it is not reading. */
  readonly stop: () => void;
  readonly reading: () => boolean;
  /** Told whenever reading() changes; returns the remover. */
  readonly subscribe: (listener: () => void) => () => void;
};

type ReaderState = {
  /** Bumped by every read and stop: a late voice pick or event of an older reading does nothing. */
  readonly generation: number;
  readonly reading: boolean;
  /** Gives the voice's listener back; null while the reading does not hold it. */
  readonly unlisten: (() => void) | null;
  readonly listeners: ReadonlySet<() => void>;
};

/** One cell holds the state, replaced whole on every change. */
type Cell = { state: ReaderState };

function update(cell: Cell, changes: Partial<ReaderState>): void {
  cell.state = { ...cell.state, ...changes };
}

function setReading(cell: Cell, reading: boolean): void {
  if (cell.state.reading === reading) return;
  update(cell, { reading });
  cell.state.listeners.forEach((listener) => listener());
}

/** The reading is over: the listener given back, the card back to Listen. */
function settle(cell: Cell): void {
  const { unlisten } = cell.state;
  update(cell, { unlisten: null });
  unlisten?.();
  setReading(cell, false);
}

/** A new generation: whatever an older reading still waits for is ignored when it comes. */
function nextGeneration(cell: Cell): number {
  update(cell, { generation: cell.state.generation + 1 });
  return cell.state.generation;
}

async function phoneVoiceOf(voice: ReaderVoice, speech: BriefSpeech): Promise<string | undefined> {
  try {
    return await voice.voiceFor(speech.language, speech.setting.voice);
  } catch (error) {
    logger.warn("[brief] the brief's voice was not found; using the default", error);
    return undefined;
  }
}

/** Takes the voice's listener for this reading: its end, or another engine taking over, settles it. */
function listenFor(cell: Cell, voice: ReaderVoice, generation: number): void {
  const unlisten = voice.listen(
    (event) => {
      if (generation !== cell.state.generation || event.type === 'speak_start') return;
      settle(cell);
    },
    () => {
      if (generation !== cell.state.generation) return;
      nextGeneration(cell);
      voice.stop();
      settle(cell);
    },
  );
  update(cell, { unlisten });
}

const IDLE: ReaderState = Object.freeze({
  generation: 0,
  reading: false,
  unlisten: null,
  listeners: new Set<() => void>(),
});

export function createBriefReader(voice: ReaderVoice): BriefReader {
  const cell: Cell = { state: IDLE };

  async function read(text: string, speech: BriefSpeech): Promise<void> {
    const sentences = briefSentences(text);
    if (sentences.length === 0) return;
    const generation = nextGeneration(cell);
    setReading(cell, true);
    const phoneVoice = await phoneVoiceOf(voice, speech);
    if (generation !== cell.state.generation) return;
    // whatever was speaking stops first (its own listener hears that), then this reading listens
    voice.stop();
    listenFor(cell, voice, generation);
    voice.newTurn();
    const options = speakOptionsFor(speech.language, phoneVoice, speech.setting, speech.server);
    sentences.forEach((sentence) => voice.speak(sentence, options));
  }

  function stop(): void {
    if (!cell.state.reading) return;
    nextGeneration(cell);
    if (cell.state.unlisten) voice.stop();
    settle(cell);
  }

  return Object.freeze({
    read,
    stop,
    reading: () => cell.state.reading,
    subscribe: (listener: () => void) => {
      update(cell, { listeners: new Set([...cell.state.listeners, listener]) });
      return () => {
        const kept = [...cell.state.listeners].filter((each) => each !== listener);
        update(cell, { listeners: new Set(kept) });
      };
    },
  });
}
