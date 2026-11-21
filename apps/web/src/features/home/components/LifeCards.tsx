import { collator } from '../../../lib/text';
import { IconAction } from '../../../components/actions/IconAction';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { Badge, Group, Text } from '@mantine/core';
import { ArrowBendUpRightIcon, ArrowsClockwiseIcon, BasketIcon, CheckCircleIcon } from '@phosphor-icons/react';

import { useRoutinesData, type Routine } from '../../routines/api';
import { useRoutineColumns } from '../../routines/hooks/use-routine-columns';
import { useDefaultTableView, useViewRows } from '../../../components/data-table/views/use-default-view';
import { viewPath } from '../../../components/data-table/views/use-saved-views';
import { useMemo } from 'react';
import { RoutineDoneToggles } from '../../routines/components/DoneToggle';
import { scheduleOf, currentRoutineState, movableOccurrence, waitingFor, windowOf, windowText } from '../../routines/lib/routine-format';
import { usePostponeRoutine } from '../../routines/hooks/use-routine-move';
import { useShoppingData, useShoppingLists } from '../../shopping/api';
import classes from './Home.module.css';
import tile from '../../../components/page/StatTile.module.css';
import { CardFigure, HomeCard } from './HomeCard';
import { HomeList, HomeRow } from './HomeList';
import { leftToBuy } from '../../shopping/lib/shopping-format';
import { LateBadge } from '../../../components/feedback/LateBadge';
import { shoppingListPath, PAGES } from '../../../app/pages';
import { WaitingIcon } from '../../routines/components/WaitingIcon';
import { unarchived } from '../../../lib/archive';
import { viewList, viewNote, type ViewItem } from '../lib/home-data';

/**
 * Whether a routine is archived (left out, as the routine table does until « Afficher les archivées » is on).
 * @param {Routine} routine Routine.
 * @returns {boolean} Archived.
 */
const isArchivedRoutine = (routine: Routine): boolean => routine.archived;

/**
 * Routines of the default view of the routines page (its filter, search, sorts and groups), archived ones left out;
 * without any view yet, those left to do today (late ones first). Ticked and postponed from the card.
 * @param {{ today: string }} props Component props.
 * @param {string} props.today Today.
 * @returns {JSX.Element} Card.
 */
export function RoutinesCard({ today }: { today: string }) {
  const { data } = useRoutinesData();
  const postpone = usePostponeRoutine();
  const routines = useMemo(() => data?.routines ?? [], [data]);
  const categories = useMemo(() => data?.routineCategories ?? [], [data]);
  const { view, isPending } = useDefaultTableView('routines');
  const { columns, byId, doable } = useRoutineColumns(routines, categories, today);
  const shown = useViewRows({ view, columns, rows: routines, archived: isArchivedRoutine });
  const list = useMemo(() => {
    if (view) return viewList(shown, (routine) => routine.id);
    const todo = unarchived(routines)
      .filter((routine) => ['due', 'late'].includes(currentRoutineState(routine, today, doable(routine))))
      // Late ones first, then by time to leave (or to do it by), those of any time of the day last.
      .sort(
        (a, b) =>
          (a.currentDate ?? '').localeCompare(b.currentDate ?? '') ||
          (scheduleOf(a).leaveAt ?? a.windowFrom ?? a.windowTo ?? '99').localeCompare(scheduleOf(b).leaveAt ?? b.windowFrom ?? b.windowTo ?? '99') ||
          collator.compare(a.label, b.label),
      );
    return { items: todo.map((routine): ViewItem<Routine> => ({ key: routine.id, group: '', row: routine })), group: undefined };
  }, [view, shown, routines, today, doable]);
  const loading = !data || isPending || (view !== null && columns.length === 0);

  return (
    <HomeCard
      title={view ? 'Routines' : 'Routines du jour'}
      icon={<ArrowsClockwiseIcon aria-hidden />}
      to={view ? viewPath(PAGES.routines.path, 'routines', view.id) : PAGES.routines.path}
      loading={loading}
      note={!isPending && viewNote(view, 'Routines', 'routines du jour')}
    >
      {list.items.length === 0 && <EmptyState compact icon={<CheckCircleIcon aria-hidden />} message={view ? 'Aucune routine dans cette vue.' : 'Toutes les routines du jour sont faites.'} />}
      {list.items.length > 0 && (
        <HomeList
          items={list.items}
          group={list.group}
          render={({ key, row: routine }) => {
            const waiting = waitingFor(routine, byId);
            const late = routine.currentDate !== null && routine.currentDate < today;
            return (
              <Group key={key} justify="space-between" wrap="nowrap" gap="xs" className={`${tile.tile} ${classes.row}`}>
                <Group gap="xs" wrap="nowrap" miw={0}>
                  <RoutineDoneToggles routine={routine} />
                  <Text size="sm" truncate>
                    {routine.label}
                  </Text>
                </Group>
                <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
                  <WaitingIcon waiting={waiting} />
                  {late && routine.currentDate && <LateBadge due={routine.currentDate} today={today} />}
                  {(routine.windowFrom || routine.windowTo) && (
                    <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                      {[scheduleOf(routine).leaveAt && `départ ${scheduleOf(routine).leaveAt}`, windowText(windowOf(routine))].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                  {!routine.windowFrom && !routine.windowTo && routine.estimate && (
                    <Text size="xs" c="dimmed">
                      {routine.estimate} min
                    </Text>
                  )}
                  {movableOccurrence(routine) && (
                    <IconAction label="Reporter au lendemain" size="sm" item={routine.label} onClick={() => postpone(routine)}>
                      <ArrowBendUpRightIcon aria-hidden />
                    </IconAction>
                  )}
                </Group>
              </Group>
            );
          }}
        />
      )}
    </HomeCard>
  );
}

/**
 * Shopping: products missing from the base lists, and the open lists with what is left to buy in each.
 * @returns {JSX.Element} Card.
 */
export function ShoppingCard() {
  const { data } = useShoppingData();
  const { data: lists } = useShoppingLists();
  // The archived products and lists apart.
  const missing = unarchived(data?.shoppingProducts ?? []).filter((product) => product.missing).length;
  const open = unarchived(lists ?? [])
    .filter((list) => !list.closed)
    .map((list) => ({ list, left: leftToBuy(list.items).length }))
    .sort((a, b) => b.list.createdAt.localeCompare(a.list.createdAt));

  return (
    <HomeCard title="Achats" icon={<BasketIcon aria-hidden />} to={PAGES.shopping.path} loading={!data || !lists}>
      <Group gap="xl">
        <CardFigure label="Produits manquants" value={missing} color={missing ? 'orange' : undefined} />
        <CardFigure label="Listes en cours" value={open.length} />
      </Group>
      {open.length === 0 ? (
        <EmptyState compact icon={<BasketIcon aria-hidden />} message="Aucune liste en cours." />
      ) : (
        <HomeList
          items={open}
          render={({ list, left }) => (
            <HomeRow
              key={list.id}
              to={shoppingListPath(list.id)}
              label={list.label}
              value={
                <Badge variant="light" color={left ? undefined : 'green'}>
                  {left ? `${left} à acheter` : 'Tout acheté'}
                </Badge>
              }
            />
          )}
        />
      )}
    </HomeCard>
  );
}
