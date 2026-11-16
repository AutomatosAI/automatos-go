// The store-copy audit's true negatives (store-copy.test.ts, R12–R14): each the exact text, where
// it is, the rule it trips and why it keeps the rule. A new one fails the audit until it is
// reworded or listed here with a reason; a listed one that is gone fails it too. The rules and
// their phrases are the audit's own (support/forbidden-copy.ts).

import type { CopyRuleId } from '../support/forbidden-copy';
import { frozen } from './types';

export type AllowedCopy = Readonly<{
  file: string;
  text: string;
  rule: CopyRuleId;
  reason: string;
}>;

/** True negatives: the exact text, where it is, the rule it trips and why it keeps the rule. */
export const ALLOWED: readonly AllowedCopy[] = frozen([
  {
    file: 'src/styles/strings.ts',
    text: 'Can you make me a shortlist under £700?',
    rule: 'BILLING',
    reason:
      "The look picker's sample conversation (US-016h): a person asks Auto for laptops within a budget. The app prices and sells nothing, and the line names no plan, credit or price of its own (D8).",
  },
  {
    file: 'src/voice/strings.ts',
    text: 'Download the ${…} speech model to talk to Auto. It stays on your phone.',
    rule: 'DATA_CLAIMS',
    reason:
      "Android's offline speech model (A6 quick-ask): 'It' is the downloaded model, which is stored on the phone. The sentence claims nothing about the person's words, which go to Auto as typed words do (D70).",
  },
]);
