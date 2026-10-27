// The server voice's MP3s on the phone (27 Oct 2026): the server speaker's SpeechFiles bound to
// expo-file-system, in one folder under the cache. Each sentence's file lives from its download to
// the end of its playback (or the stop that cut it short) and is then deleted; the folder is
// emptied before the first file of each launch, so a file a crash left behind goes too. Nothing
// here is logged with a file's contents, and the bytes never leave the phone's cache.

import { Directory, File, Paths } from 'expo-file-system';

import { logger } from '../../lib/logger';
import type { SpeechFiles } from './server-speaker-ports';

/** The one folder under the cache the server voice's files are kept in. */
export const SERVER_VOICE_FOLDER = 'server-voice';

let emptied = false;
let written = 0;

function folder(): Directory {
  return new Directory(Paths.cache, SERVER_VOICE_FOLDER);
}

function removeQuietly(entry: File | Directory): void {
  try {
    if (entry.exists) entry.delete();
  } catch (error) {
    logger.warn('[voice] a server voice file could not be deleted', error);
  }
}

function write(bytes: Uint8Array): string {
  const dir = folder();
  if (!emptied) {
    emptied = true;
    removeQuietly(dir);
  }
  dir.create({ intermediates: true, idempotent: true });
  written += 1;
  const file = new File(dir, `sentence-${Date.now()}-${written}.mp3`);
  file.create({ overwrite: true });
  file.write(bytes);
  return file.uri;
}

export const speechFiles: SpeechFiles = Object.freeze({
  write,
  remove: (uri: string) => removeQuietly(new File(uri)),
});
