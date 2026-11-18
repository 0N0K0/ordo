import { Checkbox, Stack, Text, TextInput } from '@mantine/core';
import { shoppingListFormSchema } from '@ordo/shared';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { useAppForm, formCallbacks } from '../../../lib/form';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { useActiveWorkspace } from '../../workspaces/api';
import { useShoppingData, useShoppingMutations } from '../api';
import { taskOptions } from '../lib/shopping-format';
import * as fmt from '../../../lib/format';
import { FormActions } from '../../../components/dialogs/FormActions';
import { unarchived } from '../../../lib/archive';

const schema = shoppingListFormSchema.extend({ baseListIds: z.array(z.string()) });
type Values = z.input<typeof schema>;

interface NewListFormProps {
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
  // The archived base lists and products are left out.
  const missingOf = (id: string) => (data?.shoppingProducts ?? []).filter((product) => product.baseListId === id && product.missing && !product.archived).length;
  const baseLists = unarchived(data?.shoppingBaseLists ?? []);
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
      formCallbacks(form, 'Liste créée.', onDone, { then: (id: string) => navigate(`/shopping/${id}`) }),
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
          D’autres produits des références pourront être ajoutés ensuite.
        </Text>
        <FormActions onCancel={onDone} submitLabel="Créer" loading={createList.isPending} />
      </Stack>
    </form>
  );
}
