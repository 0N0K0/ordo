import { Stack, Text, TextInput } from '@mantine/core';
import { addDays, type CalendarEventInput, TEXT_MAX } from '@ordo/shared';
import { ArrowArcRightIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { PeriodField } from '../../../components/inputs/PeriodField';
import { FormActions } from '../../../components/dialogs/FormActions';
import { formCallbacks } from '../../../lib/form';
import { fitName } from '../../../lib/text';
import { useCalendarEventMutations, type EventOccurrence } from '../api';
import { withDays } from '../lib/event-input';
import { AvailabilityHint } from './AvailabilityHint';

interface PostponeFormProps {
  /** Fields of the event postponed (with the changes of the form). */
  fields: CalendarEventInput;
  /** Original label, for the label of the postponement. */
  label: string;
  loading: boolean;
  onCancel: () => void;
  onConfirm: (input: CalendarEventInput) => void;
}

/**
 * New date (and label) of a postponement: the event keeps its duration, from the next day by default.
 * @param {PostponeFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
function PostponeForm({ fields, label, loading, onCancel, onConfirm }: PostponeFormProps) {
  const [values, setValues] = useState({
    label: fitName('Report de l’évènement « ', label, ' »'),
    startDate: addDays(fields.startDate, 1),
    endDate: addDays(fields.endDate, 1),
    startTime: fields.startTime ?? null,
    endTime: fields.endTime ?? null,
  });
  const { endDate } = values;
  const valid = Boolean(values.label.trim() && values.startDate && (fields.allDay || (values.startTime && values.endTime && (endDate > values.startDate || values.endTime > values.startTime))));
  return (
    <Stack gap="sm">
      <Text size="sm">La date initiale sera annulée (l’évènement reste barré dans l’agenda) et un nouvel évènement, lié à elle, sera créé à la nouvelle date.</Text>
      <TextInput label="Libellé" required maxLength={TEXT_MAX} value={values.label} onChange={(event) => setValues({ ...values, label: event.currentTarget.value })} />
      <PeriodField
        label="Nouvelle date"
        description="L’évènement garde sa durée ; changez la fin pour la modifier."
        required
        weekday
        keepLength
        value={[values.startDate, values.endDate]}
        times={fields.allDay ? undefined : [values.startTime, values.endTime]}
        onChange={([startDate, end], hours) => startDate && end && setValues({ ...values, startDate, endDate: end, ...(hours ? { startTime: hours[0], endTime: hours[1] } : {}) })}
      />
      <AvailabilityHint allDay={fields.allDay} startDate={values.startDate} startTime={values.startTime} endDate={endDate} endTime={values.endTime} />
      <FormActions
        onCancel={onCancel}
        submitLabel="Reporter"
        submitIcon={<ArrowArcRightIcon aria-hidden />}
        loading={loading}
        disabled={!valid}
        // Its routine links go with it to its new days.
        onSubmit={() => onConfirm({ ...withDays(fields, values.startDate, endDate), label: values.label.trim(), startTime: values.startTime, endTime: values.endTime, recurrence: null })}
      />
    </Stack>
  );
}

/**
 * Postponement of an occurrence in its panel: its form, and the postponement once confirmed.
 * @param {{ fields: PostponeFormProps['fields'], occurrence: EventOccurrence, onCancel: () => void, onDone: () => void }} props Fields of the event, occurrence, closing.
 * @returns {JSX.Element} Panel content.
 */
export function PostponePanel({ fields, occurrence, onCancel, onDone }: { fields: PostponeFormProps['fields']; occurrence: EventOccurrence; onCancel: () => void; onDone: () => void }) {
  const { postpone } = useCalendarEventMutations();
  return (
    <PostponeForm
      fields={fields}
      label={occurrence.label}
      loading={postpone.isPending}
      onCancel={onCancel}
      onConfirm={(input) => postpone.mutate({ id: occurrence.eventId, occurrenceDate: occurrence.occurrenceDate, input }, formCallbacks(null, 'Évènement reporté.', onDone))}
    />
  );
}
