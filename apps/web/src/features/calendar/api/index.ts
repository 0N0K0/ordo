import { calendarQueryKey, SLOT_DEPENDENT_KEYS, birthdaysQueryKey, tasksQueryKey } from '../../../lib/query-keys';
import { useQuery, type QueryKey } from '@tanstack/react-query';
import { useInvalidatingMutation } from '../../../lib/mutation';
import { graphql } from '../../../graphql';
import { countedSchedules, reminderDayRange, readScheduleCases, readScheduleExceptions, slotSchedules, type Recurrence, type ScheduleDisplay, type ScheduleSubscriptionLook, type WorkScheduleInput, type WorkScheduleRule } from '@ordo/shared';
import type {
  BirthdaysQuery,
  CalendarEventInput,
  CalendarEventOccurrenceFieldsFragment,
  CalendarEventExceptionChange,
  CalendarEventExceptionsChange,
  CalendarEventExceptionsQuery,
  CalendarEventScope,
  CalendarEventsQuery,
  CalendarsQuery,
  SubscribableCalendarsQuery,
  WorkSchedulesQuery,
} from '../../../graphql/graphql';
import { execute, executeIn } from '../../../lib/graphql-client';
import { withLossConfirmation } from '../../time/lib/confirm-loss';
import { withMovedRuleChoice } from '../../../components/recurrence/ask-moved-rule';
import { treasuryKey } from '../../treasury/api';
import { archivedIds, unarchived, useSetArchived } from '../../../lib/archive';

export type EventOccurrence = CalendarEventOccurrenceFieldsFragment;
export type WorkSchedule = WorkSchedulesQuery['workSchedules'][number];
export type ScheduleType = WorkSchedulesQuery['scheduleTypes'][number];
/** Fields of a kind saved: label, color, display; nature (at its creation) and budget fields. */
export type ScheduleTypeFields = { label: string; color: string } & ScheduleDisplay & { ephemeris?: boolean; unavailable?: boolean; budgetContext?: boolean; sharedContext?: boolean };
export type { CalendarEventInput, CalendarEventScope };

graphql(`
  fragment CalendarEventOccurrenceFields on CalendarEventOccurrence {
    key
    eventId
    occurrenceDate
    modified
    label
    description
    location
    locationLat
    locationLon
    links {
      url
      label
    }
    allDay
    startDate
    startTime
    endDate
    endTime
    start
    end
    recurrence
    seriesStartDate
    reminders {
      ...ReminderFields
    }
    travelBefore
    travelAfter
    projectId
    calendarId
    archived
    contributorIds
    relationIds
    beneficiaryIds
    beneficiaryRelationIds
    categoryIds
    taskIds
    libraryDocumentIds
    projectResourceIds
    savedCountdownIds
    routineLinks {
      routineId
      date
      shownDate
    }
    calledOff
    postponedFrom {
      eventId
      date
      label
    }
    postponedTo {
      eventId
      label
      startDate
      startTime
    }
    trackedSeconds
    lastShownDate
    series {
      label
      description
      location
      locationLat
      locationLon
      links {
        url
        label
      }
      allDay
      startDate
      startTime
      endDate
      endTime
      travelBefore
      travelAfter
    }
  }
`);

const EventExceptionsDocument = graphql(`
  query CalendarEventExceptions($id: ID!) {
    calendarEventExceptions(id: $id) {
      date
      cancelled
      calledOff
      postponedTo
      allDay
      startDate
      startTime
      endDate
      endTime
      otherHours
      label
      changed
    }
  }
`);

const WorkSchedulesDocument = graphql(`
  query WorkSchedules {
    workSchedules {
      id
      archived
      label
      startDate
      endDate
      typeId
      ephemeris
      unavailable
      cases
      exceptions
      reminders {
        ...ReminderFields
      }
    }
    scheduleTypes {
      id
      archived
      label
      color
      iconUrl
      dayDisplay
      dayBar
      monthDisplay
      ephemeris
      unavailable
      budgetContext
      sharedContext
      position
      subscriberCount
    }
    defaultScheduleKind {
      label
      color
      dayDisplay
      dayBar
      monthDisplay
    }
    birthdayLook {
      shown
      color
    }
  }
`);

