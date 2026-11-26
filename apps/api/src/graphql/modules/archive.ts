import * as archive from '../../services/core/archive';
import { builder } from '../builder';
import { done } from '../errors';
import { ARCHIVED_DESCRIPTION } from '../label-inputs';
import { CONFIRM_LOSS_DESCRIPTION } from '../occurrence-fields';
import { archiveEdit } from '../../services/calendar/slot-conditions';
import { settleScheduleChange } from '../../services/routines/routines';
import { assertPeopleArchivable, LINKED_PEOPLE_KINDS, linkedPeople } from '../../services/people/contributor-links';
import { automated } from '../../services/tasks/task-automation-engine';
import { assertEventsArchivable } from '../../services/calendar/calendar-events';
import { archivedCalendarsUnsubscribed } from '../../services/calendar/calendars';

/** Kinds whose archive changes what tasks go by (the dates of a milestone, the sprints of today): through the rules of the tasks. */
const TASK_FOLLOWED_KINDS = new Set<archive.ArchivableKind>(['MILESTONE', 'SPRINT']);

/** Archive of elements applying the rules of the tasks. */
const automatedSetArchived = automated(archive.setArchived);

const ArchivableKindEnum = builder.enumType('ArchivableKind', {
  description: 'Kind of element archived or restored by `setArchived`: main elements of the features and every settings list (clients, projects, tasks and routines have their own mutations).',
  values: Object.keys(archive.ARCHIVABLE) as archive.ArchivableKind[],
});

/** GraphQL types of the elements archived by their date (the settings lists of `labelObject` and places apart: they expose it themselves). */
const TYPES = [
  'Client',
  'Project',
  'Task',
  'Routine',
  'Milestone',
  'Sprint',
  'Dashboard',
  'WorkSchedule',
  'AccountingDocument',
  'RecurringInvoice',
  'ImportedDocument',
  'TreasuryEntry',
  'TreasuryBudget',
  'TreasuryRelation',
  'ShoppingList',
  'ShoppingProduct',
  'StockItem',
  'Sheet',
  'Contributor',
  'ClientContact',
  'MailAccount',
  'CatalogItem',
  'TreasuryAccount',
  'TreasuryCounterparty',
  'TaskStatus',
  'DocumentStatus',
  'ShoppingBaseList',
  'ShoppingCategory',
  'CalendarCategory',
  'ScheduleType',
  'TreasuryPaymentMethod',
  'TreasuryCategory',
  'RoutineCategory',
  'StockLocation',
] as const;

for (const type of TYPES) {
  builder.prismaObjectField(type as 'Sheet', 'archived', (t) => t.boolean({ description: ARCHIVED_DESCRIPTION, select: { archivedAt: true }, resolve: (item) => item.archivedAt !== null }));
}

builder.mutationFields((t) => ({
  setArchived: t.boolean({
    description: 'Archives (hidden by default, read only) or restores elements of a kind, all at once; people with those they are linked to (a contributor with its relation or its contact); « Moi » is never archived, a contact of an archived client is not restored; an archived calendar loses the subscriptions of the other workspaces to it, for good.',
    args: {
      kind: t.arg({ type: ArchivableKindEnum, required: true }),
      ids: t.arg.idList({ required: true }),
      archived: t.arg.boolean({ required: true }),
      // Schedules, kinds of schedules and people archived give no moment to the slot conditions.
      confirmLoss: t.arg.boolean({ description: `${CONFIRM_LOSS_DESCRIPTION} Schedules, kinds of schedules, contributors, relations and contacts (with the people linked to them).` }),
    },
    resolve: (_root, { kind, ids, archived, confirmLoss }) =>
      done(
        (TASK_FOLLOWED_KINDS.has(kind) ? automatedSetArchived : archive.setArchived)(kind, ids, archived, {
          // People go with those they are linked to: a contributor with its relation or its contact.
          along: LINKED_PEOPLE_KINDS.has(kind) ? (found) => linkedPeople(kind, found) : undefined,
          settle: async (changing) => {
            await assertPeopleArchivable(changing, archived);
            // The events of an archived calendar are read only.
            await assertEventsArchivable(changing.CALENDAR_EVENT ?? []);
            const edit = archiveEdit(changing, archived);
            // The comments of the occurrences lost go once the change is saved.
            return edit ? settleScheduleChange(edit, confirmLoss ?? false) : undefined;
          },
          // An archived calendar is never shown elsewhere: the subscriptions of the other workspaces go, for good.
          writes: (changing) => archivedCalendarsUnsubscribed(changing.CALENDAR ?? [], archived),
        }),
      ),
  }),
}));
