import { Button, Checkbox, Group, Stack, Text, TextInput } from '@mantine/core';
import { shoppingListNameSchema } from '@ordo/shared';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { BatchMultiSelect } from '../../components/BatchMultiSelect';
import { showFormError, useAppForm } from '../../lib/form';
import { notifySuccess } from '../../lib/notify';
import { useTaskContext } from '../tasks/use-task-context';
import { useActiveWorkspace } from '../workspaces/api';
import { useShoppingData, useShoppingMutations } from './api';
import { taskOptions } from './shopping-format';
import * as fmt from '../../lib/format';

const schema = z.object({ name: shoppingListNameSchema, taskIds: z.array(z.string()), baseListIds: z.array(z.string()) });
type Values = z.input<typeof schema>;

export interface NewListFormProps {
  /** Base lists whose missing products it takes, checked at first. */
  baseListIds: string[];
  /** Tasks it is attached to at first. */
  taskIds: string[];
  /**
   * Projects it is made for (a project and its sub-projects): a list belongs to a project through its tasks, so one of
   * their tasks is asked. Optional.
   */
  projectIds?: ReadonlySet<string>;
  onDone: () => void;
}

/**
 * New list: its name, the tasks it is attached to (one of a project at least, made from a project), and the base lists
 * whose missing products it takes.
 * @param {NewListFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function NewListForm({ baseListIds, taskIds, projectIds, onDone }: NewListFormProps) {
  const { data } = useShoppingData();
  const missingOf = (id: string) => (data?.shoppingProducts ?? []).filter((product) => product.baseListId === id && product.missing).length;
  const baseLists = data?.shoppingBaseLists ?? [];
  const { perso } = useActiveWorkspace();
  const { context } = useTaskContext();
  const { createList } = useShoppingMutations();
  const navigate = useNavigate();
  const form = useAppForm<Values>({
    initialValues: { name: `${perso ? 'Achats' : 'Consommables'} du ${fmt.dayShort(new Date())}`, taskIds, baseListIds },
    schema: projectIds ? schema.extend({ taskIds: z.array(z.string()).min(1, 'Choisissez une tâche du projet : la liste y apparaît par ses tâches.') }) : schema,
  });
  // From a project: its tasks only (and those already chosen).
  const options = taskOptions(context, taskIds).filter((option) => {
    if (!projectIds || taskIds.includes(option.value)) return true;
    const projectId = context?.taskById.get(option.value)?.projectId;
    return Boolean(projectId && projectIds.has(projectId));
  });

  const handleSubmit = form.onSubmit((values) =>
    createList.mutate(
      { name: values.name, taskIds: values.taskIds, baseListIds: values.baseListIds.filter((id) => missingOf(id) > 0) },
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
        <BatchMultiSelect
          label="Tâches"
          required={Boolean(projectIds)}
          placeholder={form.values.taskIds.length ? undefined : 'Aucune'}
          data={options}
          searchable
          clearable
          nothingFoundMessage="Aucune tâche"
          disabled={!context}
          {...form.getInputProps('taskIds')}
        />
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