const ForeignScheduleKindsDocument = graphql(`
  query ForeignScheduleKinds {
    foreignScheduleKinds {
      workspaceId
      workspaceLabel
      typeId
      label
      color
      sourceColor
      dayDisplay
      dayBar
      monthDisplay
      customized
      scheduleCount
      subscribed
      archived
      ephemeris
      unavailable
    }
  }
`);

const SubscribedSchedulesDocument = graphql(`
  query SubscribedWorkSchedules {
    subscribedWorkSchedules {
      id
      archived
      kindArchived
      label
      startDate
      endDate
      cases
      exceptions
      typeLabel
      typeId
      ephemeris
      color
      dayDisplay
      dayBar
      monthDisplay
      unavailable
      workspaceId
      workspaceLabel
    }
  }
`);

const OtherWorkspaceSchedulesDocument = graphql(`
  query OtherWorkspaceSchedules {
    otherWorkspaceSchedules {
      id
      archived
      label
      startDate
      endDate
      cases
      exceptions
      typeId
      ephemeris
      unavailable
      workspaceId
      workspaceLabel
    }
  }
`);

const CreateScheduleTypeDocument = graphql(`
  mutation CreateScheduleType($input: ScheduleTypeInput!) {
    createScheduleType(input: $input) {
      id
    }
  }
`);

const UpdateScheduleTypeDocument = graphql(`
  mutation UpdateScheduleType($id: ID!, $input: ScheduleTypeInput!, $confirmLoss: Boolean) {
    updateScheduleType(id: $id, input: $input, confirmLoss: $confirmLoss) {
      id
    }
  }
`);

const DeleteScheduleTypeDocument = graphql(`
  mutation DeleteScheduleType($id: ID!, $confirmLoss: Boolean) {
    deleteScheduleType(id: $id, confirmLoss: $confirmLoss)
  }
`);

const SubscribeScheduleKindDocument = graphql(`
  mutation SubscribeScheduleKind($workspaceId: ID!, $typeId: ID) {
    subscribeScheduleKind(workspaceId: $workspaceId, typeId: $typeId)
  }
`);

const SaveDefaultScheduleKindDocument = graphql(`
  mutation SaveDefaultScheduleKind($input: DefaultScheduleKindInput!) {
    saveDefaultScheduleKind(input: $input) {
      label
    }
  }
`);

const SaveBirthdayLookDocument = graphql(`
  mutation SaveBirthdayLook($input: BirthdayLookInput!) {
    saveBirthdayLook(input: $input) {
      shown
    }
  }
`);

const SetScheduleSubscriptionLookDocument = graphql(`
  mutation SetScheduleSubscriptionLook($workspaceId: ID!, $typeId: ID, $input: ScheduleSubscriptionLookInput!) {
    setScheduleSubscriptionLook(workspaceId: $workspaceId, typeId: $typeId, input: $input)
  }
`);

const SetScheduleSubscriptionUnavailableDocument = graphql(`
  mutation SetScheduleSubscriptionUnavailable($workspaceId: ID!, $typeId: ID, $unavailable: Boolean!, $confirmLoss: Boolean) {
    setScheduleSubscriptionUnavailable(workspaceId: $workspaceId, typeId: $typeId, unavailable: $unavailable, confirmLoss: $confirmLoss)
  }
`);

const UnsubscribeScheduleKindDocument = graphql(`
  mutation UnsubscribeScheduleKind($workspaceId: ID!, $typeId: ID) {
    unsubscribeScheduleKind(workspaceId: $workspaceId, typeId: $typeId)
  }
`);

const CreateWorkScheduleDocument = graphql(`
  mutation CreateWorkSchedule($input: WorkScheduleInput!, $confirmLoss: Boolean) {
    createWorkSchedule(input: $input, confirmLoss: $confirmLoss)
  }
`);

