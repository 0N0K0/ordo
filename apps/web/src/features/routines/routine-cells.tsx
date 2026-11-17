import { TimeField } from '../../components/TimeField';
import { ItemAvatar } from '../../components/settings/ItemAvatar';
import { Group, Stack, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { readSlotCondition, routineSchema, type RoutineCase } from '@ordo/shared';
import { describeSlotCondition } from './slot-condition-text';
import { CheckIcon, HourglassMediumIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { BatchMultiSelect } from '../../components/BatchMultiSelect';
import { categoryOptions, categoryTree } from '../../components/category-tree/category-tree';
import { describeRecurrence } from '../../components/recurrence/describe-recurrence';
import { notifyError } from '../../lib/notify';
import { useWorkSchedules } from '../calendar/api';
import type { TaskContext } from '../tasks/use-task-context';
import classes from '../../components/data-table/EditableCells.module.css';
import { StackedMultiCell } from '../../components/data-table/StackedMultiCell';
import type { Routine, RoutineCategory } from './api';
import { routinesLabel, useRoutineCellEdit } from './routine-cell-edit';
import { applyDiff } from '../../components/data-table/bulk-edit';
import { describeRoutineCase, routinePath, ruleOf, scheduleOf, waitingFor, windowOf, windowText } from './routine-format';
import { openRoutineForm } from './open-routine-form';
import { RoutineRepetitionModal } from './RoutineSchedule';
import { treeSelectProps } from '../../components/tree-select/tree-select';
import { BeneficiariesCell } from '../beneficiaries/BeneficiariesSelect';
import { routineTreeOptions } from './routine-format';
import { cellField, cellMulti } from '../../components/data-table/cell-field';
import { EditableNumber } from '../../components/data-table/EditableCells';
import { EditableTitle } from '../../components/data-table/EditableTitle';
import { AssigneesCell as SharedAssigneesCell, ProjectCell as SharedProjectCell } from '../tasks/views/context-cells';

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
 * Title cell: a click opens the routine form; a double-click elsewhere in the cell renames it in place (one routine at
 * a time).
 * @param {CellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TitleCell({ routine, readOnly = false }: CellProps) {
  const { apply } = useRoutineCellEdit(routine, 'title');
  return (
    <EditableTitle
      value={routine.title}
      label={`Titre de ${routine.title}`}
      schema={routineSchema.shape.title}
      onOpen={() => openRoutineForm({ routine })}
      readOnly={readOnly}
      onSave={(title) => apply({ title })}
    />
  );
}

/**
 * Time to spend on it, in minutes: typed in place, saved when leaving the field if valid and changed (on a selection,
 * given to every routine of it).
 * @param {CellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function EstimateCell({ routine, readOnly = false }: CellProps) {
  const { apply, count } = useRoutineCellEdit(routine, 'estimate');
  return (
    <EditableNumber
      value={routine.estimate}
      label={fieldLabel('Temps à consacrer', routine, count)}
      decimals={0}
      min={1}
      max={24 * 60}
      suffix="min"
      schema={routineSchema.shape.estimate}
      saveUnchanged={count > 1}
      readOnly={readOnly}
      onSave={(estimate) => apply({ estimate }, { estimate })}
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
  // Names of the schedules it follows.
  const followed = describeSlotCondition(readSlotCondition(routine.slotCondition), new Map((schedules ?? []).map((item) => [item.id, item.name])));
  const severalMoments = ((routine.moments as unknown[] | null) ?? []).length > 1;

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
      {(routine.cases as RoutineCase[]).length || (severalMoments && !routine.slotCondition) ? (
        <UnstyledButton className={classes.root} onClick={() => openRoutineForm({ routine })} disabled={readOnly} aria-label={`Horaire de ${routine.title} : selon ses moments`}>
          <Text size="xs">{(routine.cases as RoutineCase[]).length ? 'Selon le cas' : 'Plusieurs moments'}</Text>
          <Text size="xs" c="dimmed">
            {routine.slots.map((slot) => windowText(slot) || 'dans la journée').join(' · ') || 'pas ce jour-là'}
          </Text>
        </UnstyledButton>
      ) : routine.slotCondition ? (
        <UnstyledButton className={classes.root} onClick={() => openRoutineForm({ routine })} disabled={readOnly} aria-label={`Horaire de ${routine.title} : plages ${followed}`}>
          <Text size="xs" truncate>
            {followed || 'Plages'}
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
        .map((item) => ({ id: item.category.id, label: item.path, icon: <ItemAvatar name={item.category.name} iconUrl={item.category.iconUrl} color={item.color} size={14} /> }))}
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
    <SharedAssigneesCell
      value={routine.assigneeIds}
      // Of a routine of a project: its contributors only (its current assignees stay).
      projectId={routine.projectId ?? null}
      context={context}
      label={fieldLabel('Assignés', routine, count)}
      readOnly={readOnly}
      onSave={(assigneeIds, { added, removed }) => apply({ assigneeIds }, { addAssigneeIds: added, removeAssigneeIds: removed })}
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
                label: routinePath(required, byId),
                title: waiting.has(id) ? `${routinePath(required, byId)} (pas encore faite)` : routinePath(required, byId),
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
          {...treeSelectProps(routineTreeOptions(routines, (other) => other.id !== routine.id && (!other.archived || routine.requiredIds.includes(other.id))))}
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
  return (
    <SharedProjectCell
      value={routine.projectId ?? null}
      context={context}
      label={fieldLabel('Projet', routine, count)}
      readOnly={readOnly}
      onSave={(projectId) => apply({ projectId }, { projectId })}
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
    : rule
      ? [describeRecurrence(rule, routine.startDate), describeSlotCondition(readSlotCondition(routine.slotCondition), new Map((schedules ?? []).map((item) => [item.id, item.name])))]
          .filter(Boolean)
          .join(' · ')
      : '';
  return (
    <Text size="xs" c="dimmed" lineClamp={1} title={text} px={6}>
      {text}
    </Text>
  );
}

/**
 * "Quand" cell: where the routine stands today (its content); a click opens every setting of its repetition (one rule
 * or cases, moments, schedules, « à partir du ») in the common modal. On a selection, the repetition applies to every
 * routine selected.
 * @param {CellProps & { children: ReactNode }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function RepetitionCell({ routine, readOnly = false, children }: CellProps & { children: ReactNode }) {
  const { apply, count } = useRoutineCellEdit(routine, 'repetition');
  const [opened, setOpened] = useState(false);
  return (
    <>
      <UnstyledButton onClick={() => setOpened(true)} disabled={readOnly} aria-label={`Modifier la répétition de ${routine.title}${count > 1 ? ` (${routinesLabel(count)})` : ''}`}>
        {children}
      </UnstyledButton>
      {/* Mounted when opened: its draft starts from the routine as it is then. */}
      {opened && (
        <RoutineRepetitionModal
          routine={routine}
          opened
          onClose={() => setOpened(false)}
          header={
            count > 1 && (
              <Text size="sm" c="dimmed">
                S’applique à {routinesLabel(count)} : chacune prend cette répétition entière (première fois, règle ou cas, moments, plages, « à partir du »).
              </Text>
            )
          }
          onApply={(repetition) => apply(repetition, repetition)}
        />
      )}
    </>
  );
}

/**
 * « Bénéficiaires » cell of a routine: contributors and relations it is for.
 * @param {CellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function RoutineBeneficiariesCell({ routine, readOnly = false }: CellProps) {
  const { apply, count } = useRoutineCellEdit(routine, 'beneficiaries');
  // On a selection, those added here are added to each routine, those removed here removed.
  return (
    <BeneficiariesCell
      label={fieldLabel('Bénéficiaires', routine, count)}
      value={routine}
      readOnly={readOnly}
      onSave={(beneficiaries) =>
        apply((target) => ({
          beneficiaryIds: applyDiff(target.beneficiaryIds, routine.beneficiaryIds, beneficiaries.beneficiaryIds),
          beneficiaryRelationIds: applyDiff(target.beneficiaryRelationIds, routine.beneficiaryRelationIds, beneficiaries.beneficiaryRelationIds),
        }))
      }
    />
  );
}
