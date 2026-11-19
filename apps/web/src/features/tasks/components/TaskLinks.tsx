import { Stack } from '@mantine/core';
import { linksFormSchema, type LinksFormValues } from '@ordo/shared';
import { PencilSimpleIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { IconAction } from '../../../components/actions/IconAction';
import { FormActions } from '../../../components/dialogs/FormActions';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { LinksField } from '../../../components/inputs/LinksField';
import { ItemLinks } from '../../../components/items/ItemLinks';
import { SubSection } from '../../../components/page/SubSection';
import { useAppForm, formCallbacks } from '../../../lib/form';
import { linkInputs } from '../../../lib/links';
import { useUpdateTask, type Task } from '../api';

/**
 * Editor of the links of a task: the shared links field, saved together (all the links checked at once).
 * @param {{ task: Task, onClose: () => void }} props Task, closing of the editor.
 * @returns {JSX.Element} Form.
 */
function TaskLinksEditor({ task, onClose }: { task: Task; onClose: () => void }) {
  const updateTask = useUpdateTask();
  const form = useAppForm<LinksFormValues>({ initialValues: { links: linkInputs(task.links) }, schema: linksFormSchema });
  const handleSubmit = form.onSubmit(({ links }) => updateTask.mutate({ id: task.id, input: { links } }, formCallbacks(form, null, onClose)));
  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="xs">
        <LinksField form={form} />
        <FormActions size="xs" onCancel={onClose} loading={updateTask.isPending} />
      </Stack>
    </form>
  );
}

/**
 * Links of a task in its panel, as those of the events: shown (opened in a new tab), edited from the pencil.
 * @param {{ task: Task, locked: boolean }} props Task, read only (archived).
 * @returns {JSX.Element} Section.
 */
export function TaskLinks({ task, locked }: { task: Task; locked: boolean }) {
  const [editing, setEditing] = useState(false);
  return (
    <SubSection
      title="Liens"
      gap="xs"
      action={
        !editing &&
        !locked && (
          <IconAction label="Modifier les liens" size="sm" onClick={() => setEditing(true)}>
            <PencilSimpleIcon aria-hidden />
          </IconAction>
        )
      }
    >
      {editing ? <TaskLinksEditor task={task} onClose={() => setEditing(false)} /> : task.links.length ? <ItemLinks links={task.links} /> : <EmptyState compact message="Aucun lien." />}
    </SubSection>
  );
}
