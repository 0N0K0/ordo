import * as archive from '../../services/core/archive';
import { builder } from '../builder';
import { done } from '../errors';

const ArchivableKindEnum = builder.enumType('ArchivableKind', {
  description: 'Kind of element archived or restored by `setArchived`: main elements of the features and every settings list (clients, projects, tasks and routines have their own mutations).',
  values: Object.keys(archive.ARCHIVABLE) as archive.ArchivableKind[],
});

/** GraphQL types of the elements archived by their date (the settings lists of `labelObject` and places apart: they expose it themselves). */
const TYPES = [
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
  'MailAccount',
  'ProjectCategory',
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
  builder.prismaObjectField(type as 'Sheet', 'archived', (t) =>
    t.boolean({ description: 'Archived: hidden by default, read only.', select: { archivedAt: true }, resolve: (item) => item.archivedAt !== null }),
  );
}

builder.mutationFields((t) => ({
  setArchived: t.boolean({
    description: 'Archives (hidden by default, read only) or restores elements of a kind, all at once.',
    args: { kind: t.arg({ type: ArchivableKindEnum, required: true }), ids: t.arg.idList({ required: true }), archived: t.arg.boolean({ required: true }) },
    resolve: (_root, { kind, ids, archived }) => done(archive.setArchived(kind, ids, archived)),
  }),
}));
