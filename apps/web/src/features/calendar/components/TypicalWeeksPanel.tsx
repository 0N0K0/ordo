import { List, Stack, Text } from '@mantine/core';
import { NO_TYPICAL_WEEK, TYPICAL_WEEKS_MAX, typicalWeeks, typicalWeeksRefusal } from '@ordo/shared';
import { FilePdfIcon } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { FormActions } from '../../../components/dialogs/FormActions';
import { NoticeAlert } from '../../../components/feedback/NoticeAlert';
import { ListSkeleton } from '../../../components/feedback/Skeletons';
import { PeriodField } from '../../../components/inputs/PeriodField';
import * as fmt from '../../../lib/format';
import { countOf } from '../../../lib/text';
import { useAsyncAction } from '../../../lib/use-async-action';
import { useScheduleSources } from '../api';
import { scheduleSources, slotEvents } from '../lib/calendar-events';
import { downloadTypicalWeeksPdf, pdfItems } from '../lib/calendar-pdf';
import { scheduleChoices } from '../lib/layer-label';
import classes from '../pages/CalendarPage.module.css';
import { HiddenChecklist } from './HiddenChecklist';

interface TypicalWeeksPanelProps {
  /** Period offered first (that of the agenda). */
  period: { from: string; to: string };
  /** Créneaux and éphémérides left out first (those the view of the agenda hides). */
  hidden: readonly string[];
  /** Closes the panel. */
  onClose: () => void;
}

/**
 * Export of the typical weeks of a period: the period, and the créneaux and éphémérides taken into account (of the
 * workspace and of the workspaces it subscribes to, the archived ones apart); the typical weeks they give, counted
 * as they change (`typicalWeeks`, from their rules only), and their PDF, a page each, 6 at most (« Générer » disabled
 * beyond, with the reason). A skeleton until the schedules are read.
 * @param {TypicalWeeksPanelProps} props Component props.
 * @returns {JSX.Element} Panel content.
 */
export function TypicalWeeksPanel({ period, hidden: initiallyHidden, onClose }: TypicalWeeksPanelProps) {
  const [[from, to], setPeriod] = useState<[string, string]>([period.from, period.to]);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set(initiallyHidden));
  const { schedules, foreign, types, defaultKind } = useScheduleSources();
  const loaded = schedules !== undefined && foreign !== undefined && types !== undefined;
  const sources = useMemo(() => scheduleSources(schedules ?? [], foreign ?? [], types ?? [], defaultKind, false), [schedules, foreign, types, defaultKind]);
  const chosen = useMemo(() => sources.filter((source) => !hidden.has(source.schedule.id)), [sources, hidden]);
  const weeks = useMemo(() => typicalWeeks(chosen.map((source) => source.rule), from, to), [chosen, from, to]);
  const refusal = weeks.length > TYPICAL_WEEKS_MAX ? typicalWeeksRefusal(weeks.length) : weeks.length ? null : NO_TYPICAL_WEEK;
  // Each typical week drawn as the week of the agenda shows its slots, then as the PDF prints them.
  const { run: generate, loading } = useAsyncAction(
    () =>
      downloadTypicalWeeksPdf({
        title: `Du ${fmt.day(from)} au ${fmt.day(to)}`,
        weeks: weeks.map((week) => ({
          name: week.name,
          monday: week.weeks[0],
          items: pdfItems(
            slotEvents(
              chosen.map((source) => ({ ...source, slots: week.slots.filter((slot) => slot.scheduleId === source.rule.id) })),
              false,
            ),
            { closed: classes.closed, archived: classes.archived },
          ),
        })),
      }),
    { success: 'Semaines types exportées.', fallback: 'Export PDF impossible.', onDone: onClose },
  );
  return (
    <Stack gap="sm">
      <Text size="sm">Une page par semaine type : les semaines de la période qui ont les mêmes créneaux et éphémérides, d’après leurs répétitions seules (sans les jours modifiés, déplacés, supprimés ou en pause).</Text>
      <PeriodField label="Période" required value={[from, to]} onChange={([start, end]) => start && end && setPeriod([start, end])} />
      {loaded ? (
        <>
          <HiddenChecklist label="Créneaux et éphémérides" empty="Aucun créneau." choices={scheduleChoices(sources)} hidden={hidden} onChange={(next) => setHidden(new Set(next))} />
          {refusal ? (
            <NoticeAlert kind="warning">{refusal}</NoticeAlert>
          ) : (
            <NoticeAlert kind="info" title={countOf(weeks.length, 'semaine type', 'semaines types')}>
              <List size="sm">
                {weeks.map((week) => (
                  <List.Item key={week.weeks[0]}>{week.name}</List.Item>
                ))}
              </List>
            </NoticeAlert>
          )}
        </>
      ) : (
        <ListSkeleton items={4} />
      )}
      <FormActions onCancel={onClose} submitLabel="Générer" submitIcon={<FilePdfIcon aria-hidden />} loading={loading} disabled={!loaded || refusal !== null} onSubmit={() => void generate()} />
    </Stack>
  );
}
