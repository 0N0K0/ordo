import { Chip, Group, Select, Stack, TextInput } from '@mantine/core';
import { COUNTDOWN_PRESETS, countdownFormSchema, durationText, formatDuration, isRingtone, parseDuration, type CountdownFormValues, type DeadTime } from '@ordo/shared';
import { TimerIcon } from '@phosphor-icons/react';
import { FormActions } from '../../../components/dialogs/FormActions';
import { RingtoneSelect } from '../../../components/inputs/RingtoneSelect';
import { formCallbacks, useAppForm } from '../../../lib/form';
import { useWorkspaces } from '../../workspaces/api';
import { useCountdownMutations } from '../api';
import { COUNTDOWN_DEFAULT_NAME, deadTimeLabel, type DeadTimeItem } from '../lib/countdowns';

export interface CountdownFormProps {
  /** Item whose dead time it is launched for (none: a timer of its own). Optional. */
  item?: DeadTimeItem;
  /** Dead times of that item, one of them chosen (its name, duration and ringtone). Optional. */
  deadTimes?: readonly DeadTime[];
  /** Dead time chosen at first. Optional. Default = the first one. */
  deadTime?: DeadTime;
  onDone: () => void;
}

/**
 * Values of the form for a dead time (its name, estimated time, ringtone), or a timer of 10 minutes.
 * @param {DeadTime | undefined} deadTime Dead time.
 * @returns {CountdownFormValues} Values.
 */
const valuesOf = (deadTime: DeadTime | undefined): CountdownFormValues => ({ label: deadTime?.label ?? '', duration: durationText(deadTime?.minutes ?? 10), ringtone: deadTime?.ringtone ?? null });

/**
 * Starts a timer (« Lancer un minuteur », decision FT): its name (optional), its duration (typed, or a duration offered
 * at once), its ringtone; launched for a dead time of a task or a routine (« Lancer un temps mort »), the dead time
 * chosen gives them (its estimated time stays editable). The timers running keep running.
 * @param {CountdownFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function CountdownForm({ item, deadTimes = [], deadTime = deadTimes[0], onDone }: CountdownFormProps) {
  const { start } = useCountdownMutations();
  const { data: spaces } = useWorkspaces();
  const form = useAppForm<CountdownFormValues>({ initialValues: valuesOf(deadTime), schema: countdownFormSchema });
  const seconds = parseDuration(form.values.duration);

  const handleSubmit = form.onSubmit((values) =>
    start.mutate(
      {
        label: values.label || null,
        seconds: parseDuration(values.duration)!,
        ringtone: values.ringtone,
        ...(item && {
          taskId: item.taskId,
          routineId: item.routineId,
          occurrenceDate: item.occurrenceDate,
          subject: item.subject,
          path: item.path,
          linkLabel: item.linkLabel,
          workspaceId: item.workspaceId ?? spaces?.currentWorkspaceId,
        }),
      },
      formCallbacks(form, `Minuteur lancé : ${formatDuration(parseDuration(values.duration)!)}.`, onDone),
    ),
  );

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        {deadTimes.length > 1 && (
          <Select
            label="Temps mort"
            data={deadTimes.map((option, index) => ({ value: String(index), label: deadTimeLabel(option) }))}
            defaultValue={String(Math.max(0, deadTimes.indexOf(deadTime ?? deadTimes[0])))}
            allowDeselect={false}
            onChange={(index) => form.setValues(valuesOf(deadTimes[Number(index)]))}
          />
        )}
        <TextInput label="Nom" placeholder={COUNTDOWN_DEFAULT_NAME} data-autofocus={item ? undefined : true} {...form.getInputProps('label')} />
        <TextInput label="Durée" required description="10, 1:30, 1h30 ou 1,5 h" data-autofocus={item ? true : undefined} {...form.getInputProps('duration')} />
        <Group gap="xs" role="group" aria-label="Durées proposées">
          {COUNTDOWN_PRESETS.map((minutes) => (
            <Chip key={minutes} size="xs" checked={seconds === minutes * 60} onChange={() => form.setFieldValue('duration', durationText(minutes))}>
              {formatDuration(minutes * 60)}
            </Chip>
          ))}
        </Group>
        <RingtoneSelect label="Sonnerie" value={isRingtone(form.values.ringtone) ? form.values.ringtone : null} onChange={(ringtone) => form.setFieldValue('ringtone', ringtone)} />
        <FormActions onCancel={onDone} submitLabel="Lancer" submitIcon={<TimerIcon aria-hidden />} loading={start.isPending} />
      </Stack>
    </form>
  );
}
