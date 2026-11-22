import { descriptionFormSchema, type DescriptionFormValues } from '@ordo/shared';
import { DescriptionSection } from '../../../components/markdown/DescriptionSection';
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor';
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
 * Editor of the description of a task: saved on leaving it, and by Ctrl/⌘ + Enter, which also closes it:
 * no button.
 * @param {TaskDescriptionProps & { onClose: () => void, autoFocus: boolean }} props Task, its context and save, closing of the editor, focus taken.
 * @returns {JSX.Element} Editor.
 */
function TaskDescriptionEditor({ task, context, save, onClose, autoFocus }: Omit<TaskDescriptionProps, 'locked'> & { onClose: () => void; autoFocus: boolean }) {
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
      autoFocus={autoFocus}
    />
  );
}

/**
 * Description of a task in its panel (`DescriptionSection`): its editor directly when it has none, otherwise shown in
 * markdown (its checkboxes ticked in place), edited from the pencil and saved as it is typed (on leaving the editor).
 * @param {TaskDescriptionProps} props Component props.
 * @returns {JSX.Element} Section.
 */
export function TaskDescription({ task, context, locked, save }: TaskDescriptionProps) {
  return (
    <DescriptionSection
      value={task.description}
      targets={context.targetsFor(task.projectId)}
      readOnly={locked}
      onCheck={(next) => void save({ description: next }).catch(notifyFailure)}
      editor={({ close, autoFocus }) => <TaskDescriptionEditor task={task} context={context} save={save} onClose={close} autoFocus={autoFocus} />}
    />
  );
}
