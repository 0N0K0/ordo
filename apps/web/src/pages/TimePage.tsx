import { Button, Group, SegmentedControl, Stack, Text, Title, Tooltip } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { entrySeconds, filterPeriod, formatDuration } from '@ordo/shared';
import { PlayIcon, PlusIcon } from '@phosphor-icons/react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { ProjectSelect } from '../features/tasks/task-ui';
import { useTaskContext } from '../features/tasks/use-task-context';
import { useRunningTimer, useTimeEntriesSince } from '../features/time/api';
import { openTimerForm } from '../features/time/open-timer-form';
import { PlannedTime } from '../features/time/PlannedTime';
import { TimeLog } from '../features/time/TimeLog';
import { useTimeEntryDialogs } from '../features/time/use-time-dialogs';
import { descendantIds } from '../features/workspace/api';
import { localToday } from '../lib/dates';
import { useActiveWorkspace } from '../features/workspaces/api';
import { PageTitle } from '../components/PageTitle';

type Period = 'week' | 'month' | 'year' | 'range';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'week', label: 'Cette semaine' },
  { value: 'month', label: 'Ce mois' },
  { value: 'year', label: 'Cette année' },
  { value: 'range', label: 'Entre deux dates' },
];

/**
 * Days of a period, first and last (null: up to now).
 * @param {Period} period Period.
 * @param {string} today Today.
 * @param {string | null} from First day chosen (between two dates).
 * @param {string | null} to Last day chosen (between two dates).
 * @returns {[string, string | null]} YYYY-MM-DD.
 */
function periodDays(period: Period, today: string, from: string | null, to: string | null): [string, string | null] {
  if (period === 'week') return [filterPeriod('thisWeek', today)[0], null];
  if (period === 'year') return [`${today.slice(0, 4)}-01-01`, null];
  if (period === 'range') return [from ?? `${today.slice(0, 8)}01`, to ?? today];
  return [`${today.slice(0, 8)}01`, null];
}

/**
 * Local day of an instant.
 * @param {string} iso Instant.
 * @returns {string} YYYY-MM-DD.
 */
function localDay(iso: string): string {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/**
 * Timers of every project: a button starting one (in a modal), planned against tracked time, time added by hand,
 * and the tracked times of a period (this week, month or year, or between two dates) in a table by day, optionally
 * of one project and its sub-projects.
 * @returns {JSX.Element} Page.
 */
export function TimePage() {
  const { perso } = useActiveWorkspace();
  const { context } = useTaskContext();
  const [params, setParams] = useSearchParams();
  const period = (PERIODS.find((item) => item.value === params.get('period'))?.value ?? 'week') as Period;
  const projectId = params.get('project');
  const today = localToday();
  const [start, end] = periodDays(period, today, params.get('from'), params.get('to'));
  // From local midnight of the first day; the last one, if any, is applied below.
  const entries = useTimeEntriesSince(new Date(`${start}T00:00:00`).toISOString());
  const running = useRunningTimer();
  const { openForm, duplicate, confirmDelete } = useTimeEntryDialogs(context, projectId ?? undefined);

  const shown = useMemo(() => {
    if (!entries.data) return undefined;
    const inPeriod = end ? entries.data.filter((entry) => localDay(entry.startedAt) <= end) : entries.data;
    if (!projectId || !context) return inPeriod;
    const tree = new Set([projectId, ...descendantIds(context.projects, projectId)]);
    return inPeriod.filter((entry) => entry.projectId !== null && tree.has(entry.projectId));
  }, [entries.data, end, projectId, context]);

  const finished = (shown ?? []).filter((entry) => entry.endedAt !== null);
  const total = finished.reduce((sum, entry) => sum + entrySeconds(entry), 0);
  const unbilled = finished.filter((entry) => !entry.documentId).reduce((sum, entry) => sum + entrySeconds(entry), 0);

  /**
   * Changes a parameter of the page.
   * @param {string} key Parameter.
   * @param {string | null} value Value (null: removed).
   * @returns {void}
   */
  const setParam = (key: string, value: string | null) => setParamsTo({ [key]: value });

  /**
   * Changes parameters of the page.
   * @param {Record<string, string | null>} values Values by parameter (null: removed).
   * @returns {void}
   */
  const setParamsTo = (values: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };

  return (
    <Stack gap="lg">
      <PageTitle>Chronos</PageTitle>
      {/* In a personal workspace, slots are no working hours: timers are not compared with them. */}
      {!perso && <PlannedTime />}
      <Group justify="space-between" align="flex-end" gap="sm">
        <Stack gap={2}>
          <Title order={2} size="h4">
            Temps passé
          </Title>
          <Text size="sm" c="dimmed">
            {formatDuration(total)} au total
            {total > 0 && (unbilled > 0 ? `, dont ${formatDuration(unbilled)} non facturé` : ', tout est facturé')}.
          </Text>
        </Stack>
        {/* One timer runs at a time: the one running shows in the top bar. */}
        <Group gap="sm">
          <Button variant="light" leftSection={<PlusIcon aria-hidden />} onClick={() => openForm()} disabled={!context}>
            Ajouter un temps
          </Button>
          <Tooltip label="Un chrono tourne déjà" disabled={!running.data}>
            <Button leftSection={<PlayIcon aria-hidden />} onClick={() => context && openTimerForm(context)} disabled={!context || Boolean(running.data)}>
              Lancer un chrono
            </Button>
          </Tooltip>
        </Group>
      </Group>
      <Group gap="sm" align="flex-end">
        <SegmentedControl aria-label="Période" data={PERIODS} value={period} onChange={(value) => setParamsTo({ period: value === 'week' ? null : value, from: null, to: null })} />
        {period === 'range' && (
          <DatePickerInput
            type="range"
            aria-label="Dates"
            valueFormat="DD/MM/YYYY"
            value={[start, end]}
            onChange={([from, to]) => from && to && setParamsTo({ from, to })}
            allowSingleDateInRange
            w={240}
          />
        )}
        {context && (
          <ProjectSelect
            context={context}
            aria-label="Projet"
            placeholder="Tous les projets"
            clearable
            value={projectId}
            onChange={(value) => setParam('project', value)}
            w={{ base: '100%', sm: 360 }}
          />
        )}
      </Group>
      <TimeLog
        entries={shown}
        context={context}
        projectId={projectId}
        emptyMessage={projectId ? 'Aucun temps sur ce projet pendant cette période.' : 'Aucun temps pendant cette période.'}
        onEdit={openForm}
        onDuplicate={duplicate}
        onDelete={confirmDelete}
      />
    </Stack>
  );
}
