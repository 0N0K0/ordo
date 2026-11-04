import { Button, Group, SegmentedControl, Stack, Text, Title } from '@mantine/core';
import { addDays, entrySeconds, filterPeriod, formatDuration } from '@ordo/shared';
import { PlusIcon } from '@phosphor-icons/react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { ProjectSelect } from '../features/tasks/task-ui';
import { useTaskContext } from '../features/tasks/use-task-context';
import { useTimeEntriesSince } from '../features/time/api';
import { TimeLog } from '../features/time/TimeLog';
import { TimerCard } from '../features/time/TimerCard';
import { useTimeEntryDialogs } from '../features/time/use-time-dialogs';
import { descendantIds } from '../features/workspace/api';
import { localToday } from '../lib/dates';

type Period = 'week' | 'month' | 'quarter' | 'all';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'week', label: 'Cette semaine' },
  { value: 'month', label: 'Ce mois' },
  { value: 'quarter', label: '3 derniers mois' },
  { value: 'all', label: 'Tout' },
];

/**
 * First day of a period (null: everything).
 * @param {Period} period Period.
 * @param {string} today Today.
 * @returns {string | null} YYYY-MM-DD.
 */
function periodStart(period: Period, today: string): string | null {
  if (period === 'week') return filterPeriod('thisWeek', today)[0];
  if (period === 'month') return `${today.slice(0, 8)}01`;
  if (period === 'quarter') return addDays(today, -90);
  return null;
}

/**
 * Timers of every project: the running timer (or the form starting one), time added by hand, and the
 * tracked times of a period by day, optionally of one project and its sub-projects.
 * @returns {JSX.Element} Page.
 */
export function TimePage() {
  const { context } = useTaskContext();
  const [params, setParams] = useSearchParams();
  const period = (PERIODS.find((item) => item.value === params.get('period'))?.value ?? 'week') as Period;
  const projectId = params.get('project');
  const today = localToday();
  const start = periodStart(period, today);
  // Local midnight of the first day.
  const entries = useTimeEntriesSince(start ? new Date(`${start}T00:00:00`).toISOString() : null);
  const { openForm, confirmDelete } = useTimeEntryDialogs(context, projectId ?? undefined);

  const shown = useMemo(() => {
    if (!entries.data) return undefined;
    if (!projectId || !context) return entries.data;
    const tree = new Set([projectId, ...descendantIds(context.projects, projectId)]);
    return entries.data.filter((entry) => tree.has(entry.projectId));
  }, [entries.data, projectId, context]);

  const finished = (shown ?? []).filter((entry) => entry.endedAt !== null);
  const total = finished.reduce((sum, entry) => sum + entrySeconds(entry), 0);
  const unbilled = finished.filter((entry) => !entry.documentId).reduce((sum, entry) => sum + entrySeconds(entry), 0);

  /**
   * Changes a parameter of the page.
   * @param {string} key Parameter.
   * @param {string | null} value Value (null: removed).
   * @returns {void}
   */
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <Stack gap="lg">
      <Title order={1} size="h2">
        Chronos
      </Title>
      <TimerCard />
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
        <Button variant="light" leftSection={<PlusIcon aria-hidden />} onClick={() => openForm()} disabled={!context}>
          Ajouter un temps
        </Button>
      </Group>
      <Group gap="sm" align="flex-end">
        <SegmentedControl aria-label="Période" data={PERIODS} value={period} onChange={(value) => setParam('period', value === 'week' ? null : value)} />
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
        onDelete={confirmDelete}
      />
    </Stack>
  );
}
