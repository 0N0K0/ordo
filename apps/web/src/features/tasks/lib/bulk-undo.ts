import { groupBy, readSlotCondition, readTaskHours, taskFieldsGiven, type TaskAutomationRevert, type TaskInheritableField } from '@ordo/shared';
import { notifySuccess, notifyFailure } from '../../../lib/notify';
import { originOf } from '../../../components/inheritance/inheritance';
import { useBulkTaskMutations, useSetTasksClosed, useUpdateTask, type BulkChanges, type Task, type TaskInputValues } from '../api';

const SCALAR_FIELDS = ['statusId', 'priorityId', 'typeId', 'milestoneId', 'effort', 'startDate', 'endDate', 'deadline', 'minDate'] as const;

/** Keys of a bulk change giving each inherited field a value (`TASK_FIELD_INPUTS` of the bulk input). */
const BULK_KEYS: Partial<Record<TaskInheritableField, readonly (keyof BulkChanges)[]>> = {
  PRIORITY: ['priorityId'],
  MILESTONE: ['milestoneId'],
  MIN_DATE: ['minDate'],
  DEADLINE: ['deadline'],
  ASSIGNEES: ['addAssigneeIds', 'removeAssigneeIds'],
};

/**
 * Change of a task giving back an inherited field as it was: inherited again, emptied again, or its own
 * value; its own project comes back by a transfer (`useBulkUndo().inheritance`).
 * @param {Task} task Task before the change.
 * @param {TaskInheritableField} field Field.
 * @returns {Omit<TaskInputValues, 'projectId'>} Change.
 */
function restoredField(task: Task, field: TaskInheritableField): Omit<TaskInputValues, 'projectId'> {
  const state = originOf(task, field)?.state;
  if (state === 'INHERITED') return { inherit: [field] };
  if (state === 'CLEARED') return { clear: [field] };
  switch (field) {
    case 'PROJECT':
      return {};
    case 'ASSIGNEES':
      return { assigneeIds: task.assigneeIds };
    case 'BENEFICIARIES':
      return { beneficiaryIds: task.beneficiaryIds, beneficiaryRelationIds: task.beneficiaryRelationIds };
    case 'SLOT_CONDITION':
      return { slotCondition: readSlotCondition(task.slotCondition) };
    case 'HOURS':
      return { hours: readTaskHours(task.hours) };
    case 'MIN_DATE':
      return { minDate: task.minDate };
    case 'DEADLINE':
      return { deadline: task.deadline };
    case 'LOCATION':
      return { location: task.location, locationLat: task.locationLat, locationLon: task.locationLon };
    case 'PRIORITY':
      return { priorityId: task.priorityId };
    case 'MILESTONE':
      return { milestoneId: task.milestoneId };
  }
}

/**
 * Changes restoring tasks as they were before a bulk change, grouped by identical restoring changes.
 * @param {Task[]} tasks Tasks as they were before the change.
 * @param {BulkChanges} changes Applied change.
 * @returns {{ ids: string[], changes: BulkChanges }[]} Restoring changes.
 */
