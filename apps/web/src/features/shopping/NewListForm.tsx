import { Button, Checkbox, Group, Stack, Text, TextInput } from '@mantine/core';
import { shoppingListNameSchema } from '@ordo/shared';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { showFormError, useAppForm } from '../../lib/form';
import { notifySuccess } from '../../lib/notify';
import { TaskSelect } from '../tasks/task-ui';
import { useTaskContext } from '../tasks/use-task-context';
import { useActiveWorkspace } from '../workspaces/api';
import { useShoppingData, useShoppingMutations } from './api';
import { taskChoices } from './shopping-format';

const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

const schema = z.object({ name: shoppingListNameSchema, taskId: z.string().nullable(), baseListIds: z.array(z.string()) });
type Values = z.input<typeof schema>;

export interface NewListFormProps {
  /** Base lists whose missing products it takes, checked at first. */
  baseListIds: string[];
  taskId: string | null;
  onDone: () => void;
}

/**
 * New list: its name, the task it is attached to, and the base lists whose missing products it takes.
 * @param {NewListFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function NewListForm({ baseListIds, taskId, onDone }: NewListFormProps) {
  const { data } = useShoppingData();
  const missingOf = (id: string) => (data?.shoppingProducts ?? []).filter((product) => product.baseListId === id && product.missing).length;
  const baseLists = data?.shoppingBaseLists ?? [];
  const { perso } = useActiveWorkspace();
  const { context } = useTaskContext();
  const { createList } = useShoppingMutations();
  const navigate = useNavigate();
  const form = useAppForm<Values>({
    initialValues: { name: `${perso ? 'Courses' : 'Consommables'} du ${dayFormat.format(new Date())}`, taskId, baseListIds },
    schema,
  });
  const { tasks, labelOf } = taskChoices(context);

  const handleSubmit = form.onSubmit((values) =>
    createList.mutate(
      { name: values.name, taskId: values.taskId ?? null, baseListIds: values.baseListIds.filter((id) => missingOf(id) > 0) },
      {
        onSuccess: (id) => {
          notifySuccess('Liste créée.');
          onDone();
          navigate(`/shopping/${id}`);
        },
        onError: (error) => showFormError(form, error),
      },
    ),
  );

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <TextInput label="Nom" required data-autofocus {...form.getInputProps('name')} />
        <TaskSelect label="Tâche" placeholder="Aucune" tasks={tasks} labelOf={labelOf} disabled={!context} {...form.getInputProps('taskId')} />
        {baseLists.length > 0 && (
          <Checkbox.Group label="Reprendre les produits manquants de" {...form.getInputProps('baseListIds')}>
            <Stack gap={6} mt={6}>
              {baseLists.map((baseList) => (
                <Checkbox key={baseList.id} value={baseList.id} disabled={missingOf(baseList.id) === 0} label={`${baseList.name} (${missingOf(baseList.id)} manquant(s))`} />
              ))}
            </Stack>
          </Checkbox.Group>
        )}
        <Text size="xs" c="dimmed">
          D’autres produits des listes types pourront être ajoutés ensuite.
        </Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={createList.isPending}>
            Créer
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
