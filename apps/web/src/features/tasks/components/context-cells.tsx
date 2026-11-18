import { unarchived } from '../../../lib/archive';
import { EditableMultiSelect } from '../../../components/data-table/cells/EditableCells';
import { PersonAvatar, PersonOption } from '../../../components/people/people-rows';
import { EditableSelect } from '../../../components/data-table/cells/EditableCells';
import { treeSelectProps } from '../../../components/tree/tree-select';
import type { TaskContext } from '../hooks/use-task-context';
import { listDiff } from '../../../components/data-table/selection/bulk-edit';

interface AssigneesCellProps {
  /** Assignees of the row. */
  value: string[];
  /** Project of the row: its contributors are offered (none: everyone). */
  projectId: string | null;
  /** Projects of the rows edited at once (a selection): only the contributors of all of them are offered. Optional. */
  projectIds?: (string | null)[];
  context: TaskContext;
  label: string;
  readOnly?: boolean;
  /**
   * Saves the assignees chosen, with those added and removed (a selection gets the same additions and removals).
   * @param {string[]} assigneeIds Assignees chosen.
   * @param {{ added: string[], removed: string[] }} changes Assignees added and removed.
   * @returns {void}
   */
  onSave: (assigneeIds: string[], changes: { added: string[]; removed: string[] }) => void;
}

/**
 * Assignees cell (tasks, routines): the assignees one under the other with their avatar; a click opens the
 * multi-select of the contributors of the project (the current assignees stay offered).
 * @param {AssigneesCellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function AssigneesCell({ value, projectId, projectIds, context, label, readOnly = false, onSave }: AssigneesCellProps) {
  return (
    <EditableMultiSelect
      label={label}
      readOnly={readOnly}
      value={value}
      items={value.flatMap((id) => {
        const contributor = context.contributorById.get(id);
        return contributor ? [{ id, label: context.contributorName(contributor), icon: <PersonAvatar name={contributor.name} avatarUrl={contributor.avatarUrl} /> }] : [];
      })}
      data={context.assignableFor(projectIds ?? [projectId], value).map((contributor) => ({ value: contributor.id, label: context.contributorName(contributor) }))}
      renderOption={({ option }) => {
        const contributor = context.contributorById.get(option.value);
        return <PersonOption name={contributor?.name ?? option.label} label={option.label} avatarUrl={contributor?.avatarUrl} />;
      }}
      onSave={(assigneeIds) => onSave(assigneeIds, listDiff(value, assigneeIds))}
    />
  );
}

interface ProjectCellProps {
  value: string | null;
  context: TaskContext;
  label: string;
  /** Shown without a project. Optional. Default = « — ». */
  placeholder?: string;
  readOnly?: boolean;
  onSave: (projectId: string | null) => void;
}

/**
 * Project cell (tasks, routines): one of the projects in their tree (archived ones left out, but the current one), or
 * none.
 * @param {ProjectCellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function ProjectCell({ value, context, label, placeholder, readOnly = false, onSave }: ProjectCellProps) {
  const options = context.projectOptions(unarchived(context.projects, value));
  return <EditableSelect value={value} label={label} nullable placeholder={placeholder} readOnly={readOnly} nothingFoundMessage="Aucun projet" {...treeSelectProps(options)} onSave={onSave} />;
}
