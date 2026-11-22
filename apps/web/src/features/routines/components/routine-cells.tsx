import { useSlotChoices } from '../../calendar/hooks/use-slot-sources';
import { ItemAvatar } from '../../../components/items/ItemAvatar';
import { Box, Text, UnstyledButton } from '@mantine/core';
import { StackedLines } from '../../../components/data-table/cells/StackedValues';
import { mapById, readSlotCondition, type RoutineCase, routineSchema } from '@ordo/shared';
import { describeSlotCondition } from '../../calendar/lib/slot-condition-text';
import { useState, type ReactNode } from 'react';

import { categoryOptions, categoryTree } from '../../../components/tree/category-tree';
import { unarchivedOffered } from '../../../lib/archive';
import { describeRecurrence } from '../../../components/recurrence/describe-recurrence';

import type { TaskContext } from '../../tasks/hooks/use-task-context';

import { useRoutinesData, type Routine, type RoutineCategory } from '../api';
import { routineCellLabel, routinesLabel, useRoutineCellEdit } from '../lib/routine-cell-edit';
import { listDiff } from '../../../components/data-table/selection/bulk-edit';
import { describeRoutineCase, linkableRoutine, routinePath, ruleOf, waitingFor } from '../lib/routine-format';
import { openRoutineForm } from '../lib/open-routine-form';
import { RoutineRepetitionModal } from './RoutineSchedule';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { BeneficiariesCell } from '../../beneficiaries/components/BeneficiariesSelect';
import { routineTreeOptions } from '../lib/routine-format';
import { EditableMultiSelect, EditableNumber } from '../../../components/data-table/cells/EditableCells';
import { EditableLabel } from '../../../components/data-table/cells/EditableLabel';
import { AssigneesCell as SharedAssigneesCell, ProjectCell as SharedProjectCell } from '../../tasks/components/context-cells';
import { DependencyIcon } from '../../../components/data-table/cells/DependencyIcon';
import { beneficiariesDiff } from '../../beneficiaries/lib/beneficiaries-diff';
import { ChipChoiceCell } from '../../../components/data-table/cells/ChipChoiceCell';
import type { TaskLabel } from '../../tasks/api';

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
export function RoutineLabelCell({ routine, readOnly = false }: CellProps) {
  const { apply } = useRoutineCellEdit(routine, 'label');
  return (
    <EditableLabel
      value={routine.label}
      label={routineCellLabel('Libellé', routine, 1)}
      schema={routineSchema.shape.label}
      // Not opened when read only (archived or being created): the form would change it.
      onOpen={readOnly ? undefined : () => openRoutineForm({ routine })}
      readOnly={readOnly}
      onSave={(label) => apply({ label })}
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
      label={routineCellLabel('Temps à consacrer', routine, count)}
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
    <EditableMultiSelect
      label={routineCellLabel('Catégories', routine, count)}
      readOnly={readOnly}
      items={placed
        .filter((item) => routine.categoryIds.includes(item.category.id))
        .map((item) => ({ id: item.category.id, label: item.path, icon: <ItemAvatar name={item.category.label} iconUrl={item.category.iconUrl} color={item.color} size={14} /> }))}
      {...treeSelectProps(categoryOptions(categories, undefined, unarchivedOffered(categories, routine.categoryIds)))}
      value={routine.categoryIds}
      onSave={(categoryIds) => {
        const { added, removed } = listDiff(routine.categoryIds, categoryIds);
        apply({ categoryIds }, { addCategoryIds: added, removeCategoryIds: removed });
      }}
      nothingFoundMessage="Aucune catégorie (ajoutez-en dans les paramètres)"
    />
  );
}

/** Field and name of each list of the tasks a routine takes one item of. */
const LABEL_FIELDS = { priority: ['priorityId', 'Priorité'], type: ['typeId', 'Type'] } as const;

