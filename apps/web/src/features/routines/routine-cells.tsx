import { TimeField } from '../../components/TimeField';
import { Avatar, Button, ColorSwatch, Group, NumberInput, Popover, Select, Stack, Text, TextInput, Tooltip, UnstyledButton } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { ROUTINE_ANCHOR_LABELS, routineSchema, type Recurrence, type RoutineAnchor, type RoutineCase } from '@ordo/shared';
import { CheckIcon, HourglassMediumIcon } from '@phosphor-icons/react';
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { BatchMultiSelect } from '../../components/BatchMultiSelect';
import { categoryOptions, categoryTree } from '../../components/category-tree/category-tree';
import { describeRecurrence } from '../../components/recurrence/describe-recurrence';
import { RecurrenceEditor } from '../../components/recurrence/RecurrenceEditor';
import { notifyError } from '../../lib/notify';
import { useWorkSchedules } from '../calendar/api';
import type { TaskContext } from '../tasks/use-task-context';
import classes from '../../components/data-table/EditableCells.module.css';
import { StackedMultiCell } from '../tasks/views/StackedMultiCell';
import { useRoutineMutations, type Routine, type RoutineCategory } from './api';
import { routinesLabel, useRoutineCellEdit } from './routine-cell-edit';
import { DAILY, describeRoutineCase, ruleOf, scheduleOf, waitingFor, windowOf, windowText } from './routine-format';
import { openRoutineForm } from './open-routine-form';
import { treeSelectProps } from '../../components/tree-select/tree-select';

/** Borderless field filling the cell; a border shows on hover and focus (as the cells of the task tables). */
const cellField = {
  variant: 'unstyled',
  size: 'xs',
  classNames: { root: classes.root, input: classes.input, section: classes.section },
} as const;

/** Select fields: dropdown as wide as its options. */
const cellCombobox = { ...cellField, comboboxProps: { withinPortal: true, width: 'max-content', position: 'bottom-start' } } as const;

/** Multi-select fields: their values as pills. */
const cellMulti = { ...cellCombobox, classNames: { ...cellField.classNames, pillsList: classes.pills } } as const;

/**
 * Keys of a typed cell: Enter saves (by leaving the field), Escape gives up the draft.
 * @param {KeyboardEvent<HTMLInputElement>} event Key event.
 * @param {() => void} cancel Gives up the draft.
 * @returns {void}
 */
function cellKeys(event: KeyboardEvent<HTMLInputElement>, cancel: () => void): void {
  if (event.key === 'Enter') event.currentTarget.blur();
  if (event.key === 'Escape') {
    cancel();
    event.currentTarget.blur();
  }
}

/**
 * Accessible label of a cell, with the number of routines it changes on a selection.
 * @param {string} field Field name.
 * @param {Routine} routine Routine.
 * @param {number} count Routines changed by an edit.
 * @returns {string} Label.
 */
const fieldLabel = (field: string, routine: Routine, count: number) => `${field} de ${routine.title}${count > 1 ? ` (${routinesLabel(count)})` : ''}`;

/**
 * Ids added and removed between two lists.
 * @param {string[]} before Previous ids.
 * @param {string[]} after New ids.
 * @returns {{ added: string[], removed: string[] }} Differences.
 */
const diff = (before: string[], after: string[]) => ({ added: after.filter((id) => !before.includes(id)), removed: before.filter((id) => !after.includes(id)) });

interface CellProps {
  routine: Routine;
  readOnly?: boolean;
}

/**
 * Title cell: typed in place, saved when leaving the field if valid and changed (one routine at a time).
 * @param {CellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TitleCell({ routine, readOnly = false }: CellProps) {
  const { patch } = useRoutineMutations();
  const [draft, setDraft] = useState<string | null>(null);

  /**
   * Saves the draft when valid and changed.
   * @returns {void}
   */
  const save = () => {
    if (draft === null) return;
    setDraft(null);
    const result = routineSchema.shape.title.safeParse(draft);
    if (!result.success) {
      notifyError(`${result.error.issues[0]?.message ?? 'Titre invalide.'} Rien n’a été modifié.`);
      return;
    }
    if (result.data !== routine.title) patch.mutate({ id: routine.id, input: { title: result.data } }, { onError: (error) => notifyError(error.message) });
  };

  return (
    <TextInput
      {...cellField}
      aria-label={`Titre de ${routine.title}`}
      readOnly={readOnly}
      value={draft ?? routine.title}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={save}
      onKeyDown={(event) => cellKeys(event, () => setDraft(null))}
      fw={500}
      style={{ flex: 1, minWidth: 0 }}
    />
  );
}