const UpdateWorkScheduleDocument = graphql(`
  mutation UpdateWorkSchedule($id: ID!, $input: WorkScheduleInput!, $confirmLoss: Boolean) {
    updateWorkSchedule(id: $id, input: $input, confirmLoss: $confirmLoss)
  }
`);

const SetWorkScheduleEphemerisDocument = graphql(`
  mutation SetWorkScheduleEphemeris($id: ID!, $ephemeris: Boolean!, $confirmLoss: Boolean) {
    setWorkScheduleEphemeris(id: $id, ephemeris: $ephemeris, confirmLoss: $confirmLoss)
  }
`);

const SetScheduleTypeEphemerisDocument = graphql(`
  mutation SetScheduleTypeEphemeris($id: ID!, $ephemeris: Boolean!, $confirmLoss: Boolean) {
    setScheduleTypeEphemeris(id: $id, ephemeris: $ephemeris, confirmLoss: $confirmLoss)
  }
`);

const DeleteWorkScheduleDocument = graphql(`
  mutation DeleteWorkSchedule($id: ID!, $confirmLoss: Boolean) {
    deleteWorkSchedule(id: $id, confirmLoss: $confirmLoss)
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
      archived
      label
      color
      iconUrl
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
    calendars {
      id
      archived
    }
  }
`);

const CalendarsDocument = graphql(`
  query Calendars {
    calendars {
      id
      archived
      label
      color
      iconUrl
      position
      subscriberCount
    }
    calendarSubscriptions {
      id
      calendarId
      label
      color
      workspace {
        id
        label
        kind
      }
    }
  }
`);

const SubscribableCalendarsDocument = graphql(`
  query SubscribableCalendars {
    subscribableCalendars {
      id
      label
      color
      subscribed
      workspace {
        id
        label
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
  mutation CreateCalendar($input: LabelColorInput!) {
    createCalendar(input: $input) {
      id
    }
  }
`);

const UpdateCalendarDocument = graphql(`
  mutation UpdateCalendar($id: ID!, $input: LabelColorInput!) {
    updateCalendar(id: $id, input: $input) {
      id
    }
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
  mutation MoveCalendarCategory($id: ID!, $index: Int!, $parentId: ID) {
    moveCalendarCategory(id: $id, index: $index, parentId: $parentId)
  }
`);

const CreateCalendarEventDocument = graphql(`
  mutation CreateCalendarEvent($input: CalendarEventInput!) {
    createCalendarEvent(input: $input)
  }
`);

const UpdateCalendarEventDocument = graphql(`
  mutation UpdateCalendarEvent($id: ID!, $input: CalendarEventInput!, $scope: CalendarEventScope!, $occurrenceDate: Date, $confirmLoss: Boolean, $movedRule: JSON, $exceptions: CalendarEventExceptionsChange) {
    updateCalendarEvent(id: $id, input: $input, scope: $scope, occurrenceDate: $occurrenceDate, confirmLoss: $confirmLoss, movedRule: $movedRule, exceptions: $exceptions)
  }
`);

const DeleteCalendarEventDocument = graphql(`
  mutation DeleteCalendarEvent($id: ID!, $scope: CalendarEventScope!, $occurrenceDate: Date) {
    deleteCalendarEvent(id: $id, scope: $scope, occurrenceDate: $occurrenceDate)
  }
`);

export { calendarQueryKey, SLOT_DEPENDENT_KEYS };

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
 * Occurrences of a period, those archived (their event, or their calendar: the container) left out unless asked.
 * @param {CalendarEventsQuery} data Occurrences and calendars.
 * @param {boolean} [includeArchived] Archived ones kept. Optional. Default = left out.
 * @returns {EventOccurrence[]} Occurrences.
 */
function occurrencesOf(data: CalendarEventsQuery, includeArchived = false): EventOccurrence[] {
  if (includeArchived) return data.calendarEvents;
  const archived = archivedIds(data.calendars);
  return unarchived(data.calendarEvents).filter((occurrence) => !archived.has(occurrence.calendarId));
}

/**
 * Event occurrences of a period: the archived ones (and those of archived calendars) left out unless asked.
 * @param {{ from: string, to: string } | null} range Dates, included.
 * @param {boolean} [includeArchived] Archived ones too (the agenda, on demand). Optional. Default = left out.
 * @returns {UseQueryResult} Query state.
 */
