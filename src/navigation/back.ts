// Where Back goes, pure (the app standard's rule 4.2): the screen before this one when there is
// one, or the fallback (home) when the screen was opened first (a link or a notification), so a
// back button never leaves the person stranded on an empty stack. use-go-back.ts asks the router
// whether there is a screen behind and does what this says.

export type BackMove = Readonly<{ kind: 'back' }> | Readonly<{ kind: 'replace'; href: string }>;

const BACK: BackMove = Object.freeze({ kind: 'back' });

/** Back when there is a screen behind; otherwise the fallback, in this screen's place. */
export function backMove(canGoBack: boolean, fallback: string): BackMove {
  return canGoBack ? BACK : Object.freeze({ kind: 'replace', href: fallback });
}
