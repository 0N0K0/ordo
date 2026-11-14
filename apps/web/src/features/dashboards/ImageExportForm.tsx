import { Button, Group, SegmentedControl, Select, Stack, Text } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { useState } from 'react';
import type { ExportScheme } from './chart-image';
import * as fmt from '../../lib/format';

/** Settings of an image export. */
export interface ImageExportSettings {
  scheme: Exclude<ExportScheme, 'current'>;
  /** Final size, in pixels. */
  width: number;
  height: number;
}

const RATIOS: { value: string; label: string; ratio: number }[] = [
  { value: '16:9', label: '16:9 (écran large, présentation)', ratio: 16 / 9 },
  { value: '4:3', label: '4:3 (présentation classique)', ratio: 4 / 3 },
  { value: '3:2', label: '3:2 (photo)', ratio: 3 / 2 },
  { value: 'A4', label: 'A4 (√2, document imprimé)', ratio: Math.SQRT2 },
  { value: '1:1', label: '1:1 (carré)', ratio: 1 },
];
const SIZES: { value: string; label: string; long: number }[] = [
  { value: '1280', label: 'HD — 1 280 px', long: 1280 },
  { value: '1920', label: 'Full HD — 1 920 px', long: 1920 },
  { value: '2560', label: 'QHD — 2 560 px', long: 2560 },
  { value: '3840', label: '4K — 3 840 px', long: 3840 },
];

/**
 * Settings of the image export of a chart: light or dark colors, landscape or portrait, a standard ratio
 * (16:9, 4:3, 3:2, A4, 1:1) and size (long side in pixels). The choices are remembered in this browser.
 * @param {{ onExport: (settings: ImageExportSettings) => Promise<void>, onDone: () => void }} props Export and close.
 * @returns {JSX.Element} Form.
 */
export function ImageExportForm({ onExport, onDone }: { onExport: (settings: ImageExportSettings) => Promise<void>; onDone: () => void }) {
  const [stored, setStored] = useLocalStorage({
    key: 'ordo.dashboards.imageExport',
    defaultValue: { scheme: 'light' as ImageExportSettings['scheme'], orientation: 'landscape', ratio: '16:9', size: '1920' },
  });
  const [loading, setLoading] = useState(false);
  const ratio = RATIOS.find((item) => item.value === stored.ratio) ?? RATIOS[0];
  const long = (SIZES.find((item) => item.value === stored.size) ?? SIZES[1]).long;
  const short = Math.round(long / ratio.ratio);
  const portrait = stored.orientation === 'portrait' && ratio.ratio !== 1;
  const width = portrait ? short : long;
  const height = portrait ? long : short;
  const set = (changes: Partial<typeof stored>) => setStored({ ...stored, ...changes });

  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Text size="sm" fw={500}>
          Thème
        </Text>
        <SegmentedControl
          data={[
            { value: 'light', label: 'Clair' },
            { value: 'dark', label: 'Foncé' },
          ]}
          value={stored.scheme}
          onChange={(scheme) => set({ scheme: scheme as ImageExportSettings['scheme'] })}
        />
      </Stack>
      <Stack gap={4}>
        <Text size="sm" fw={500}>
          Orientation
        </Text>
        <SegmentedControl
          data={[
            { value: 'landscape', label: 'Paysage' },
            { value: 'portrait', label: 'Portrait' },
          ]}
          value={stored.orientation}
          disabled={ratio.ratio === 1}
          onChange={(orientation) => set({ orientation })}
        />
      </Stack>
      <Select label="Format" allowDeselect={false} data={RATIOS.map(({ value, label }) => ({ value, label }))} value={ratio.value} onChange={(value) => value && set({ ratio: value })} />
      <Select label="Taille (grand côté)" allowDeselect={false} data={SIZES.map(({ value, label }) => ({ value, label }))} value={String(long)} onChange={(value) => value && set({ size: value })} />
      <Text size="sm" c="dimmed">
        Image PNG de {fmt.number(width, 0)} × {fmt.number(height, 0)} px.
      </Text>
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onDone}>
          Annuler
        </Button>
        <Button
          loading={loading}
          onClick={() => {
            setLoading(true);
            onExport({ scheme: stored.scheme, width, height })
              .then(onDone)
              .finally(() => setLoading(false));
          }}
        >
          Exporter
        </Button>
      </Group>
    </Stack>
  );
}
