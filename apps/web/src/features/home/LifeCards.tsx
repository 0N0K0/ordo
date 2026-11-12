import { Badge, Group, Stack, Text, Tooltip } from '@mantine/core';
import { ArrowsClockwiseIcon, BasketIcon, CheckCircleIcon, HourglassMediumIcon } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { notifyError } from '../../lib/notify';
import { useRoutineMutations, useRoutinesData } from '../routines/api';
import { DoneToggle } from '../routines/DoneToggle';
import { stateOf, waitingFor } from '../routines/routine-format';
import { useShoppingData, useShoppingLists } from '../shopping/api';
import classes from './Home.module.css';
import { Figure, HomeCard, HomeEmpty } from './HomeCard';
import { daysBetween } from './home-data';

const MAX_ROWS = 7;

/**
 * Routines left to do today (late ones first), ticked from the card.
 * @param {{ today: string }} props Component props.
 * @param {string} props.today Today.
 * @returns {JSX.Element} Card.
 */
export function RoutinesCard({ today }: { today: string }) {
  const { data } = useRoutinesData();
  const { setDone } = useRoutineMutations();
  const routines = data?.routines ?? [];
  const byId = new Map(routines.map((routine) => [routine.id, routine]));
  const todo = routines
    .filter((routine) => !routine.archived && ['due', 'late'].includes(stateOf(routine, today)))
    .sort((a, b) => (a.currentDate ?? '').localeCompare(b.currentDate ?? '') || a.title.localeCompare(b.title, 'fr'));

  return (
    <HomeCard title="Routines du jour" icon={<ArrowsClockwiseIcon aria-hidden />} to="/routines" loading={!data}>
      {todo.length === 0 && <HomeEmpty icon={<CheckCircleIcon aria-hidden />}>Toutes les routines du jour sont faites.</HomeEmpty>}
      {todo.length > 0 && (
        <Stack gap={0}>
          {todo.slice(0, MAX_ROWS).map((routine) => {
            const waiting = waitingFor(routine, byId);
            const late = routine.currentDate !== null && routine.currentDate < today;
            return (
              <Group key={routine.id} justify="space-between" wrap="nowrap" gap="xs" className={classes.row}>
                <Group gap="xs" wrap="nowrap" miw={0}>
                  <DoneToggle
                    title={routine.title}
                    done={false}
                    date={routine.currentDate}
                    onChange={(done) => setDone.mutate({ id: routine.id, done }, { onError: (error) => notifyError(error.message) })}
                  />
                  <Text size="sm" truncate>
                    {routine.title}
                  </Text>
                </Group>
                <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
                  {waiting.length > 0 && (
                    <Tooltip label={`En attente de : ${waiting.map((item) => item.title).join(', ')}`}>
                      <HourglassMediumIcon aria-label="En attente" color="var(--mantine-color-orange-6)" />
                    </Tooltip>
                  )}
                  {late && routine.currentDate && (
                    <Badge color="orange" variant="light">
                      {daysBetween(routine.currentDate, today)} j de retard
                    </Badge>
                  )}
                  {routine.estimate && (
                    <Text size="xs" c="dimmed">
                      {routine.estimate} min
                    </Text>
                  )}
                </Group>
              </Group>
            );
          })}
          {todo.length > MAX_ROWS && (
            <Text size="xs" c="dimmed" pt={4}>
              + {todo.length - MAX_ROWS} autre{todo.length - MAX_ROWS > 1 ? 's' : ''}
            </Text>
          )}
        </Stack>
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
  const missing = (data?.shoppingProducts ?? []).filter((product) => product.missing).length;
  const open = (lists ?? [])
    .filter((list) => !list.closed)
    .map((list) => ({ list, left: list.items.filter((item) => !item.purchasedAt).length }))
    .sort((a, b) => b.list.createdAt.localeCompare(a.list.createdAt));

  return (
    <HomeCard title="Courses" icon={<BasketIcon aria-hidden />} to="/shopping" loading={!data || !lists}>
      <Group gap="xl">
        <Figure label="Produits manquants" value={missing} color={missing ? 'orange' : undefined} />
        <Figure label="Listes en cours" value={open.length} />
      </Group>
      {open.length === 0 ? (
        <HomeEmpty icon={<BasketIcon aria-hidden />}>Aucune liste en cours.</HomeEmpty>
      ) : (
        <Stack gap={0}>
          {open.slice(0, MAX_ROWS).map(({ list, left }) => (
            <Link key={list.id} to={`/shopping/${list.id}`} className={classes.row}>
              <Group justify="space-between" wrap="nowrap" gap="xs">
                <Text size="sm" truncate>
                  {list.name}
                </Text>
                <Badge variant="light" color={left ? undefined : 'green'} style={{ flexShrink: 0 }}>
                  {left ? `${left} à acheter` : 'Tout acheté'}
                </Badge>
              </Group>
            </Link>
          ))}
        </Stack>
      )}
    </HomeCard>
  );
}