/**
 * Priority or type cell (the lists of the tasks): its colored chip, chosen in place as on the tasks (`ChipChoiceCell`);
 * on a selection, given to every routine of it.
 * @param {CellProps & { column: 'priority' | 'type', items: TaskLabel[] }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function RoutineLabelChipCell({ routine, readOnly = false, column, items }: CellProps & { column: 'priority' | 'type'; items: TaskLabel[] }) {
  const { apply, count } = useRoutineCellEdit(routine, column);
  const [field, name] = LABEL_FIELDS[column];
  return (
    <ChipChoiceCell
      value={routine[field]}
      items={items}
      label={routineCellLabel(name, routine, count)}
      readOnly={readOnly}
      onChoose={(value) => apply({ [field]: value }, { [field]: value })}
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
  const { apply, count, targets } = useRoutineCellEdit(routine, 'assignees');
  const { data } = useRoutinesData();
  const routineById = mapById(data?.routines ?? []);
  return (
    <SharedAssigneesCell
      value={routine.assigneeIds}
      // Of a routine of a project: its contributors only (its current assignees stay); of a selection, those of all its projects.
      projectId={routine.projectId ?? null}
      projectIds={targets.length > 1 ? targets.map((id) => routineById.get(id)?.projectId ?? null) : undefined}
      context={context}
      label={routineCellLabel('Assignés', routine, count)}
      readOnly={readOnly}
      onSave={(assigneeIds, { added, removed }) => apply({ assigneeIds }, { addAssigneeIds: added, removeAssigneeIds: removed })}
    />
  );
}

/**
 * Cell of the links of a routine with others, chosen in place among the routines of its project tree (as the tasks):
 * « Dépend de », the routines to do before this one (those still to do for their current occurrence marked with an
 * hourglass), or « Relative à », the routines related to it. On a column selection, the change applies to every
 * selected routine (never to itself).
 * @param {CellProps & { routines: Routine[], context: TaskContext, kind: 'requires' | 'related' }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function RoutineLinksCell({ routine, readOnly = false, routines, context, kind }: CellProps & { routines: Routine[]; context: TaskContext; kind: 'requires' | 'related' }) {
  const { apply, count } = useRoutineCellEdit(routine, kind);
  const byId = mapById(routines);
  const waiting = new Set(kind === 'requires' ? waitingFor(routine, byId).map((other) => other.id) : []);
  const ids = kind === 'requires' ? routine.requiredIds : routine.relatedIds;
  return (
    <EditableMultiSelect
      label={routineCellLabel(kind === 'requires' ? 'Dépendances' : 'Routines relatives', routine, count)}
      readOnly={readOnly}
      items={ids.flatMap((id) => {
        const other = byId.get(id);
        if (!other) return [];
        const path = routinePath(other, byId);
        return [kind === 'requires' ? { id, label: path, hint: waiting.has(id) ? `${path} (pas encore faite)` : path, icon: <DependencyIcon done={!waiting.has(id)} /> } : { id, label: path, hint: path }];
      })}
      {...treeSelectProps(routineTreeOptions(routines, linkableRoutine(context, routine.projectId ?? null, routine.id, ids)))}
      value={ids}
      onSave={(next) => {
        const { added, removed } = listDiff(ids, next);
        if (kind === 'requires') apply({ requiredIds: next }, { addRequiredIds: added, removeRequiredIds: removed });
        // Each routine of the selection gets (or loses) the same relations, never to itself: one bulk change, with « Annuler ».
        else apply({ relatedIds: next }, { addRelatedIds: added, removeRelatedIds: removed });
      }}
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
      label={routineCellLabel('Projet', routine, count)}
      readOnly={readOnly}
      onSave={(projectId) => apply({ projectId }, { projectId })}
    />
  );
}

/**
 * Repetition of a routine in words, shown under its title: its rule, or its cases one under the other.
 * @param {{ routine: Routine }} props Component props.
 * @returns {JSX.Element} Text.
 */
export function RepetitionText({ routine }: { routine: Routine }) {
  const { names } = useSlotChoices();
  const cases = routine.cases as RoutineCase[];
  const rule = ruleOf(routine);
  const lines = cases.length
    ? cases.map((item) => describeRoutineCase(item, routine.startDate))
    : rule
      ? [[describeRecurrence(rule, routine.startDate), describeSlotCondition(readSlotCondition(routine.slotCondition), names)].filter(Boolean).join(' · ')]
      : [];
  return (
    <Box px={6} style={{ minWidth: 0 }}>
      <StackedLines lines={lines} size="xs" c="dimmed" />
    </Box>
  );
}

/**
 * "Quand" cell: where the routine stands today (its content); a click opens every setting of its repetition (one rule
 * or cases, moments, schedules, « Ouverture ») in the common modal. On a selection, the repetition applies to every
 * routine selected.
 * @param {CellProps & { children: ReactNode }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function RepetitionCell({ routine, readOnly = false, children }: CellProps & { children: ReactNode }) {
  const { apply, count } = useRoutineCellEdit(routine, 'repetition');
  const [opened, setOpened] = useState(false);
  return (
    <>
      <UnstyledButton onClick={() => setOpened(true)} disabled={readOnly} aria-label={routineCellLabel('Modifier la répétition', routine, count)}>
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
                S’applique à {routinesLabel(count)} : chacune prend cette répétition entière (première fois, règle ou cas, moments, créneaux, « Ouverture »).
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
      label={routineCellLabel('Bénéficiaires', routine, count)}
      value={routine}
      readOnly={readOnly}
      onSave={(beneficiaries) => apply((target) => beneficiariesDiff(target, routine, beneficiaries))}
    />
  );
}