export function useCalendarEvents(range: { from: string; to: string } | null, includeArchived = false) {
  return useQuery({
    queryKey: [...calendarQueryKey, 'events', range, includeArchived],
    queryFn: async () => occurrencesOf(await execute(CalendarEventsDocument, range!), includeArchived),
    enabled: range !== null,
    placeholderData: (previous) => previous,
  });
}

/** An occurrence of a series deleted, cancelled or changed alone. */
export type EventException = CalendarEventExceptionsQuery['calendarEventExceptions'][number];

/** Exceptions of a series restored (days of their rule) and changed alone, saved with it. */
export type EventExceptionsChange = CalendarEventExceptionsChange;

/** An occurrence of a series changed alone from the list of its exceptions: its label, days and hours. */
export type EventExceptionChange = CalendarEventExceptionChange;

/**
 * Occurrences of a recurring event deleted, cancelled or changed alone, by day; reloaded with the calendar.
 * @param {string | null} id Event (none: nothing loaded).
 * @returns {UseQueryResult} Query state.
 */
export function useEventExceptions(id: string | null) {
  return useQuery({
    queryKey: [...calendarQueryKey, 'exceptions', id],
    queryFn: async () => (await execute(EventExceptionsDocument, { id: id! })).calendarEventExceptions,
    enabled: id !== null,
  });
}

/**
 * Event occurrences of a period (reminders included), of the workspace of this tab or of another one; the archived
 * ones (and those of archived calendars) left out.
 * @param {{ from: string, to: string }} range First and last days.
 * @param {string} [workspace] Another workspace (its notifications). Optional.
 * @returns {Promise<EventOccurrence[]>} Occurrences.
 */
export async function fetchCalendarEvents(range: { from: string; to: string }, workspace?: string): Promise<EventOccurrence[]> {
  return occurrencesOf(await (workspace ? executeIn(workspace, CalendarEventsDocument, range) : execute(CalendarEventsDocument, range)));
}

/**
 * Event occurrences whose reminders may ring soon: from yesterday to the most days a reminder rings before
 * (`reminderDayRange`, taken again at each load), loaded again every 5 minutes and on any change of the calendar.
 * @returns {UseQueryResult} Query state.
 */
export function useReminderOccurrences() {
  return useQuery({
    queryKey: [...calendarQueryKey, 'reminders'],
    queryFn: () => fetchCalendarEvents(reminderDayRange(new Date())),
    refetchInterval: 5 * 60_000,
  });
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
 * @param {readonly QueryKey[]} [also] Other queries refreshed too. Optional. Default = none.
 * @returns {UseMutationResult} Mutation state.
 */
function useCalendarMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>, also: readonly QueryKey[] = []) {
  return useInvalidatingMutation(mutationFn, { invalidate: [calendarQueryKey, ...also] });
}

/**
 * Calendars edition, and the subscriptions to the calendars of other workspaces.
 * @returns {object} Mutations.
 */
