import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphql } from '../../graphql';
import type { WorkScheduleInput } from '@ordo/shared';
import type { CalendarEventInput, CalendarEventOccurrenceFieldsFragment, CalendarEventScope, CalendarsQuery, SubscribableCalendarsQuery, WorkSchedulesQuery } from '../../graphql/graphql';
import { execute, executeIn } from '../../lib/graphql-client';
import { tasksQueryKey } from '../tasks/api';

export type EventOccurrence = CalendarEventOccurrenceFieldsFragment;
export type WorkSchedule = WorkSchedulesQuery['workSchedules'][number];
export type ScheduleType = WorkSchedulesQuery['scheduleTypes'][number];
export type { CalendarEventInput, CalendarEventScope };

graphql(`
  fragment CalendarEventOccurrenceFields on CalendarEventOccurrence {
    key
    eventId
    occurrenceDate
    modified
    title
    description
    location
    links {
      url
      label
    }
    allDay
    startDate
    startTime
    endDate
    endTime
    timeZone
    start
    end
    recurrence
    seriesStartDate
    reminders
    projectId
    calendarId
    contributorIds
    categoryIds
    taskIds
    calledOff
    postponedFrom {
      eventId
      date
      title
    }
    postponedTo {
      eventId
      title
      startDate
      startTime
    }
    trackedSeconds
  }
`);

const WorkSchedulesDocument = graphql(`
  query WorkSchedules {
    workSchedules {
      id
      name
      startDate
      endDate
      intervalWeeks
      typeId
      slots {
        weekday
        start
        end
        allDay
      }
      pauses {
        from
        to
        label
      }
    }
    scheduleTypes {
      id
      name
      color
      position
    }
  }
`);

const ForeignSchedulesDocument = graphql(`
  query ForeignWorkSchedules($subscribed: Boolean) {
    foreignWorkSchedules(subscribed: $subscribed) {
      id
      name
      startDate
      endDate
      intervalWeeks
      slots {
        weekday
        start
        end
        allDay
      }
      pauses {
        from
        to
        label
      }
      typeName
      color
      workspaceId
      workspaceName
      subscribed
    }
  }
`);

const SaveScheduleTypeDocument = graphql(`
  mutation SaveScheduleType($id: ID, $input: ScheduleTypeInput!) {
    saveScheduleType(id: $id, input: $input)
  }
`);

const DeleteScheduleTypeDocument = graphql(`
  mutation DeleteScheduleType($id: ID!) {
    deleteScheduleType(id: $id)
  }
`);

const SubscribeWorkScheduleDocument = graphql(`
  mutation SubscribeWorkSchedule($scheduleId: ID!) {
    subscribeWorkSchedule(scheduleId: $scheduleId)
  }
`);

const UnsubscribeWorkScheduleDocument = graphql(`
  mutation UnsubscribeWorkSchedule($scheduleId: ID!) {
    unsubscribeWorkSchedule(scheduleId: $scheduleId)
  }
`);

const CreateWorkScheduleDocument = graphql(`
  mutation CreateWorkSchedule($input: WorkScheduleInput!) {
    createWorkSchedule(input: $input)
  }
`);

const UpdateWorkScheduleDocument = graphql(`
  mutation UpdateWorkSchedule($id: ID!, $input: WorkScheduleInput!) {
    updateWorkSchedule(id: $id, input: $input)
  }
`);

const DeleteWorkScheduleDocument = graphql(`
  mutation DeleteWorkSchedule($id: ID!) {
    deleteWorkSchedule(id: $id)
  }
`);

const SetCalledOffDocument = graphql(`
  mutation SetCalendarEventCalledOff($id: ID!, $scope: CalendarEventScope!, $occurrenceDate: Date, $calledOff: Boolean!) {
    setCalendarEventCalledOff(id: $id, scope: $scope, occurrenceDate: $occurrenceDate, calledOff: $calledOff)
  }
`);

const PostponeDocument = graphql(`
  mutation PostponeCalendarEvent($id: ID!, $occurrenceDate: Date, $input: CalendarEventInput!) {
    postponeCalendarEvent(id: $id, occurrenceDate: $occurrenceDate, input: $input)
  }
`);

const CalendarCategoriesDocument = graphql(`
  query CalendarCategories {
    calendarCategories {
      id
      name
      color
      parentId
      position
    }
  }
`);

const CalendarEventsDocument = graphql(`
  query CalendarEvents($from: Date!, $to: Date!) {
    calendarEvents(from: $from, to: $to) {
      ...CalendarEventOccurrenceFields
    }
  }
`);

const CalendarsDocument = graphql(`
  query Calendars {
    calendars {
      id
      name
      color
      position
    }
    calendarSubscriptions {
      id
      calendarId
      name
      color
      workspace {
        id
        name
        kind
      }
    }
  }
`);

