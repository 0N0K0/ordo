import { iconUrl } from '../../services/core/icons';
import * as lists from '../../services/core/settings-lists';
import { builder } from '../builder';

const SettingsListKindEnum = builder.enumType('SettingsListKind', {
  description: 'Settings list sharing the same look (color, image, name) and manual order.',
  values: Object.keys(lists.SETTINGS_LISTS) as lists.SettingsListKind[],
});

/** GraphQL types of the items of the settings lists (places apart: not a Prisma object). */
const TYPES = [
  'ProjectStatus',
  'ProjectCategory',
  'TaskStatus',
  'TaskPriority',
  'TaskType',
  'TaskTag',
  'DocumentStatus',
  'SheetCategory',
  'ShoppingStore',
  'ShoppingUnit',
  'ShoppingStorage',
  'ShoppingBaseList',
  'ShoppingCategory',
  'MailLabel',
  'Calendar',
  'CalendarCategory',
  'ScheduleType',
  'TreasuryAccount',
  'TreasuryContext',
  'TreasuryPaymentMethod',
  'TreasuryCounterparty',
  'TreasuryCategory',
  'RoutineCategory',
  'StockLocation',
] as const;

for (const type of TYPES) {
  builder.prismaObjectField(type as 'TaskTag', 'iconUrl', (t) =>
    t.string({ nullable: true, description: 'Image shown as its avatar (none: its initials on its color).', select: { iconId: true }, resolve: (item) => iconUrl(item.iconId) }),
  );
}

// Colors and orders the lists did not have.
for (const type of ['TreasuryAccount', 'TreasuryPaymentMethod', 'TreasuryCounterparty', 'ShoppingBaseList'] as const) {
  builder.prismaObjectField(type as 'TreasuryAccount', 'color', (t) => t.exposeString('color', { nullable: true }));
}
for (const type of ['ProjectCategory', 'TreasuryPaymentMethod', 'TreasuryCounterparty'] as const) {
  builder.prismaObjectField(type as 'ProjectCategory', 'position', (t) => t.exposeInt('position'));
}

const SettingsItemLookInput = builder.inputType('SettingsItemLookInput', {
  fields: (t) => ({
    color: t.string({ description: 'New color; null: none (where the list allows it).' }),
    icon: t.field({ type: 'File', description: 'Replaces the current image.' }),
    removeIcon: t.boolean(),
  }),
});

builder.mutationFields((t) => ({
  setSettingsItemLook: t.string({
    description: 'Changes the color and / or the image of an item of a settings list; gives the URL of its image.',
    nullable: true,
    args: { kind: t.arg({ type: SettingsListKindEnum, required: true }), id: t.arg.id({ required: true }), input: t.arg({ type: SettingsItemLookInput, required: true }) },
    resolve: async (_root, { kind, id, input }) => iconUrl(await lists.setLook(kind, id, input)),
  }),
  reorderSettingsItems: t.boolean({
    description: 'Puts the items of a flat settings list in the order given.',
    args: { kind: t.arg({ type: SettingsListKindEnum, required: true }), ids: t.arg.idList({ required: true }) },
    resolve: async (_root, { kind, ids }) => {
      await lists.reorder(
        kind,
        ids.map((id) => id),
      );
      return true;
    },
  }),
}));