export function useCalendarMutations() {
  type Input = { label: string; color: string };
  return {
    create: useCalendarMutation(async (input: Input) => (await execute(CreateCalendarDocument, { input })).createCalendar),
    update: useCalendarMutation(async (variables: { id: string; input: Input }) => (await execute(UpdateCalendarDocument, variables)).updateCalendar),
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
  type Input = { label: string; color: string; parentId: string | null };
  return {
    create: useCalendarMutation(async (input: Input) => (await execute(CreateCalendarCategoryDocument, { input })).createCalendarCategory),
    update: useCalendarMutation(async (variables: { id: string; input: Input }) => (await execute(UpdateCalendarCategoryDocument, variables)).updateCalendarCategory),
    remove: useCalendarMutation(async (id: string) => (await execute(DeleteCalendarCategoryDocument, { id })).deleteCalendarCategory),
    move: useCalendarMutation(async (variables: { id: string; index: number; parentId: string | null }) => (await execute(MoveCalendarCategoryDocument, variables)).moveCalendarCategory),
  };
}

/**
 * Events edition.
 * @returns {object} Mutations.
 */
export function useCalendarEventMutations() {
  return {
    create: useCalendarMutation(async (input: CalendarEventInput) => (await execute(CreateCalendarEventDocument, { input })).createCalendarEvent),
    // A series on the last day of the month moved to another day: its new rule is asked first (`withMovedRuleChoice`);
    // gives the event saved and that rule (none: not asked).
    update: useCalendarMutation(
      // Exceptions restored and changed alone with it (`exceptions`): all or nothing, with the save.
      async (variables: { id: string; input: CalendarEventInput; scope: CalendarEventScope; occurrenceDate: string | null; exceptions?: EventExceptionsChange }) => {
        const asked: { rule: Recurrence | null } = { rule: null };
        const id = await withMovedRuleChoice((movedRule) => {
          asked.rule = movedRule;
          return withLossConfirmation(async (confirmLoss) => (await execute(UpdateCalendarEventDocument, { ...variables, confirmLoss, movedRule })).updateCalendarEvent);
        });
        return { id, movedRule: asked.rule };
      },
      // A change of project attaches the contributors to it: the contributors (task data) are refreshed too.
      [tasksQueryKey],
    ),
    remove: useCalendarMutation(
      async (variables: { id: string; scope: CalendarEventScope; occurrenceDate: string | null }) => (await execute(DeleteCalendarEventDocument, variables)).deleteCalendarEvent,
    ),
    setCalledOff: useCalendarMutation(
      async (variables: { id: string; scope: CalendarEventScope; occurrenceDate: string | null; calledOff: boolean }) => (await execute(SetCalledOffDocument, variables)).setCalendarEventCalledOff,
    ),
    postpone: useCalendarMutation(async (variables: { id: string; occurrenceDate: string | null; input: CalendarEventInput }) => (await execute(PostponeDocument, variables)).postponeCalendarEvent,
      [tasksQueryKey],
    ),
  };
}

const BirthdaysDocument = graphql(`
  query Birthdays {
    birthdays(archived: true) {
      id
      contributorId
      relationId
      name
      birthDate
      archived
      aliases
      reminders {
        ...ReminderFields
      }
    }
  }
`);

const BirthdayPersonNamesDocument = graphql(`
  query BirthdayPersonNames {
    birthdayPersonNames {
      id
      name
      archived
    }
  }
`);

/** Birthday of a person: derived from its birth date by the API. */
export type PersonBirthday = BirthdaysQuery['birthdays'][number];

export { birthdaysQueryKey };

/**
 * Birthdays of the people of the workspace (contributors and relations with a birth date), those of archived
 * people too, flagged (one query for both hooks).
 * @returns {Promise<PersonBirthday[]>} Birthdays.
 */
const fetchBirthdays = async () => (await execute(BirthdaysDocument)).birthdays;

/**
 * Birthdays of the people of the workspace (contributors and relations with a birth date, not archived): those
 * the calendar shows and the alarms ring.
 * @returns {UseQueryResult} Query state.
 */
export function useBirthdays() {
  return useQuery({ queryKey: birthdaysQueryKey, queryFn: fetchBirthdays, select: (birthdays) => unarchived(birthdays) });
}

/**
 * Birthdays a slot condition may name: those of archived people too, flagged (still named, « archivé »,
 * no moment), with the other ids naming each (`aliases`: a relation linked to a contributor).
 * @returns {UseQueryResult} Query state.
 */
export function useSlotBirthdays() {
  return useQuery({ queryKey: birthdaysQueryKey, queryFn: fetchBirthdays });
}

/**
 * Every contributor and relation of the workspace, archived ones too, by birthday id: names of the people a slot
 * condition cites, even those without a birthday.
 * @returns {UseQueryResult} Query state.
 */
export function useBirthdayPersonNames() {
  return useQuery({ queryKey: [...birthdaysQueryKey, 'names'], queryFn: async () => (await execute(BirthdayPersonNamesDocument)).birthdayPersonNames });
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
 * Schedules without kind of this workspace: their name, color and display.
 * @returns {UseQueryResult} Query state.
 */
export function useDefaultScheduleKind() {
  return useQuery({ queryKey: [...calendarQueryKey, 'work-schedules'], queryFn: () => execute(WorkSchedulesDocument), select: (data) => data.defaultScheduleKind });
}

/**
 * Birthdays of the people of this workspace in its calendar, all-day events: shown or not, and color (none: the gray
 * of the éphémérides).
 * @returns {UseQueryResult} Query state.
 */
export function useBirthdayLook() {
  return useQuery({ queryKey: [...calendarQueryKey, 'work-schedules'], queryFn: () => execute(WorkSchedulesDocument), select: (data) => data.birthdayLook });
}

/**
 * Kinds of schedules of the other workspaces, with whether this one shows them.
 * @returns {UseQueryResult} Query state.
 */
export function useForeignScheduleKinds() {
  return useQuery({ queryKey: [...calendarQueryKey, 'foreign-schedule-kinds'], queryFn: async () => (await execute(ForeignScheduleKindsDocument)).foreignScheduleKinds });
}

/**
 * Schedules of the kinds of other workspaces this one shows (read only).
 * @returns {UseQueryResult} Query state.
 */
export function useSubscribedSchedules() {
  return useQuery({ queryKey: [...calendarQueryKey, 'subscribed-schedules'], queryFn: async () => (await execute(SubscribedSchedulesDocument)).subscribedWorkSchedules });
}

/**
 * Every schedule of the other workspaces of the user (archived ones too), shown here or not: what a slot condition can
 * name of them.
 * @returns {UseQueryResult} Query state.
 */
export function useOtherWorkspaceSchedules() {
  return useQuery({ queryKey: [...calendarQueryKey, 'other-workspace-schedules'], queryFn: async () => (await execute(OtherWorkspaceSchedulesDocument)).otherWorkspaceSchedules });
}

/**
 * What the slots of the agenda are drawn from: the schedules of the workspace, those shown from the other workspaces,
 * the kinds of slots and the kind of the schedules without any (undefined while loading).
 * @returns {{ schedules: object[] | undefined, foreign: object[] | undefined, types: object[] | undefined, defaultKind: object | undefined }} Sources.
 */
export function useScheduleSources() {
  const { data: schedules } = useWorkSchedules();
  const { data: foreign } = useSubscribedSchedules();
  const { data: types } = useScheduleTypes();
  const { data: defaultKind } = useDefaultScheduleKind();
  return { schedules, foreign, types, defaultKind };
}

/**
 * Working hours edition.
 * @returns {object} Mutations.
 */
export function useWorkScheduleMutations() {
  return {
    // The occurrences of routines a change makes disappear (no moment left) are confirmed first, with what they lose.
    create: useCalendarMutation(
      async (input: WorkScheduleInput) => withLossConfirmation(async (confirmLoss) => (await execute(CreateWorkScheduleDocument, { input, confirmLoss } as never)).createWorkSchedule),
      SLOT_DEPENDENT_KEYS,
    ),
    update: useCalendarMutation(
      async (variables: { id: string; input: WorkScheduleInput }) =>
        withLossConfirmation(async (confirmLoss) => (await execute(UpdateWorkScheduleDocument, { ...variables, confirmLoss } as never)).updateWorkSchedule),
      SLOT_DEPENDENT_KEYS,
    ),
    remove: useCalendarMutation(async (id: string) => withLossConfirmation(async (confirmLoss) => (await execute(DeleteWorkScheduleDocument, { id, confirmLoss })).deleteWorkSchedule), SLOT_DEPENDENT_KEYS),
    // A kind of éphémérides may be a context of the treasury: its contexts follow it.
    createType: useCalendarMutation(async (input: ScheduleTypeFields) => (await execute(CreateScheduleTypeDocument, { input })).createScheduleType, [treasuryKey]),
    // Its « Indisponible » changed: the occurrences of routines lost are confirmed first.
    updateType: useCalendarMutation(
      async (variables: { id: string; input: ScheduleTypeFields }) =>
        withLossConfirmation(async (confirmLoss) => (await execute(UpdateScheduleTypeDocument, { ...variables, confirmLoss })).updateScheduleType),
      [...SLOT_DEPENDENT_KEYS, treasuryKey],
    ),
    removeType: useCalendarMutation(
      async (id: string) => withLossConfirmation(async (confirmLoss) => (await execute(DeleteScheduleTypeDocument, { id, confirmLoss })).deleteScheduleType),
      [...SLOT_DEPENDENT_KEYS, treasuryKey],
    ),
    // « Convertir en éphéméride(s) » / « Convertir en créneau(x) »: ids kept; occurrences of routines lost confirmed first.
    setEphemeris: useCalendarMutation(
      async (variables: { id: string; ephemeris: boolean }) =>
        withLossConfirmation(async (confirmLoss) => (await execute(SetWorkScheduleEphemerisDocument, { ...variables, confirmLoss })).setWorkScheduleEphemeris),
      [...SLOT_DEPENDENT_KEYS, treasuryKey],
    ),
    setTypeEphemeris: useCalendarMutation(
      async (variables: { id: string; ephemeris: boolean }) =>
        withLossConfirmation(async (confirmLoss) => (await execute(SetScheduleTypeEphemerisDocument, { ...variables, confirmLoss })).setScheduleTypeEphemeris),
      [...SLOT_DEPENDENT_KEYS, treasuryKey],
    ),
    subscribe: useCalendarMutation(async (kind: { workspaceId: string; typeId: string | null }) => (await execute(SubscribeScheduleKindDocument, kind)).subscribeScheduleKind),
    saveDefaultKind: useCalendarMutation(
      async (input: { label: string; color: string | null } & ScheduleDisplay) => (await execute(SaveDefaultScheduleKindDocument, { input })).saveDefaultScheduleKind,
    ),
    saveBirthdayLook: useCalendarMutation(async (input: { shown: boolean; color: string | null }) => (await execute(SaveBirthdayLookDocument, { input })).saveBirthdayLook),
    setLook: useCalendarMutation(
      async (variables: { workspaceId: string; typeId: string | null; input: ScheduleSubscriptionLook }) => (await execute(SetScheduleSubscriptionLookDocument, variables)).setScheduleSubscriptionLook,
    ),
    // « Indisponible » in this workspace, on its subscription: occurrences of routines lost confirmed first.
    setSubscriptionUnavailable: useCalendarMutation(
      async (variables: { workspaceId: string; typeId: string | null; unavailable: boolean }) =>
        withLossConfirmation(async (confirmLoss) => (await execute(SetScheduleSubscriptionUnavailableDocument, { ...variables, confirmLoss })).setScheduleSubscriptionUnavailable),
      SLOT_DEPENDENT_KEYS,
    ),
    unsubscribe: useCalendarMutation(async (kind: { workspaceId: string; typeId: string | null }) => (await execute(UnsubscribeScheduleKindDocument, kind)).unsubscribeScheduleKind),
  };
}

/**
 * Archives or restores schedules or people — contributors, relations, contacts, each with the people linked to it —
 * (`useSetArchived`), the sources of the slot conditions: the occurrences of routines it makes disappear are
 * confirmed first, once for the whole (`withLossConfirmation`, as a change of schedule), then what depends on them is
 * refreshed (`SLOT_DEPENDENT_KEYS`, the birthdays with the people).
 * @param {'WORK_SCHEDULE' | 'CONTRIBUTOR' | 'TREASURY_RELATION' | 'CLIENT_CONTACT'} kind Kind of the elements (a kind of schedules: `useScheduleTypeItems`).
 * @param {readonly QueryKey[]} [invalidate] Queries refreshed besides. Optional. Default = every query.
 * @returns {UseMutationResult} Mutation state.
 */
export function useSlotSourceArchiving(kind: 'WORK_SCHEDULE' | 'CONTRIBUTOR' | 'TREASURY_RELATION' | 'CLIENT_CONTACT', invalidate: readonly QueryKey[] = [[]]) {
  return useSetArchived(kind, [...invalidate, ...SLOT_DEPENDENT_KEYS, kind === 'WORK_SCHEDULE' ? calendarQueryKey : birthdaysQueryKey], withLossConfirmation);
}

/**
 * Schedules as the shared functions read them (those of this workspace, or of another one subscribed to): their
 * cases and exceptions validated (invalid ones left out), archived or of an archived kind (the slot conditions do not
 * count them), « Indisponible » in this workspace. A schedule of another workspace says itself whether its kind is
 * archived there (`kindArchived`).
 * @param {object[]} schedules Schedules.
 * @param {ReadonlySet<string>} [archivedKinds] Kinds archived (ids). Optional. Default = none.
 * @returns {import('@ordo/shared').WorkScheduleRule[]} Rules.
 */
export function scheduleRules(
  schedules: readonly {
    id: string;
    label: string;
    startDate: string;
    endDate?: string | null;
    cases: unknown;
    exceptions: unknown;
    typeId?: string | null;
    ephemeris?: boolean | null;
    unavailable?: boolean | null;
    archived?: boolean | null;
    kindArchived?: boolean | null;
  }[],
  archivedKinds: ReadonlySet<string> = new Set(),
): WorkScheduleRule[] {
  return schedules.map((schedule) => ({
    id: schedule.id,
    label: schedule.label,
    startDate: schedule.startDate,
    endDate: schedule.endDate || null,
    cases: readScheduleCases(schedule.cases, schedule.startDate),
    exceptions: readScheduleExceptions(schedule.exceptions),
    typeId: schedule.typeId ?? null,
    ephemeris: schedule.ephemeris ?? false,
    unavailable: Boolean(schedule.unavailable),
    archived: Boolean(schedule.archived),
    kindArchived: Boolean(schedule.kindArchived) || Boolean(schedule.typeId && archivedKinds.has(schedule.typeId)),
  }));
}

/**
 * Working hours of the workspace, as the hint of an event out of them (`AvailabilityHint`) and the planned time
 * (`PlannedTime`) count them: its créneaux (the éphémérides left out), neither archived nor of an archived kind
 * (`countedSchedules`, as the slot conditions).
 * @returns {UseQueryResult<WorkScheduleRule[]>} Query state: the rules of the créneaux counted.
 */
export function useWorkingHours() {
  return useQuery({
    queryKey: [...calendarQueryKey, 'work-schedules'],
    queryFn: () => execute(WorkSchedulesDocument),
    // eslint-disable-next-line no-restricted-syntax -- the working hours themselves.
    select: (data) => countedSchedules(scheduleRules(slotSchedules(data.workSchedules), archivedIds(data.scheduleTypes))),
  });
}

/**
 * Input of a schedule from its rule and a change of its cases and exceptions (an hour moved in the calendar), and of
 * its period when it moves with it: its kind, nature and « Indisponible » kept.
 * @param {WorkScheduleRule} rule Schedule.
 * @param {Pick<WorkScheduleInput, 'cases' | 'exceptions'> & Partial<Pick<WorkScheduleInput, 'startDate' | 'endDate'>>} change New cases and exceptions, and period. Period optional. Default = that of the rule.
 * @returns {WorkScheduleInput} Input.
 */
export const ruleScheduleInput = (rule: WorkScheduleRule, change: Pick<WorkScheduleInput, 'cases' | 'exceptions'> & Partial<Pick<WorkScheduleInput, 'startDate' | 'endDate'>>): WorkScheduleInput => ({
  label: rule.label,
  startDate: rule.startDate,
  endDate: rule.endDate,
  typeId: rule.typeId ?? null,
  ephemeris: rule.ephemeris ?? false,
  unavailable: rule.unavailable ?? false,
  ...change,
});

/**
 * Address of the iCalendar file of a calendar of the workspace, or of all of them (downloaded with the session).
 * @param {string | null} calendarId Calendar, or null for every calendar.
 * @returns {string} URL.
 */
export function calendarIcsUrl(calendarId: string | null): string {
  return `/api/exports/calendar.ics${calendarId ? `?calendar=${encodeURIComponent(calendarId)}` : ''}`;
}
