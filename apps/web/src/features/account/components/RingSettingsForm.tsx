import { NumberInput, SimpleGrid, Stack, Switch } from '@mantine/core';
import { REPEAT_MINUTES_MAX, RING_MINUTES_MAX, ringSettingsSchema, type RingSettings } from '@ordo/shared';
import { SaveStatus } from '../../../components/feedback/SaveStatus';
import { RingtoneSelect } from '../../../components/inputs/RingtoneSelect';
import { useAppForm, useFieldSave } from '../../../lib/form';
import { useUpdateRingSettings } from '../../auth/api';
import { OutsideRings } from './OutsideRings';

/**
 * How the alarms and reminders of the user ring, in every workspace: duration of a ring, looped or once,
 * repeated every N minutes until « Arrêter », ringtone (`RingtoneSelect`, « Écouter » plays it), ringing outside the app (`OutsideRings`:
 * the push notifications of the devices). Each field is
 * saved as soon as it changes (the numbers on leaving them, `useFieldSave`).
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
        <RingtoneSelect
          label="Sonnerie"
          withSettings={false}
          value={form.getValues().ringtone}
          onChange={(ringtone) => {
            if (ringtone) form.setFieldValue('ringtone', ringtone);
          }}
        />
        <OutsideRings checked={form.getValues().outside} onChange={(value) => form.setFieldValue('outside', value)} />
      </Stack>
    </form>
  );
}