const SubscribableCalendarsDocument = graphql(`
  query SubscribableCalendars {
    subscribableCalendars {
      id
      name
      color
      subscribed
      workspace {
        id
        name
        kind
      }
    }
  }
`);

const SubscribedCalendarEventsDocument = graphql(`
  query SubscribedCalendarEvents($from: Date!, $to: Date!) {
    subscribedCalendarEvents(from: $from, to: $to) {
      ...CalendarEventOccurrenceFields
    }
  }
`);

const CreateCalendarDocument = graphql(`
  mutation CreateCalendar($input: CalendarInput!) {
    createCalendar(input: $input) {
      id
    }
  }
`);

const UpdateCalendarDocument = graphql(`
  mutation UpdateCalendar($id: ID!, $input: CalendarInput!) {
    updateCalendar(id: $id, input: $input) {
      id
    }
  }
`);

const MoveCalendarDocument = graphql(`
  mutation MoveCalendar($id: ID!, $index: Int!) {
    moveCalendar(id: $id, index: $index)
  }
`);

const DeleteCalendarDocument = graphql(`
  mutation DeleteCalendar($id: ID!) {
    deleteCalendar(id: $id)
  }
`);

const SubscribeCalendarDocument = graphql(`
  mutation SubscribeCalendar($calendarId: ID!) {
    subscribeCalendar(calendarId: $calendarId)
  }
`);

const UnsubscribeCalendarDocument = graphql(`
  mutation UnsubscribeCalendar($calendarId: ID!) {
    unsubscribeCalendar(calendarId: $calendarId)
  }
`);

const CreateCalendarCategoryDocument = graphql(`
  mutation CreateCalendarCategory($input: CalendarCategoryInput!) {
    createCalendarCategory(input: $input) {
      id
    }
  }
`);

const UpdateCalendarCategoryDocument = graphql(`
  mutation UpdateCalendarCategory($id: ID!, $input: CalendarCategoryInput!) {
    updateCalendarCategory(id: $id, input: $input) {
      id
    }
  }
`);

const DeleteCalendarCategoryDocument = graphql(`
  mutation DeleteCalendarCategory($id: ID!) {
    deleteCalendarCategory(id: $id)
  }
`);

const MoveCalendarCategoryDocument = graphql(`
  mutation MoveCalendarCategory($id: ID!, $index: Int!) {
    moveCalendarCategory(id: $id, index: $index)
  }
`);

const CreateCalendarEventDocument = graphql(`
  mutation CreateCalendarEvent($input: CalendarEventInput!) {
    createCalendarEvent(input: $input)
  }
`);

const UpdateCalendarEventDocument = graphql(`
  mutation UpdateCalendarEvent($id: ID!, $input: CalendarEventInput!, $scope: CalendarEventScope!, $occurrenceDate: Date) {
    updateCalendarEvent(id: $id, input: $input, scope: $scope, occurrenceDate: $occurrenceDate)
  }
`);

const DeleteCalendarEventDocument = graphql(`
  mutation DeleteCalendarEvent($id: ID!, $scope: CalendarEventScope!, $occurrenceDate: Date) {
    deleteCalendarEvent(id: $id, scope: $scope, occurrenceDate: $occurrenceDate)
  }
`);

const MaterializeTaskOccurrencesDocument = graphql(`
  mutation MaterializeTaskOccurrences($from: Date!, $to: Date!) {
    materializeTaskOccurrences(from: $from, to: $to)
  }
`);

export const calendarQueryKey = ['calendar'] as const;

export type CalendarCategory = Awaited<ReturnType<typeof fetchCategories>>[number];

/**
 * Calendar categories, in manual order.
 * @returns {Promise<object[]>} Categories.
 */
async function fetchCategories() {
  return (await execute(CalendarCategoriesDocument)).calendarCategories;
}

/**
 * Calendar categories.
 * @returns {UseQueryResult} Query state.
 */
export function useCalendarCategories() {
  return useQuery({ queryKey: [...calendarQueryKey, 'categories'], queryFn: fetchCategories });
}

/**
 * Event occurrences of a period.
 * @param {{ from: string, to: string } | null} range Dates, included.
 * @returns {UseQueryResult} Query state.
 */
export function useCalendarEvents(range: { from: string; to: string } | null) {
  return useQuery({
    queryKey: [...calendarQueryKey, 'events', range],
    queryFn: async () => (await execute(CalendarEventsDocument, range!)).calendarEvents,
    enabled: range !== null,
    placeholderData: (previous) => previous,
  });
}

