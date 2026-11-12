import { Button, Group, Paper, SegmentedControl, Skeleton, Stack, Text, ThemeIcon } from '@mantine/core';
import { ArrowsClockwiseIcon, PlusIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { PageTitle } from '../../components/PageTitle';
import { localToday } from '../../lib/dates';
import { useTaskContext } from '../tasks/use-task-context';
import { useRoutinesData, type Routine } from './api';
import { openRoutineForm } from './open-routine-form';
import { stateOf } from './routine-format';
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
 * Routines page: tasks repeating on a calendar rule, ticked once done for their current occurrence, in a table by
 * category (sub-routines under their parent). Shows what is left to do today (and late), every routine, or the archived
 * ones; the settings hold the categories.
 * @returns {JSX.Element} Page.
 */
export function RoutinesPage() {
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
    if (filter === 'archived') return routine.archived;
    if (routine.archived) return false;
    return filter === 'all' || ['due', 'late'].includes(stateOf(routine, today));
  };
  const count = routines.filter(keep).length;

  return (
    <Stack gap="lg">
      <PageTitle>Routines</PageTitle>
      <RoutineSettings />
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
        <Button leftSection={<PlusIcon aria-hidden />} onClick={() => openRoutineForm()}>
          Nouvelle routine
        </Button>
      </Group>
      {isLoading || !context ? (
        <Stack gap="xs" aria-label="Chargement">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} height={36} />
          ))}
        </Stack>
      ) : count === 0 && filter !== 'all' ? (
        <Paper withBorder radius="md" p="xl">
          <Stack align="center" gap="sm">
            <ThemeIcon variant="light" size="xl" radius="xl">
              <ArrowsClockwiseIcon aria-hidden />
            </ThemeIcon>
            <Text size="sm" c="dimmed" ta="center">
              {EMPTY[filter]}
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
          <RoutineTable routines={routines} categories={data?.routineCategories ?? []} context={context} keep={keep} addable={filter === 'all'} />
        </Stack>
      )}
    </Stack>
  );
}
