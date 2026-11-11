import { Button, Checkbox, Group, Stack, TextInput } from '@mantine/core';
import { shoppingListNameSchema } from '@ordo/shared';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { showFormError, useAppForm } from '../../lib/form';
import { notifySuccess } from '../../lib/notify';
import { TaskSelect } from '../tasks/task-ui';
import { useTaskContext } from '../tasks/use-task-context';
import { useActiveWorkspace } from '../workspaces/api';
import { useShoppingMutations } from './api';
import { taskChoices } from './shopping-format';

const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

const schema = z.object({ name: shoppingListNameSchema, taskId: z.string().nullable(), fromMissing: z.boolean() });
type Values = z.input<typeof schema>;

export interface NewListFormProps {
  fromMissing: boolean;
  missingCount: number;
  taskId: string | null;
  onDone: () => void;
}

/**
 * New list: its name, the task it is attached to, and whether it takes the missing products of the base list.
 * @param {NewListFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function NewListForm({ fromMissing, missingCount, taskId, onDone }: NewListFormProps) {
  const { perso } = useActiveWorkspace();
  const { context } = useTaskContext();
  const { createList } = useShoppingMutations();
  const navigate = useNavigate();
  const form = useAppForm<Values>({
    initialValues: { name: `${perso ? 'Courses' : 'Consommables'} du ${dayFormat.format(new Date())}`, taskId, fromMissing: fromMissing && missingCount > 0 },
    schema,
  });
  const { tasks, labelOf } = taskChoices(context);

  const handleSubmit = form.onSubmit((values) =>
    createList.mutate(
      { name: values.name, taskId: values.taskId ?? null, fromMissing: values.fromMissing },
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
        <Checkbox label={`Reprendre les ${missingCount} produit(s) manquant(s) de la liste de base`} disabled={missingCount === 0} {...form.getInputProps('fromMissing', { type: 'checkbox' })} />
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
