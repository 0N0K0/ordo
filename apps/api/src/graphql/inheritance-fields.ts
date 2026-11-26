import { INHERIT_SOURCES, INHERIT_STATES, ROUTINE_INHERITABLE_FIELDS, TASK_INHERITABLE_FIELDS, type FieldOrigin } from '@ordo/shared';
import { builder } from './builder';

/** State of an inherited field. */
export const InheritStateEnum = builder.enumType('InheritState', {
  description: 'State of an inherited field of a sub-task or sub-routine: INHERITED (its parent’s, live), OWN (its own value; a top-level item’s fields always are), CLEARED (emptied on purpose, « aucun », even when its parent has one).',
  values: INHERIT_STATES,
});

/** Where the effective value of a field comes from. */
export const InheritSourceEnum = builder.enumType('InheritSource', {
  description: 'Where the value a field goes by comes from: OWN, PARENT (« (parent) »), and for the dates of a task MILESTONE (« (jalon) »), PROJECT (« (projet) »), SPRINT (« (sprint) »).',
  values: INHERIT_SOURCES,
});

/** Inherited fields of a task. */
export const TaskInheritableFieldEnum = builder.enumType('TaskInheritableField', {
  description: 'Field a sub-task inherits from its parent.',
  values: TASK_INHERITABLE_FIELDS,
});

/** Inherited fields of a routine. */
export const RoutineInheritableFieldEnum = builder.enumType('RoutineInheritableField', {
  description: 'Field a sub-routine inherits from its parent; START_DATE, RECURRENCE, CASES, MOVES and OPENS_ON make its « quand » (its moments are its own).',
  values: ROUTINE_INHERITABLE_FIELDS,
});

/** State and source of one inherited field of a task or a routine. */
export const FieldOriginRef = builder.objectRef<FieldOrigin>('FieldOrigin').implement({
  description: 'State and source of one inherited field: what the screens show greyed with « hérité de … », « (jalon) »…',
  fields: (t) => ({
    field: t.exposeString('field', { description: 'Field: a value of TaskInheritableField or RoutineInheritableField.' }),
    state: t.field({ type: InheritStateEnum, resolve: (origin) => origin.state }),
    source: t.field({ type: InheritSourceEnum, nullable: true, description: 'Where its value comes from; null: no value.', resolve: (origin) => origin.source }),
    sourceId: t.exposeID('sourceId', { nullable: true, description: 'Parent task or routine (PARENT), milestone, project or sprint it comes from; null: its own.' }),
  }),
});