/**
 * Time to spend on it, in minutes: typed in place, saved when leaving the field if valid and changed.
 * @param {CellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function EstimateCell({ routine, readOnly = false }: CellProps) {
  const { apply, count } = useRoutineCellEdit(routine, 'estimate');
  const [draft, setDraft] = useState<string | number | null>(null);

  /**
   * Saves the draft when valid and changed.
   * @returns {void}
   */
  const save = () => {
    if (draft === null) return;
    setDraft(null);
    const result = routineSchema.shape.estimate.safeParse(draft === '' ? null : Number(draft));
    if (!result.success) {
      notifyError(`${result.error.issues[0]?.message ?? 'Durée invalide.'} Rien n’a été modifié.`);
      return;
    }
    if (result.data !== routine.estimate || count > 1) apply({ estimate: result.data }, { estimate: result.data });
  };

  return (
    <NumberInput
      {...cellField}
      aria-label={fieldLabel('Temps à consacrer', routine, count)}
      placeholder={readOnly ? undefined : '—'}
      readOnly={readOnly}
      min={1}
      max={24 * 60}
      allowDecimal={false}
      allowNegative={false}
      suffix=" min"
      hideControls
      value={draft ?? routine.estimate ?? ''}
      onChange={setDraft}
      onBlur={save}
      onKeyDown={(event) => cellKeys(event, () => setDraft(null))}
    />
  );
}

