import { Group, NumberInput, Select, SimpleGrid, Stack, Switch } from '@mantine/core';
import { REPEAT_MINUTES_MAX, RING_MINUTES_MAX, RINGTONES, ringSettingsSchema, type RingSettings } from '@ordo/shared';
import { PlayIcon } from '@phosphor-icons/react';
import { ActionButton } from '../../../components/actions/ActionButton';
import { SaveStatus } from '../../../components/feedback/SaveStatus';
import { useAppForm, useFieldSave } from '../../../lib/form';
import { previewRingtone } from '../../alarms/lib/alarm-sound';
import { useUpdateRingSettings } from '../../auth/api';
import { OutsideRings } from './OutsideRings';

/** Ringtones offered. */
const RINGTONE_OPTIONS = RINGTONES.map((ringtone) => ({ value: ringtone.id, label: ringtone.label }));

/**
 * How the alarms and reminders of the user ring, in every workspace (decision FS): duration of a ring, looped or once,
 * repeated every N minutes until « Arrêter », ringtone (« Écouter » plays it), ringing outside the app (`OutsideRings`:
 * the push notifications of the devices, lot 17c). Each field is
 * saved as soon as it changes (the numbers on leaving them, decision D22, `useFieldSave`).
 * @param {{ settings: RingSettings }} props Settings as saved.
 * @returns {JSX.Element} Form.
 */
export function RingSettingsForm({ settings }: { settings: RingSettings }) {
  const update = useUpdateRingSettings();
  const base = useAppForm<RingSettings>({ initialValues: settings, schema: ringSettingsSchema });
  const { form, saving } = useFieldSave(base, {
    save: (_changes, values) => update.mutateAsync(values),
    schema: ringSettingsSchema,
    saved: settings,
    onBlur: ['ringMinutes', 'repeatMinutes'],
  });
  // Enter in a number saves it (the fields are saved one by one).
  const handleSubmit = form.onSubmit(() => undefined);

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <SaveStatus saving={saving} />
        <SimpleGrid type="container" cols={{ base: 1, '560px': 2 }} spacing="md">
          <NumberInput label="Durée de la sonnerie" suffix=" min" min={1} max={RING_MINUTES_MAX} allowDecimal={false} required {...form.getInputProps('ringMinutes')} />
          <NumberInput
            label="Répéter toutes les"
            description="Jusqu’à « Arrêter » ; 0 : pas de répétition."
            suffix=" min"
            min={0}
            max={REPEAT_MINUTES_MAX}
            allowDecimal={false}
            required
            {...form.getInputProps('repeatMinutes')}
          />
        </SimpleGrid>
        <Switch label="En boucle" description="La sonnerie se répète pendant toute sa durée ; sinon elle sonne une fois." {...form.getInputProps('loop', { type: 'checkbox' })} />
        <Group align="flex-end" gap="xs">
          <Select label="Sonnerie" data={RINGTONE_OPTIONS} allowDeselect={false} {...form.getInputProps('ringtone')} />
          <ActionButton priority="secondary" icon={<PlayIcon aria-hidden />} onClick={() => previewRingtone(form.getValues().ringtone)}>
            Écouter
          </ActionButton>
        </Group>
        <OutsideRings checked={form.getValues().outside} onChange={(value) => form.setFieldValue('outside', value)} />
      </Stack>
    </form>
  );
}
