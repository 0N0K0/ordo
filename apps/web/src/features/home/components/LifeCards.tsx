import { collator } from '../../../lib/text';
import { IconAction } from '../../../components/actions/IconAction';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { daysBetween, mapById } from '@ordo/shared';
import { Badge, Group, Text, Tooltip } from '@mantine/core';
import { useSlotRules, routineDoable } from '../../calendar/hooks/use-slot-rules';
import { ArrowBendUpRightIcon, ArrowsClockwiseIcon, BasketIcon, CheckCircleIcon, HourglassMediumIcon } from '@phosphor-icons/react';

import { useRoutinesData } from '../../routines/api';
import { RoutineDoneToggles } from '../../routines/components/DoneToggle';
import { scheduleOf, stateOf, waitingFor, windowOf, windowText } from '../../routines/lib/routine-format';
import { usePostponeRoutine } from '../../routines/hooks/use-routine-move';
import { useShoppingData, useShoppingLists } from '../../shopping/api';
import classes from './Home.module.css';
import tile from '../../../components/page/StatTile.module.css';
import { CardFigure, HomeCard } from './HomeCard';
import { HomeList, HomeRow } from './HomeList';
import { leftToBuy } from '../../shopping/lib/shopping-format';

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
  const todo = routines
    .filter((routine) => !routine.archived && ['due', 'late'].includes(stateOf(routine, today, slotRules.allowed(routineDoable(routine)))))
    // Late ones first, then by time to leave (or to do it by), those of any time of the day last.
    .sort(
      (a, b) =>
        (a.currentDate ?? '').localeCompare(b.currentDate ?? '') ||
        (scheduleOf(a).leaveAt ?? a.windowFrom ?? a.windowTo ?? '99').localeCompare(scheduleOf(b).leaveAt ?? b.windowFrom ?? b.windowTo ?? '99') ||
        collator.compare(a.label, b.label),
    );

  return (
    <HomeCard title="Routines du jour" icon={<ArrowsClockwiseIcon aria-hidden />} to="/routines" loading={!data}>
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
                  {waiting.length > 0 && (
                    <Tooltip label={`En attente de : ${waiting.map((item) => item.label).join(', ')}`}>
                      <HourglassMediumIcon aria-label="En attente" color="var(--mantine-color-orange-6)" />
                    </Tooltip>
                  )}
                  {late && routine.currentDate && (
                    <Badge color="orange" variant="light">
                      {daysBetween(routine.currentDate, today)} j de retard
                    </Badge>
                  )}
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
    <HomeCard title="Achats" icon={<BasketIcon aria-hidden />} to="/shopping" loading={!data || !lists}>
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
              to={`/shopping/${list.id}`}
              title={list.label}
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