/**
 * Time window cell: from when and by when to do it, typed in place (each one optional); under them, when to leave and
 * when back (from its travel times and time to spend on it). On a column selection, the time changed applies to every
 * selected routine.
 * @param {CellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TimeWindowCell({ routine, readOnly = false }: CellProps) {
  const { apply, count } = useRoutineCellEdit(routine, 'time');
  const [drafts, setDrafts] = useState<{ fromTime?: string; dueTime?: string }>({});
  const { data: schedules } = useWorkSchedules();
  const { leaveAt, backAt } = scheduleOf(routine);
  const schedule = routine.scheduleId ? schedules?.find((item) => item.id === routine.scheduleId) : undefined;

  /**
   * Saves one of the times when valid and changed.
   * @param {'fromTime' | 'dueTime'} field Time edited.
   * @returns {void}
   */
  const save = (field: 'fromTime' | 'dueTime') => {
    const draft = drafts[field];
    if (draft === undefined) return;
    setDrafts((current) => ({ ...current, [field]: undefined }));
    const result = routineSchema.shape[field].safeParse(draft || null);
    if (!result.success) {
      notifyError(`${result.error.issues[0]?.message ?? 'Heure invalide.'} Rien n’a été modifié.`);
      return;
    }
    const window = { fromTime: routine.fromTime, dueTime: routine.dueTime, [field]: result.data };
    if (count === 1 && window.fromTime && window.dueTime && window.fromTime >= window.dueTime) {
      notifyError('L’heure maximale doit suivre l’heure de début. Rien n’a été modifié.');
      return;
    }
    if (result.data !== routine[field] || count > 1) apply({ [field]: result.data }, { [field]: result.data });
  };

  /**
   * One of the times.
   * @param {'fromTime' | 'dueTime'} field Time.
   * @param {string} name Its name.
   * @returns {JSX.Element} Field.
   */
  const input = (field: 'fromTime' | 'dueTime', name: string) => (
    <TimeField
      {...cellField}
      aria-label={fieldLabel(name, routine, count)}
      readOnly={readOnly}
      value={drafts[field] ?? routine[field] ?? ''}
      onChange={(value) => setDrafts((current) => ({ ...current, [field]: value }))}
      onBlur={() => save(field)}
      onKeyDown={(event) => {
        // Enter saves (by leaving the field), Escape gives up the draft.
        if (event.key === 'Enter') (document.activeElement as HTMLElement | null)?.blur();
        if (event.key === 'Escape') {
          setDrafts((current) => ({ ...current, [field]: undefined }));
          (document.activeElement as HTMLElement | null)?.blur();
        }
      }}
      style={{ flex: 1, minWidth: 0 }}
    />
  );

  return (
    <Stack gap={0}>
      {(routine.cases as RoutineCase[]).length ? (
        <UnstyledButton className={classes.root} onClick={() => openRoutineForm({ routine })} disabled={readOnly} aria-label={`Horaire de ${routine.title} : selon ses cas`}>
          <Text size="xs">Selon le cas</Text>
          <Text size="xs" c="dimmed">
            {routine.slots.map((slot) => windowText(slot) || 'dans la journée').join(' · ') || 'pas ce jour-là'}
          </Text>
        </UnstyledButton>
      ) : routine.scheduleId ? (
        <UnstyledButton
          className={classes.root}
          onClick={() => openRoutineForm({ routine })}
          disabled={readOnly}
          aria-label={`Horaire de ${routine.title} : plage ${schedule?.name ?? ''}, ${ROUTINE_ANCHOR_LABELS[routine.scheduleAnchor as RoutineAnchor]?.toLowerCase() ?? ''}`}
        >
          <Text size="xs" truncate>
            {schedule?.name ?? 'Plage'} · {ROUTINE_ANCHOR_LABELS[routine.scheduleAnchor as RoutineAnchor]?.toLowerCase()}
          </Text>
          <Text size="xs" c="dimmed">
            {windowText(windowOf(routine)) || 'pas de créneau'}
          </Text>
        </UnstyledButton>
      ) : (
        <Group gap={2} wrap="nowrap">
          {input('fromTime', 'À partir de')}
          <Text size="xs" c="dimmed" aria-hidden>
            –
          </Text>
          {input('dueTime', 'Avant')}
        </Group>
      )}
      {(leaveAt || backAt) && (
        <Tooltip
          label={[
            leaveAt && `Partir à ${leaveAt} (trajet ${routine.travelBefore} min${routine.estimate && routine.windowTo ? `, ${routine.estimate} min sur place` : ''})`,
            backAt && `Retour vers ${backAt}`,
            routine.location,
          ]
            .filter(Boolean)
            .join(' · ')}
        >
          <Text size="xs" c="dimmed" className={classes.input} style={{ whiteSpace: 'nowrap' }}>
            {leaveAt && `Départ ${leaveAt}`}
            {leaveAt && backAt && ' · '}
            {backAt && `retour ${backAt}`}
          </Text>
        </Tooltip>
      )}
    </Stack>
  );
}

