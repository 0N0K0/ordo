import { Avatar, Group } from '@mantine/core';
import { EditableMultiSelect, EditableSelect } from '../../../components/data-table/EditableCells';
import { treeSelectProps } from '../../../components/tree-select/tree-select';
import type { TaskContext } from '../use-task-context';

interface AssigneesCellProps {
  /** Assignees of the row. */
  value: string[];
  /** Project of the row: its contributors are offered (none: everyone). */
  projectId: string | null;
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
export function AssigneesCell({ value, projectId, context, label, readOnly = false, onSave }: AssigneesCellProps) {
  return (
    <EditableMultiSelect
      label={label}
      readOnly={readOnly}
      value={value}
      items={value.flatMap((id) => {
        const contributor = context.contributorById.get(id);
        return contributor
          ? [{ id, label: context.contributorName(contributor), icon: <Avatar src={contributor.avatarUrl} name={contributor.name} color="initials" size={16} style={{ flexShrink: 0 }} /> }]
          : [];
      })}
      data={context.assignableFor([projectId], value).map((contributor) => ({ value: contributor.id, label: context.contributorName(contributor) }))}
      renderOption={({ option }) => {
        const contributor = context.contributorById.get(option.value);
        return (
          <Group gap="xs" wrap="nowrap">
            <Avatar src={contributor?.avatarUrl} name={contributor?.name} color="initials" size={20} />
            {option.label}
          </Group>
        );
      }}
      onSave={(assigneeIds) => onSave(assigneeIds, { added: assigneeIds.filter((id) => !value.includes(id)), removed: value.filter((id) => !assigneeIds.includes(id)) })}
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
  const options = context.projectOptions(context.projects.filter((project) => !project.archived || project.id === value));
  return <EditableSelect value={value} label={label} nullable placeholder={placeholder} readOnly={readOnly} nothingFoundMessage="Aucun projet" {...treeSelectProps(options)} onSave={onSave} />;
}