/**
 * Event occurrences of a period (reminders included), of the workspace of this tab or of another one.
 * @param {{ from: string, to: string }} range First and last days.
 * @param {string} [workspace] Another workspace (its notifications). Optional.
 * @returns {Promise<EventOccurrence[]>} Occurrences.
 */
export async function fetchCalendarEvents(range: { from: string; to: string }, workspace?: string): Promise<EventOccurrence[]> {
  return (await (workspace ? executeIn(workspace, CalendarEventsDocument, range) : execute(CalendarEventsDocument, range))).calendarEvents;
}

export type Calendar = CalendarsQuery['calendars'][number];
export type CalendarSubscription = CalendarsQuery['calendarSubscriptions'][number];
export type SubscribableCalendar = SubscribableCalendarsQuery['subscribableCalendars'][number];

/**
 * Calendars of the workspace, and those of other workspaces it shows (read only).
 * @returns {UseQueryResult<CalendarsQuery>} Query state.
 */
export function useCalendars() {
  return useQuery({ queryKey: [...calendarQueryKey, 'calendars'], queryFn: () => execute(CalendarsDocument) });
}

/**
 * Calendars of the other workspaces, with whether this one shows them.
 * @param {boolean} enabled Whether to load them.
 * @returns {UseQueryResult} Query state.
 */
export function useSubscribableCalendars(enabled: boolean) {
  return useQuery({
    queryKey: [...calendarQueryKey, 'subscribable'],
    queryFn: async () => (await execute(SubscribableCalendarsDocument)).subscribableCalendars,
    enabled,
  });
}

/**
 * Event occurrences, in a period, of the calendars of other workspaces shown (read only).
 * @param {{ from: string, to: string } | null} range Dates, included; null when none are shown.
 * @returns {UseQueryResult} Query state.
 */
export function useSubscribedCalendarEvents(range: { from: string; to: string } | null) {
  return useQuery({
    queryKey: [...calendarQueryKey, 'subscribed-events', range],
    queryFn: async () => (await execute(SubscribedCalendarEventsDocument, range!)).subscribedCalendarEvents,
    enabled: range !== null,
    placeholderData: (previous) => previous,
  });
}

/**
 * Mutation refreshing the calendar once done.
 * @param {(variables: TVariables) => Promise<TResult>} mutationFn Request.
 * @returns {UseMutationResult} Mutation state.
 */
function useCalendarMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TVariables>({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: calendarQueryKey }),
  });
}

/**
 * Calendars edition, and the subscriptions to the calendars of other workspaces.
 * @returns {object} Mutations.
 */
export function useCalendarMutations() {
  type Input = { name: string; color: string };
  return {
    create: useCalendarMutation(async (input: Input) => (await execute(CreateCalendarDocument, { input })).createCalendar),
    update: useCalendarMutation(async (variables: { id: string; input: Input }) => (await execute(UpdateCalendarDocument, variables)).updateCalendar),
    move: useCalendarMutation(async (variables: { id: string; index: number }) => (await execute(MoveCalendarDocument, variables)).moveCalendar),
    remove: useCalendarMutation(async (id: string) => (await execute(DeleteCalendarDocument, { id })).deleteCalendar),
    subscribe: useCalendarMutation(async (calendarId: string) => (await execute(SubscribeCalendarDocument, { calendarId })).subscribeCalendar),
    unsubscribe: useCalendarMutation(async (calendarId: string) => (await execute(UnsubscribeCalendarDocument, { calendarId })).unsubscribeCalendar),
  };
}

/**
 * Calendar categories edition.
 * @returns {object} Mutations.
 */
export function useCalendarCategoryMutations() {
  type Input = { name: string; color: string; parentId: string | null };
  return {
    create: useCalendarMutation(async (input: Input) => (await execute(CreateCalendarCategoryDocument, { input })).createCalendarCategory),
    update: useCalendarMutation(
      async (variables: { id: string; input: Input }) => (await execute(UpdateCalendarCategoryDocument, variables)).updateCalendarCategory,
    ),
    remove: useCalendarMutation(async (id: string) => (await execute(DeleteCalendarCategoryDocument, { id })).deleteCalendarCategory),
    move: useCalendarMutation(async (variables: { id: string; index: number }) => (await execute(MoveCalendarCategoryDocument, variables)).moveCalendarCategory),
  };
}

/**
 * Events edition.
 * @returns {object} Mutations.
 */
