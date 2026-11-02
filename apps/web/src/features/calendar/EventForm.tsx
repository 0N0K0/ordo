import { ActionIcon, Button, Group, Modal, MultiSelect, SimpleGrid, Stack, Switch, Text, TextInput, Tooltip } from '@mantine/core';
import { DatePickerInput, TimeInput } from '@mantine/dates';
import { addDays, calendarEventInputSchema, daysBetween, type CalendarEventInput } from '@ordo/shared';
import { LinkIcon, MapPinIcon, PlusIcon, TrashIcon, XIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { MarkdownEditor } from '../../components/markdown/MarkdownEditor';
import { RecurrenceEditor } from '../../components/recurrence/RecurrenceEditor';
import { localToday } from '../../lib/dates';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import { ProjectSelect } from '../tasks/task-ui';
import type { TaskContext } from '../tasks/use-task-context';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useCalendarCategories, useCalendarEventMutations, type EventOccurrence } from './api';
import { useScopeQuestion } from './ask-scope';
import { categoryOptions } from './category-tree';
import { LOCAL_TIME_ZONE, occurrenceInput, REMINDER_PRESETS } from './event-input';

type FormValues = CalendarEventInput & Record<string, unknown>;

interface EventFormProps {
  context: TaskContext;
  /** Occurrence edited. */
  occurrence?: EventOccurrence;
  /** Fields of a new event (dates selected in the calendar…). */
  defaults?: Partial<CalendarEventInput>;
  onDone: () => void;
}

