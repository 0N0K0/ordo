import { Button, Divider, Group, Stack, Textarea, TextInput } from '@mantine/core';
import { sheetSchema } from '@ordo/shared';
import { showFormError, useAppForm } from '../../lib/form';
import { notifySuccess } from '../../lib/notify';
import { ProjectSelect } from '../tasks/task-ui';
import { useTaskContext } from '../tasks/use-task-context';
import { useSheetMutations, type Sheet } from './api';
import { SheetItemsEditor } from './SheetItemsEditor';
import type { SheetItemValues } from './sheet-format';

interface SheetValues extends Record<string, unknown> {
  name: string;
  note: string;
  projectId: string;
  items: SheetItemValues[];
}

/**
 * Sheet: its name, a note, and its items (products of the references or items of their own).
 * @param {{ sheet?: Sheet, projectId?: string | null, onDone: () => void }} props Sheet to edit (none: a new one), project of a new one, and what follows.
 * @returns {JSX.Element} Form.
 */
export function SheetForm({ sheet, projectId = null, onDone }: { sheet?: Sheet; projectId?: string | null; onDone: () => void }) {
  const { create, update } = useSheetMutations();
  const { context } = useTaskContext();
  const form = useAppForm<SheetValues>({
    initialValues: {
      name: sheet?.name ?? '',
      note: sheet?.note ?? '',
      projectId: sheet?.projectId ?? projectId ?? '',
      items: (sheet?.items ?? []).map((item) => ({
        id: item.id,
        productId: item.productId ?? null,
        label: item.label,
        categoryId: item.categoryId ?? null,
        quantity: item.quantity ?? null,
        unit: item.unit ?? null,
        note: item.note ?? null,
      })),
    },
    schema: sheetSchema.omit({ projectId: true }),
  });

  const handleSubmit = form.onSubmit((values) => {
    // Blank rows are left out.
    const input = { name: values.name, note: values.note || null, projectId: values.projectId || null, items: values.items.filter((item) => item.label.trim()) };
    const callbacks = {
      onSuccess: () => {
        notifySuccess(sheet ? 'Fiche modifiée.' : 'Fiche créée.');
        onDone();
      },
      onError: (error: Error) => showFormError(form, error),
    };
    if (sheet) update.mutate({ id: sheet.id, input }, callbacks);
    else create.mutate(input, callbacks);
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <TextInput label="Nom" required data-autofocus placeholder="Crêpes, valise de ski, trousse de secours…" {...form.getInputProps('name')} />
        {context && (
          <ProjectSelect
            context={context}
            label="Projet"
            placeholder="Aucun : fiche de l’espace"
            clearable
            {...form.getInputProps('projectId')}
            onChange={(next) => form.setFieldValue('projectId', next ?? '')}
          />
        )}
        <Textarea label="Note" autosize minRows={2} maxRows={8} {...form.getInputProps('note')} />
        <Divider label="Éléments" labelPosition="left" />
        <SheetItemsEditor items={form.values.items} onChange={(items) => form.setFieldValue('items', items)} errors={form.errors} />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            {sheet ? 'Enregistrer' : 'Créer'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
