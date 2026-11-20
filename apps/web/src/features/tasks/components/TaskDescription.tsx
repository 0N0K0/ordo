import { descriptionFormSchema, type DescriptionFormValues } from '@ordo/shared';
import { useState } from 'react';
import { EditToggle } from '../../../components/actions/EditToggle';
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor';
import { MarkdownView } from '../../../components/markdown/MarkdownView';
import { SubSection } from '../../../components/page/SubSection';
import { useAppForm, useFieldSave } from '../../../lib/form';
import { notifyFailure } from '../../../lib/notify';
import type { Task, TaskSave } from '../api';
import type { TaskContext } from '../hooks/use-task-context';

interface TaskDescriptionProps {
  task: Task;
  context: TaskContext;
  /** Read only (archived). */
  locked: boolean;
  save: TaskSave;
}

/**
 * Editor of the description of a task: saved on leaving it, and by Ctrl/⌘ + Enter, which also closes it (decision
 * D22): no button.
 * @param {TaskDescriptionProps & { onClose: () => void }} props Task, its context and save, closing of the editor.
 * @returns {JSX.Element} Editor.
 */
function TaskDescriptionEditor({ task, context, save, onClose }: Omit<TaskDescriptionProps, 'locked'> & { onClose: () => void }) {
  const value = { description: task.description ?? '' };
  const base = useAppForm<DescriptionFormValues>({ initialValues: value, schema: descriptionFormSchema });
  const { form, commit, fieldProps } = useFieldSave(base, { save: ({ description }) => save({ description: description || null }), schema: descriptionFormSchema, saved: value, onBlur: ['description'] });
  return (
    <MarkdownEditor
      {...fieldProps('description')}
      onSubmitShortcut={() => {
        commit(['description']);
        onClose();
      }}
      error={form.errors.description as string | undefined}
      suggestions={context.suggestionsFor(task.projectId)}
      autoFocus
    />
  );
}

/**
 * Description of a task in its panel: shown in markdown (its checkboxes ticked in place), edited from the pencil and
 * saved as it is typed (on leaving the editor); the check goes back to the text shown.
 * @param {TaskDescriptionProps} props Component props.
 * @returns {JSX.Element} Section.
 */
export function TaskDescription({ task, context, locked, save }: TaskDescriptionProps) {
  const [editing, setEditing] = useState(false);
  return (
    <SubSection title="Description" gap="xs" action={!locked && <EditToggle editing={editing} onChange={setEditing} what="la description" />}>
      {editing && !locked ? (
        <TaskDescriptionEditor task={task} context={context} save={save} onClose={() => setEditing(false)} />
      ) : (
        <MarkdownView targets={context.targetsFor(task.projectId)} onChange={locked ? undefined : (next) => void save({ description: next }).catch(notifyFailure)}>
          {task.description}
        </MarkdownView>
      )}
    </SubSection>
  );
}
