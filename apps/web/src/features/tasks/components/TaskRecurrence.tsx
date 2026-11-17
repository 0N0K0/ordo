import { Anchor, Stack, Text } from '@mantine/core';
import { isTaskCases, taskRepetitionSchema, type RepetitionCase, type TaskRepetition } from '@ordo/shared';
import { Link } from 'react-router';
import * as fmt from '../../../lib/format';
import { describeCase, formatLongDate } from '../../../components/recurrence/describe-recurrence';
import { RepetitionEditor, type RepetitionModeValue } from '../../../components/recurrence/RepetitionEditor';
import { RepetitionField } from '../../../components/recurrence/RepetitionField';
import { DeletedDates } from '../../../components/recurrence/DeletedDates';
import { notifySuccess, onMutationError } from '../../../lib/notify';
import { useSetTaskRecurrence, type Task } from '../api';
import { taskRef, type TaskContext } from '../hooks/use-task-context';
import { useTaskLink } from '../hooks/use-task-link';

/** Repetition of a series being edited: one rule (none: it does not repeat) or cases, and its deleted occurrences. */
interface TaskDraft {
  mode: RepetitionModeValue;
  cases: RepetitionCase<null>[];
  exceptions: string[];
}

/**
 * Stored repetition of a task, as edited.
 * @param {Task} task First task of the series.
 * @returns {TaskDraft} Draft.
 */
function draftOf(task: Task): TaskDraft {
  const parsed = taskRepetitionSchema.safeParse(task.recurrence);
  const repetition: TaskRepetition | null = parsed.success ? parsed.data : null;
  if (repetition && isTaskCases(repetition)) return { mode: 'CASES', cases: repetition.cases as RepetitionCase<null>[], exceptions: repetition.exceptions };
  return { mode: 'RULE', cases: [{ since: null, until: null, anchor: null, rule: repetition, times: null }], exceptions: [] };
}

/**
 * Repetition saved from a draft: none, its rule, or its cases.
 * @param {TaskDraft} draft Draft.
 * @returns {TaskRepetition | null} Repetition.
 */
function repetitionOf(draft: TaskDraft): TaskRepetition | null {
  if (draft.mode === 'CASES') return { cases: draft.cases, exceptions: draft.exceptions };
  return draft.cases[0]?.rule ?? null;
}

/**
 * Repetition of a task in its panel: the rule of a series, or the series an occurrence belongs to.
 * @param {{ task: Task, context: TaskContext }} props Component props.
 * @returns {JSX.Element} Section.
 */
export function TaskRecurrence({ task, context }: { task: Task; context: TaskContext }) {
  const link = useTaskLink();
  const setRecurrence = useSetTaskRecurrence();
  const series = task.seriesId ? context.taskById.get(task.seriesId) : undefined;
  const first = series ?? task;
  const start = first.occurrenceDate ?? first.startDate ?? first.endDate;
  return (
    <Stack gap={2}>
      <RepetitionField<TaskDraft>
        value={draftOf(first)}
        editable={Boolean(start) && !task.archived}
        description={start ? undefined : 'Donnez une date à la tâche pour la répéter.'}
        describe={(draft) => {
          if (!start || !repetitionOf(draft)) return [];
          return draft.cases.map((item, index) => `${draft.mode === 'CASES' ? `Cas ${index + 1} · ` : ''}${fmt.capitalize(describeCase(item, start))}`);
        }}
        valid={(draft) => draft.mode !== 'CASES' || draft.cases.length > 0}
        onChange={(draft) =>
          setRecurrence.mutate(
            { id: first.id, recurrence: repetitionOf(draft) },
            {
              onSuccess: () => notifySuccess(repetitionOf(draft) ? 'Répétition enregistrée.' : 'La tâche ne se répète plus.'),
              onError: onMutationError,
            },
          )
        }
        editor={(draft, setDraft) => (
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              La tâche se répète à partir du {start ? formatLongDate(start) : '—'}. Ses occurrences sont créées quand l’agenda affiche leur semaine ou leur mois : elles copient la tâche (titre,
              description, assignés, effort…) avec des dates décalées.
            </Text>
            <RepetitionEditor<null>
              mode={draft.mode}
              onModeChange={(mode) => setDraft({ ...draft, mode })}
              cases={draft.cases}
              onChange={(cases) => setDraft({ ...draft, cases })}
              start={start ?? ''}
              multiple
              exceptions={draft.mode === 'CASES' ? <DeletedDates dates={draft.exceptions} onChange={(exceptions) => setDraft({ ...draft, exceptions })} /> : undefined}
            />
          </Stack>
        )}
      />
      {series && (
        <Text size="xs" c="dimmed">
          Occurrence du {task.occurrenceDate ? formatLongDate(task.occurrenceDate) : '—'} de{' '}
          <Anchor component={Link} to={link.to(series.id)} size="xs">
            {taskRef(series).trim()}
          </Anchor>
        </Text>
      )}
    </Stack>
  );
}