/**
 * Categories cell: the categories one under the other; a click opens the multi-select of the categories (as their
 * path). On a column selection, adding a category adds it to every selected routine and removing one removes it.
 * @param {CellProps & { categories: RoutineCategory[] }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function CategoriesCell({ routine, readOnly = false, categories }: CellProps & { categories: RoutineCategory[] }) {
  const { apply, count } = useRoutineCellEdit(routine, 'categories');
  const placed = categoryTree(categories);
  return (
    <StackedMultiCell
      label={fieldLabel('Catégories', routine, count)}
      readOnly={readOnly}
      items={placed
        .filter((item) => routine.categoryIds.includes(item.category.id))
        .map((item) => ({ id: item.category.id, label: item.category.name, title: item.path, icon: item.color ? <ColorSwatch color={item.color} size={8} style={{ flexShrink: 0 }} /> : undefined }))}
      renderSelect={({ onDropdownClose }) => (
        <BatchMultiSelect
          {...cellMulti}
          aria-label={fieldLabel('Catégories', routine, count)}
          {...treeSelectProps(categoryOptions(categories))}
          value={routine.categoryIds}
          onChange={(categoryIds) => {
            const { added, removed } = diff(routine.categoryIds, categoryIds);
            apply({ categoryIds }, { addCategoryIds: added, removeCategoryIds: removed });
          }}
          onDropdownClose={onDropdownClose}
          placeholder={routine.categoryIds.length ? undefined : '—'}
          nothingFoundMessage="Aucune catégorie (ajoutez-en dans les paramètres)"
          searchable
        />
      )}
    />
  );
}

/**
 * Assignees cell: the assignees one under the other; a click opens the multi-select of the contributors. On a column
 * selection, adding a contributor adds them to every selected routine and removing one removes them.
 * @param {CellProps & { context: TaskContext }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function AssigneesCell({ routine, readOnly = false, context }: CellProps & { context: TaskContext }) {
  const { apply, count } = useRoutineCellEdit(routine, 'assignees');
  return (
    <StackedMultiCell
      label={fieldLabel('Assignés', routine, count)}
      readOnly={readOnly}
      items={routine.assigneeIds.flatMap((id) => {
        const contributor = context.contributorById.get(id);
        return contributor
          ? [{ id, label: context.contributorName(contributor), icon: <Avatar src={contributor.avatarUrl} name={contributor.name} color="initials" size={16} style={{ flexShrink: 0 }} /> }]
          : [];
      })}
      renderSelect={({ onDropdownClose }) => (
        <BatchMultiSelect
          {...cellMulti}
          aria-label={fieldLabel('Assignés', routine, count)}
          data={context.contributors.map((contributor) => ({ value: contributor.id, label: context.contributorName(contributor) }))}
          renderOption={({ option }) => {
            const contributor = context.contributorById.get(option.value);
            return (
              <Group gap="xs" wrap="nowrap">
                <Avatar src={contributor?.avatarUrl} name={contributor?.name} color="initials" size={20} />
                {option.label}
              </Group>
            );
          }}
          value={routine.assigneeIds}
          onChange={(assigneeIds) => {
            const { added, removed } = diff(routine.assigneeIds, assigneeIds);
            apply({ assigneeIds }, { addAssigneeIds: added, removeAssigneeIds: removed });
          }}
          onDropdownClose={onDropdownClose}
          placeholder={routine.assigneeIds.length ? undefined : '—'}
          searchable
        />
      )}
    />
  );
}

/**
 * "Dépend de" cell: the routines to do before this one, one under the other (those still to do for their current
 * occurrence marked with an hourglass); a click opens the multi-select of the other routines. On a column selection,
 * the change applies to every selected routine (never to itself).
 * @param {CellProps & { routines: Routine[] }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function RequiresCell({ routine, readOnly = false, routines }: CellProps & { routines: Routine[] }) {
  const { apply, count } = useRoutineCellEdit(routine, 'requires');
  const byId = new Map(routines.map((other) => [other.id, other]));
  const waiting = new Set(waitingFor(routine, byId).map((other) => other.id));
  return (
    <StackedMultiCell
      label={fieldLabel('Dépendances', routine, count)}
      readOnly={readOnly}
      items={routine.requiredIds.flatMap((id) => {
        const required = byId.get(id);
        return required
          ? [
              {
                id,
                label: required.title,
                title: waiting.has(id) ? `${required.title} (pas encore faite)` : required.title,
                icon: waiting.has(id) ? (
                  <HourglassMediumIcon aria-hidden color="var(--mantine-color-orange-6)" style={{ flexShrink: 0 }} />
                ) : (
                  <CheckIcon aria-hidden color="var(--mantine-color-green-6)" style={{ flexShrink: 0 }} />
                ),
              },
            ]
          : [];
      })}
      renderSelect={({ onDropdownClose }) => (
        <BatchMultiSelect
          {...cellMulti}
          aria-label={fieldLabel('Dépendances', routine, count)}
          data={routines
            .filter((other) => other.id !== routine.id && (!other.archived || routine.requiredIds.includes(other.id)))
            .map((other) => ({ value: other.id, label: other.title }))
            .sort((a, b) => a.label.localeCompare(b.label, 'fr'))}
          value={routine.requiredIds}
          onChange={(requiredIds) => {
            const { added, removed } = diff(routine.requiredIds, requiredIds);
            apply({ requiredIds }, { addRequiredIds: added, removeRequiredIds: removed });
          }}
          onDropdownClose={onDropdownClose}
          placeholder={routine.requiredIds.length ? undefined : '—'}
          searchable
        />
      )}
    />
  );
}

/**
 * Project cell: the project the tracked time of the routine goes to (none: the time has no project).
 * @param {CellProps & { context: TaskContext }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function ProjectCell({ routine, readOnly = false, context }: CellProps & { context: TaskContext }) {
  const { apply, count } = useRoutineCellEdit(routine, 'project');
  const options = context.projectOptions(context.projects.filter((project) => !project.archived || project.id === routine.projectId));
  return (
    <Select
      {...cellCombobox}
      {...treeSelectProps(options)}
      aria-label={fieldLabel('Projet', routine, count)}
      readOnly={readOnly}
      placeholder={readOnly ? undefined : '—'}
      clearable={!readOnly}
      searchable
      nothingFoundMessage="Aucun projet"
      value={routine.projectId}
      onChange={(projectId) => (projectId !== routine.projectId || count > 1) && apply({ projectId }, { projectId })}
    />
  );
}

/**
 * Repetition of a routine in words, shown under its title: its rule, its cases, or the days of its calendar schedule.
 * @param {{ routine: Routine }} props Component props.
 * @returns {JSX.Element} Text.
 */
