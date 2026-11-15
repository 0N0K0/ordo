import { Button, Group, NumberInput, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import { notifyError, notifyInfo, notifySuccess } from '../../lib/notify';
import { useSheetMutations } from './api';

/**
 * Use of a sheet (times a multiplier): its consumable items that are references followed in stock are taken from it,
 * the lots that expire first first.
 * @param {{ sheetId: string, name: string, onDone: () => void }} props Sheet, its name, and what follows.
 * @returns {JSX.Element} Form.
 */
export function SheetUseForm({ sheetId, name, onDone }: { sheetId: string; name: string; onDone: () => void }) {
  const { use } = useSheetMutations();
  const [multiplier, setMultiplier] = useState(1);
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Les éléments consommables de « {name} » qui sont des références suivies en stock en sont retirés, en commençant par les lots qui périment le plus tôt.
      </Text>
      <NumberInput
        label="Combien de fois"
        w={160}
        min={0.25}
        max={999}
        decimalScale={2}
        decimalSeparator=","
        prefix="× "
        value={multiplier}
        onChange={(value) => setMultiplier(Number(value) || 1)}
        data-autofocus
      />
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onDone}>
          Annuler
        </Button>
        <Button
          loading={use.isPending}
          onClick={() =>
            use.mutate(
              { id: sheetId, multiplier },
              {
                onSuccess: ({ taken, short }) => {
                  if (taken && !short.length) notifySuccess(`${taken} élément${taken > 1 ? 's' : ''} retiré${taken > 1 ? 's' : ''} du stock.`);
                  else
                    notifyInfo({
                      title: taken ? `${taken} élément${taken > 1 ? 's' : ''} retiré${taken > 1 ? 's' : ''} du stock` : 'Rien n’a été retiré du stock',
                      lines: [short.length ? `Pas assez en stock : ${short.join(', ')}.` : 'Aucun élément consommable de cette fiche n’est suivi en stock.'],
                    });
                  onDone();
                },
                onError: (error) => notifyError(error.message),
              },
            )
          }
        >
          Utiliser
        </Button>
      </Group>
    </Stack>
  );
}
