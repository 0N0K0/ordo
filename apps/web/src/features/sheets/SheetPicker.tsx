import { ActionIcon, Group, NumberInput, Select, Stack, Text, Tooltip } from '@mantine/core';
import { XIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { confirmDestructive } from '../../components/dialogs/confirm-destructive';
import { notifySuccess, onMutationError } from '../../lib/notify';
import { useSheets } from './api';
import { FormActions } from '../../components/dialogs/FormActions';

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
 * the same product (or same label and unit); the sheets of the list taken out of it.
 * @param {SheetPickerProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function SheetPicker({ onAdd, present = [], onRemove, onDone }: SheetPickerProps) {
  const { data: sheets } = useSheets();
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [multiplier, setMultiplier] = useState<number>(1);
  const [pending, setPending] = useState(false);
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
        <NumberInput label="Fois" w={100} min={0.25} max={999} step={1} decimalScale={2} decimalSeparator="," value={multiplier} onChange={(value) => setMultiplier(Number(value) || 1)} prefix="× " />
      </Group>
      {present.length > 0 && onRemove && (
        <Stack gap={4}>
          <Text size="sm" fw={500}>
            Fiches de la liste
          </Text>
          {present.map((sheet) => (
            <Group key={sheet.sheetId} gap="xs" justify="space-between" wrap="nowrap">
              <Text size="sm">{sheet.name}</Text>
              <Tooltip label="Retirer la fiche de la liste">
                <ActionIcon
                  variant="subtle"
                  color="gray"
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
                >
                  <XIcon aria-hidden />
                </ActionIcon>
              </Tooltip>
            </Group>
          ))}
        </Stack>
      )}
      <FormActions
        onCancel={onDone}
        submitLabel="Ajouter"
        disabled={!sheetId}
        loading={pending}
        onSubmit={() => {
          if (!sheetId) return;
          setPending(true);
          onAdd(sheetId, multiplier)
            .then(() => {
              notifySuccess('Fiche ajoutée.');
              onDone();
            })
            .catch(onMutationError)
            .finally(() => setPending(false));
        }}
      />
    </Stack>
  );
}