export function RepetitionText({ routine }: { routine: Routine }) {
  const { data: schedules } = useWorkSchedules();
  const cases = routine.cases as RoutineCase[];
  const rule = ruleOf(routine);
  const text = cases.length
    ? cases.map((item) => describeRoutineCase(item, routine.startDate)).join(' ; ')
    : routine.scheduleId
      ? `Les jours de « ${schedules?.find((item) => item.id === routine.scheduleId)?.name ?? 'sa plage'} »`
      : rule
        ? describeRecurrence(rule, routine.startDate)
        : '';
  return (
    <Text size="xs" c="dimmed" lineClamp={1} title={text} px={6}>
      {text}
    </Text>
  );
}

/**
 * "Quand" cell: where the routine stands today (its content); a click edits its repetition: its first date and rule in
 * place, or its form for cases and calendar schedules. On a column selection, the rule applies to every selected
 * routine.
 * @param {CellProps & { children: ReactNode }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function RepetitionCell({ routine, readOnly = false, children }: CellProps & { children: ReactNode }) {
  const { apply, count } = useRoutineCellEdit(routine, 'repetition');
  const [opened, setOpened] = useState(false);
  const [startDate, setStartDate] = useState(routine.startDate);
  const [rule, setRule] = useState<Recurrence>(ruleOf(routine) ?? DAILY);
  const current = ruleOf(routine);

  /**
   * Opens the editor on the current values.
   * @returns {void}
   */
  const open = () => {
    setStartDate(routine.startDate);
    setRule(current ?? DAILY);
    setOpened(true);
  };

  if (routine.scheduleId || (routine.cases as RoutineCase[]).length) {
    return (
      <UnstyledButton onClick={() => openRoutineForm({ routine })} disabled={readOnly} aria-label={`Modifier la répétition de ${routine.title}`}>
        {children}
      </UnstyledButton>
    );
  }

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" width={420} shadow="md" trapFocus withinPortal>
      <Popover.Target>
        <UnstyledButton onClick={open} disabled={readOnly} aria-label={`Modifier la répétition de ${routine.title}${count > 1 ? ` (${routinesLabel(count)})` : ''}`}>
          {children}
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="sm">
          {count > 1 && (
            <Text size="xs" c="dimmed">
              S’applique à {routinesLabel(count)}.
            </Text>
          )}
          <DatePickerInput label="Première fois" size="xs" valueFormat="D MMM YYYY" value={startDate} onChange={(value) => value && setStartDate(value)} popoverProps={{ withinPortal: false }} />
          <RecurrenceEditor value={rule} onChange={(value) => setRule(value ?? DAILY)} start={startDate} withinPortal={false} />
          <Group justify="space-between" gap="sm">
            <Button size="xs" variant="subtle" onClick={() => (setOpened(false), openRoutineForm({ routine }))}>
              Plusieurs cas, plage…
            </Button>
            <Group gap="sm">
              <Button size="xs" variant="default" onClick={() => setOpened(false)}>
                Annuler
              </Button>
              <Button
                size="xs"
                onClick={() => {
                  setOpened(false);
                  apply({ startDate, recurrence: rule }, { startDate, recurrence: rule });
                }}
              >
                Enregistrer
              </Button>
            </Group>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
