import { calendarFormSchema, type CalendarFormValues } from '@ordo/shared';
import { prisma, unscopedPrisma } from '../../db';
import type { Calendar, WorkspaceKind } from '../../generated/prisma/client';
import { clientError, orNotFound, parseInput } from '../../graphql/errors';
import { currentWorkspaceId } from '../../workspace-context';
import { BY_POSITION_ONLY, nextPositionIn } from '../core/ordering';
import { assertNotArchived, firstActive } from '../core/archive';

/** Color of the calendar a workspace starts with. */
const DEFAULT_COLOR = '#228be6';

/** Calendar of another workspace shown in this one, read only. */
export interface CalendarSubscriptionView {
  id: string;
  calendarId: string;
  label: string;
  color: string;
  workspace: { id: string; label: string; kind: WorkspaceKind };
}

/** Calendar of another workspace this one can subscribe to. */
export interface SubscribableCalendar {
  id: string;
  label: string;
  color: string;
  workspace: { id: string; label: string; kind: WorkspaceKind };
  subscribed: boolean;
}

/**
 * Loads a calendar of the workspace or throws NOT_FOUND.
 * @param {string} id Calendar.
 * @returns {Promise<Calendar>} Calendar.
 */
async function findCalendar(id: string): Promise<Calendar> {
  const calendar = await orNotFound(prisma.calendar.findUnique({ where: { id } }), 'Calendrier');
  return calendar;
}

/**
 * Calendar an event goes into: the one asked for (of the workspace), or else the first one not archived, created
 * (named after the workspace) when there is none.
 * @param {string | null | undefined} [id] Calendar asked for. Optional.
 * @returns {Promise<string>} Calendar id.
 */
export async function resolveCalendarId(id?: string | null): Promise<string> {
  if (id) return (await findCalendar(id)).id;
  // An archived calendar takes no new event: the first one that is not, else the first one (refused then).
  const first = await firstActive(prisma.calendar);
  if (first) return first.id;
  const workspace = await unscopedPrisma.workspace.findUniqueOrThrow({ where: { id: currentWorkspaceId() }, select: { label: true } });
  return (await prisma.calendar.create({ data: { label: workspace.label, color: DEFAULT_COLOR } })).id;
}

/**
 * Creates a calendar, last of the workspace.
 * @param {CalendarFormValues} input Name and color.
 * @returns {Promise<Calendar>} Calendar.
 */
export async function createCalendar(input: CalendarFormValues): Promise<Calendar> {
  const data = parseInput(calendarFormSchema, input);
  const position = await nextPositionIn('calendar');
  return prisma.calendar.create({ data: { ...data, position } });
}

/**
 * Renames a calendar or changes its color.
 * @param {string} id Calendar.
 * @param {CalendarFormValues} input Name and color.
 * @returns {Promise<Calendar>} Calendar.
 */
export async function updateCalendar(id: string, input: CalendarFormValues): Promise<Calendar> {
  await findCalendar(id);
  await assertNotArchived('calendar', id);
  return prisma.calendar.update({ where: { id }, data: parseInput(calendarFormSchema, input) });
}

/**
 * Deletes a calendar with its events (and the subscriptions of other workspaces to it). The last one of a
 * workspace stays.
 * @param {string} id Calendar.
 * @returns {Promise<void>}
 */
export async function deleteCalendar(id: string): Promise<void> {
  await findCalendar(id);
  if ((await prisma.calendar.count()) <= 1) throw clientError('BAD_USER_INPUT', 'Le dernier calendrier ne peut pas être supprimé.');
  await prisma.calendar.delete({ where: { id } });
}

/**
 * Calendars of other workspaces shown in this one, in their order.
 * @returns {Promise<CalendarSubscriptionView[]>} Subscriptions.
 */
export async function listSubscriptions(): Promise<CalendarSubscriptionView[]> {
  const subscriptions = await prisma.calendarSubscription.findMany({
    orderBy: BY_POSITION_ONLY,
    include: { calendar: { include: { workspace: { select: { id: true, label: true, kind: true } } } } },
  });
  return subscriptions.map(({ id, calendar }) => ({ id, calendarId: calendar.id, label: calendar.label, color: calendar.color, workspace: calendar.workspace }));
}

/**
 * Calendars of the other workspaces, by workspace, with whether this one shows them.
 * @returns {Promise<SubscribableCalendar[]>} Calendars.
 */
export async function subscribableCalendars(): Promise<SubscribableCalendar[]> {
  const subscribed = new Set((await prisma.calendarSubscription.findMany({ select: { calendarId: true } })).map((item) => item.calendarId));
  const calendars = await unscopedPrisma.calendar.findMany({
    where: { workspaceId: { not: currentWorkspaceId() } },
    include: { workspace: { select: { id: true, label: true, kind: true, position: true, createdAt: true } } },
  });
  return calendars
    .sort(
      (a, b) =>
        a.workspace.position - b.workspace.position || a.workspace.createdAt.getTime() - b.workspace.createdAt.getTime() || a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime(),
    )
    .map(({ id, label, color, workspace }) => ({ id, label, color, workspace: { id: workspace.id, label: workspace.label, kind: workspace.kind }, subscribed: subscribed.has(id) }));
}

/**
 * Shows a calendar of another workspace in this one (read only).
 * @param {string} calendarId Calendar.
 * @returns {Promise<void>}
 */
export async function subscribe(calendarId: string): Promise<void> {
  const calendar = await orNotFound(unscopedPrisma.calendar.findUnique({ where: { id: calendarId }, select: { workspaceId: true } }), 'Calendrier');
  if (calendar.workspaceId === currentWorkspaceId()) throw clientError('BAD_USER_INPUT', 'Ce calendrier appartient déjà à cet espace.');
  if (await prisma.calendarSubscription.findFirst({ where: { calendarId }, select: { id: true } })) return;
  const position = await nextPositionIn('calendarSubscription');
  await prisma.calendarSubscription.create({ data: { calendarId, position } });
}

/**
 * Stops showing a calendar of another workspace.
 * @param {string} calendarId Calendar.
 * @returns {Promise<void>}
 */
export async function unsubscribe(calendarId: string): Promise<void> {
  await prisma.calendarSubscription.deleteMany({ where: { calendarId } });
}
