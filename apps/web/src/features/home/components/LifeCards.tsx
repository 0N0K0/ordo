import { collator } from '../../../lib/text';
import { IconAction } from '../../../components/actions/IconAction';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { mapById } from '@ordo/shared';
import { Badge, Group, Text } from '@mantine/core';
import { useSlotRules, routineDoable } from '../../calendar/hooks/use-slot-rules';
import { ArrowBendUpRightIcon, ArrowsClockwiseIcon, BasketIcon, CheckCircleIcon } from '@phosphor-icons/react';

import { useRoutinesData } from '../../routines/api';
import { RoutineDoneToggles } from '../../routines/components/DoneToggle';
import { scheduleOf, currentRoutineState, waitingFor, windowOf, windowText } from '../../routines/lib/routine-format';
import { usePostponeRoutine } from '../../routines/hooks/use-routine-move';
import { useShoppingData, useShoppingLists } from '../../shopping/api';
import classes from './Home.module.css';
import tile from '../../../components/page/StatTile.module.css';
import { CardFigure, HomeCard } from './HomeCard';
import { HomeList, HomeRow } from './HomeList';
import { leftToBuy } from '../../shopping/lib/shopping-format';
import { LateBadge } from './LateBadge';
import { shoppingListPath, PAGES } from '../../../app/pages';
import { WaitingIcon } from '../../routines/components/WaitingIcon';
import { unarchived } from '../../../lib/archive';

/**
 * Routines left to do today (late ones first), ticked from the card.
 * @param {{ today: string }} props Component props.
 * @param {string} props.today Today.
 * @returns {JSX.Element} Card.
 */
export function RoutinesCard({ today }: { today: string }) {
  const { data } = useRoutinesData();
  const postpone = usePostponeRoutine();
  const slotRules = useSlotRules();
  const routines = data?.routines ?? [];
  const byId = mapById(routines);
  const todo = unarchived(routines)
    .filter((routine) => ['due', 'late'].includes(currentRoutineState(routine, today, slotRules.allowed(routineDoable(routine)))))
    // Late ones first, then by time to leave (or to do it by), those of any time of the day last.
    .sort(
      (a, b) =>
        (a.currentDate ?? '').localeCompare(b.currentDate ?? '') ||
        (scheduleOf(a).leaveAt ?? a.windowFrom ?? a.windowTo ?? '99').localeCompare(scheduleOf(b).leaveAt ?? b.windowFrom ?? b.windowTo ?? '99') ||
        collator.compare(a.label, b.label),
    );

  return (
    <HomeCard title="Routines du jour" icon={<ArrowsClockwiseIcon aria-hidden />} to={PAGES.routines.path} loading={!data}>
      {todo.length === 0 && <EmptyState compact icon={<CheckCircleIcon aria-hidden />} message="Toutes les routines du jour sont faites." />}
      {todo.length > 0 && (
        <HomeList
          items={todo}
          render={(routine) => {
            const waiting = waitingFor(routine, byId);
            const late = routine.currentDate !== null && routine.currentDate < today;
            return (
              <Group key={routine.id} justify="space-between" wrap="nowrap" gap="xs" className={`${tile.tile} ${classes.row}`}>
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
                  <IconAction label="Reporter au lendemain" size="sm" aria-label={`Reporter « ${routine.label} » au lendemain`} onClick={() => postpone(routine)}>
                    <ArrowBendUpRightIcon aria-hidden />
                  </IconAction>
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
  const missing = (data?.shoppingProducts ?? []).filter((product) => product.missing && !product.archived).length;
  const open = (lists ?? [])
    .filter((list) => !list.closed && !list.archived)
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
