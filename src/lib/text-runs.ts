// Runs of like characters, found by reading the text once (pure). Where text a server chooses (a
// reply, a file name, a file's content) is trimmed or cut at a run, a pattern such as /[.-]+$/ or
// /\s+#+\s*$/ starts again at every character of a long run that does not end where it must: the
// work grows with the square of the run. These read each character at most once instead.

/** Whether one character (one UTF-16 unit) belongs to the run. */
export type Takes = (char: string) => boolean;

/** Where the run that `takes` starting at `from` ends: the first index after it. */
export function runEnd(text: string, from: number, takes: Takes): number {
  let at = from;
  while (at < text.length && takes(text.charAt(at))) at += 1;
  return at;
}

/** Where the run that `takes` ending just before `to` starts. */
export function runStart(text: string, to: number, takes: Takes): number {
  let at = to;
  while (at > 0 && takes(text.charAt(at - 1))) at -= 1;
  return at;
}

/** The text without the run `takes` at its start and the run at its end. */
export function trimRuns(text: string, takes: Takes): string {
  const start = runEnd(text, 0, takes);
  return start === text.length ? '' : text.slice(start, runStart(text, text.length, takes));
}
