import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphql } from '../../graphql';
import type { WorkScheduleInput } from '@ordo/shared';
import type { CalendarEventInput, CalendarEventOccurrenceFieldsFragment, CalendarEventScope, WorkSchedulesQuery } from '../../graphql/graphql';
import { execute } from '../../lib/graphql-client';
import { tasksQueryKey } from '../tasks/api';

export type EventOccurrence = CalendarEventOccurrenceFieldsFragment;
export type WorkSchedule = WorkSchedulesQuery['workSchedules'][number];
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
      slots {
        weekday
        start
        end
      }
      pauses {
        from
        to
        label
      }
    }
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
 * Event occurrences of a period, fetched once (reminders).
 * @param {{ from: string, to: string }} range Dates, included.
 * @returns {Promise<EventOccurrence[]>} Occurrences.
 */
export async function fetchCalendarEvents(range: { from: string; to: string }): Promise<EventOccurrence[]> {
  return (await execute(CalendarEventsDocument, range)).calendarEvents;
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
  return useQuery({ queryKey: [...calendarQueryKey, 'work-schedules'], queryFn: async () => (await execute(WorkSchedulesDocument)).workSchedules });
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
  };
}

/**
 * Schedules as the shared functions read them.
 * @param {WorkSchedule[]} schedules Schedules.
 * @returns {import('@ordo/shared').WorkScheduleRule[]} Rules.
 */
export function scheduleRules(schedules: readonly WorkSchedule[]) {
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
