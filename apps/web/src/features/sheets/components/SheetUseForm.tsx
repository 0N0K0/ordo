import { Stack, Text } from '@mantine/core';
import { CookingPotIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { notifyInfo, notifySuccess, onMutationError } from '../../../lib/notify';
import { useSheetMutations } from '../api';
import { countOf, plural } from '../../../lib/text';
import { FormActions } from '../../../components/dialogs/FormActions';
import { MultiplierInput } from './MultiplierInput';

/**
 * Use of a sheet (times a multiplier): its consumable items that are references followed in stock are taken from it,
 * the lots that expire first first.
 * @param {{ sheetId: string, label: string, onDone: () => void }} props Sheet, its label, and what follows.
 * @returns {JSX.Element} Form.
 */
export function SheetUseForm({ sheetId, label, onDone }: { sheetId: string; label: string; onDone: () => void }) {
  const { use } = useSheetMutations();
  const [multiplier, setMultiplier] = useState(1);
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Les éléments consommables de « {label} » qui sont des références suivies en stock en sont retirés, en commençant par les lots qui périment le plus tôt.
      </Text>
      <MultiplierInput label="Combien de fois" w={160} value={multiplier} onChange={(value) => setMultiplier(Number(value) || 1)} data-autofocus />
      <FormActions
        onCancel={onDone}
        submitLabel="Utiliser"
        submitIcon={<CookingPotIcon aria-hidden />}
        loading={use.isPending}
        onSubmit={() =>
          use.mutate(
            { id: sheetId, multiplier },
            {
              onSuccess: ({ taken, short }) => {
                if (taken && !short.length) notifySuccess(`${countOf(taken, 'élément')} ${plural(taken, 'retiré')} du stock.`);
                else
                  notifyInfo({
                    title: taken ? `${countOf(taken, 'élément')} ${plural(taken, 'retiré')} du stock` : 'Rien n’a été retiré du stock',
                    lines: [short.length ? `Pas assez en stock : ${short.join(', ')}.` : 'Aucun élément consommable de cette fiche n’est suivi en stock.'],
                  });
                onDone();
              },
              onError: onMutationError,
            },
          )
        }
      />
    </Stack>
  );
}