export function useCalendarEventMutations() {
  return {
    create: useCalendarMutation(async (input: CalendarEventInput) => (await execute(CreateCalendarEventDocument, { input })).createCalendarEvent),
    update: useCalendarMutation(
      async (variables: { id: string; input: CalendarEventInput; scope: CalendarEventScope; occurrenceDate: string | null }) =>
        (await execute(UpdateCalendarEventDocument, variables)).updateCalendarEvent,
    ),
    remove: useCalendarMutation(
      async (variables: { id: string; scope: CalendarEventScope; occurrenceDate: string | null }) =>
        (await execute(DeleteCalendarEventDocument, variables)).deleteCalendarEvent,
    ),
    setCalledOff: useCalendarMutation(
      async (variables: { id: string; scope: CalendarEventScope; occurrenceDate: string | null; calledOff: boolean }) =>
        (await execute(SetCalledOffDocument, variables)).setCalendarEventCalledOff,
    ),
    postpone: useCalendarMutation(
      async (variables: { id: string; occurrenceDate: string | null; input: CalendarEventInput }) => (await execute(PostponeDocument, variables)).postponeCalendarEvent,
    ),
  };
}

/**
 * Planned working hours.
 * @returns {UseQueryResult} Query state.
 */
export function useWorkSchedules() {
  return useQuery({ queryKey: [...calendarQueryKey, 'work-schedules'], queryFn: () => execute(WorkSchedulesDocument), select: (data) => data.workSchedules });
}

/**
 * Kinds of time slots ("Travail", "Garde des enfants"…).
 * @returns {UseQueryResult} Query state.
 */
export function useScheduleTypes() {
  return useQuery({ queryKey: [...calendarQueryKey, 'work-schedules'], queryFn: () => execute(WorkSchedulesDocument), select: (data) => data.scheduleTypes });
}

/**
 * Time slots of the other workspaces (only those this one shows, with `subscribed`).
 * @param {boolean} subscribed Only those subscribed to.
 * @returns {UseQueryResult} Query state.
 */
export function useForeignSchedules(subscribed: boolean) {
  return useQuery({
    queryKey: [...calendarQueryKey, 'foreign-schedules', subscribed],
    queryFn: async () => (await execute(ForeignSchedulesDocument, { subscribed })).foreignWorkSchedules,
  });
}

/**
 * Working hours edition.
 * @returns {object} Mutations.
 */
export function useWorkScheduleMutations() {
  return {
    create: useCalendarMutation(async (input: WorkScheduleInput) => (await execute(CreateWorkScheduleDocument, { input } as never)).createWorkSchedule),
    update: useCalendarMutation(async (variables: { id: string; input: WorkScheduleInput }) => (await execute(UpdateWorkScheduleDocument, variables as never)).updateWorkSchedule),
    remove: useCalendarMutation(async (id: string) => (await execute(DeleteWorkScheduleDocument, { id })).deleteWorkSchedule),
    saveType: useCalendarMutation(async (variables: { id: string | null; input: { name: string; color: string } }) => (await execute(SaveScheduleTypeDocument, variables)).saveScheduleType),
    removeType: useCalendarMutation(async (id: string) => (await execute(DeleteScheduleTypeDocument, { id })).deleteScheduleType),
    subscribe: useCalendarMutation(async (scheduleId: string) => (await execute(SubscribeWorkScheduleDocument, { scheduleId })).subscribeWorkSchedule),
    unsubscribe: useCalendarMutation(async (scheduleId: string) => (await execute(UnsubscribeWorkScheduleDocument, { scheduleId })).unsubscribeWorkSchedule),
  };
}

/**
 * Schedules as the shared functions read them (those of this workspace, or of another one subscribed to).
 * @param {object[]} schedules Schedules.
 * @returns {import('@ordo/shared').WorkScheduleRule[]} Rules.
 */
export function scheduleRules<S extends Omit<WorkSchedule, 'typeId' | 'startDate' | 'endDate'> & { startDate: unknown; endDate?: unknown }>(schedules: readonly S[]) {
  return schedules.map((schedule) => ({ ...schedule, startDate: String(schedule.startDate), endDate: schedule.endDate ? String(schedule.endDate) : null }));
}

/**
 * Creates the occurrences of recurring tasks in the displayed period, then refreshes the tasks when some
 * were created.
 * @returns {UseMutationResult} Mutation state.
 */
export function useMaterializeTaskOccurrences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (range: { from: string; to: string }) => (await execute(MaterializeTaskOccurrencesDocument, range)).materializeTaskOccurrences,
    onSuccess: (created) => {
      if (created > 0) void queryClient.invalidateQueries({ queryKey: tasksQueryKey });
    },
  });
}

/**
 * Address of the iCalendar file of a calendar of the workspace, or of all of them (downloaded with the session).
 * @param {string | null} calendarId Calendar, or null for every calendar.
 * @returns {string} URL.
 */
export function calendarIcsUrl(calendarId: string | null): string {
  return `/api/exports/calendar.ics${calendarId ? `?calendar=${encodeURIComponent(calendarId)}` : ''}`;
}
