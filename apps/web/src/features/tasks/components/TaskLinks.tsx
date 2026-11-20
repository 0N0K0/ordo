import { linksFormSchema, type LinksFormValues } from '@ordo/shared';
import { useState } from 'react';
import { EditToggle } from '../../../components/actions/EditToggle';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { LinksField } from '../../../components/inputs/LinksField';
import { ItemLinks } from '../../../components/items/ItemLinks';
import { SubSection } from '../../../components/page/SubSection';
import { useAppForm, useFieldSave } from '../../../lib/form';
import { linkInputs } from '../../../lib/links';
import type { Task, TaskSave } from '../api';

/**
 * Editor of the links of a task: the shared links field, each link saved once typed (on leaving its inputs, all the
 * links checked), a removal at once (decision D22): no button.
 * @param {{ task: Task, save: TaskSave }} props Task, and its save.
 * @returns {JSX.Element} Field.
 */
function TaskLinksEditor({ task, save }: { task: Task; save: TaskSave }) {
  const links = { links: linkInputs(task.links) };
  const base = useAppForm<LinksFormValues>({ initialValues: links, schema: linksFormSchema });
  const { form, commit } = useFieldSave(base, { save: (changes) => save(changes), schema: linksFormSchema, saved: links, onBlur: ['links'] });
  return <LinksField form={form} onRemoved={() => commit(['links'])} />;
}

/**
 * Links of a task in its panel, as those of the events: shown (opened in a new tab), edited from the pencil, saved as
 * they are typed; the check goes back to the links shown.
 * @param {{ task: Task, locked: boolean, save: TaskSave }} props Task, read only (archived), its save.
 * @returns {JSX.Element} Section.
 */
export function TaskLinks({ task, locked, save }: { task: Task; locked: boolean; save: TaskSave }) {
  const [editing, setEditing] = useState(false);
  return (
    <SubSection
      title="Liens"
      gap="xs"
      action={!locked && <EditToggle editing={editing} onChange={setEditing} what="les liens" />}
    >
      {editing && !locked ? <TaskLinksEditor task={task} save={save} /> : task.links.length ? <ItemLinks links={task.links} /> : <EmptyState compact message="Aucun lien." />}
    </SubSection>
  );
}