/**
 * Calendar event form: title, dates and times (or all day), repetition with pauses, place, links,
 * project, contributors, categories, reminders, description. For an occurrence of a recurring event,
 * saving and deleting ask which occurrences are concerned.
 * @param {EventFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function EventForm({ context, occurrence, defaults, onDone }: EventFormProps) {
  const { create, update, remove } = useCalendarEventMutations();
  const { data: categories } = useCalendarCategories();
  // Questions are stacked over this form's modal: it must stay mounted to finish the save.
  const scopeQuestion = useScopeQuestion();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const today = localToday();
  const initial: CalendarEventInput = occurrence
    ? occurrenceInput(occurrence)
    : {
        title: '',
        description: '',
        location: '',
        links: [],
        allDay: false,
        startDate: today,
        startTime: '09:00',
        endDate: today,
        endTime: '10:00',
        timeZone: LOCAL_TIME_ZONE,
        recurrence: null,
        reminders: [15],
        projectId: null,
        contributorIds: [],
        categoryIds: [],
        ...defaults,
      };
  const form = useAppForm<FormValues>({ initialValues: initial as FormValues, schema: calendarEventInputSchema });
  const values = form.values;
  const recurring = occurrence?.occurrenceDate != null;
  // A rule is edited from the start of its series (for the whole series or the following occurrences).
  const ruleStart = recurring && occurrence ? occurrence.seriesStartDate : values.startDate;

  const handleSubmit = form.onSubmit(async (input) => {
    const callbacks = {
      onSuccess: () => {
        notifySuccess(occurrence ? 'Évènement modifié.' : 'Évènement créé.');
        onDone();
      },
      onError: (error: Error) => showFormError(form, error),
    };
    if (!occurrence) {
      create.mutate(input, callbacks);
      return;
    }
    let scope: 'THIS' | 'FOLLOWING' | 'ALL' = 'ALL';
    if (recurring) {
      const ruleChanged = JSON.stringify(input.recurrence) !== JSON.stringify(occurrence.recurrence);
      const chosen = await scopeQuestion.ask({ action: 'update', allowThis: !ruleChanged });
      if (!chosen) return;
      scope = chosen;
    }
    update.mutate({ id: occurrence.eventId, input, scope, occurrenceDate: occurrence.occurrenceDate }, callbacks);
  });

  /**
   * Deletes the event (asking which occurrences for a recurring one).
   * @returns {Promise<void>}
   */
  const handleDelete = async () => {
    if (!occurrence) return;
    /**
     * Runs the deletion.
     * @param {'THIS' | 'FOLLOWING' | 'ALL'} scope Scope.
     * @returns {void}
     */
    const run = (scope: 'THIS' | 'FOLLOWING' | 'ALL') =>
      remove.mutate(
        { id: occurrence.eventId, scope, occurrenceDate: occurrence.occurrenceDate },
        {
          onSuccess: () => {
            notifySuccess('Évènement supprimé.');
            onDone();
          },
          onError: (error) => notifyError(error.message),
        },
      );
    if (recurring) {
      const scope = await scopeQuestion.ask({ action: 'delete' });
      if (scope) run(scope);
      return;
    }
    setConfirmingDelete(true);
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {scopeQuestion.dialog}
      <Modal opened={confirmingDelete} onClose={() => setConfirmingDelete(false)} title="Supprimer l’évènement" centered zIndex={300}>
        <Stack gap="md">
          <Text size="sm">L’évènement « {occurrence?.title} » sera supprimé définitivement. Cette action est irréversible.</Text>
          <DestructiveActions
            loading={remove.isPending}
            onCancel={() => setConfirmingDelete(false)}
            onConfirm={() => {
              setConfirmingDelete(false);
              remove.mutate(
                { id: occurrence!.eventId, scope: 'ALL', occurrenceDate: occurrence!.occurrenceDate },
                {
                  onSuccess: () => {
                    notifySuccess('Évènement supprimé.');
                    onDone();
                  },
                  onError: (error) => notifyError(error.message),
                },
              );
            }}
          />
        </Stack>
      </Modal>
      <Stack gap="md">
        <TextInput label="Titre" required data-autofocus {...form.getInputProps('title')} />
        <Switch
          label="Journée entière"
          checked={values.allDay}
          onChange={(event) => {
            const allDay = event.currentTarget.checked;
            form.setValues({ allDay, startTime: allDay ? null : '09:00', endTime: allDay ? null : '10:00' });
          }}
        />
        <SimpleGrid cols={{ base: 1, xs: values.allDay ? 2 : 4 }} spacing="sm">
          <DatePickerInput
            label="Début"
            required
            valueFormat="ddd D MMM YYYY"
            {...form.getInputProps('startDate')}
            onChange={(startDate) => {
              if (!startDate) return;
              // The end follows, keeping the duration.
              const span = daysBetween(values.startDate, values.endDate);
              form.setValues({ startDate, endDate: addDays(startDate, Math.max(0, span)) });
            }}
          />
          {!values.allDay && <TimeInput label="Heure de début" required {...form.getInputProps('startTime')} />}
          <DatePickerInput label="Fin" required valueFormat="ddd D MMM YYYY" minDate={values.startDate} {...form.getInputProps('endDate')} />
          {!values.allDay && <TimeInput label="Heure de fin" required {...form.getInputProps('endTime')} />}
        </SimpleGrid>

        <RecurrenceEditor
          value={values.recurrence ?? null}
          onChange={(recurrence) => form.setFieldValue('recurrence', recurrence)}
          start={ruleStart}
        />

        <TextInput label="Lieu" leftSection={<MapPinIcon aria-hidden />} placeholder="Adresse, salle, visio…" {...form.getInputProps('location')} />

        <Stack gap={4}>
          <Group gap="xs">
            <Text size="sm" fw={500}>
              Liens
            </Text>
            <Button
              size="compact-xs"
              variant="subtle"
              leftSection={<PlusIcon aria-hidden />}
              onClick={() => form.setFieldValue('links', [...values.links, { url: '', label: '' }])}
            >
              Ajouter un lien
            </Button>
          </Group>
          {values.links.map((_, index) => (
            <Group key={index} gap="xs" wrap="nowrap" align="flex-start">
              <TextInput
                aria-label={`Adresse du lien ${index + 1}`}
                placeholder="https://…"
                leftSection={<LinkIcon aria-hidden />}
                style={{ flex: 2 }}
                {...form.getInputProps(`links.${index}.url`)}
              />
              <TextInput aria-label={`Libellé du lien ${index + 1}`} placeholder="Libellé (facultatif)" style={{ flex: 1 }} {...form.getInputProps(`links.${index}.label`)} />
              <Tooltip label="Retirer le lien">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  mt={4}
                  aria-label={`Retirer le lien ${index + 1}`}
                  onClick={() => form.setFieldValue('links', values.links.filter((__, position) => position !== index))}
                >
                  <XIcon aria-hidden />
                </ActionIcon>
              </Tooltip>
            </Group>
          ))}
        </Stack>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <ProjectSelect context={context} label="Projet" clearable placeholder="Aucun" {...form.getInputProps('projectId')} />
          <MultiSelect
            label="Contributeurs"
            placeholder={values.contributorIds.length ? undefined : 'Aucun'}
            data={context.contributors.map((contributor) => ({ value: contributor.id, label: context.contributorName(contributor) }))}
            searchable
            clearable
            {...form.getInputProps('contributorIds')}
          />
          <MultiSelect
            label="Catégories"
            placeholder={values.categoryIds.length ? undefined : 'Aucune'}
            data={categoryOptions(categories ?? [])}
            searchable
            clearable
            nothingFoundMessage="Créez des catégories dans Paramètres › Agenda"
            {...form.getInputProps('categoryIds')}
          />
          <MultiSelect
            label="Rappels"
            placeholder={values.reminders.length ? undefined : 'Aucun'}
            data={REMINDER_PRESETS.map((preset) => ({ value: String(preset.value), label: preset.label }))}
            value={values.reminders.map(String)}
            onChange={(reminders) => form.setFieldValue('reminders', reminders.map(Number).sort((a, b) => a - b))}
            clearable
          />
        </SimpleGrid>
        {recurring && (
          <Text size="xs" c="dimmed">
            Projet, contributeurs, catégories et rappels s’appliquent à toute la série.
          </Text>
        )}

        <MarkdownEditor
          label="Description"
          value={values.description ?? ''}
          onChange={(description) => form.setFieldValue('description', description)}
          suggestions={context.suggestions}
          minRows={3}
        />

        <Group justify="space-between" gap="sm">
          {occurrence ? (
            <Button variant="subtle" color="red" leftSection={<TrashIcon aria-hidden />} onClick={() => void handleDelete()} loading={remove.isPending}>
              Supprimer
            </Button>
          ) : (
            <span />
          )}
          <Group gap="sm">
            <Button variant="default" onClick={onDone}>
              Annuler
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              {occurrence ? 'Enregistrer' : 'Créer l’évènement'}
            </Button>
          </Group>
        </Group>
      </Stack>
    </form>
  );
}
