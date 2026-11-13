import { Button, Group, Paper, SegmentedControl, Skeleton, Stack, Tabs, Text, ThemeIcon } from '@mantine/core';
import { ArrowsClockwiseIcon, ClockCounterClockwiseIcon, PlusIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { PageTitle } from '../../components/PageTitle';
import { localToday } from '../../lib/dates';
import { useTaskContext } from '../tasks/use-task-context';
import { useRoutinesData, type Routine } from './api';
import { openRoutineForm } from './open-routine-form';
import { stateOf } from './routine-format';
import { RoutineHistory } from './RoutineHistory';
import { RoutineSettings } from './RoutineSettings';
import { RoutineTable } from './RoutineTable';

type RoutineFilter = 'todo' | 'all' | 'archived';

const FILTER_KEY = 'ordo.routines.filter';

/**
 * Filter remembered between visits.
 * @returns {RoutineFilter} Filter.
 */
function storedFilter(): RoutineFilter {
  try {
    const value = localStorage.getItem(FILTER_KEY);
    return value === 'all' || value === 'archived' ? value : 'todo';
  } catch {
    return 'todo';
  }
}

/** Empty state of each filter. */
const EMPTY: Record<RoutineFilter, string> = {
  todo: 'Rien à faire pour le moment : toutes les routines du jour sont cochées.',
  all: 'Aucune routine pour le moment. Une routine est une tâche qui revient : laver le linge, arroser les plantes…',
  archived: 'Aucune routine archivée.',
};

/**
 * Routines shown with a filter: what is left to do today (and late), every routine, or the archived ones, in a table
 * by category (sub-routines under their parent). On a project page, only the routines of the project (and of its
 * sub-projects), those added there going to the project.
 * @param {{ projectId?: string, projectIds?: ReadonlySet<string> }} props Component props.
 * @param {string} [props.projectId] Project of the page, given to the routines added. Optional.
 * @param {ReadonlySet<string>} [props.projectIds] Projects whose routines are shown (the project and its sub-projects). Optional.
 * @returns {JSX.Element} Routines.
 */
export function RoutinesPanel({ projectId, projectIds }: { projectId?: string; projectIds?: ReadonlySet<string> }) {
  const { data, isLoading } = useRoutinesData();
  const { context } = useTaskContext();
  const [filter, setFilter] = useState<RoutineFilter>(storedFilter);
  const today = localToday();
  const routines = data?.routines ?? [];

  /**
   * Whether a routine is shown with the filter.
   * @param {Routine} routine Routine.
   * @returns {boolean} Shown.
   */
  const keep = (routine: Routine) => {
    if (projectIds && !(routine.projectId && projectIds.has(routine.projectId))) return false;
    if (filter === 'archived') return routine.archived;
    if (routine.archived) return false;
    return filter === 'all' || ['due', 'late'].includes(stateOf(routine, today));
  };
  const count = routines.filter(keep).length;
  const empty = projectIds && filter === 'all' ? 'Aucune routine dans ce projet : une routine y est rattachée par son champ « Projet ».' : EMPTY[filter];

  return (
    <Stack gap="lg">
      <Group justify="space-between" gap="sm">
        <SegmentedControl
          value={filter}
          onChange={(value) => {
            setFilter(value as RoutineFilter);
            try {
              localStorage.setItem(FILTER_KEY, value);
            } catch {
              // Not remembered.
            }
          }}
          data={[
            { value: 'todo', label: 'À faire' },
            { value: 'all', label: 'Toutes' },
            { value: 'archived', label: 'Archivées' },
          ]}
          aria-label="Routines affichées"
        />
        <Button leftSection={<PlusIcon aria-hidden />} onClick={() => openRoutineForm({ projectId })}>
          Nouvelle routine
        </Button>
      </Group>
      {isLoading || !context ? (
        <Stack gap="xs" aria-label="Chargement">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} height={36} />
          ))}
        </Stack>
      ) : count === 0 && (filter !== 'all' || projectIds) ? (
        <Paper withBorder radius="md" p="xl">
          <Stack align="center" gap="sm">
            <ThemeIcon variant="light" size="xl" radius="xl">
              <ArrowsClockwiseIcon aria-hidden />
            </ThemeIcon>
            <Text size="sm" c="dimmed" ta="center">
              {empty}
            </Text>
          </Stack>
        </Paper>
      ) : (
        <Stack gap="xs">
          {count === 0 && (
            <Text size="sm" c="dimmed">
              {EMPTY.all}
            </Text>
          )}
          <RoutineTable routines={routines} categories={data?.routineCategories ?? []} context={context} keep={keep} addable={filter === 'all'} projectId={projectId ?? null} />
        </Stack>
      )}
    </Stack>
  );
}

/**
 * Routines page: tasks repeating on a calendar rule, ticked once done for their current occurrence, and the history of
 * what was ticked on which day; the settings hold the categories.
 * @returns {JSX.Element} Page.
 */
export function RoutinesPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'history' ? 'history' : 'routines';

  return (
    <Stack gap="lg">
      <PageTitle>Routines</PageTitle>
      <RoutineSettings />
      <Tabs
        value={tab}
        onChange={(value) =>
          setParams(
            (current) => {
              const next = new URLSearchParams(current);
              next.delete('routine');
              if (value === 'history') next.set('tab', 'history');
              else next.delete('tab');
              return next;
            },
            { replace: true },
          )
        }
        keepMounted={false}
      >
        <Tabs.List mb="md">
          <Tabs.Tab value="routines" leftSection={<ArrowsClockwiseIcon aria-hidden />}>
            Routines
          </Tabs.Tab>
          <Tabs.Tab value="history" leftSection={<ClockCounterClockwiseIcon aria-hidden />}>
            Historique
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="routines">
          <RoutinesPanel />
        </Tabs.Panel>
        <Tabs.Panel value="history">
          <RoutineHistory
            routineId={params.get('routine')}
            onRoutine={(id) =>
              setParams(
                (current) => {
                  const next = new URLSearchParams(current);
                  if (id) next.set('routine', id);
                  else next.delete('routine');
                  return next;
                },
                { replace: true },
              )
            }
          />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
