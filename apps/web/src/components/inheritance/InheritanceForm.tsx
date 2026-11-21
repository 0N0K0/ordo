import { Input, SegmentedControl, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import { FormActions } from '../dialogs/FormActions';
import { useAsyncAction } from '../../lib/use-async-action';
import { INHERITANCE_WORDS } from './inheritance';

/** Choice for one field: unchanged, inherited again, emptied on purpose. */
type FieldChoice = 'keep' | 'inherit' | 'clear';

/** An inherited field offered: its key, its label, whether it can be emptied. */
export interface InheritableFieldOption<F extends string> {
  field: F;
  label: string;
  /** « Vider » not offered (the project of a sub-task, the first time and the repetition of a routine). Optional. */
  required?: boolean;
}

export interface InheritanceFormProps<F extends string> {
  fields: readonly InheritableFieldOption<F>[];
  /** Items changed, told above the fields (« 3 tâches »). */
  about: string;
  /** Applies the choices (its toast with « Annuler » told by the caller). */
  onApply: (change: { inheritFields: F[]; clearFields: F[] }) => Promise<unknown>;
  onDone: () => void;
}

/**
 * « Héritage » of sub-items, the same for one item (its row menu) and for a selection: for each
 * inherited field, « Inchangé », « Rétablir l'héritage » or « Vider »; the items without parent are left as they are.
 * @param {InheritanceFormProps<F>} props Component props.
 * @returns {JSX.Element} Form.
 */
export function InheritanceForm<F extends string>({ fields, about, onApply, onDone }: InheritanceFormProps<F>) {
  const [choices, setChoices] = useState<Partial<Record<F, FieldChoice>>>({});
  const picked = (choice: FieldChoice) => fields.filter((option) => choices[option.field] === choice).map((option) => option.field);
  const changed = picked('inherit').length + picked('clear').length > 0;
  const apply = useAsyncAction(() => onApply({ inheritFields: picked('inherit'), clearFields: picked('clear') }), { onDone });

  return (
    <Stack gap="md">
      <Text size="sm">{about} : choisissez, champ par champ, de reprendre la valeur du parent ou de vider le champ exprès. Un élément sans parent n’hérite de rien.</Text>
      {fields.map((option) => (
        <Input.Wrapper key={option.field} label={option.label}>
          <SegmentedControl
            fullWidth
            size="xs"
            value={choices[option.field] ?? 'keep'}
            onChange={(value) => setChoices((current) => ({ ...current, [option.field]: value as FieldChoice }))}
            data={[
              { value: 'keep', label: 'Inchangé' },
              { value: 'inherit', label: INHERITANCE_WORDS.inherit },
              ...(option.required ? [] : [{ value: 'clear', label: INHERITANCE_WORDS.clear }]),
            ]}
          />
        </Input.Wrapper>
      ))}
      <FormActions onCancel={onDone} submitLabel="Appliquer" onSubmit={() => void apply.run()} loading={apply.loading} disabled={!changed} />
    </Stack>
  );
}
