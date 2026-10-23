// The Questions' wire shapes (D-ONE-CLIENT: zod at the boundary, unknown fields ignored): GET
// /api/v1/approval-grants?status=pending&kind=question, api/approval_grants.py list_grants at the
// pinned SHA: each grant's to_dict, its cascade (services/ask_cascade.py, at most 6 tasks listed)
// and its owner (services/grant_owners.py). The list is never persisted (query-keys.ts 'questions':
// question text stays off the phone's disk). Of `details` only the stopped-run marker is read
// (services/playbook_owner_ask.py ask_marker: details.playbook_ask.execution_id), because a stopped
// run's question closes its run when dismissed. A grant this version cannot read is left out.

import { z } from 'zod';

import { logger } from '../../lib/logger';

const Text = z.string().nullable().catch(null);
const RowId = z.number().int().nullable().catch(null);
/** subject_id is a string column; a number is read as its text. */
const AnyId = z
  .union([z.string(), z.number()])
  .nullable()
  .catch(null)
  .transform((value) => (value === null ? null : String(value)));

/** Only list entries of the right shape are kept; a missing or broken list is empty. */
function rowsOf<T extends z.ZodTypeAny>(row: T) {
  return z
    .array(z.unknown())
    .catch([])
    .transform((items): z.output<T>[] =>
      items.flatMap((item) => {
        const parsed = row.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      }),
    );
}

/** The options are the answers offered, as sent (an option is matched exactly by the server). */
const Options = z
  .array(z.unknown())
  .nullable()
  .catch(null)
  .transform((items) =>
    (items ?? []).filter((item): item is string => typeof item === 'string' && !!item.trim()),
  );

const OwnerSchema = z
  .object({
    agent: z.object({ id: z.number().int(), name: Text }).nullable().catch(null),
    /** The ticket it was asked on: number is '#0042' (PRD-252 R4), null on an older server. */
    ticket: z.object({ id: z.number().int(), title: Text, number: Text }).nullable().catch(null),
  })
  .nullable()
  .catch(null);

const CascadeTaskSchema = z.object({ id: z.number().int(), title: Text, status: Text });

/** The downstream work parked behind the question: the total, and up to six of them. */
const CascadeSchema = z
  .object({
    total: z.number().int().nonnegative().catch(0),
    tasks: rowsOf(CascadeTaskSchema),
  })
  .catch({ total: 0, tasks: [] });

/** ask_marker(grant): the question stopped a playbook run, which a dismiss closes. */
const StoppedRun = z
  .object({
    playbook_ask: z.object({ execution_id: z.unknown() }).nullable().catch(null),
  })
  .nullable()
  .catch(null)
  .transform((details) => Boolean(details?.playbook_ask?.execution_id));

export const QuestionSchema = z
  .object({
    id: z.number().int(),
    status: Text,
    question_md: z.string().catch(''),
    options: Options,
    subject_type: Text,
    subject_id: AnyId,
    asked_by_agent_id: RowId,
    owner: OwnerSchema,
    cascade: CascadeSchema,
    details: StoppedRun,
  })
  .transform(({ details, ...grant }) => ({ ...grant, stoppedRun: details }));

export type Question = Readonly<z.output<typeof QuestionSchema>>;
export type QuestionOwner = NonNullable<Question['owner']>;
export type QuestionCascade = Question['cascade'];

/** The grants that parse; one this version cannot read is logged and left out. */
const QuestionRows = z.array(z.unknown()).transform((items): Question[] =>
  items.flatMap((item) => {
    const parsed = QuestionSchema.safeParse(item);
    if (parsed.success) return [parsed.data];
    logger.debug('[cc/questions] left out a question this version cannot read');
    return [];
  }),
);

export const QuestionsSchema = z.object({ grants: QuestionRows });

export type Questions = Readonly<z.output<typeof QuestionsSchema>>;

/** What /answer and /deny send back: {grant: to_dict}; only what the toast reads is kept. */
const DecidedGrantSchema = z
  .object({ id: z.number().int(), status: Text, answer_text: Text })
  .nullable()
  .catch(null);

export const DecisionResultSchema = z.object({ grant: DecidedGrantSchema });

export type DecisionResult = Readonly<z.output<typeof DecisionResultSchema>>;
