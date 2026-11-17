import { ItemAvatar } from '../../../components/settings/ItemAvatar';
import { Text, UnstyledButton } from '@mantine/core';
import { mapById, readSlotCondition, type RoutineCase, routineSchema } from '@ordo/shared';
import { describeSlotCondition } from '../lib/slot-condition-text';
import { CheckIcon, HourglassMediumIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { categoryOptions, categoryTree } from '../../../components/tree/category-tree';
import { describeRecurrence } from '../../../components/recurrence/describe-recurrence';

import { useWorkSchedules } from '../../calendar/api';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { StackedMultiCell } from '../../../components/data-table/cells/StackedMultiCell';
import type { Routine, RoutineCategory } from '../api';
import { routinesLabel, useRoutineCellEdit } from '../lib/routine-cell-edit';
import { applyDiff } from '../../../components/data-table/selection/bulk-edit';
import { describeRoutineCase, routinePath, ruleOf, waitingFor } from '../lib/routine-format';
import { openRoutineForm } from '../lib/open-routine-form';
import { RoutineRepetitionModal } from './RoutineSchedule';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { BeneficiariesCell } from '../../beneficiaries/components/BeneficiariesSelect';
import { routineTreeOptions } from '../lib/routine-format';
import { cellMulti } from '../../../components/data-table/cells/cell-field';
import { EditableNumber } from '../../../components/data-table/cells/EditableCells';
import { EditableTitle } from '../../../components/data-table/cells/EditableTitle';
import { AssigneesCell as SharedAssigneesCell, ProjectCell as SharedProjectCell } from '../../tasks/components/context-cells';

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
  const byId = mapById(routines);
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
