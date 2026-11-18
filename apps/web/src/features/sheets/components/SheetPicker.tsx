import { Group, Select, Stack, Text } from '@mantine/core';
import { LabeledField } from '../../../components/inputs/LabeledField';
import { useState } from 'react';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { notifySuccess, onMutationError } from '../../../lib/notify';
import { useSheets } from '../api';
import { FormActions } from '../../../components/dialogs/FormActions';
import { MultiplierInput } from './MultiplierInput';
import { RemoveButton } from '../../../components/actions/RemoveButton';
import { unarchived } from '../../../lib/archive';
import { useAsyncAction } from '../../../lib/use-async-action';

interface SheetPickerProps {
  /** Adds a sheet, times a multiplier (resolves once done). */
  onAdd: (sheetId: string, multiplier: number) => Promise<unknown>;
  /** Sheets already in the list, that can be taken out (their share of the items). Optional. */
  present?: { sheetId: string; name: string }[];
  onRemove?: (sheetId: string) => Promise<unknown>;
  onDone: () => void;
}

/**
 * Sheet added to a list (shopping list or checklist), times a multiplier: its items summed with those of the list of
 * the same product (or same label and unit); the sheets of the list taken out of it. The archived sheets are not
 * offered.
 * @param {SheetPickerProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function SheetPicker({ onAdd, present = [], onRemove, onDone }: SheetPickerProps) {
  // An archived sheet does not fill lists.
  const { data: all } = useSheets();
  const sheets = all && unarchived(all);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [multiplier, setMultiplier] = useState<number>(1);
  const { run: add, loading: pending } = useAsyncAction(() => (sheetId ? onAdd(sheetId, multiplier) : Promise.resolve()), { success: 'Fiche ajoutée.', onDone });
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Ses éléments s’ajoutent à ceux de la liste : un même produit (ou un même libellé dans la même unité) n’y figure qu’une fois, quantités additionnées et fiches indiquées.
      </Text>
      <Group gap="sm" align="flex-end" wrap="nowrap">
        <Select
          label="Fiche"
          placeholder={sheets?.length ? 'Choisir une fiche' : 'Aucune fiche'}
          searchable
          data={(sheets ?? []).map((sheet) => ({ value: sheet.id, label: sheet.name }))}
          value={sheetId}
          onChange={setSheetId}
          style={{ flex: 1 }}
          data-autofocus
        />
        <MultiplierInput label="Fois" w={100} step={1} value={multiplier} onChange={(value) => setMultiplier(Number(value) || 1)} />
      </Group>
      {present.length > 0 && onRemove && (
        <LabeledField label="Fiches de la liste">
          {present.map((sheet) => (
            <Group key={sheet.sheetId} gap="xs" justify="space-between" wrap="nowrap">
              <Text size="sm">{sheet.name}</Text>
              <RemoveButton
                label="Retirer la fiche de la liste"
                aria-label={`Retirer ${sheet.name} de la liste`}
                onClick={() =>
                  confirmDestructive({
                    title: 'Retirer la fiche',
                    risks: `La part de « ${sheet.name} » sera retirée des quantités de la liste, et les éléments qu’elle seule apportait (pas encore achetés ou cochés) seront supprimés.`,
                    onConfirm: () =>
                      onRemove(sheet.sheetId)
                        .then(() => notifySuccess('Fiche retirée.'))
                        .catch(onMutationError),
                  })
                }
              />
            </Group>
          ))}
        </LabeledField>
      )}
      <FormActions onCancel={onDone} submitLabel="Ajouter" disabled={!sheetId} loading={pending} onSubmit={() => void add()} />
    </Stack>
  );
}