function revertChanges(tasks: Task[], changes: BulkChanges): { ids: string[]; changes: BulkChanges }[] {
  const groups = new Map<string, { ids: string[]; changes: BulkChanges }>();
  for (const task of tasks) {
    const previous: BulkChanges = {};
    for (const field of SCALAR_FIELDS) {
      if (changes[field] !== undefined) Object.assign(previous, { [field]: task[field] });
    }
    // Only the assignees the change really added or removed are given back.
    const added = (changes.addAssigneeIds ?? []).filter((id) => !task.assigneeIds.includes(id));
    const removed = (changes.removeAssigneeIds ?? []).filter((id) => task.assigneeIds.includes(id));
    if (added.length) previous.removeAssigneeIds = added;
    if (removed.length) previous.addAssigneeIds = removed;
    const addedTags = (changes.addTagIds ?? []).filter((id) => !task.tagIds.includes(id));
    const removedTags = (changes.removeTagIds ?? []).filter((id) => task.tagIds.includes(id));
    if (addedTags.length) previous.removeTagIds = addedTags;
    if (removedTags.length) previous.addTagIds = removedTags;
    const addedSprints = (changes.addSprintIds ?? []).filter((id) => !task.sprintIds.includes(id));
    const removedSprints = (changes.removeSprintIds ?? []).filter((id) => task.sprintIds.includes(id));
    if (addedSprints.length) previous.removeSprintIds = addedSprints;
    if (removedSprints.length) previous.addSprintIds = removedSprints;
    // A field it inherited or had emptied on purpose comes back so, not as a value of its own.
    for (const field of taskFieldsGiven(changes)) {
      const state = originOf(task, field)?.state;
      if (state !== 'INHERITED' && state !== 'CLEARED') continue;
      for (const key of BULK_KEYS[field] ?? []) delete previous[key];
      if (state === 'INHERITED') previous.inheritFields = [...(previous.inheritFields ?? []), field];
      else previous.clearFields = [...(previous.clearFields ?? []), field];
    }
    if (Object.keys(previous).length === 0) continue;
    const key = JSON.stringify(previous);
    const group = groups.get(key) ?? { ids: [], changes: previous };
    group.ids.push(task.id);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/**
 * Task ids grouped by a key.
 * @param {Task[]} tasks Tasks.
 * @param {(task: Task) => K} keyOf Key of a task.
 * @returns {[K, string[]][]} Ids by key.
 */
const idsBy = <K>(tasks: Task[], keyOf: (task: Task) => K): [K, string[]][] => [...groupBy(tasks, keyOf)].map(([key, group]) => [key, group.map((task) => task.id)]);

/**
 * Reverts bulk actions from the snapshot of the tasks taken before them ("Annuler" of the toasts).
 * Each method returns the undo callback of one action.
 * @returns {object} Undo builders.
 */
export function useBulkUndo() {
  const { update, archive, transfer } = useBulkTaskMutations();
  const updateTask = useUpdateTask();
  const setClosed = useSetTasksClosed();

  /**
   * Runs the restoring steps one after the other.
   * @param {(() => Promise<unknown>)[]} steps Steps.
   * @returns {Promise<void>}
   */
  const run = async (steps: (() => Promise<unknown>)[]) => {
    try {
      for (const step of steps) await step();
      notifySuccess('Action annulée.');
    } catch (error) {
      notifyFailure(error, 'L’action n’a pas pu être annulée.');
    }
  };

  return {
    /**
     * Undo of a field change.
     * @param {Task[]} tasks Tasks before the change.
     * @param {BulkChanges} changes Applied change.
     * @returns {() => void} Undo.
     */
    changes: (tasks: Task[], changes: BulkChanges) => () => run(revertChanges(tasks, changes).map((step) => () => update.mutateAsync({ ...step, restoring: true }))),

    /**
     * Undo of « Héritage… »: each field of each task given back as it was, inherited, emptied or its own
     * value; its own project by a transfer (it had followed its parent's).
     * @param {Task[]} tasks Tasks before the change.
     * @param {readonly TaskInheritableField[]} fields Fields changed.
     * @returns {() => void} Undo.
     */
    inheritance: (tasks: Task[], fields: readonly TaskInheritableField[]) => () =>
      run(
        tasks.filter((task) => task.parentId).flatMap((task) => {
          const input = fields.reduce<Omit<TaskInputValues, 'projectId'>>((all, field) => {
            const { inherit = [], clear = [], ...values } = restoredField(task, field);
            return { ...all, ...values, ...(inherit?.length && { inherit: [...(all.inherit ?? []), ...inherit] }), ...(clear?.length && { clear: [...(all.clear ?? []), ...clear] }) };
          }, {});
          const ownProject = fields.includes('PROJECT') && originOf(task, 'PROJECT')?.state !== 'INHERITED';
          return [
            ...(Object.keys(input).length ? [() => updateTask.mutateAsync({ id: task.id, input })] : []),
            ...(ownProject ? [() => transfer.mutateAsync({ ids: [task.id], projectId: task.projectId })] : []),
          ];
        }),
      ),

    /**
     * Undo of a close / reopen: only the tasks whose state changed go back. A cancelled task reopened by hand took the
     * first « À faire » status: its « Annulé » status comes back too, which closes it again.
     * @param {Task[]} tasks Tasks before the change.
     * @param {boolean} closed Applied state.
     * @returns {() => void} Undo.
     */
    closed: (tasks: Task[], closed: boolean) => () => {
      const changed = tasks.filter((task) => task.closed !== closed);
      const cancelled = closed ? [] : changed.filter((task) => task.cancelled);
      const ids = changed.filter((task) => !cancelled.includes(task)).map((task) => task.id);
      return run([
        ...(ids.length ? [() => setClosed.mutateAsync({ ids, closed: !closed })] : []),
        ...idsBy(cancelled, (task) => task.statusId).map(([statusId, statusIds]) => () => update.mutateAsync({ ids: statusIds, changes: { statusId }, restoring: true })),
      ]);
    },

    /**
     * Undo of an archive / restore: only the tasks whose state changed go back (with the usual cascade).
     * @param {Task[]} tasks Tasks before the change.
     * @param {boolean} archived Applied state.
     * @returns {() => void} Undo.
     */
    archived: (tasks: Task[], archived: boolean) => () => {
      const ids = tasks.filter((task) => task.archived !== archived).map((task) => task.id);
      return run(ids.length ? [() => archive.mutateAsync({ ids, archived: !archived })] : []);
    },

    /**
     * Undo of the automations of the tasks applied by a change: each task restored when a rule archived it, moved
     * back to its project, its fields given back (inherited again, emptied again, or their values), then its open /
     * closed state.
     * @param {readonly TaskAutomationRevert[]} reverts What gives each task back (from the API).
     * @returns {() => void} Undo.
     */
    automation: (reverts: readonly TaskAutomationRevert[]) => () =>
      run(
        reverts.flatMap(({ taskId, projectId, changes, closed, restore }) => {
          const ids = [taskId];
          return [
            ...(restore ? [() => archive.mutateAsync({ ids, archived: false })] : []),
            ...(projectId !== undefined ? [() => transfer.mutateAsync({ ids, projectId })] : []),
            ...(Object.keys(changes).length ? [() => update.mutateAsync({ ids, changes, restoring: true })] : []),
            ...(closed !== undefined ? [() => setClosed.mutateAsync({ ids, closed })] : []),
          ];
        }),
      ),

    /**
     * Undo of a transfer: tasks go back to their project level by level (a transfer moves the sub-tasks
     * along, deeper ones are then put back in their own project).
     * @param {Task[][]} levels Moved tasks, then their sub-tasks level by level, before the transfer.
     * @returns {() => void} Undo.
     */
    transfer: (levels: Task[][]) => () =>
      run(
        levels.flatMap((level) =>
          idsBy(level, (task) => task.projectId).map(
            ([projectId, ids]) =>
              () =>
                transfer.mutateAsync({ ids, projectId }),
          ),
        ),
      ),
  };
}
